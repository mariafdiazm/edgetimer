import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Header } from '@/components/Header';
import { Button, Card, Section } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { SHOP } from '@/data/mock';
import { formatCOP, formatDuration, formatLongDate, formatTime } from '@/lib/dates';

export default function Home() {
  const router = useRouter();
  const { user, appointments, activeServices: services, barberById, servicesLabel, subscription, reload } = useApp();

  const next = appointments
    .filter((a) => a.status === 'confirmada' && new Date(a.start) > new Date())
    .sort((a, b) => a.start.localeCompare(b.start))[0];

  if (user?.role === 'barbero') return <Redirect href="/agenda" />;
  if (user?.role === 'admin') return <Redirect href="/panel" />;

  // Resumen del cliente
  const nowMs = Date.now();
  const upcomingCount = appointments.filter((a) => a.status === 'confirmada' && new Date(a.end).getTime() > nowMs).length;
  const doneCount = appointments.filter((a) => a.status === 'confirmada' && new Date(a.end).getTime() <= nowMs).length;
  const ratedCount = appointments.filter((a) => a.review).length;

  // Recordatorio de cita en las próximas 24 horas (RF006).
  const soon = next && new Date(next.start).getTime() - Date.now() < 24 * 3600 * 1000;

  return (
    <Screen onRefresh={reload}>
      <Text style={styles.hello}>Hola, {user?.name} 👋</Text>
      <Header title={SHOP.name} subtitle={SHOP.hours} />

      {soon && next && (
        <Card style={styles.reminder}>
          <Ionicons name="alarm" size={22} color={colors.gold} />
          <Text style={[styles.text, { flex: 1, marginLeft: spacing.sm }]}>
            Recordatorio: tienes cita hoy o mañana a las {formatTime(new Date(next.start))} con {barberById(next.barberId)?.name}.
          </Text>
        </Card>
      )}

      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{upcomingCount}</Text>
          <Text style={styles.muted}>próximas</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{doneCount}</Text>
          <Text style={styles.muted}>realizadas</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{ratedCount}</Text>
          <Text style={styles.muted}>calificadas</Text>
        </Card>
      </View>

      <Section>Tu próxima cita</Section>
      {next ? (
        <Card>
          <Text style={styles.big}>{servicesLabel(next)}</Text>
          <Text style={styles.muted}>
            {formatLongDate(new Date(next.start))} · {formatTime(new Date(next.start))} a{' '}
            {formatTime(new Date(next.end))}
          </Text>
          <Text style={styles.muted}>Total: {formatCOP(next.totalPrice)}</Text>
          <Text style={styles.muted}>con {barberById(next.barberId)?.name}</Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.muted}>Aún no tienes citas programadas.</Text>
          <View style={{ height: spacing.md }} />
          <Button title="Reservar ahora" onPress={() => router.push('/reservar')} />
        </Card>
      )}

      <Card style={[styles.row, { marginTop: spacing.md }]}>
        <Ionicons name="ribbon" size={22} color={colors.gold} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.name}>{subscription ? `Plan ${subscription.plan} activo` : 'Plan Alpha'}</Text>
          <Text style={styles.muted}>
            {subscription ? `${subscription.discountPct}% de descuento en tus citas` : 'Hasta 15% de descuento en todas tus citas'}
          </Text>
        </View>
        <Button title={subscription ? 'Ver' : 'Conocer'} variant="ghost" onPress={() => router.push('/suscripcion')} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
      </Card>

      <Section>Servicios</Section>
      <Text style={[styles.muted, { marginBottom: spacing.sm }]}>
        Puedes combinar varios en una misma cita desde Reservar.
      </Text>
      {services.map((s) => (
        <Card key={s.id} style={styles.row}>
          <Ionicons name={s.icon} size={22} color={colors.gold} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.name}>{s.name}</Text>
            <Text style={styles.muted}>{formatDuration(s.minutes)}</Text>
          </View>
          <Text style={styles.price}>{formatCOP(s.price)}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: { color: colors.textMuted, marginBottom: 4 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  stat: { width: '32%', alignItems: 'center', paddingVertical: spacing.sm },
  statValue: { color: colors.gold, fontSize: 22, fontWeight: '800' },
  text: { color: colors.text, fontSize: 14 },
  reminder: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, borderColor: colors.gold },
  muted: { color: colors.textMuted, fontSize: 13 },
  big: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  name: { color: colors.text, fontWeight: '600' },
  price: { color: colors.gold, fontWeight: '700' },
});
