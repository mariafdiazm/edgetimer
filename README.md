EdgeTimer
App móvil para agendar citas en la barbería Alpha Corte. Proyecto Pedagógico Integrador de Ingeniería en Software, Tecnológico de Antioquia.


Tecnologías
* React Native con Expo y TypeScript
* Expo Router para la navegación
* Supabase (autenticación y base de datos PostgreSQL)

Qué hace
Cliente: se registra e inicia sesión, reserva citas con uno o varios servicios, cancela o reprograma (hasta 1 hora antes), ve su historial, califica al barbero, se suscribe al Plan Alpha para tener descuento y recibe notificaciones de sus citas.
Barbero: ve su agenda del día con los datos de cada cliente y sus calificaciones.
Administrador: ve un panel con métricas, crea y edita servicios y asigna roles a los usuarios.

Base de datos
Tiene 8 tablas: profiles, services, barbers, appointments, appointment_services, reviews, notifications y subscriptions.
Las tablas tienen seguridad por filas (RLS), así que cada usuario solo puede ver y modificar lo que le corresponde según su rol. El script completo está en supabase/schema.sql

Cómo ejecutarlo
1. Crear un proyecto en Supabase y ejecutar supabase/schema.sql en el SQL Editor.
2. Copiar .env.example como .env y poner la URL y la Publishable key del proyecto.
3. Instalar y arrancar:

bash
npm install
npm start

Estructura

src/app          pantallas
src/components   componentes reutilizables
src/context      estado de la app y conexión con Supabase
src/lib          cliente de Supabase y funciones de fechas
supabase         scripts de la base de datos
