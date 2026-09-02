-- ===========================================================================
-- Datos de prueba: agosto 2026
--
--   · 5 trabajadores por finca (30 en total), nombres ficticios
--   · Jornadas de lunes a sabado (nunca domingo), maximo 7 h/dia
--   · ~85% de asistencia, para que no todos trabajen todos los dias
--   · Tareas de campo con estados variados
--
-- NOTA SOBRE LA ALEATORIEDAD
-- No usar random() dentro de un CROSS JOIN LATERAL: Postgres puede evaluarlo
-- una sola vez por fila externa, y entonces cada trabajador acaba con las
-- mismas horas y el mismo tipo de tarea todo el mes. Aqui se deriva el valor
-- de hashtext(worker_id || fecha), que si varia fila a fila y ademas es
-- reproducible.
-- ===========================================================================

-- --- LIMPIEZA (descomentar para borrar los datos de prueba) -----------------
-- delete from public.work_hours;
-- delete from public.tasks;
-- delete from public.workers;

-- --- 1) Trabajadores --------------------------------------------------------
insert into public.workers (farm_id, name, active)
select f.id, t.trabajador, true
from (values
  ('Pai Mango',         'Antonio Ruiz'),
  ('Pai Mango',         'Manuel Ortega'),
  ('Pai Mango',         'José Molina'),
  ('Pai Mango',         'Francisco Salas'),
  ('Pai Mango',         'Miguel Herrera'),
  ('Avoclan Casa',      'Carmen Vidal'),
  ('Avoclan Casa',      'Lucía Prados'),
  ('Avoclan Casa',      'Rafael Ibáñez'),
  ('Avoclan Casa',      'Andrés Peña'),
  ('Avoclan Casa',      'Rocío Cabrera'),
  ('Avoclan Fortaleza', 'Javier Lozano'),
  ('Avoclan Fortaleza', 'Marta Aguilar'),
  ('Avoclan Fortaleza', 'Sergio Bermúdez'),
  ('Avoclan Fortaleza', 'Nuria Gálvez'),
  ('Avoclan Fortaleza', 'Iván Castaño'),
  ('Loma Mesías',       'Pedro Nieto'),
  ('Loma Mesías',       'Alba Ferrer'),
  ('Loma Mesías',       'Tomás Rojas'),
  ('Loma Mesías',       'Elena Quintero'),
  ('Loma Mesías',       'Diego Marín'),
  ('Río Seco',          'Rubén Pardo'),
  ('Río Seco',          'Sofía Cuesta'),
  ('Río Seco',          'Álvaro Serrano'),
  ('Río Seco',          'Lidia Moreno'),
  ('Río Seco',          'Hugo Bautista'),
  ('Frunet',            'Cristina Vega'),
  ('Frunet',            'Óscar Delgado'),
  ('Frunet',            'Paula Núñez'),
  ('Frunet',            'Adrián Soler'),
  ('Frunet',            'Beatriz Campos')
) as t(finca, trabajador)
join public.farms f on f.name = t.finca;

-- --- 2) Jornadas de agosto --------------------------------------------------
insert into public.work_hours (farm_id, worker_id, worker_name, work_date, hours, task_type, variety, kg)
select
  w.farm_id,
  w.id,
  w.name,
  d::date,
  k.horas,
  k.tipo,
  case when k.tipo = 'Cosecha/Recolección' then
    case f.crop::text
      when 'mango' then (array['Osteen','Keitt','Kent','Tommy Atkins','Palmer'])[k.idx_var]
      else              (array['Hass','Fuerte','Bacon','Lamb Hass','Reed'])[k.idx_var]
    end
  end,
  case when k.tipo = 'Cosecha/Recolección'
       then 150 + (((hashtext(w.id::text || d::text || 'k') % 351) + 351) % 351)
  end
from public.workers w
join public.farms f on f.id = w.farm_id
cross join generate_series(date '2026-08-01', date '2026-08-31', interval '1 day') as d
cross join lateral (
  select
    -- 4,0 a 7,0 horas
    4 + (((hashtext(w.id::text || d::text || 'h') % 31) + 31) % 31) / 10.0 as horas,
    (array['Instalación','Suelos','Liado/Guía de planta','Otros cuidados planta',
           'Riego, Abonado y Tratamiento','Cosecha/Recolección','Otros'])
      [1 + (((hashtext(w.id::text || d::text || 't') % 7) + 7) % 7)]        as tipo,
    1 + (((hashtext(w.id::text || d::text || 'v') % 5) + 5) % 5)           as idx_var
) k
where extract(dow from d) <> 0                                 -- 0 = domingo
  and (((hashtext(w.id::text || d::text || 'a') % 100) + 100) % 100) < 85; -- ~85% asistencia

-- --- 3) Tareas de campo -----------------------------------------------------
insert into public.tasks (farm_id, title, description, status, due_date, assignee)
select
  f.id, x.titulo, x.descripcion, x.estado::public.task_status, x.fecha,
  (select w.name from public.workers w where w.farm_id = f.id order by w.name limit 1)
from public.farms f
cross join (values
  ('Desbroce de calles',            'Limpieza de hierbas entre líneas de plantación', 'completada', date '2026-08-04'),
  ('Revisión del sistema de riego', 'Comprobar goteros, presión y fugas',             'completada', date '2026-08-08'),
  ('Abonado de fondo',              'Aplicación según el plan de fertilización',      'completada', date '2026-08-13'),
  ('Tratamiento fitosanitario',     'Control preventivo de plagas y hongos',          'en_curso',   date '2026-08-20'),
  ('Liado y guía de planta',        'Entutorado de plantones jóvenes',                'en_curso',   date '2026-08-26'),
  ('Preparar cajas de recolección', 'Material y logística para la campaña',           'pendiente',  date '2026-08-31')
) as x(titulo, descripcion, estado, fecha);
