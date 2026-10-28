import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button, Card, Chip, Section, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { BusyRange, useApp } from '@/context/AppContext';
import {
  endsBeforeClose,
  formatCOP,
  formatDuration,
  formatLongDate,
  formatTime,
  nextOpenDays,
  overlaps,
  sameDay,
  slotsFor,
} from '@/lib/dates';

export default function Reservar() {
  const router = useRouter();
  const { reschedule: rescheduleId } = useLocalSearchParams<{ reschedule?: string }>();
  const { appointments, activeServices: services, activeBarbers: barbers, book, reschedule, busyRanges, serviceById, barberById, subscription } = useApp();

  const editing = appointments.find((a) => a.id === rescheduleId && a.status === 'confirmada');
  const days = useMemo(() => nextOpenDays(7), []);

  const [selected, setSelected] = useState<string[]>([]);
  const [barberId, setBarberId] = useState('');
  const [day, setDay] = useState<Date>(days[0]);
  const [slot, setSlot] = useState<Date | null>(null);
  const [busy, setBusy] = useState<BusyRange[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Valores iniciales: la cita que se reprograma, o el primer barbero disponible.
  useEffect(() => {
    if (editing) {
      setSelected(editing.services.map((s) => s.serviceId));
      setBarberId(editing.barberId);
    } else {
      setSelected([]);
      if (!barberId && barbers[0]) setBarberId(barbers[0].id);
    }
    setSlot(null);
  }, [editing?.id, barbers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Horarios ocupados del barbero en el día elegido (consulta a Supabase).
  useEffect(() => {
    if (!barberId) return;
    let cancelled = false;
    busyRanges(barberId, day).then((b) => {
      if (!cancelled) setBusy(b);
    });
    return () => {
      cancelled = true;
    };
  }, [barberId, day, busyRanges, appointments]);

  // Totales de los servicios elegidos (en reprogramación, los de la cita original).
  const chosen = editing
    ? editing.services.map((s) => ({ ...s, name: serviceById(s.serviceId)?.name ?? 'Servicio' }))
    : selected.map((id) => {
        const s = serviceById(id)!;
        return { serviceId: id, name: s?.name ?? '', price: s?.price ?? 0, minutes: s?.minutes ?? 0 };
      });
  const totalMinutes = chosen.reduce((n, s) => n + s.minutes, 0);
  const subtotal = chosen.reduce((n, s) => n + s.price, 0);
  const discountPct = editing ? editing.discountPct : (subscription?.discountPct ?? 0);
  const totalPrice = Math.round((subtotal * (100 - discountPct)) / 100);

  const toggle = (id: string) => {
    setSlot(null);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const now = new Date();
  const own = editing ? { start: new Date(editing.start).getTime(), end: new Date(editing.end).getTime() } : null;
  const slots = slotsFor(day).map((s) => {
    const start = s.getTime();
    const end = start + Math.max(totalMinutes, 1) * 60_000;
    const taken = busy.some(
      (b) => !(own && b.start === own.start && b.end === own.end) && overlaps(start, end, b.start, b.end),
    );
    return { date: s, disabled: s <= now || taken || !endsBeforeClose(s, totalMinutes) };
  });

  const confirm = async () => {
    if (!slot) return;
    setSaving(true);
    setError('');
    const res = editing
      ? await reschedule(editing.id, slot.toISOString())
      : await book({ barberId, start: slot.toISOString(), serviceIds: selected });
    setSaving(false);
    if (!res.ok) return setError(res.message ?? 'No se pudo guardar la cita.');
    setSlot(null);
    setSelected([]);
    router.replace({ pathname: '/citas', params: { ok: editing ? 'reprogramada' : 'reservada' } });
  };

  return (
    <Screen>
      <Title>{editing ? 'Reprogramar cita' : 'Reservar cita'}</Title>
      <Text style={styles.muted}>
        {editing ? 'Elige el nuevo día y hora.' : 'Puedes elegir uno o varios servicios para la misma cita.'}
      </Text>

      <Section>Servicios</Section>
      {services.map((s) => {
        const on = editing ? chosen.some((c) => c.serviceId === s.id) : selected.includes(s.id);
        return (
          <Pressable
            key={s.id}
            onPress={() => toggle(s.id)}
            disabled={!!editing}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={[styles.service, on && styles.serviceOn, !!editing && !on && { opacity: 0.35 }]}
          >
            <Ionicons
              name={on ? 'checkbox' : 'square-outline'}
              size={22}
              color={on ? colors.gold : colors.textMuted}
            />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.serviceName}>{s.name}</Text>
              <Text style={styles.muted}>{formatDuration(s.minutes)}</Text>
            </View>
            <Text style={styles.price}>{formatCOP(s.price)}</Text>
          </Pressable>
        );
      })}

      <Section>Barbero</Section>
      <View style={styles.wrap}>
        {barbers.map((b) => (
          <Chip
            key={b.id}
            label={`${b.name} ★ ${b.rating.toFixed(1)}`}
            selected={b.id === barberId}
            disabled={!!editing}
            onPress={() => {
              setBarberId(b.id);
              setSlot(null);
            }}
          />
        ))}
      </View>

      <Section>Día</Section>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {days.map((d) => (
          <Chip
            key={d.toISOString()}
            label={formatLongDate(d)}
            selected={sameDay(d, day)}
            onPress={() => {
              setDay(d);
              setSlot(null);
            }}
          />
        ))}
      </ScrollView>

      <Section>Hora</Section>
      {chosen.length === 0 ? (
        <Text style={styles.muted}>Elige al menos un servicio para ver los horarios disponibles.</Text>
      ) : (
        <View style={styles.wrap}>
          {slots.map(({ date, disabled }) => (
            <Chip
              key={date.toISOString()}
              label={formatTime(date)}
              selected={!!slot && slot.getTime() === date.getTime()}
              disabled={disabled}
              onPress={() => setSlot(date)}
            />
          ))}
        </View>
      )}

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.sumTitle}>Resumen</Text>
        {chosen.length === 0 && <Text style={styles.muted}>Sin servicios seleccionados.</Text>}
        {chosen.map((s) => (
          <View key={s.serviceId} style={styles.sumRow}>
            <Text style={styles.sumText}>{s.name}</Text>
            <Text style={styles.sumText}>{formatCOP(s.price)}</Text>
          </View>
        ))}
        {chosen.length > 0 && discountPct > 0 && (
          <View style={styles.sumRow}>
            <Text style={[styles.sumText, { color: colors.gold }]}>Descuento Plan Alpha ({discountPct}%)</Text>
            <Text style={[styles.sumText, { color: colors.gold }]}>−{formatCOP(subtotal - totalPrice)}</Text>
          </View>
        )}
        {chosen.length > 0 && (
          <View style={[styles.sumRow, styles.sumTotal]}>
            <Text style={styles.totalText}>Total · {formatDuration(totalMinutes)}</Text>
            <Text style={styles.totalText}>{formatCOP(totalPrice)}</Text>
          </View>
        )}
        <Text style={[styles.muted, { marginTop: spacing.sm }]}>Barbero: {barberById(barberId)?.name ?? '—'}</Text>
        <Text style={styles.muted}>
          {slot
            ? `${formatLongDate(slot)} · ${formatTime(slot)} a ${formatTime(new Date(slot.getTime() + totalMinutes * 60_000))}`
            : 'Selecciona un horario'}
        </Text>
      </Card>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button
        title={saving ? 'Guardando…' : editing ? 'Confirmar cambio' : 'Confirmar reserva'}
        onPress={confirm}
        disabled={!slot || saving || chosen.length === 0}
        style={{ marginTop: spacing.md }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 13 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  service: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  serviceOn: { borderColor: colors.gold },
  serviceName: { color: colors.text, fontWeight: '600' },
  price: { color: colors.gold, fontWeight: '700' },
  sumTitle: { color: colors.text, fontWeight: '700', marginBottom: 6 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  sumText: { color: colors.textMuted, fontSize: 13 },
  sumTotal: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, marginTop: 4 },
  totalText: { color: colors.text, fontWeight: '700' },
  error: { color: colors.danger, marginTop: spacing.md },
});
