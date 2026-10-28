import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';

/** Título de pantalla con la campana de notificaciones (RF006). */
export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();
  const { unread, loadError } = useApp();
  return (
    <View>
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      </View>
      <Pressable
        onPress={() => router.push('/notificaciones')}
        accessibilityRole="button"
        accessibilityLabel="Notificaciones"
        hitSlop={8}
        style={styles.bell}
      >
        <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={24} color={colors.text} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </Pressable>
    </View>
    {!!loadError && <Text style={styles.error}>No se pudieron cargar todos los datos: {loadError}. Desliza hacia abajo para reintentar.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  bell: { padding: 6, marginLeft: spacing.sm },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 12, marginTop: 6 },
});
