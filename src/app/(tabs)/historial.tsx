import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states';
import { Button, Card, Section, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { Appointment, useApp } from '@/context/AppContext';
import { formatCOP, formatLongDate, formatTime } from '@/lib/dates';

/** Historial de servicios (RF005) y calificación del barbero (RF007). */
export default function Historial() {
  const { appointments, barberById, servicesLabel, deleteAppointment, reload } = useApp();
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [error, setError] = useState('');
  const now = Date.now();

  const past = [...appointments]
    .filter((a) => a.status === 'cancelada' || new Date(a.end).getTime() <= now)
    .sort((a, b) => b.start.localeCompare(a.start));
  const done = past.filter((a) => a.status === 'confirmada');
  const cancelled = past.filter((a) => a.status === 'cancelada');
  const spent = done.reduce((n, a) => n + a.totalPrice, 0);

  return (
    <Screen onRefresh={reload}>
      <Title>Historial</Title>
      <Text style={styles.muted}>Tus servicios anteriores. Califica al barbero después de cada cita.</Text>

      <Card style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{done.length}</Text>
          <Text style={styles.muted}>citas realizadas</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatCOP(spent)}</Text>
          <Text style={styles.muted}>total en servicios</Text>
        </View>
      </Card>

      <Section>Realizadas</Section>
      {done.length === 0 && (
        <EmptyState icon="cut-outline" title="Aún no tienes citas realizadas" text="Después de cada cita podrás calificar a tu barbero aquí." />
      )}
      {done.map((a) => (
        <Card key={a.id} style={{ marginBottom: spacing.sm }}>
          <Text style={styles.name}>{servicesLabel(a)}</Text>
          <Text style={styles.muted}>
            {formatLongDate(new Date(a.start))} · {formatTime(new Date(a.start))} · {formatCOP(a.totalPrice)}
          </Text>
          <Text style={styles.muted}>con {barberById(a.barberId)?.name}</Text>
          {a.review ? <ReviewView rating={a.review.rating} comment={a.review.comment} /> : <RateForm appt={a} />}
        </Card>
      ))}

      {cancelled.length > 0 && <Section>Canceladas</Section>}
      {cancelled.map((a) => (
        <Card key={a.id} style={{ marginBottom: spacing.sm, opacity: 0.6 }}>
          <Text style={styles.name}>{servicesLabel(a)}</Text>
          <Text style={styles.muted}>
            {formatLongDate(new Date(a.start))} · {formatTime(new Date(a.start))}
          </Text>
          {confirmDel === a.id ? (
            <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
              <Button title="Volver" variant="ghost" onPress={() => setConfirmDel(null)} style={{ flex: 1, marginRight: spacing.sm }} />
              <Button
                title="Sí, eliminar"
                variant="danger"
                onPress={async () => {
                  const r = await deleteAppointment(a.id);
                  setConfirmDel(null);
                  setError(r.ok ? '' : (r.message ?? ''));
                }}
                style={{ flex: 1 }}
              />
            </View>
          ) : (
            <Button title="Eliminar del historial" variant="ghost" onPress={() => setConfirmDel(a.id)} style={{ marginTop: spacing.sm }} />
          )}
        </Card>
      ))}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </Screen>
  );
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange?.(n)}
          disabled={!onChange}
          accessibilityLabel={`${n} estrellas`}
          hitSlop={6}
          style={{ marginRight: 4 }}
        >
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={onChange ? 28 : 18} color={colors.gold} />
        </Pressable>
      ))}
    </View>
  );
}

function ReviewView({ rating, comment }: { rating: number; comment: string | null }) {
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Stars value={rating} />
      {!!comment && <Text style={[styles.muted, { marginTop: 4 }]}>“{comment}”</Text>}
    </View>
  );
}

function RateForm({ appt }: { appt: Appointment }) {
  const { rate } = useApp();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) {
    return <Button title="Calificar" variant="ghost" onPress={() => setOpen(true)} style={{ marginTop: spacing.md }} />;
  }

  const send = async () => {
    setSaving(true);
    const res = await rate(appt, rating, comment);
    setSaving(false);
    if (!res.ok) setError(res.message ?? 'No se pudo guardar la calificación.');
  };

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={styles.name}>¿Cómo te fue?</Text>
      <Stars value={rating} onChange={setRating} />
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Comentario (opcional)"
        placeholderTextColor={colors.textMuted}
        maxLength={500}
        multiline
        style={styles.input}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={{ flexDirection: 'row' }}>
        <Button title="Cancelar" variant="ghost" onPress={() => setOpen(false)} style={{ flex: 1, marginRight: spacing.sm }} />
        <Button title={saving ? 'Enviando…' : 'Enviar'} onPress={send} disabled={rating === 0 || saving} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 13 },
  name: { color: colors.text, fontWeight: '700', marginBottom: 2 },
  stats: { flexDirection: 'row', marginTop: spacing.md },
  stat: { flex: 1 },
  statValue: { color: colors.gold, fontSize: 20, fontWeight: '800' },
  input: {
    marginVertical: spacing.sm,
    minHeight: 60,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    textAlignVertical: 'top',
  },
  error: { color: colors.danger, marginBottom: spacing.sm },
});
