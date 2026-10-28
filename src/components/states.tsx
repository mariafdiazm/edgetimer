import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Estado vacío: cuando una lista no tiene registros. */
export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {!!text && <Text style={styles.text}>{text}</Text>}
      {action}
    </View>
  );
}

/** Indicador de carga a pantalla completa. */
export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.gold} size="large" />
      {!!label && <Text style={[styles.text, { marginTop: spacing.md }]}>{label}</Text>}
    </View>
  );
}

/** Ruta protegida: sin sesión, redirige al login; con sesión cargando, muestra un indicador. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, hasSession } = useApp();
  if (user) return <>{children}</>;
  if (hasSession) return <Loading label="Cargando tu cuenta…" />;
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 14,
  },
  title: { color: colors.text, fontWeight: '700', marginTop: spacing.sm, textAlign: 'center' },
  text: { color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
