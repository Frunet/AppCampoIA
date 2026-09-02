-- Auditoria de modificaciones en work_hours: updated_at (automatico via
-- trigger) y updated_by (lo rellena el cliente al editar, ver horas.tsx).
--
-- De paso, un hallazgo al revisar como se rellena created_by hoy: la
-- columna existe desde la migracion inicial pero no tiene DEFAULT ni se
-- rellena desde el cliente (horas.tsx nunca la incluye en el INSERT), asi
-- que las 669 filas actuales tienen created_by a NULL. Sin arreglar esto
-- la columna "Creado por" del Excel de la Fase 3 saldria vacia siempre, asi
-- que se fija un DEFAULT auth.uid() aqui (solo en work_hours, que es la
-- tabla de este encargo — purchases/tasks tienen el mismo hueco y quedan
-- fuera de alcance).

ALTER TABLE public.work_hours
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.work_hours ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_hours_set_updated_at
BEFORE UPDATE ON public.work_hours
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
