import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states';
import { Button, Card, Section, Title } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { canModify, formatCOP, formatLongDate, formatTime } from '@/lib/dates';


export default function Citas() {
  const router = useRouter();
  const { appointments, cancel, barberById, servicesLabel, reload } = useApp();
  const { ok } = useLocalSearchParams<{ ok?: string }>();
  const [banner, setBanner] = useState('');
  useEffect(() => {
    if (ok) setBanner(ok === 'reprogramada' ? '¡Cita reprogramada! Te enviamos una notificación.' : '¡Cita reservada! Te enviamos una notificación.');
  }, [ok]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const sorted = [...appointments].sort((a, b) => a.start.localeCompare(b.start));
  const now = Date.now();
  // Las citas ya realizadas o canceladas se ven en la pestaña Historial.
  const active = sorted.filter((a) => a.status === 'confirmada' && new Date(a.end).getTime() > now);

  return (
    <Screen onRefresh={reload}>
      <Title>Mis citas</Title>
      <Text style={styles.muted}>Puedes cancelar o reprogramar hasta 1 hora antes.</Text>

      {!!banner && (
        <View style={styles.ok}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.okText}>{banner}</Text>
        </View>
      )}
      {!!error && <Text style={styles.warn}>{error}</Text>}

      <Section>Programadas</Section>
      {active.length === 0 && (
        <EmptyState
          icon="calendar-outline"
          title="No tienes citas programadas"
          text="Reserva una cita con uno o varios servicios."
          action={<Button title="Reservar ahora" onPress={() => router.push('/reservar')} style={{ marginTop: spacing.md }} />}
        />
      )}
      {active.map((a) => {
        const start = new Date(a.start);
        const editable = canModify(start);
        return (
          <Card key={a.id} style={{ marginBottom: spacing.sm }}>
            <Text style={styles.name}>{servicesLabel(a)}</Text>
            <Text style={styles.muted}>
              {formatLongDate(start)} · {formatTime(start)} a {formatTime(new Date(a.end))}
            </Text>
            <Text style={styles.muted}>Total: {formatCOP(a.totalPrice)}</Text>
            <Text style={styles.muted}>con {barberById(a.barberId)?.name}</Text>

            {!editable && <Text style={styles.warn}>Faltan menos de 1 hora: ya no se puede modificar.</Text>}

            {editable && confirmId !== a.id && (
              <View style={styles.actions}>
                <Button
                  title="Reprogramar"
                  variant="ghost"
                  onPress={() => router.push({ pathname: '/reservar', params: { reschedule: a.id } })}
                  style={{ flex: 1, marginRight: spacing.sm }}
                />
                <Button title="Cancelar" variant="danger" onPress={() => setConfirmId(a.id)} style={{ flex: 1 }} />
              </View>
            )}

            {editable && confirmId === a.id && (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.name}>¿Seguro que deseas cancelar esta cita?</Text>
                <View style={styles.actions}>
                  <Button title="Volver" variant="ghost" onPress={() => setConfirmId(null)} style={{ flex: 1, marginRight: spacing.sm }} />
                  <Button title="Sí, cancelar" variant="danger" onPress={async () => {
                      const res = await cancel(a.id);
                      setConfirmId(null);
                      setError(res.ok ? '' : res.message ?? '');
                    }} style={{ flex: 1 }} />
                </View>
              </View>
            )}
          </Card>
        );
      })}

    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 13 },
  name: { color: colors.text, fontWeight: '700', marginBottom: 2 },
  warn: { color: colors.danger, fontSize: 12, marginTop: spacing.sm },
  actions: { flexDirection: 'row', marginTop: spacing.md },
  ok: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, padding: spacing.sm, borderRadius: 10, borderWidth: 1, borderColor: colors.success },
  okText: { color: colors.success, marginLeft: spacing.sm, flex: 1 },
});
