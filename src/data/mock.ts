// Datos fijos de la barbería. Servicios, barberos y citas viven en Supabase.
// ⚠️ Antes de presentar, cambia el teléfono, WhatsApp, correo y dirección por los reales de la barbería.
export const SHOP = {
  name: 'Alpha Corte',
  address: 'Tv. 79c #80-33, Medellín, Antioquia',
  /** Texto que se busca en Google Maps (dirección exacta de la barbería). */
  mapsQuery: 'Alpha Men Barberías, Tv. 79c #80-33, Medellín, Antioquia',
  /** Identificador único del lugar en Google Maps: abre exactamente esta barbería. */
  placeId: 'ChIJ3frCWtopRI4R3NQFX3Bt4qQ',
  hours: 'Lun a Sáb · 9:00 a. m. – 7:00 p. m.',
  /** Número en formato internacional, sin "+" ni espacios (ej. 573001234567). */
  whatsapp: '573000000000',
  phone: '+57 300 000 0000',
  email: 'contacto@alphacorte.com',
};

export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 19;

/** Preguntas frecuentes (RF010). */
export const FAQ = [
  {
    q: '¿Puedo reservar varios servicios en una misma cita?',
    a: 'Sí. En Reservar marca todos los servicios que quieras; la app suma el precio y la duración y solo muestra horarios donde cabe la cita completa.',
  },
  {
    q: '¿Cómo cancelo o reprogramo una cita?',
    a: 'En Mis citas pulsa Cancelar o Reprogramar. Se puede hacer hasta 1 hora antes de la cita.',
  },
  {
    q: '¿Por qué no aparecen algunos horarios?',
    a: 'Los horarios grises ya pasaron, están ocupados por otra cita del barbero o la cita terminaría después de las 7:00 p. m.',
  },
  {
    q: '¿Cómo califico a mi barbero?',
    a: 'Después de la cita, entra a Historial y pulsa Calificar. Puedes dar de 1 a 5 estrellas y dejar un comentario.',
  },
  {
    q: '¿Cuál es el horario de atención?',
    a: 'Lunes a sábado de 9:00 a. m. a 7:00 p. m. Los domingos no se atiende.',
  },
];

/** Planes de suscripción (RF009). Los valores reales los aplica la función subscribe() en la base de datos. */
export const PLANS = [
  { id: 'mensual' as const, name: 'Plan Mensual', price: 60000, discountPct: 10, days: 30, perks: ['10% de descuento en todas tus citas', 'Vigencia de 30 días'] },
  { id: 'trimestral' as const, name: 'Plan Trimestral', price: 160000, discountPct: 15, days: 90, perks: ['15% de descuento en todas tus citas', 'Vigencia de 90 días', 'El mejor precio por mes'] },
];
