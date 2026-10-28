import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states';
import { Button, Card, Chip, Section } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { canModify, formatCOP, formatLongDate, formatTime, nextOpenDays, sameDay } from '@/lib/dates';

/** Agenda del barbero (RF003) y sus calificaciones (RF007). */
export default function Agenda() {
  const { appointments, myBarberId, barberById, servicesLabel, cancel, reload } = useApp();
  const days = useMemo(() => nextOpenDays(7), []);
  const [day, setDay] = useState(days[0]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      reload();
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const me = myBarberId ? barberById(myBarberId) : undefined;
  const mine = appointments.filter((a) => a.barberId === myBarberId);
  const now = Date.now();
  const ofDay = mine
    .filter((a) => a.status === 'confirmada' && sameDay(new Date(a.start), day))
    .sort((a, b) => a.start.localeCompare(b.start));
  const reviews = mine.filter((a) => a.review).sort((a, b) => b.start.localeCompare(a.start));
  const visits = (clientId: string) =>
    mine.filter((a) => a.clientId === clientId && a.status === 'confirmada' && new Date(a.end).getTime() <= now).length;

  if (!myBarberId) {
    return (
      <Screen>
        <Header title="Agenda" />
        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.muted}>
            Tu cuenta tiene rol de barbero, pero aún no está vinculada a una ficha de barbero. Pídele al administrador que la
            vincule en la pestaña Usuarios.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen onRefresh={reload}>
      <Header title="Mi agenda" subtitle={`${me?.name ?? ''} · ★ ${me?.rating.toFixed(1) ?? '—'}`} />

      <Section>Día</Section>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {days.map((d) => {
          const n = mine.filter((a) => a.status === 'confirmada' && sameDay(new Date(a.start), d)).length;
          return (
            <Chip
              key={d.toISOString()}
              label={`${formatLongDate(d)}${n ? ` · ${n}` : ''}`}
              selected={sameDay(d, day)}
              onPress={() => setDay(d)}
            />
          );
        })}
      </ScrollView>

      <Section>{ofDay.length ? `${ofDay.length} cita${ofDay.length > 1 ? 's' : ''}` : 'Citas'}</Section>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {ofDay.length === 0 && <EmptyState icon="calendar-clear-outline" title="No tienes citas este día" text="Elige otro día arriba." />}
      {ofDay.map((a) => {
        const start = new Date(a.start);
        const past = new Date(a.end).getTime() <= now;
        const v = visits(a.clientId);
        return (
          <Card key={a.id} style={[{ marginBottom: spacing.sm }, past && { opacity: 0.6 }]}>
            <View style={styles.row}>
              <Text style={styles.time}>
                {formatTime(start)} – {formatTime(new Date(a.end))}
              </Text>
              {past && <Text style={styles.tag}>Realizada</Text>}
            </View>
            <Text style={styles.name}>{a.client?.name ?? 'Cliente'}</Text>
            <Text style={styles.muted}>{servicesLabel(a)}</Text>
            <Text style={styles.muted}>
              Total: {formatCOP(a.totalPrice)}
              {a.discountPct ? ` (con ${a.discountPct}% de suscripción)` : ''} · {v ? `${v} ${v > 1 ? 'visitas anteriores' : 'visita anterior'}` : 'Cliente nuevo'}
            </Text>
            {!!a.client?.phone && (
              <Text style={styles.link} onPress={() => Linking.openURL(`tel:${a.client?.phone}`).catch(() => {})}>
                <Ionicons name="call" size={13} color={colors.gold} /> {a.client.phone}
              </Text>
            )}
            {!past && canModify(start) && confirmId !== a.id && (
              <Button title="Cancelar cita" variant="danger" onPress={() => setConfirmId(a.id)} style={{ marginTop: spacing.md }} />
            )}
            {confirmId === a.id && (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.name}>¿Cancelar esta cita? Se le avisará al cliente.</Text>
                <View style={styles.actions}>
                  <Button title="Volver" variant="ghost" onPress={() => setConfirmId(null)} style={{ flex: 1, marginRight: spacing.sm }} />
                  <Button
                    title="Sí, cancelar"
                    variant="danger"
                    onPress={async () => {
                      const res = await cancel(a.id);
                      setConfirmId(null);
                      setError(res.ok ? '' : (res.message ?? ''));
                    }}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}
          </Card>
        );
      })}

      <Section>Mis calificaciones</Section>
      {reviews.length === 0 && <EmptyState icon="star-outline" title="Todavía no tienes calificaciones" />}
      {reviews.map((a) => (
        <Card key={a.id} style={{ marginBottom: spacing.sm }}>
          <Text style={styles.stars}>{'★'.repeat(a.review!.rating)}{'☆'.repeat(5 - a.review!.rating)}</Text>
          {!!a.review!.comment && <Text style={styles.muted}>“{a.review!.comment}”</Text>}
          <Text style={styles.small}>
            {a.client?.name} · {formatLongDate(new Date(a.start))}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 13 },
  small: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  name: { color: colors.text, fontWeight: '700', marginTop: 2 },
  time: { color: colors.gold, fontWeight: '700', flex: 1 },
  tag: { color: colors.textMuted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  link: { color: colors.gold, fontSize: 13, marginTop: 4 },
  stars: { color: colors.gold, fontSize: 16, marginBottom: 2 },
  actions: { flexDirection: 'row', marginTop: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.sm },
});
