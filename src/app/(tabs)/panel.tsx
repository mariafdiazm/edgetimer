import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states';
import { Card, Section } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { formatCOP, formatTime, sameDay } from '@/lib/dates';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </Card>
  );
}

function Bar({ label, value, max, right }: { label: string; value: number; max: number; right: string }) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <View style={styles.rowBetween}>
        <Text style={styles.text}>{label}</Text>
        <Text style={styles.muted}>{right}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${max ? Math.max(4, (value / max) * 100) : 0}%` }]} />
      </View>
    </View>
  );
}

/** Panel de administración con métricas de la barbería (RF008). */
export default function Panel() {
  const { appointments, services, barbers, profiles, activeSubscriptions, servicesLabel, barberById, reload } = useApp();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const now = Date.now();
  const confirmed = appointments.filter((a) => a.status === 'confirmada');
  const done = confirmed.filter((a) => new Date(a.end).getTime() <= now);
  const upcoming = confirmed.filter((a) => new Date(a.end).getTime() > now);
  const cancelled = appointments.filter((a) => a.status === 'cancelada');
  const income = done.reduce((n, a) => n + a.totalPrice, 0);
  const projected = upcoming.reduce((n, a) => n + a.totalPrice, 0);
  const clients = profiles.filter((p) => p.role === 'cliente').length;
  const cancelRate = appointments.length ? Math.round((cancelled.length / appointments.length) * 100) : 0;

  // Servicios más solicitados (en citas confirmadas)
  const byService = services
    .map((s) => ({ s, n: confirmed.reduce((k, a) => k + a.services.filter((x) => x.serviceId === s.id).length, 0) }))
    .sort((a, b) => b.n - a.n);
  const maxService = Math.max(0, ...byService.map((x) => x.n));

  // Rendimiento de barberos
  const byBarber = barbers
    .map((b) => {
      const mine = confirmed.filter((a) => a.barberId === b.id);
      return { b, n: mine.length, income: mine.filter((a) => new Date(a.end).getTime() <= now).reduce((k, a) => k + a.totalPrice, 0) };
    })
    .sort((a, b) => b.n - a.n);
  const maxBarber = Math.max(0, ...byBarber.map((x) => x.n));

  const today = upcoming.filter((a) => sameDay(new Date(a.start), new Date())).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <Screen onRefresh={reload}>
      <Header title="Panel" subtitle="Métricas de Alpha Corte" />

      <View style={styles.grid}>
        <Stat label="citas realizadas" value={done.length} />
        <Stat label="próximas citas" value={upcoming.length} />
        <Stat label="ingresos realizados" value={formatCOP(income)} />
        <Stat label="ingresos por venir" value={formatCOP(projected)} />
        <Stat label="clientes registrados" value={clients} />
        <Stat label="suscripciones activas" value={activeSubscriptions} />
      </View>
      <Text style={styles.muted}>Tasa de cancelación: {cancelRate}% ({cancelled.length} canceladas)</Text>

      <Section>Servicios más solicitados</Section>
      <Card>
        {byService.map(({ s, n }) => (
          <Bar key={s.id} label={s.name + (s.active ? '' : ' (inactivo)')} value={n} max={maxService} right={`${n}`} />
        ))}
      </Card>

      <Section>Rendimiento de barberos</Section>
      <Card>
        {byBarber.map(({ b, n, income: inc }) => (
          <Bar key={b.id} label={`${b.name} · ★ ${b.rating.toFixed(1)}`} value={n} max={maxBarber} right={`${n} citas · ${formatCOP(inc)}`} />
        ))}
      </Card>

      <Section>Hoy</Section>
      {today.length === 0 && <EmptyState icon="cafe-outline" title="No hay más citas hoy" />}
      {today.map((a) => (
        <Card key={a.id} style={{ marginBottom: spacing.sm }}>
          <Text style={styles.gold}>
            {formatTime(new Date(a.start))} · {barberById(a.barberId)?.name}
          </Text>
          <Text style={styles.text}>{a.client?.name ?? 'Cliente'}</Text>
          <Text style={styles.muted}>
            {servicesLabel(a)} · {formatCOP(a.totalPrice)}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: spacing.md },
  stat: { width: '48.5%', marginBottom: spacing.sm },
  statValue: { color: colors.gold, fontSize: 20, fontWeight: '800' },
  muted: { color: colors.textMuted, fontSize: 13 },
  text: { color: colors.text, fontSize: 14 },
  gold: { color: colors.gold, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.gold },
});
