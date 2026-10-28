import { ErrorBoundaryProps, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PhoneFrame } from '@/components/PhoneFrame';
import { colors, spacing } from '@/constants/theme';
import { AppProvider } from '@/context/AppContext';

/** Si una pantalla falla, se muestra este mensaje en vez de cerrar la app. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.bg }}>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: spacing.sm }}>Algo salió mal</Text>
      <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg }}>
        Ocurrió un error inesperado. Intenta de nuevo; si continúa, cierra y vuelve a abrir la app.
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: spacing.lg }}>{error.message}</Text>
      <Pressable onPress={retry} style={{ backgroundColor: colors.gold, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14 }}>
        <Text style={{ color: '#111', fontWeight: '700' }}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <PhoneFrame>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        </PhoneFrame>
      </AppProvider>
    </SafeAreaProvider>
  );
}
