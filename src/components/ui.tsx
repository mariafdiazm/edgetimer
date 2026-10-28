import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'ghost' && styles.btnGhost,
        variant === 'danger' && styles.btnDanger,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          variant === 'primary' && { color: '#111' },
          variant === 'danger' && { color: colors.danger },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

export function Chip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, selected && styles.chipSelected, disabled && { opacity: 0.3 }]}
    >
      <Text style={[styles.chipText, selected && { color: '#111', fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

export const Title = ({ children }: { children: ReactNode }) => <Text style={styles.title}>{children}</Text>;
export const Section = ({ children }: { children: ReactNode }) => <Text style={styles.section}>{children}</Text>;

const styles = StyleSheet.create({
  btn: { paddingVertical: 14, paddingHorizontal: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.gold },
  btnGhost: { borderWidth: 1, borderColor: colors.border },
  btnDanger: { borderWidth: 1, borderColor: colors.danger },
  btnText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.text, fontSize: 13 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: spacing.xs },
  section: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
});
