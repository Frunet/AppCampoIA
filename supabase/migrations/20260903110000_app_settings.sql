-- Configuracion clave/valor de la app. Primer uso: "hours_per_jornal", el
-- valor actual unico (no historico, a diferencia de labor_cost_rates) usado
-- para convertir horas en jornales en los informes.
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Mismo patron que el resto de catalogos: lectura abierta a cualquier
-- autenticado (todo el mundo necesita poder leer hours_per_jornal para ver
-- el informe de jornales), escritura solo admin.
CREATE POLICY "app_settings select" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_settings admin write" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

INSERT INTO public.app_settings (key, value) VALUES ('hours_per_jornal', '7');
