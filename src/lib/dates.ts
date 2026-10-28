import { CLOSE_HOUR, OPEN_HOUR } from '@/data/mock';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const dayShort = (d: Date) => DAYS[d.getDay()];
export const monthShort = (d: Date) => MONTHS[d.getMonth()];

export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Próximos `count` días en los que la barbería abre (lunes a sábado). */
export function nextOpenDays(count: number, from: Date = new Date()): Date[] {
  const out: Date[] = [];
  const cursor = startOfDay(from);
  while (out.length < count) {
    if (cursor.getDay() !== 0) out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Horarios cada 30 minutos entre apertura y cierre. */
export function slotsFor(day: Date): Date[] {
  const slots: Date[] = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    for (const m of [0, 30]) {
      const s = new Date(day);
      s.setHours(h, m, 0, 0);
      slots.push(s);
    }
  }
  return slots;
}

export function formatTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const suffix = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${m} ${suffix}`;
}

export function formatLongDate(d: Date): string {
  return `${dayShort(d)} ${d.getDate()} ${monthShort(d)}`;
}

export const formatCOP = (n: number) => '$' + n.toLocaleString('es-CO');

/** Regla RF004: solo se puede cancelar/reprogramar con al menos 1 hora de antelación. */
export function canModify(start: Date, now: Date = new Date()): boolean {
  return start.getTime() - now.getTime() >= 60 * 60 * 1000;
}

/** "1 h 30 min", "45 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** La cita debe terminar antes o justo a la hora de cierre. */
export function endsBeforeClose(start: Date, minutes: number): boolean {
  const close = new Date(start);
  close.setHours(CLOSE_HOUR, 0, 0, 0);
  return start.getTime() + minutes * 60_000 <= close.getTime();
}

/** ¿Se cruzan los intervalos [aStart, aEnd) y [bStart, bEnd)? (en milisegundos) */
export const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd;
