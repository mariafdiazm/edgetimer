import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BackBar } from '@/components/BackBar';
import { Screen } from '@/components/Screen';
import { EmptyState, RequireAuth } from '@/components/states';
import { Button, Card } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { formatLongDate, formatTime } from '@/lib/dates';

const ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Cita confirmada': 'checkmark-circle',
  'Nueva cita': 'calendar',
  'Cita cancelada': 'close-circle',
  'Cita reprogramada': 'swap-horizontal',
  'Nueva calificación': 'star',
  'Suscripción activada': 'ribbon',
};

/** Notificaciones de la aplicación (RF006). Ruta protegida. */
export default function NotificacionesScreen() {
  return (
    <RequireAuth>
      <Notificaciones />
    </RequireAuth>
  );
}

function Notificaciones() {
  const { notifications, markAllRead, deleteNotification, clearNotifications, reload } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);
  // Recordar cuáles eran nuevas al abrir, para resaltarlas aunque se marquen como leídas.
  const [fresh] = useState(() => new Set(notifications.filter((n) => !n.read).map((n) => n.id)));

  useEffect(() => {
    markAllRead();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen onRefresh={reload}>
      <BackBar title="Notificaciones" />
      {notifications.length === 0 && (
        <EmptyState icon="notifications-off-outline" title="Sin notificaciones" text="Aquí verás los avisos de tus citas, calificaciones y suscripción." />
      )}
      {notifications.length > 0 &&
        (confirmClear ? (
          <View style={[styles.row, { marginBottom: spacing.md }]}>
            <Button title="Volver" variant="ghost" onPress={() => setConfirmClear(false)} style={{ flex: 1, marginRight: spacing.sm }} />
            <Button title="Sí, borrar todas" variant="danger" onPress={() => { clearNotifications(); setConfirmClear(false); }} style={{ flex: 1 }} />
          </View>
        ) : (
          <Button title="Borrar todas" variant="ghost" onPress={() => setConfirmClear(true)} style={{ marginBottom: spacing.md }} />
        ))}
      {notifications.map((n) => (
        <Card key={n.id} style={[styles.item, fresh.has(n.id) && styles.fresh]}>
          <Ionicons name={ICON[n.title] ?? 'notifications'} size={22} color={colors.gold} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <View style={styles.row}>
              <Text style={styles.title}>{n.title}</Text>
              {fresh.has(n.id) && <Text style={styles.new}>Nueva</Text>}
              <Pressable onPress={() => deleteNotification(n.id)} accessibilityLabel="Borrar notificación" hitSlop={8} style={{ marginLeft: spacing.sm }}>
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.body}>{n.body}</Text>
            <Text style={styles.muted}>
              {formatLongDate(new Date(n.createdAt))} · {formatTime(new Date(n.createdAt))}
            </Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  fresh: { borderColor: colors.gold },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { color: colors.text, fontWeight: '700', flex: 1 },
  new: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  body: { color: colors.text, fontSize: 13, marginVertical: 2 },
  muted: { color: colors.textMuted, fontSize: 12 },
});
