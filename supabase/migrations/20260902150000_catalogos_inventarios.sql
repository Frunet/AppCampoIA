-- Fase 1: catalogos de Inventarios (companies, fruits, varieties, task_types,
-- labor_cost_rates), columnas nuevas en workers/farms, y sustitucion del
-- enum crop_type por fruits/fruit_id.

-- =============================================================================
-- 1) Catalogos nuevos
-- =============================================================================

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.fruits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fruits ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.varieties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fruit_id uuid NOT NULL REFERENCES public.fruits(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fruit_id, name)
);
ALTER TABLE public.varieties ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  hint text,
  is_harvest boolean NOT NULL DEFAULT false,
  sort_order int,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;

-- Coste de la hora de personal: valor unico general, historico por fecha de
-- vigencia. Un valor por fecha (si hiciera falta corregir un valor cargado
-- por error, se añade una fila nueva con la misma fecha reemplazandola no
-- esta permitido por el UNIQUE; hay que insertar con la fecha siguiente).
CREATE TABLE public.labor_cost_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hourly_rate numeric(10,2) NOT NULL,
  valid_from date NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.labor_cost_rates ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2) Columnas nuevas en tablas existentes
-- =============================================================================

ALTER TABLE public.workers ADD COLUMN idrh text;

ALTER TABLE public.farms
  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN surface_m2 numeric(12,2),
  ADD COLUMN fruit_id uuid REFERENCES public.fruits(id);

-- =============================================================================
-- 3) Seed de catalogos + migracion de datos de crop -> fruit_id
-- =============================================================================

INSERT INTO public.fruits (name) VALUES ('mango'), ('aguacate');

INSERT INTO public.varieties (fruit_id, name)
SELECT f.id, v.name
FROM public.fruits f
JOIN (VALUES
  ('mango', 'Osteen'), ('mango', 'Keitt'), ('mango', 'Kent'),
  ('mango', 'Tommy Atkins'), ('mango', 'Palmer'), ('mango', 'Otra'),
  ('aguacate', 'Hass'), ('aguacate', 'Fuerte'), ('aguacate', 'Bacon'),
  ('aguacate', 'Lamb Hass'), ('aguacate', 'Reed'), ('aguacate', 'Otra')
) AS v(fruit, name) ON v.fruit = f.name;

INSERT INTO public.task_types (name, hint, is_harvest, sort_order) VALUES
  ('Instalación', 'Instalación', false, 1),
  ('Suelos', 'Suelos (arado, desbroce, hierbas...)', false, 2),
  ('Liado/Guía de planta', 'Liado/Guía de planta', false, 3),
  ('Otros cuidados planta', 'Otros cuidados planta (tala, destalle...)', false, 4),
  ('Riego, Abonado y Tratamiento', 'Riego, Abonado y Tratamiento (sulfatos...)', false, 5),
  ('Cosecha/Recolección', 'Cosecha/Recolección', true, 6),
  ('Otros', 'Otros', false, 7);

-- Backfill: cada finca apunta a la fruta que ya tenia en su columna crop.
UPDATE public.farms f
SET fruit_id = fr.id
FROM public.fruits fr
WHERE fr.name = f.crop::text;

ALTER TABLE public.farms ALTER COLUMN fruit_id SET NOT NULL;

-- Con los datos migrados, fuera el enum: nada mas los referencia (se
-- actualizo el codigo de la app para leer fruit_id / fruits.name).
ALTER TABLE public.farms DROP COLUMN crop;
DROP TYPE public.crop_type;

-- =============================================================================
-- 4) RLS: catalogos de lectura abierta a cualquier autenticado, escritura
--    solo admin. Sigue el mismo patron que las tablas existentes
--    (has_role/has_farm_access, definidas en la migracion inicial).
-- =============================================================================

CREATE POLICY "companies select" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "companies admin write" ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "fruits select" ON public.fruits FOR SELECT TO authenticated USING (true);
CREATE POLICY "fruits admin write" ON public.fruits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "varieties select" ON public.varieties FOR SELECT TO authenticated USING (true);
CREATE POLICY "varieties admin write" ON public.varieties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "task_types select" ON public.task_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_types admin write" ON public.task_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "labor_cost_rates select" ON public.labor_cost_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "labor_cost_rates admin write" ON public.labor_cost_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- farms solo tenia SELECT (via has_farm_access, que ya incluye a los admin).
-- Faltaba dar de alta/editar/borrar fincas: eso lo hace ahora Inventarios.
CREATE POLICY "farms admin write" ON public.farms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Grants: las tablas nuevas necesitan los mismos GRANT base que las
-- existentes (RLS filtra filas, pero sin GRANT no hay ni SELECT).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fruits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.varieties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.labor_cost_rates TO authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT ALL ON public.fruits TO service_role;
GRANT ALL ON public.varieties TO service_role;
GRANT ALL ON public.task_types TO service_role;
GRANT ALL ON public.labor_cost_rates TO service_role;
-- farms solo tenia GRANT SELECT (ver migracion inicial); admin necesita
-- poder insertar/editar/borrar fincas desde Inventarios (RLS ya lo limita
-- a admin con la policy de arriba).
GRANT INSERT, UPDATE, DELETE ON public.farms TO authenticated;
