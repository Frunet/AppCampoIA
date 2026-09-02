-- 4) Renombrar la finca "Loma Mesías" -> "Loma Mecías" (dato ya existente
-- en farms). Va antes del seed de empresas porque el punto 3 vincula
-- fincas por su nombre nuevo.
UPDATE public.farms SET name = 'Loma Mecías' WHERE name IN ('Loma Mesías', 'Loma Mesias');

-- 3) Empresas iniciales, vinculadas a sus fincas via farms.company_id.
-- companies.name no tiene UNIQUE, asi que se inserta solo si no existe ya
-- una con ese nombre (idempotente si esta migracion se re-ejecutara).
INSERT INTO public.companies (name)
SELECT v.name FROM (VALUES ('Frunet'), ('PAI'), ('Loma Mecías')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.name = v.name);

UPDATE public.farms f SET company_id = c.id
FROM public.companies c
WHERE c.name = 'Frunet' AND f.name = 'Frunet';

UPDATE public.farms f SET company_id = c.id
FROM public.companies c
WHERE c.name = 'PAI' AND f.name IN ('Pai Mango', 'Avoclan Casa', 'Avoclan Fortaleza');

UPDATE public.farms f SET company_id = c.id
FROM public.companies c
WHERE c.name = 'Loma Mecías' AND f.name IN ('Loma Mecías', 'Río Seco');
