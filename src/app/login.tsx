import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button, Field } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { signIn, signUp, configured, user } = useApp();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (register && name.trim().length < 3) return setError('Ingresa tu nombre completo.');
    if (!EMAIL_RE.test(email)) return setError('Ingresa un correo electrónico válido.');
    if (register && phone.trim().length < 7) return setError('Ingresa un número de contacto válido.');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    setError('');
    setBusy(true);
    const res = register
      ? await signUp(name.trim(), email.trim(), phone.trim(), password)
      : await signIn(email.trim(), password);
    setBusy(false);
    if (!res.ok) return setError(res.message ?? 'No se pudo completar la operación.');
    // Al cargar el perfil, el Redirect de abajo lleva a la app.
  };

  if (user) return <Redirect href="/(tabs)" />;

  return (
    <Screen>
      <View style={styles.logo}>
        <Ionicons name="cut" size={40} color={colors.gold} />
        <Text style={styles.brand}>EdgeTimer</Text>
        <Text style={styles.sub}>Reserva tu cita en Alpha Corte</Text>
      </View>

      {register && <Field label="Nombre completo" value={name} onChangeText={setName} autoCapitalize="words" />}
      <Field label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" />
      {register && <Field label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />}
      <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />

      {!configured && (
        <Text style={styles.error}>Falta configurar Supabase: crea el archivo .env (ver .env.example).</Text>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Button
        title={busy ? 'Un momento…' : register ? 'Crear cuenta' : 'Iniciar sesión'}
        onPress={submit}
        disabled={busy || !configured}
      />
      <Pressable onPress={() => { setRegister(!register); setError(''); }} style={{ marginTop: spacing.md }}>
        <Text style={styles.link}>
          {register ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', marginVertical: spacing.xl },
  brand: { color: colors.text, fontSize: 32, fontWeight: '800', marginTop: spacing.sm },
  sub: { color: colors.textMuted, marginTop: 4 },
  error: { color: colors.danger, marginBottom: spacing.md },
  link: { color: colors.gold, textAlign: 'center' },
});
