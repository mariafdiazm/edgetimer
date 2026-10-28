import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ComponentProps, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button, Card, Section, Title } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { FAQ, SHOP } from '@/data/mock';

type IconName = ComponentProps<typeof Ionicons>['name'];

const open = (url: string) => Linking.openURL(url).catch(() => {});
const mapsSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SHOP.mapsQuery)}&query_place_id=${SHOP.placeId}`;
const mapsRoute = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(SHOP.mapsQuery)}&destination_place_id=${SHOP.placeId}`;

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={22} color={colors.gold} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

export default function Perfil() {
  const router = useRouter();
  const { user, signOut, subscription, unread } = useApp();
  const roleLabel = { cliente: 'Cliente', barbero: 'Barbero', admin: 'Administrador' }[user?.role ?? 'cliente'];
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const sendForm = () => {
    const subject = encodeURIComponent('Soporte EdgeTimer');
    const body = encodeURIComponent(`${message.trim()}\n\n— ${user?.name ?? ''} (${user?.email ?? ''})`);
    open(`mailto:${SHOP.email}?subject=${subject}&body=${body}`);
    setMessage('');
  };

  return (
    <Screen>
      <Title>Perfil</Title>
      <Card>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.muted}>{user?.email}</Text>
        {!!user?.phone && <Text style={styles.muted}>{user.phone}</Text>}
        <Text style={styles.role}>{roleLabel}</Text>
      </Card>

      <Section>Mi cuenta</Section>
      <Card>
        <Pressable onPress={() => router.push('/notificaciones')} style={styles.menuItem}>
          <Ionicons name="notifications" size={20} color={colors.gold} />
          <Text style={styles.menuText}>Notificaciones{unread ? ` (${unread} nuevas)` : ''}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
        {user?.role === 'cliente' && (
          <Pressable onPress={() => router.push('/suscripcion')} style={[styles.menuItem, { borderBottomWidth: 0 }]}>
            <Ionicons name="ribbon" size={20} color={colors.gold} />
            <Text style={styles.menuText}>
              {subscription ? `Plan ${subscription.plan} · ${subscription.discountPct}% de descuento` : 'Plan Alpha (suscripción)'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </Card>

      {/* RF011 · Geolocalización de la barbería */}
      <Section>Ubicación</Section>
      <Card>
        <View style={styles.row}>
          <Ionicons name="location" size={22} color={colors.gold} />
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text style={styles.name}>{SHOP.name}</Text>
            <Text style={styles.muted}>{SHOP.address}</Text>
            <Text style={styles.muted}>{SHOP.hours}</Text>
          </View>
        </View>
        <View style={[styles.row, { marginTop: spacing.md }]}>
          <Button title="Ver en el mapa" variant="ghost" onPress={() => open(mapsSearch)} style={{ flex: 1, marginRight: spacing.sm }} />
          <Button title="Cómo llegar" onPress={() => open(mapsRoute)} style={{ flex: 1 }} />
        </View>
      </Card>

      {/* RF010 · Soporte al usuario */}
      <Section>Soporte</Section>
      <Card>
        <Text style={styles.sub}>Contáctanos</Text>
        <View style={styles.actions}>
          <Action
            icon="logo-whatsapp"
            label="WhatsApp"
            onPress={() => open(`https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent('Hola, necesito ayuda con EdgeTimer')}`)}
          />
          <Action icon="call" label="Llamar" onPress={() => open(`tel:${SHOP.phone.replace(/\s/g, '')}`)} />
          <Action icon="mail" label="Correo" onPress={() => open(`mailto:${SHOP.email}`)} />
        </View>

        <Text style={[styles.sub, { marginTop: spacing.lg }]}>Preguntas frecuentes</Text>
        {FAQ.map((f, i) => (
          <Pressable key={f.q} onPress={() => setOpenFaq(openFaq === i ? null : i)} style={styles.faq}>
            <View style={styles.row}>
              <Text style={[styles.faqQ, { flex: 1 }]}>{f.q}</Text>
              <Ionicons name={openFaq === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </View>
            {openFaq === i && <Text style={[styles.muted, { marginTop: 6 }]}>{f.a}</Text>}
          </Pressable>
        ))}

        <Text style={[styles.sub, { marginTop: spacing.lg }]}>Escríbenos</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Cuéntanos tu duda o problema"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={1000}
          style={styles.input}
        />
        <Button title="Enviar mensaje" onPress={sendForm} disabled={message.trim().length < 5} />
      </Card>

      <Button
        title="Cerrar sesión"
        variant="ghost"
        onPress={async () => {
          await signOut();
          router.replace('/login');
        }}
        style={{ marginTop: spacing.lg }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontWeight: '700' },
  role: { color: colors.gold, fontSize: 12, fontWeight: '700', marginTop: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuText: { color: colors.text, flex: 1, marginLeft: spacing.md },
  muted: { color: colors.textMuted, fontSize: 13 },
  sub: { color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  action: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  actionText: { color: colors.text, fontSize: 12, marginTop: 4 },
  faq: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  faqQ: { color: colors.text, fontSize: 14 },
  input: {
    minHeight: 80,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    textAlignVertical: 'top',
  },
});
