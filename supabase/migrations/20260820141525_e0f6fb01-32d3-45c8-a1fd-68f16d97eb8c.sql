
CREATE TYPE public.app_role AS ENUM ('admin', 'manager');
CREATE TYPE public.crop_type AS ENUM ('mango', 'aguacate');
CREATE TYPE public.task_status AS ENUM ('pendiente', 'en_curso', 'completada');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  crop public.crop_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.farms TO authenticated;
GRANT ALL ON public.farms TO service_role;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.farm_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  UNIQUE (user_id, farm_id)
);
GRANT SELECT ON public.farm_managers TO authenticated;
GRANT ALL ON public.farm_managers TO service_role;
ALTER TABLE public.farm_managers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_farm_access(_user_id uuid, _farm_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (SELECT 1 FROM public.farm_managers WHERE user_id = _user_id AND farm_id = _farm_id)
$$;

CREATE TABLE public.workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workers TO authenticated;
GRANT ALL ON public.workers TO service_role;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.work_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.workers(id) ON DELETE SET NULL,
  worker_name text NOT NULL,
  work_date date NOT NULL DEFAULT current_date,
  hours numeric(5,2) NOT NULL,
  task_type text NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_hours TO authenticated;
GRANT ALL ON public.work_hours TO service_role;
ALTER TABLE public.work_hours ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.supply_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.supply_categories TO authenticated;
GRANT ALL ON public.supply_categories TO service_role;
ALTER TABLE public.supply_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  purchase_date date NOT NULL DEFAULT current_date,
  item text NOT NULL,
  category_id uuid REFERENCES public.supply_categories(id) ON DELETE SET NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'ud',
  cost numeric(12,2) NOT NULL DEFAULT 0,
  supplier text,
  attachment_path text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'pendiente',
  due_date date,
  assignee text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "own roles select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "farms select" ON public.farms FOR SELECT TO authenticated USING (public.has_farm_access(auth.uid(), id));
CREATE POLICY "farm managers select" ON public.farm_managers FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "workers access" ON public.workers FOR ALL TO authenticated
  USING (public.has_farm_access(auth.uid(), farm_id)) WITH CHECK (public.has_farm_access(auth.uid(), farm_id));
CREATE POLICY "work_hours access" ON public.work_hours FOR ALL TO authenticated
  USING (public.has_farm_access(auth.uid(), farm_id)) WITH CHECK (public.has_farm_access(auth.uid(), farm_id));
CREATE POLICY "purchases access" ON public.purchases FOR ALL TO authenticated
  USING (public.has_farm_access(auth.uid(), farm_id)) WITH CHECK (public.has_farm_access(auth.uid(), farm_id));
CREATE POLICY "tasks access" ON public.tasks FOR ALL TO authenticated
  USING (public.has_farm_access(auth.uid(), farm_id)) WITH CHECK (public.has_farm_access(auth.uid(), farm_id));

CREATE POLICY "categories select" ON public.supply_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories insert" ON public.supply_categories FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.farms (name, crop) VALUES
  ('Pai Mango', 'mango'),
  ('Avoclan Casa', 'mango'),
  ('Avoclan Fortaleza', 'mango'),
  ('Loma Mesías', 'aguacate'),
  ('Río Seco', 'aguacate'),
  ('Frunet', 'aguacate');

INSERT INTO public.supply_categories (name) VALUES
  ('Fertilizantes'), ('Fitosanitarios'), ('Herramientas'), ('Combustible'), ('Otros');

CREATE POLICY "facturas read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'facturas');
CREATE POLICY "facturas insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'facturas');
CREATE POLICY "facturas delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'facturas');
