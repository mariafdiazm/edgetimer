-- EdgeTimer · Asignar roles para la demostración
-- 1) Registra en la app las cuentas que vas a usar (por ejemplo: tu cuenta y una del barbero).
-- 2) Cambia los correos de abajo por los reales y ejecuta este script en el SQL Editor.
-- Después, desde la app, el administrador puede cambiar roles en la pestaña "Usuarios".

-- (Solo si "Confirm email" está activo en Supabase) confirmar las cuentas de prueba:
update auth.users set email_confirmed_at = now()
where email in ('ADMIN@correo.com', 'BARBERO@correo.com') and email_confirmed_at is null;

-- Administrador
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'ADMIN@correo.com');

-- Barbero: vincula la cuenta con el barbero "Andrés Carmona"
update public.profiles set role = 'barbero'
where id = (select id from auth.users where email = 'BARBERO@correo.com');
update public.barbers set profile_id = (select id from auth.users where email = 'BARBERO@correo.com')
where name = 'Andrés Carmona';

-- Ver cómo quedaron los roles
select u.email, p.name, p.role, b.name as barbero_vinculado
from public.profiles p join auth.users u on u.id = p.id
left join public.barbers b on b.profile_id = p.id
order by p.role, u.email;
