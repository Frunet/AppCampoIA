-- Fase 3: la pestaña "Responsables" de Inventarios deja al admin editar el
-- rol y las fincas asignadas de cada usuario directamente desde el cliente.
-- user_roles y farm_managers solo tenian policy de SELECT (ver migracion
-- inicial) — hacia falta un admin las creaba via la Edge Function/service
-- role, pero editar una cuenta existente necesita tambien INSERT/UPDATE/
-- DELETE para el rol admin.

CREATE POLICY "user_roles admin write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "farm_managers admin write" ON public.farm_managers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.farm_managers TO authenticated;
