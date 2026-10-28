-- EdgeTimer · MIGRACIÓN de la versión 2 a la versión 3
-- Ejecutar UNA vez en: Supabase Dashboard > SQL Editor > New query > pegar todo > Run
-- (Si se ejecuta dos veces no pasa nada.) Conserva usuarios, citas y calificaciones. Agrega:
--   notifications   notificaciones de citas (RF006)
--   subscriptions   suscripciones con descuento (RF009)
--   roles barbero / administrador: agenda (RF003), panel (RF008), gestión de servicios (RF012)
-- Resultado: 8 tablas.

begin;

-- ───────── Tablas de la versión 3 ─────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('mensual','trimestral')),
  price integer not null check (price >= 0),
  discount_pct integer not null check (discount_pct between 0 and 100),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'activa' check (status in ('activa','cancelada')),
  created_at timestamptz not null default now()
);
-- Un cliente solo puede tener una suscripción activa a la vez.
create unique index if not exists subscriptions_one_active on public.subscriptions (user_id) where status = 'activa';

alter table public.appointments add column if not exists discount_pct integer not null default 0;
alter table public.appointments drop constraint if exists appointments_discount_check;
alter table public.appointments add constraint appointments_discount_check check (discount_pct between 0 and 100);

-- ═════════ Funciones auxiliares de roles (security definer: no dependen de RLS) ═════════
create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_barber_id() returns uuid
language sql security definer set search_path = public stable as $$
  select id from barbers where profile_id = auth.uid() limit 1;
$$;

create or replace function public.my_role() returns text
language sql security definer set search_path = public stable as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.my_discount() returns integer
language sql security definer set search_path = public stable as $$
  select coalesce(max(discount_pct), 0) from subscriptions
  where user_id = auth.uid() and status = 'activa' and ends_at > now();
$$;

-- ═════════ Reglas de negocio de las citas ═════════
-- · No se reserva en el pasado, en domingo ni fuera de 9:00 a. m. – 7:00 p. m. (hora de Colombia).
-- · Cancelar o reprogramar solo con al menos 1 hora de antelación (RF004).
-- · Al reprogramar se conserva la duración de la cita.
create or replace function public.check_appointment_rules() returns trigger
language plpgsql set search_path = public as $$
declare
  local_start timestamp;
  local_end timestamp;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'cancelada' then
      raise exception 'La cita ya fue cancelada';
    end if;
    if old.start_at - now() < interval '1 hour' then
      raise exception 'Solo se puede modificar con al menos 1 hora de antelación';
    end if;
    -- Solo se puede cambiar la hora o cancelar.
    new.client_id := old.client_id;
    new.barber_id := old.barber_id;
    new.total_price := old.total_price;
    new.discount_pct := old.discount_pct;
    new.end_at := new.start_at + (old.end_at - old.start_at);
  end if;

  if tg_op = 'INSERT' or new.start_at <> old.start_at then
    if new.start_at <= now() then
      raise exception 'No se puede reservar en una hora pasada';
    end if;
    local_start := new.start_at at time zone 'America/Bogota';
    local_end := new.end_at at time zone 'America/Bogota';
    if extract(isodow from local_start) = 7 then
      raise exception 'La barbería no abre los domingos';
    end if;
    if local_start::time < time '09:00' or local_end::time > time '19:00'
       or local_end::date <> local_start::date then
      raise exception 'La cita debe quedar dentro del horario: 9:00 a. m. a 7:00 p. m.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists appointments_rules on public.appointments;
create trigger appointments_rules before insert or update on public.appointments
  for each row execute function public.check_appointment_rules();

-- ═════════ Reservar una cita con uno o varios servicios (RF002) ═════════
-- Calcula duración y precio, aplica el descuento de la suscripción activa (RF009)
-- y guarda el detalle en una sola transacción.
create or replace function public.book_appointment(p_barber uuid, p_start timestamptz, p_services uuid[])
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
  v_count integer;
  v_minutes integer;
  v_price integer;
  v_discount integer := public.my_discount();
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if p_services is null or coalesce(array_length(p_services, 1), 0) = 0 then
    raise exception 'Elige al menos un servicio';
  end if;

  select count(*), coalesce(sum(minutes), 0), coalesce(sum(price), 0)
    into v_count, v_minutes, v_price
  from services where id = any(p_services) and active;

  if v_count <> (select count(distinct x) from unnest(p_services) as x) then
    raise exception 'Uno de los servicios no está disponible';
  end if;

  insert into appointments (client_id, barber_id, start_at, end_at, total_price, discount_pct)
  values (auth.uid(), p_barber, p_start, p_start + make_interval(mins => v_minutes),
          round(v_price * (100 - v_discount) / 100.0)::integer, v_discount)
  returning id into v_id;

  insert into appointment_services (appointment_id, service_id, price, minutes)
  select v_id, id, price, minutes from services where id = any(p_services);

  return v_id;
