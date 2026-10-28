-- EdgeTimer · MIGRACIÓN de la versión 3 a la versión 4
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > pegar todo > Run  (se puede repetir sin problema)
-- Agrega las operaciones de ELIMINAR con sus políticas de seguridad (RLS).

begin;

-- ═════════ Eliminar registros (parte "Delete" del CRUD) ═════════
-- · El cliente puede borrar de su historial las citas CANCELADAS (las confirmadas se cancelan, no se borran).
-- · El administrador puede borrar citas, y servicios que nunca se hayan usado en una cita
--   (si ya se usaron, la llave foránea lo impide: se desactivan en su lugar).
-- · Cada usuario puede borrar sus notificaciones.
drop policy if exists "citas: eliminar" on public.appointments;
create policy "citas: eliminar" on public.appointments for delete to authenticated
  using ((client_id = auth.uid() and status = 'cancelada') or public.is_admin());

drop policy if exists "servicios: admin elimina" on public.services;
create policy "servicios: admin elimina" on public.services for delete to authenticated using (public.is_admin());

drop policy if exists "notificaciones: eliminar" on public.notifications;
create policy "notificaciones: eliminar" on public.notifications for delete to authenticated using (user_id = auth.uid());

grant delete on public.appointments, public.services, public.notifications to authenticated;

commit;
