import { ReactNode } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors } from '@/constants/theme';

const PHONE_W = 390;
const PHONE_H = 844;

/**
 * En el navegador (Expo Web) muestra la app dentro de un marco con proporciones de
 * teléfono. En Expo Go / dispositivos reales ocupa toda la pantalla sin cambios.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const showFrame = Platform.OS === 'web' && width > 600;

  if (!showFrame) return <View style={styles.full}>{children}</View>;

  const scale = Math.min(1, (height - 90) / (PHONE_H + 24));
  return (
    <View style={styles.stage}>
      <Text style={styles.caption}>EdgeTimer · vista móvil (Expo Web)</Text>
      <View
        style={[
          styles.device,
          { width: PHONE_W + 24, height: PHONE_H + 24, transform: [{ scale }] },
        ]}
      >
        <View style={styles.screen}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: colors.bg },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050506' },
  caption: { position: 'absolute', top: 12, color: colors.textMuted, fontSize: 12, letterSpacing: 1 },
  device: {
    padding: 12,
    borderRadius: 52,
    backgroundColor: '#1C1C1F',
    borderWidth: 2,
    borderColor: '#3A3A40',
  },
  screen: { flex: 1, borderRadius: 40, overflow: 'hidden', backgroundColor: colors.bg },
});
