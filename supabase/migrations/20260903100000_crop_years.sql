-- Años de cultivo por finca (rango de cultivo + rango de cosecha), y la
-- asignacion automatica de cada work_hours al año de cultivo que le
-- corresponde segun su fecha.

CREATE TABLE public.crop_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name text NOT NULL,
  crop_start date NOT NULL,
  crop_end date NOT NULL,
  harvest_start date NOT NULL,
  harvest_end date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (crop_end >= crop_start),
  CHECK (harvest_end >= harvest_start)
);
ALTER TABLE public.crop_years ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.work_hours
  ADD COLUMN crop_year_id uuid REFERENCES public.crop_years(id) ON DELETE SET NULL;

-- RLS: mismo patron que el resto de catalogos de Inventarios (lectura
-- abierta a cualquier autenticado, escritura solo admin).
CREATE POLICY "crop_years select" ON public.crop_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "crop_years admin write" ON public.crop_years FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crop_years TO authenticated;
GRANT ALL ON public.crop_years TO service_role;

-- ---------------------------------------------------------------------------
-- Asignacion automatica al insertar/editar horas: cualquier INSERT y
-- cualquier UPDATE que toque farm_id o work_date recalcula crop_year_id
-- solo, buscando entre los crop_years de esa finca el que contenga la
-- fecha (crop_start <= work_date <= crop_end); si varios se solapan, el de
-- crop_start mas reciente; si ninguno encaja, NULL ("Sin año asignado").
-- Es un trigger (no logica solo en horas.tsx) para cubrir cualquier via de
-- insercion en work_hours (formulario, dictado por voz, n8n...), no solo
-- el formulario de Horas.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_crop_year_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  SELECT cy.id INTO NEW.crop_year_id
  FROM public.crop_years cy
  WHERE cy.farm_id = NEW.farm_id
    AND NEW.work_date BETWEEN cy.crop_start AND cy.crop_end
  ORDER BY cy.crop_start DESC
  LIMIT 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_hours_set_crop_year
BEFORE INSERT OR UPDATE OF farm_id, work_date ON public.work_hours
FOR EACH ROW EXECUTE FUNCTION public.set_crop_year_id();

-- ---------------------------------------------------------------------------
-- Recalculo explicito ("Recalcular asignaciones" en Inventarios): repite la
-- misma logica del trigger pero en bloque, para cuando cambian las fechas
-- de un crop_year ya existente (eso no dispara el trigger de arriba, que
-- solo escucha cambios en work_hours). No se ejecuta solo — hay que
-- llamarla explicitamente. SECURITY INVOKER (por defecto): el admin que la
-- llama ya tiene UPDATE sobre work_hours de cualquier finca via RLS
-- (has_farm_access incluye a los admin), no hace falta elevar privilegios.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_crop_years(p_farm_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.work_hours wh
  SET crop_year_id = (
    SELECT cy.id FROM public.crop_years cy
    WHERE cy.farm_id = p_farm_id
      AND wh.work_date BETWEEN cy.crop_start AND cy.crop_end
    ORDER BY cy.crop_start DESC
    LIMIT 1
  )
  WHERE wh.farm_id = p_farm_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_crop_years(uuid) TO authenticated;

-- Seed pedido: AÑO 2026 en Pai Mango (nombre exacto en farms, comprobado).
INSERT INTO public.crop_years (farm_id, name, crop_start, crop_end, harvest_start, harvest_end)
SELECT id, 'AÑO 2026', '2025-09-01', '2026-08-31', '2025-09-01', '2026-08-31'
FROM public.farms WHERE name = 'Pai Mango';
