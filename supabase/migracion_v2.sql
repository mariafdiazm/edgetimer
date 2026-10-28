-- EdgeTimer · MIGRACIÓN de la versión 1 a la versión 2
-- Ejecutar UNA sola vez en: Supabase Dashboard > SQL Editor > New query > pegar todo > Run
-- Conserva usuarios y citas existentes. Agrega:
--   appointment_services  (una cita puede tener varios servicios)
--   reviews               (calificación y comentario por cita)
-- Resultado: 6 tablas.

begin;

create extension if not exists btree_gist;

-- 1) Nuevas columnas en citas
alter table public.appointments add column if not exists end_at timestamptz;
alter table public.appointments add column if not exists total_price integer not null default 0;

-- 2) Tabla de detalle: servicios de cada cita
create table if not exists public.appointment_services (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid not null references public.services(id),
  price integer not null check (price >= 0),
  minutes integer not null check (minutes > 0),
  primary key (appointment_id, service_id)
);

-- 3) Pasar los datos existentes (las citas tenían un solo servicio).
--    Solo se hace si la columna vieja service_id todavía existe (así el script se puede repetir sin daño).
do $mig$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'appointments' and column_name = 'service_id') then
    alter table public.appointments disable trigger user;

    insert into public.appointment_services (appointment_id, service_id, price, minutes)
    select a.id, s.id, s.price, s.minutes
    from public.appointments a join public.services s on s.id = a.service_id
    on conflict do nothing;

    update public.appointments a
    set end_at = a.start_at + make_interval(mins => s.minutes),
        total_price = s.price
    from public.services s
    where s.id = a.service_id;

    -- Si alguna cita vieja se cruza con otra del mismo barbero, se cancela la más reciente.
    update public.appointments a set status = 'cancelada'
    where a.status = 'confirmada' and exists (
      select 1 from public.appointments b
      where b.id <> a.id and b.status = 'confirmada' and b.barber_id = a.barber_id
        and b.start_at < a.start_at and tstzrange(b.start_at, b.end_at) && tstzrange(a.start_at, a.end_at));

    alter table public.appointments enable trigger user;
    alter table public.appointments drop column service_id;
  end if;
end $mig$;

alter table public.appointments alter column end_at set not null;
alter table public.appointments drop constraint if exists appointments_end_after_start;
alter table public.appointments add constraint appointments_end_after_start check (end_at > start_at);

-- 4) Cruce de horarios por rango (reemplaza el índice de la versión 1)
alter table public.appointments drop constraint if exists appointments_no_overlap;
drop index if exists public.appointments_no_overlap;
alter table public.appointments add constraint appointments_no_overlap
  exclude using gist (barber_id with =, tstzrange(start_at, end_at) with &&)
  where (status = 'confirmada');

-- 5) Calificaciones
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  client_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  barber_id uuid not null references public.barbers(id),
  rating integer not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

drop function if exists public.busy_slots(uuid, timestamptz, timestamptz);

-- ───────── Reglas de negocio de las citas ─────────
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
    -- El cliente solo puede cambiar la hora o cancelar.
    new.client_id := old.client_id;
    new.barber_id := old.barber_id;
    new.total_price := old.total_price;
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

-- ───────── Reservar una cita con uno o varios servicios (RF002) ─────────
-- Calcula duración y precio total y guarda el detalle en una sola transacción.
create or replace function public.book_appointment(p_barber uuid, p_start timestamptz, p_services uuid[])
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
  v_count integer;
  v_minutes integer;
  v_price integer;
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

  insert into appointments (client_id, barber_id, start_at, end_at, total_price)
  values (auth.uid(), p_barber, p_start, p_start + make_interval(mins => v_minutes), v_price)
  returning id into v_id;

  insert into appointment_services (appointment_id, service_id, price, minutes)
  select v_id, id, price, minutes from services where id = any(p_services);

  return v_id;
end $$;

-- ───────── Horarios ocupados de un barbero (sin exponer datos de otros clientes) ─────────
create or replace function public.busy_slots(p_barber uuid, p_from timestamptz, p_to timestamptz)
returns table (start_at timestamptz, end_at timestamptz)
language sql security definer set search_path = public stable as $$
  select a.start_at, a.end_at from appointments a
  where a.barber_id = p_barber and a.status = 'confirmada'
    and tstzrange(a.start_at, a.end_at) && tstzrange(p_from, p_to);
$$;

-- ───────── Promedio de calificación del barbero (RF007) ─────────
create or replace function public.update_barber_rating() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update barbers
  set rating = (select round(avg(rating)::numeric, 1) from reviews where barber_id = new.barber_id)
  where id = new.barber_id;
  return new;
end $$;

drop trigger if exists reviews_update_rating on public.reviews;
create trigger reviews_update_rating after insert on public.reviews
  for each row execute function public.update_barber_rating();

-- ───────── Seguridad a nivel de fila (RLS) ─────────
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.barbers enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "perfil propio: leer" on public.profiles;
drop policy if exists "perfil propio: actualizar" on public.profiles;
create policy "perfil propio: leer" on public.profiles for select to authenticated using (id = auth.uid());
create policy "perfil propio: actualizar" on public.profiles for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

drop policy if exists "servicios visibles" on public.services;
drop policy if exists "barberos visibles" on public.barbers;
create policy "servicios visibles" on public.services for select to authenticated using (active);
create policy "barberos visibles" on public.barbers for select to authenticated using (active);

drop policy if exists "cliente ve sus citas" on public.appointments;
drop policy if exists "cliente crea sus citas" on public.appointments;
drop policy if exists "cliente modifica sus citas" on public.appointments;
create policy "cliente ve sus citas" on public.appointments for select to authenticated using (client_id = auth.uid());
create policy "cliente crea sus citas" on public.appointments for insert to authenticated with check (client_id = auth.uid());
create policy "cliente modifica sus citas" on public.appointments for update to authenticated
  using (client_id = auth.uid()) with check (client_id = auth.uid());
-- No hay policy de DELETE: las citas se cancelan (status), no se borran.

drop policy if exists "cliente ve servicios de sus citas" on public.appointment_services;
drop policy if exists "cliente agrega servicios a sus citas" on public.appointment_services;
create policy "cliente ve servicios de sus citas" on public.appointment_services for select to authenticated
  using (exists (select 1 from public.appointments a where a.id = appointment_id and a.client_id = auth.uid()));
create policy "cliente agrega servicios a sus citas" on public.appointment_services for insert to authenticated
  with check (exists (select 1 from public.appointments a where a.id = appointment_id and a.client_id = auth.uid()));

drop policy if exists "cliente ve sus calificaciones" on public.reviews;
drop policy if exists "cliente califica citas realizadas" on public.reviews;
create policy "cliente ve sus calificaciones" on public.reviews for select to authenticated using (client_id = auth.uid());
create policy "cliente califica citas realizadas" on public.reviews for insert to authenticated
  with check (
    client_id = auth.uid() and exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.client_id = auth.uid() and a.barber_id = reviews.barber_id
        and a.status = 'confirmada' and a.end_at <= now()));

-- ───────── Permisos para la API ─────────
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.services, public.barbers to authenticated;
grant select, insert, update on public.appointments to authenticated;
grant select, insert on public.appointment_services, public.reviews to authenticated;
grant execute on function public.book_appointment(uuid, timestamptz, uuid[]) to authenticated;
grant execute on function public.busy_slots(uuid, timestamptz, timestamptz) to authenticated;

commit;