end $$;

-- ═════════ Horarios ocupados de un barbero (sin exponer datos de otros clientes) ═════════
create or replace function public.busy_slots(p_barber uuid, p_from timestamptz, p_to timestamptz)
returns table (start_at timestamptz, end_at timestamptz)
language sql security definer set search_path = public stable as $$
  select a.start_at, a.end_at from appointments a
  where a.barber_id = p_barber and a.status = 'confirmada'
    and tstzrange(a.start_at, a.end_at) && tstzrange(p_from, p_to);
$$;

-- ═════════ Suscripciones (RF009) · pago simulado ═════════
create or replace function public.subscribe(p_plan text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_price integer;
  v_discount integer;
  v_days integer;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  case p_plan
    when 'mensual' then v_price := 60000; v_discount := 10; v_days := 30;
    when 'trimestral' then v_price := 160000; v_discount := 15; v_days := 90;
    else raise exception 'Plan no válido';
  end case;
  -- Las suscripciones vencidas se cierran antes de crear la nueva.
  update subscriptions set status = 'cancelada'
  where user_id = auth.uid() and status = 'activa' and ends_at <= now();
  if exists (select 1 from subscriptions where user_id = auth.uid() and status = 'activa') then
    raise exception 'Ya tienes una suscripción activa';
  end if;
  insert into subscriptions (user_id, plan, price, discount_pct, ends_at)
  values (auth.uid(), p_plan, v_price, v_discount, now() + make_interval(days => v_days))
  returning id into v_id;
  insert into notifications (user_id, title, body)
  values (auth.uid(), 'Suscripción activada',
          'Tu plan ' || p_plan || ' está activo. Tendrás ' || v_discount || '% de descuento en tus citas.');
  return v_id;
end $$;

create or replace function public.cancel_subscription() returns void
language plpgsql security definer set search_path = public as $$
begin
  update subscriptions set status = 'cancelada' where user_id = auth.uid() and status = 'activa';
end $$;

-- ═════════ Notificaciones automáticas (RF006) ═════════
create or replace function public.fmt_cita(p_start timestamptz) returns text
language sql immutable as $$
  select replace(replace(to_char(p_start at time zone 'America/Bogota', 'DD/MM/YYYY "a las" HH12:MI AM'),
                         'AM', 'a. m.'), 'PM', 'p. m.');
$$;

create or replace function public.notify_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_barber_name text;
  v_barber_profile uuid;
  v_client_name text;
begin
  select name, profile_id into v_barber_name, v_barber_profile from barbers where id = new.barber_id;
  select name into v_client_name from profiles where id = new.client_id;

  if tg_op = 'INSERT' then
    insert into notifications (user_id, title, body) values
      (new.client_id, 'Cita confirmada',
       'Tu cita del ' || fmt_cita(new.start_at) || ' con ' || v_barber_name || ' quedó confirmada.');
    if v_barber_profile is not null then
      insert into notifications (user_id, title, body) values
        (v_barber_profile, 'Nueva cita', v_client_name || ' reservó para el ' || fmt_cita(new.start_at) || '.');
    end if;
  elsif new.status = 'cancelada' and old.status <> 'cancelada' then
    insert into notifications (user_id, title, body) values
      (new.client_id, 'Cita cancelada', 'Tu cita del ' || fmt_cita(old.start_at) || ' fue cancelada.');
    if v_barber_profile is not null then
      insert into notifications (user_id, title, body) values
        (v_barber_profile, 'Cita cancelada', 'Se canceló la cita de ' || v_client_name || ' del ' || fmt_cita(old.start_at) || '.');
    end if;
  elsif new.start_at <> old.start_at then
    insert into notifications (user_id, title, body) values
      (new.client_id, 'Cita reprogramada', 'Tu cita ahora es el ' || fmt_cita(new.start_at) || '.');
    if v_barber_profile is not null then
      insert into notifications (user_id, title, body) values
        (v_barber_profile, 'Cita reprogramada', 'La cita de ' || v_client_name || ' pasó al ' || fmt_cita(new.start_at) || '.');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists appointments_notify on public.appointments;
create trigger appointments_notify after insert or update on public.appointments
  for each row execute function public.notify_appointment();

-- ═════════ Promedio de calificación del barbero (RF007) ═════════
create or replace function public.update_barber_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
begin
  update barbers
  set rating = (select round(avg(rating)::numeric, 1) from reviews where barber_id = new.barber_id)
  where id = new.barber_id
  returning profile_id into v_profile;
  if v_profile is not null then
    insert into notifications (user_id, title, body)
    values (v_profile, 'Nueva calificación', 'Recibiste ' || new.rating || ' de 5 estrellas.');
  end if;
  return new;
end $$;

drop trigger if exists reviews_update_rating on public.reviews;
create trigger reviews_update_rating after insert on public.reviews
  for each row execute function public.update_barber_rating();

-- ═════════ Seguridad a nivel de fila (RLS) por rol ═════════
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.barbers enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.subscriptions enable row level security;

-- profiles
drop policy if exists "perfil propio: leer" on public.profiles;
drop policy if exists "perfil propio: actualizar" on public.profiles;
drop policy if exists "perfiles: leer" on public.profiles;
drop policy if exists "perfiles: admin actualiza" on public.profiles;
create policy "perfiles: leer" on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_admin()
  or exists (select 1 from public.appointments a where a.client_id = profiles.id and a.barber_id = public.my_barber_id()));
