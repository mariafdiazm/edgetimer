import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackBar } from '@/components/BackBar';
import { Screen } from '@/components/Screen';
import { RequireAuth } from '@/components/states';
import { Button, Card, Section } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { Plan, useApp } from '@/context/AppContext';
import { PLANS } from '@/data/mock';
import { formatCOP, formatLongDate } from '@/lib/dates';

/** Suscripciones para clientes frecuentes (RF009). El pago es simulado: no hay pasarela de pago real. */
export default function SuscripcionScreen() {
  return (
    <RequireAuth>
      <Suscripcion />
    </RequireAuth>
  );
}

function Suscripcion() {
  const { subscription, subscribe, cancelSubscription } = useApp();
  const [chosen, setChosen] = useState<Plan | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const pay = async () => {
    if (!chosen) return;
    setBusy(true);
    const res = await subscribe(chosen);
    setBusy(false);
    setMsg(res.ok ? '¡Listo! Tu suscripción está activa.' : (res.message ?? 'No se pudo activar.'));
    if (res.ok) setChosen(null);
  };

  const current = subscription ? PLANS.find((p) => p.id === subscription.plan) : undefined;

  return (
    <Screen>
      <BackBar title="Plan Alpha" />
      <Text style={styles.muted}>Para clientes frecuentes: descuento automático en todas tus citas mientras el plan esté activo.</Text>

      {subscription && current && (
        <Card style={[styles.active, { marginTop: spacing.md }]}>
          <View style={styles.row}>
            <Ionicons name="ribbon" size={22} color={colors.gold} />
            <Text style={[styles.name, { marginLeft: spacing.sm }]}>{current.name} activo</Text>
          </View>
          <Text style={styles.muted}>
            {subscription.discountPct}% de descuento · vence el {formatLongDate(new Date(subscription.endsAt))}
          </Text>
          {!confirmCancel ? (
            <Button title="Cancelar suscripción" variant="danger" onPress={() => setConfirmCancel(true)} style={{ marginTop: spacing.md }} />
          ) : (
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.name}>¿Seguro? Perderás el descuento desde ahora.</Text>
              <View style={[styles.row, { marginTop: spacing.sm }]}>
                <Button title="Volver" variant="ghost" onPress={() => setConfirmCancel(false)} style={{ flex: 1, marginRight: spacing.sm }} />
                <Button
                  title="Sí, cancelar"
                  variant="danger"
                  onPress={async () => {
                    const r = await cancelSubscription();
                    setConfirmCancel(false);
                    setMsg(r.ok ? 'Suscripción cancelada.' : (r.message ?? ''));
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </Card>
      )}

      {!!msg && <Text style={styles.msg}>{msg}</Text>}

      {!subscription && (
        <>
          <Section>Planes</Section>
          {PLANS.map((p) => (
            <Card key={p.id} style={[{ marginBottom: spacing.sm }, chosen === p.id && styles.active]}>
              <View style={styles.rowBetween}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.price}>{formatCOP(p.price)}</Text>
              </View>
              {p.perks.map((perk) => (
                <Text key={perk} style={styles.perk}>
                  ✓ {perk}
                </Text>
              ))}
              <Button
                title={chosen === p.id ? 'Seleccionado' : 'Elegir este plan'}
                variant={chosen === p.id ? 'primary' : 'ghost'}
                onPress={() => setChosen(p.id)}
                style={{ marginTop: spacing.md }}
              />
            </Card>
          ))}

          {chosen && (
            <Card style={{ marginTop: spacing.sm }}>
              <Text style={styles.name}>Confirmar pago</Text>
              <Text style={styles.muted}>
                Total a pagar: {formatCOP(PLANS.find((p) => p.id === chosen)!.price)}. Pago simulado para demostración: no se
                realiza ningún cobro real.
              </Text>
              <Button title={busy ? 'Procesando…' : 'Pagar y activar'} onPress={pay} disabled={busy} style={{ marginTop: spacing.md }} />
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 13 },
  name: { color: colors.text, fontWeight: '700' },
  price: { color: colors.gold, fontWeight: '800', fontSize: 16 },
  perk: { color: colors.text, fontSize: 13, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  active: { borderColor: colors.gold },
  msg: { color: colors.gold, marginTop: spacing.md },
});
