import { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase, supabaseConfigured } from '@/lib/supabase';

export type Role = 'cliente' | 'barbero' | 'admin';

export type User = { id: string; name: string; email: string; phone: string; role: Role };

export type Profile = { id: string; name: string; phone: string | null; role: Role };

export type ServiceIcon = 'cut' | 'man' | 'sparkles' | 'color-wand';

export type Service = { id: string; name: string; price: number; minutes: number; icon: ServiceIcon; active: boolean };

export type Barber = { id: string; name: string; specialty: string; rating: number; active: boolean; profileId: string | null };

/** Servicio incluido en una cita, con el precio y la duración del momento en que se reservó. */
export type AppointmentService = { serviceId: string; price: number; minutes: number };

export type Review = { rating: number; comment: string | null };

export type Appointment = {
  id: string;
  clientId: string;
  client: { name: string; phone: string | null } | null;
  barberId: string;
  start: string; // ISO
  end: string; // ISO
  totalPrice: number;
  discountPct: number;
  status: 'confirmada' | 'cancelada';
  services: AppointmentService[];
  review: Review | null;
};

export type Notification = { id: string; title: string; body: string; read: boolean; createdAt: string };

export type Plan = 'mensual' | 'trimestral';

export type Subscription = { id: string; plan: Plan; price: number; discountPct: number; endsAt: string };

/** Rango ocupado de un barbero, en milisegundos. */
export type BusyRange = { start: number; end: number };

type Result = { ok: boolean; message?: string };

type Ctx = {
  ready: boolean;
  configured: boolean;
  /** Hay sesión iniciada (el perfil puede estar cargando todavía). */
  hasSession: boolean;
  user: User | null;
  services: Service[];
  barbers: Barber[];
  activeServices: Service[];
  activeBarbers: Barber[];
  appointments: Appointment[];
  notifications: Notification[];
  unread: number;
  subscription: Subscription | null;
  /** Solo para administradores. */
  profiles: Profile[];
  activeSubscriptions: number;
  myBarberId: string | null;

  reload: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<Result>;
  signUp: (name: string, email: string, phone: string, password: string) => Promise<Result>;
  signOut: () => Promise<void>;
  book: (a: { barberId: string; start: string; serviceIds: string[] }) => Promise<Result>;
  cancel: (id: string) => Promise<Result>;
  reschedule: (id: string, start: string) => Promise<Result>;
  rate: (a: Appointment, rating: number, comment: string) => Promise<Result>;
  busyRanges: (barberId: string, day: Date) => Promise<BusyRange[]>;
  markAllRead: () => Promise<void>;
  subscribe: (plan: Plan) => Promise<Result>;
  cancelSubscription: () => Promise<Result>;
  saveService: (s: Omit<Service, 'id'> & { id?: string }) => Promise<Result>;
  setRole: (profileId: string, role: Role) => Promise<Result>;
  linkBarber: (profileId: string, barberId: string | 'new') => Promise<Result>;
  setBarberActive: (barberId: string, active: boolean) => Promise<Result>;
  deleteAppointment: (id: string) => Promise<Result>;
  deleteService: (id: string) => Promise<Result>;
  deleteNotification: (id: string) => Promise<Result>;
  clearNotifications: () => Promise<Result>;
  /** Mensaje si falló la carga inicial de datos (por ejemplo, sin conexión). */
  loadError: string;

  serviceById: (id: string) => Service | undefined;
  barberById: (id: string) => Barber | undefined;
  servicesLabel: (a: Appointment) => string;
};

const AppContext = createContext<Ctx | null>(null);

/** Traduce los errores de Supabase/Postgres a mensajes para el usuario. */
function friendly(message: string): string {
  if (/Invalid login credentials/i.test(message)) return 'Correo o contraseña incorrectos.';
  if (/already registered/i.test(message)) return 'Ese correo ya está registrado.';
  if (/Email not confirmed/i.test(message)) return 'Debes confirmar tu correo antes de iniciar sesión.';
  if (/reviews_appointment_id_key/i.test(message)) return 'Ya calificaste esta cita.';
  if (/appointments_no_overlap/i.test(message)) return 'Ese horario acaba de ser ocupado. Elige otro.';
  if (/appointment_services_service_id_fkey/i.test(message)) return 'Este servicio ya se usó en citas: desactívalo en lugar de eliminarlo.';
  if (/row-level security/i.test(message)) return 'No tienes permiso para hacer esta acción.';
  if (/Failed to fetch|Network request failed/i.test(message)) return 'Sin conexión con el servidor. Intenta de nuevo.';
  // Los mensajes de las reglas de negocio ya vienen en español desde la base de datos.
  return message;
}

