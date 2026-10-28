# EdgeTimer (móvil)

Aplicación móvil de reservación de citas para la barbería **Alpha Corte**.
Proyecto Pedagógico Integrador – Tecnológico de Antioquia

Stack: React Native + TypeScript + Expo (SDK 57) + Expo Router + **Supabase** (Auth + PostgreSQL).
Se prueba en el celular con **Expo Go** y en el navegador (React Native Web, dentro de un marco de teléfono).

## Funcionalidades por rol
**Cliente**
- Registro e inicio de sesión (RF001).
- Reserva con **uno o varios servicios** en la misma cita; suma precio y duración (RF002).
- Cancelar / reprogramar con al menos 1 hora de antelación (RF004).
- Historial con total gastado y **calificación 1–5** con comentario (RF005, RF007).
- **Plan Alpha**: suscripción mensual (10 %) o trimestral (15 %) con descuento automático al reservar; pago simulado (RF009).
- Notificaciones dentro de la app y recordatorio de la cita de las próximas 24 h (RF006).
- Perfil con ubicación en Google Maps (RF011) y soporte: preguntas frecuentes, WhatsApp, llamada y correo (RF010).

**Barbero**
- Agenda por día con datos del cliente, servicios, total y visitas anteriores; puede cancelar avisando al cliente (RF003).
- Sus calificaciones y comentarios (RF007).

**Administrador**
- Panel con métricas: citas, ingresos, clientes, suscripciones, servicios más solicitados y rendimiento de barberos (RF008).
- Gestión de servicios: crear, editar precio y duración, activar/desactivar (RF012).
- Usuarios: cambiar roles, vincular cuentas con fichas de barbero, activar/desactivar barberos.

## Base de datos (8 tablas)
| Tabla | Para qué |
|---|---|
| `profiles` | Usuarios (nombre, teléfono, rol: cliente / barbero / admin) |
| `services` | Catálogo de servicios con precio y duración |
| `barbers` | Barberos, calificación promedio y cuenta vinculada |
| `appointments` | Citas: cliente, barbero, inicio, fin, total, descuento, estado |
| `appointment_services` | Detalle N:M: servicios incluidos en cada cita |
| `reviews` | Calificación y comentario de una cita realizada |
| `notifications` | Notificaciones de la app |
| `subscriptions` | Suscripciones con descuento |

Funciones SQL: `book_appointment`, `busy_slots`, `subscribe`, `cancel_subscription`, `is_admin`, `my_barber_id`,
triggers de reglas de negocio, notificaciones, perfil automático y promedio de calificación. Seguridad RLS por rol.

## 1. Configurar Supabase
- **Proyecto nuevo:** SQL Editor > New query > pegar `supabase/schema.sql` > Run.
- **Ya tienes la versión 3:** pegar `supabase/migracion_v4.sql` > Run (agrega las operaciones de eliminar).
- **Ya tienes la versión 2:** primero `migracion_v3.sql` y luego `migracion_v4.sql`.
  (Si vienes de la versión 1: `migracion_v2.sql`, `migracion_v3.sql` y `migracion_v4.sql`, en ese orden.)
- **Roles para la demo:** edita los correos en `supabase/roles_demo.sql` y ejecútalo
  (deja una cuenta como administradora y vincula otra como barbero). Luego el admin puede cambiar roles desde la app.
- `.env` en la raíz del proyecto con la Project URL y la Publishable key (ver `.env.example`).

## 2. Ejecutar
```bash
npm install
npm start -- --clear   # QR para Expo Go; tecla w para el navegador
npm run typecheck
```

## Datos de contacto de la barbería
En `src/data/mock.ts` cambia WhatsApp, teléfono, correo y dirección por los reales antes de presentar.

## Cumplimiento de la rúbrica
| Criterio | Dónde se cumple |
|---|---|
| **1. Autenticación (15 %)** | `src/app/login.tsx`: validación de correo y contraseña (mín. 8). Supabase Auth (`signInWithPassword`, `signUp`). Mensajes de error claros (credenciales incorrectas, correo sin confirmar, sin conexión). Rutas protegidas: `(tabs)/_layout.tsx` y `components/states.tsx` (`RequireAuth`) redirigen al login sin sesión. Sesión con token JWT guardada en AsyncStorage; URL y llave en `.env` (`EXPO_PUBLIC_*`), `.env` en `.gitignore`. |
| **2. Navegación y Home (10 %)** | Tras iniciar sesión va a la vista de su rol; al cerrar sesión vuelve al login. La sesión persiste al recargar o reiniciar (`persistSession`). Home del cliente con resumen (próximas, realizadas, calificadas), próxima cita, recordatorio y accesos; Panel del admin con métricas. |
| **3. Modelo de datos (35 %)** | 8 tablas en PostgreSQL con PK, FK, `check`, `unique` y restricción de exclusión (`supabase/schema.sql`). CRUD: **crear** (citas, servicios, calificaciones, suscripciones), **leer** (todas), **actualizar** (reprogramar y cancelar citas, editar servicios, roles, leer notificaciones), **eliminar** (citas canceladas, servicios no usados, notificaciones). RLS activo en las 8 tablas con políticas por rol, probadas. Listados con tarjetas, búsqueda y filtros (Servicios, Usuarios, días en Agenda) y formularios de creación/edición. |
| **4. UI/UX (15 %)** | Paleta oscura con dorado y jerarquía tipográfica constantes (`constants/theme.ts`). Barra de pestañas en todas las pantallas (y botón volver en las secundarias). Se adapta al ancho: pantalla completa en celular y marco de teléfono en pantallas anchas. Indicadores de carga (inicio de sesión, guardando…, deslizar para recargar) y estados vacíos con ícono (`EmptyState`). |
| **5. Arquitectura (25 %)** | Separación en `app` (pantallas), `components` (UI), `context` (estado y servicios de datos), `lib` (cliente Supabase y utilidades), `constants` y `data`. Cliente Supabase inicializado con variables de entorno (`lib/supabase.ts`). Errores controlados: cada llamada devuelve `{ ok, message }`, la carga inicial usa `try/catch` y hay un `ErrorBoundary` global (`app/_layout.tsx`). Probado sin errores en consola. |