create policy "perfil propio: actualizar" on public.profiles for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and role = public.my_role());  -- el usuario no puede cambiarse el rol
create policy "perfiles: admin actualiza" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- services (RF012)
drop policy if exists "servicios visibles" on public.services;
drop policy if exists "servicios: admin crea" on public.services;
drop policy if exists "servicios: admin edita" on public.services;
create policy "servicios visibles" on public.services for select to authenticated using (active or public.is_admin());
create policy "servicios: admin crea" on public.services for insert to authenticated with check (public.is_admin());
create policy "servicios: admin edita" on public.services for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- barbers
drop policy if exists "barberos visibles" on public.barbers;
drop policy if exists "barberos: admin crea" on public.barbers;
drop policy if exists "barberos: admin edita" on public.barbers;
create policy "barberos visibles" on public.barbers for select to authenticated using (active or public.is_admin());
create policy "barberos: admin crea" on public.barbers for insert to authenticated with check (public.is_admin());
create policy "barberos: admin edita" on public.barbers for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- appointments: el cliente sus citas, el barbero su agenda (RF003), el admin todas (RF008)
drop policy if exists "cliente ve sus citas" on public.appointments;
drop policy if exists "cliente crea sus citas" on public.appointments;
drop policy if exists "cliente modifica sus citas" on public.appointments;
drop policy if exists "citas: leer" on public.appointments;
drop policy if exists "citas: modificar" on public.appointments;
create policy "citas: leer" on public.appointments for select to authenticated using (
  client_id = auth.uid() or barber_id = public.my_barber_id() or public.is_admin());
create policy "cliente crea sus citas" on public.appointments for insert to authenticated with check (client_id = auth.uid());
create policy "citas: modificar" on public.appointments for update to authenticated
  using (client_id = auth.uid() or barber_id = public.my_barber_id() or public.is_admin())
  with check (client_id = auth.uid() or barber_id = public.my_barber_id() or public.is_admin());
-- No hay policy de DELETE: las citas se cancelan (status), no se borran.

-- appointment_services: visibles si la cita es visible
drop policy if exists "cliente ve servicios de sus citas" on public.appointment_services;
drop policy if exists "cliente agrega servicios a sus citas" on public.appointment_services;
drop policy if exists "servicios de cita: leer" on public.appointment_services;
create policy "servicios de cita: leer" on public.appointment_services for select to authenticated
  using (exists (select 1 from public.appointments a where a.id = appointment_id));
create policy "cliente agrega servicios a sus citas" on public.appointment_services for insert to authenticated
  with check (exists (select 1 from public.appointments a where a.id = appointment_id and a.client_id = auth.uid()));

-- reviews
drop policy if exists "cliente ve sus calificaciones" on public.reviews;
drop policy if exists "calificaciones: leer" on public.reviews;
drop policy if exists "cliente califica citas realizadas" on public.reviews;
create policy "calificaciones: leer" on public.reviews for select to authenticated using (
  client_id = auth.uid() or barber_id = public.my_barber_id() or public.is_admin());
create policy "cliente califica citas realizadas" on public.reviews for insert to authenticated
  with check (
    client_id = auth.uid() and exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.client_id = auth.uid() and a.barber_id = reviews.barber_id
        and a.status = 'confirmada' and a.end_at <= now()));

-- notifications: cada quien las suyas; solo puede marcarlas como leídas
drop policy if exists "notificaciones: leer" on public.notifications;
drop policy if exists "notificaciones: marcar leídas" on public.notifications;
create policy "notificaciones: leer" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notificaciones: marcar leídas" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- subscriptions: se crean y cancelan solo con las funciones subscribe / cancel_subscription
drop policy if exists "suscripciones: leer" on public.subscriptions;
create policy "suscripciones: leer" on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- ═════════ Permisos para la API ═════════
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.services, public.barbers to authenticated;
grant select, insert, update on public.appointments to authenticated;
grant select, insert on public.appointment_services, public.reviews to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.subscriptions to authenticated;
grant execute on function public.book_appointment(uuid, timestamptz, uuid[]) to authenticated;
grant execute on function public.busy_slots(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.subscribe(text) to authenticated;
grant execute on function public.cancel_subscription() to authenticated;
grant execute on function public.is_admin(), public.my_barber_id(), public.my_discount(), public.my_role() to authenticated;

commit;