const fail = (error: { message: string } | null): Result | null =>
  error ? { ok: false, message: friendly(error.message) } : null;

type Row = {
  id: string;
  client_id: string;
  client: { name: string; phone: string | null } | { name: string; phone: string | null }[] | null;
  barber_id: string;
  start_at: string;
  end_at: string;
  total_price: number;
  discount_pct: number;
  status: 'confirmada' | 'cancelada';
  appointment_services: { service_id: string; price: number; minutes: number }[] | null;
  reviews: Review | Review[] | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

function toAppointment(r: Row): Appointment {
  const review = one(r.reviews);
  return {
    id: r.id,
    clientId: r.client_id,
    client: one(r.client),
    barberId: r.barber_id,
    start: r.start_at,
    end: r.end_at,
    totalPrice: r.total_price,
    discountPct: r.discount_pct ?? 0,
    status: r.status,
    services: (r.appointment_services ?? []).map((s) => ({ serviceId: s.service_id, price: s.price, minutes: s.minutes })),
    review: review ? { rating: review.rating, comment: review.comment } : null,
  };
}

const APPOINTMENT_SELECT =
  'id, client_id, barber_id, start_at, end_at, total_price, discount_pct, status, ' +
  'client:profiles!appointments_client_id_fkey(name, phone), ' +
  'appointment_services(service_id, price, minutes), reviews(rating, comment)';

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState(0);
  const [loadError, setLoadError] = useState('');

  // Sesión: se restaura desde AsyncStorage y se mantiene sincronizada.
  useEffect(() => {
    if (!supabaseConfigured) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadCatalog = useCallback(async () => {
    const [svc, brb] = await Promise.all([
      supabase.from('services').select('id, name, price, minutes, icon, active').order('price'),
      supabase.from('barbers').select('id, name, specialty, rating, active, profile_id').order('name'),
    ]);
    setServices((svc.data ?? []) as Service[]);
    setBarbers(
      (brb.data ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        specialty: b.specialty,
        rating: Number(b.rating),
        active: b.active,
        profileId: b.profile_id,
      })),
    );
  }, []);

  const loadAppointments = useCallback(async () => {
    const { data, error } = await supabase.from('appointments').select(APPOINTMENT_SELECT).order('start_at');
    if (error) return;
    setAppointments(((data ?? []) as unknown as Row[]).map(toAppointment));
  }, []);

  const loadNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, read, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data ?? []).map((n) => ({ id: n.id, title: n.title, body: n.body, read: n.read, createdAt: n.created_at })));
  }, []);

  const loadSubscription = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('subscriptions')
      .select('id, plan, price, discount_pct, ends_at')
      .eq('user_id', uid)
      .eq('status', 'activa')
      .gt('ends_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    const s = data?.[0];
    setSubscription(s ? { id: s.id, plan: s.plan, price: s.price, discountPct: s.discount_pct, endsAt: s.ends_at } : null);
  }, []);

  const loadAdmin = useCallback(async () => {
    const [p, subs] = await Promise.all([
      supabase.from('profiles').select('id, name, phone, role').order('name'),
      supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'activa').gt('ends_at', new Date().toISOString()),
    ]);
    setProfiles((p.data ?? []) as Profile[]);
    setActiveSubscriptions(subs.count ?? 0);
  }, []);

  const loadAll = useCallback(
    async (u: User) => {
      await Promise.all([
        loadCatalog(),
        loadAppointments(),
        loadNotifications(),
        loadSubscription(u.id),
        u.role === 'admin' ? loadAdmin() : Promise.resolve(),
      ]);
    },
    [loadCatalog, loadAppointments, loadNotifications, loadSubscription, loadAdmin],
  );

  // Al haber sesión: cargar perfil y luego todos los datos según el rol.
  useEffect(() => {
    if (!session) {
      setUser(null);
      setAppointments([]);
      setNotifications([]);
      setSubscription(null);
      setProfiles([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
      const profile = await supabase.from('profiles').select('name, phone, role').eq('id', session.user.id).single();
      const u: User = {
        id: session.user.id,
        email: session.user.email ?? '',
        name: profile.data?.name ?? session.user.email?.split('@')[0] ?? '',
        phone: profile.data?.phone ?? '',
        role: (profile.data?.role as Role) ?? 'cliente',
      };
      await loadAll(u);
      if (cancelled) return;
      setLoadError(profile.error ? friendly(profile.error.message) : '');
      setUser(u);
      } catch (e) {
        // Sin conexión u otro fallo: no se cae la app; se muestra el aviso y se puede recargar.
        if (!cancelled) setLoadError(friendly(e instanceof Error ? e.message : String(e)));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, loadAll]);

  const serviceById = useCallback((id: string) => services.find((s) => s.id === id), [services]);
  const barberById = useCallback((id: string) => barbers.find((b) => b.id === id), [barbers]);
  const myBarberId = useMemo(() => (user ? (barbers.find((b) => b.profileId === user.id)?.id ?? null) : null), [user, barbers]);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      configured: supabaseConfigured,
      hasSession: !!session,
      user,
      services,
      barbers,
      activeServices: services.filter((s) => s.active),
      activeBarbers: barbers.filter((b) => b.active),
      appointments,
      notifications,
      unread: notifications.filter((n) => !n.read).length,
      subscription,
      profiles,
      activeSubscriptions,
      myBarberId,

      loadError,

      reload: async () => {
        if (!user) return;
        try {
          await loadAll(user);
          setLoadError('');
        } catch (e) {
          setLoadError(friendly(e instanceof Error ? e.message : String(e)));
        }
      },

      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return fail(error) ?? { ok: true };
      },

      signUp: async (name, email, phone, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, phone } } });
        if (error) return { ok: false, message: friendly(error.message) };
        // Si el proyecto exige confirmar el correo, no hay sesión todavía.
        if (!data.session) {
          return { ok: false, message: 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.' };
        }
        return { ok: true };
      },

      signOut: async () => {
        await supabase.auth.signOut();
      },

      /** Reserva una cita con uno o varios servicios (función book_appointment en la BD). */
      book: async ({ barberId, start, serviceIds }) => {
        const { error } = await supabase.rpc('book_appointment', { p_barber: barberId, p_start: start, p_services: serviceIds });
        if (error) return { ok: false, message: friendly(error.message) };
        await Promise.all([loadAppointments(), loadNotifications()]);
        return { ok: true };
      },

      cancel: async (id) => {
        const { error } = await supabase.from('appointments').update({ status: 'cancelada' }).eq('id', id);
        if (error) return { ok: false, message: friendly(error.message) };
        await Promise.all([loadAppointments(), loadNotifications()]);
        return { ok: true };
      },

      /** Cambia la hora; la base de datos conserva la duración y recalcula la hora de fin. */
      reschedule: async (id, start) => {
        const { error } = await supabase.from('appointments').update({ start_at: start }).eq('id', id);
        if (error) return { ok: false, message: friendly(error.message) };
        await Promise.all([loadAppointments(), loadNotifications()]);
        return { ok: true };
      },

      rate: async (a, rating, comment) => {
        const { error } = await supabase
          .from('reviews')
          .insert({ appointment_id: a.id, barber_id: a.barberId, rating, comment: comment.trim() || null });
        if (error) return { ok: false, message: friendly(error.message) };
        await Promise.all([loadAppointments(), loadCatalog()]);
        return { ok: true };
      },

      busyRanges: async (barberId, day) => {
        if (!session) return []; // sin sesión (por ejemplo, justo al cerrar sesión) no se consulta
        const from = new Date(day);
        from.setHours(0, 0, 0, 0);
        const to = new Date(from);
        to.setDate(to.getDate() + 1);
        const { data } = await supabase.rpc('busy_slots', { p_barber: barberId, p_from: from.toISOString(), p_to: to.toISOString() });
        return ((data ?? []) as { start_at: string; end_at: string }[]).map((r) => ({
          start: new Date(r.start_at).getTime(),
          end: new Date(r.end_at).getTime(),
        }));
      },

      markAllRead: async () => {
        if (!user || !notifications.some((n) => !n.read)) return;
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
      },

      subscribe: async (plan) => {
        const { error } = await supabase.rpc('subscribe', { p_plan: plan });
        if (error) return { ok: false, message: friendly(error.message) };
        if (user) await Promise.all([loadSubscription(user.id), loadNotifications()]);
        return { ok: true };
      },

      cancelSubscription: async () => {
        const { error } = await supabase.rpc('cancel_subscription');
        if (error) return { ok: false, message: friendly(error.message) };
        setSubscription(null);
        return { ok: true };
      },

      saveService: async ({ id, ...s }) => {
        const { error } = id
          ? await supabase.from('services').update(s).eq('id', id)
          : await supabase.from('services').insert(s);
        if (error) return { ok: false, message: friendly(error.message) };
        await loadCatalog();
        return { ok: true };
      },

      setRole: async (profileId, role) => {
        const { error } = await supabase.from('profiles').update({ role }).eq('id', profileId);
        if (error) return { ok: false, message: friendly(error.message) };
        // Si deja de ser barbero, se desvincula de su ficha de barbero.
        if (role !== 'barbero') await supabase.from('barbers').update({ profile_id: null }).eq('profile_id', profileId);
        await Promise.all([loadAdmin(), loadCatalog()]);
        return { ok: true };
      },

      linkBarber: async (profileId, barberId) => {
        await supabase.from('barbers').update({ profile_id: null }).eq('profile_id', profileId);
        const { error } =
          barberId === 'new'
            ? await supabase.from('barbers').insert({
                name: profiles.find((p) => p.id === profileId)?.name ?? 'Barbero',
                specialty: '',
                profile_id: profileId,
              })
            : await supabase.from('barbers').update({ profile_id: profileId }).eq('id', barberId);
        if (error) return { ok: false, message: friendly(error.message) };
        await loadCatalog();
        return { ok: true };
      },

      setBarberActive: async (barberId, active) => {
        const { error } = await supabase.from('barbers').update({ active }).eq('id', barberId);
        if (error) return { ok: false, message: friendly(error.message) };
        await loadCatalog();
        return { ok: true };
      },

      /** El cliente solo puede borrar citas canceladas (lo verifica la política RLS). */
      deleteAppointment: async (id) => {
        const { error, count } = await supabase.from('appointments').delete({ count: 'exact' }).eq('id', id);
        if (error) return { ok: false, message: friendly(error.message) };
        if (!count) return { ok: false, message: 'No se pudo eliminar: solo se borran citas canceladas.' };
        setAppointments((prev) => prev.filter((a) => a.id !== id));
        return { ok: true };
      },

      deleteService: async (id) => {
        // Si el servicio ya se usó en alguna cita, no se intenta borrar: se sugiere desactivarlo.
        const used = await supabase.from('appointment_services').select('service_id', { count: 'exact', head: true }).eq('service_id', id);
        if (used.count) return { ok: false, message: 'Este servicio ya se usó en citas: desactívalo en lugar de eliminarlo.' };
        const { error, count } = await supabase.from('services').delete({ count: 'exact' }).eq('id', id);
        if (error) return { ok: false, message: friendly(error.message) };
        if (!count) return { ok: false, message: 'No tienes permiso para eliminar servicios.' };
        await loadCatalog();
        return { ok: true };
      },

      deleteNotification: async (id) => {
        const { error } = await supabase.from('notifications').delete().eq('id', id);
        if (error) return { ok: false, message: friendly(error.message) };
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        return { ok: true };
      },

      clearNotifications: async () => {
        if (!user) return { ok: false };
        const { error } = await supabase.from('notifications').delete().eq('user_id', user.id);
        if (error) return { ok: false, message: friendly(error.message) };
        setNotifications([]);
        return { ok: true };
      },

      serviceById,
      barberById,
      servicesLabel: (a) => a.services.map((s) => serviceById(s.serviceId)?.name ?? 'Servicio').join(' + ') || 'Cita',
    }),
    [
      ready, session, user, services, barbers, appointments, notifications, subscription, profiles, activeSubscriptions, loadError,
      myBarberId, loadAll, loadAppointments, loadNotifications, loadSubscription, loadCatalog, loadAdmin, serviceById, barberById,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return ctx;
}
