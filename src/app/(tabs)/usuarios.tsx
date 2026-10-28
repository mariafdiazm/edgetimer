import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states';
import { Button, Card, Chip, Field, Section } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { Role, useApp } from '@/context/AppContext';

const ROLES: { id: Role; label: string }[] = [
  { id: 'cliente', label: 'Cliente' },
  { id: 'barbero', label: 'Barbero' },
  { id: 'admin', label: 'Admin' },
];

/** Administración de usuarios, roles y barberos (parte del panel de administración, RF008). */
export default function Usuarios() {
  const { user, profiles, barbers, setRole, linkBarber, setBarberActive, reload } = useApp();
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'todos'>('todos');
  const visible = profiles.filter(
    (p) =>
      (roleFilter === 'todos' || p.role === roleFilter) &&
      (p.name.toLowerCase().includes(query.trim().toLowerCase()) || (p.phone ?? '').includes(query.trim())),
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const run = async (p: Promise<{ ok: boolean; message?: string }>) => {
    const res = await p;
    setError(res.ok ? '' : (res.message ?? 'No se pudo guardar.'));
  };

  return (
    <Screen onRefresh={reload}>
      <Header title="Usuarios" subtitle="Roles y fichas de barberos" />
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Section>Usuarios ({visible.length} de {profiles.length})</Section>
      <Field label="Buscar" value={query} onChangeText={setQuery} placeholder="Nombre o teléfono" />
      <View style={styles.wrap}>
        <Chip label="Todos" selected={roleFilter === 'todos'} onPress={() => setRoleFilter('todos')} />
        {ROLES.map((r) => (
          <Chip key={r.id} label={r.label} selected={roleFilter === r.id} onPress={() => setRoleFilter(r.id)} />
        ))}
      </View>
      {visible.length === 0 && <EmptyState icon="people-outline" title="No hay usuarios con ese filtro" />}
      {visible.map((p) => {
        const linked = barbers.find((b) => b.profileId === p.id);
        const isMe = p.id === user?.id;
        return (
          <Card key={p.id} style={{ marginBottom: spacing.sm }}>
            <Text style={styles.name}>
              {p.name}
              {isMe ? ' (tú)' : ''}
            </Text>
            {!!p.phone && <Text style={styles.muted}>{p.phone}</Text>}
            <View style={[styles.wrap, { marginTop: spacing.sm }]}>
              {ROLES.map((r) => (
                <Chip
                  key={r.id}
                  label={r.label}
                  selected={p.role === r.id}
                  disabled={isMe}
                  onPress={() => p.role !== r.id && run(setRole(p.id, r.id))}
                />
              ))}
            </View>
            {p.role === 'barbero' && (
              <View>
                <Text style={styles.muted}>Ficha de barbero: {linked ? linked.name : 'sin vincular'}</Text>
                <View style={[styles.wrap, { marginTop: 6 }]}>
                  {barbers
                    .filter((b) => !b.profileId || b.profileId === p.id)
                    .map((b) => (
                      <Chip key={b.id} label={b.name} selected={linked?.id === b.id} onPress={() => run(linkBarber(p.id, b.id))} />
                    ))}
                  {!linked && <Chip label="+ Crear ficha nueva" onPress={() => run(linkBarber(p.id, 'new'))} />}
                </View>
              </View>
            )}
          </Card>
        );
      })}

      <Section>Barberos</Section>
      {barbers.map((b) => (
        <Card key={b.id} style={[styles.item, !b.active && { opacity: 0.5 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {b.name} · ★ {b.rating.toFixed(1)}
            </Text>
            <Text style={styles.muted}>
              {b.specialty || 'Sin especialidad'} · {b.profileId ? 'con cuenta' : 'sin cuenta'} · {b.active ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
          <Button
            title={b.active ? 'Desactivar' : 'Activar'}
            variant="ghost"
            onPress={() => run(setBarberActive(b.id, !b.active))}
            style={{ paddingVertical: 8, paddingHorizontal: 12 }}
          />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 13 },
  name: { color: colors.text, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  error: { color: colors.danger, marginVertical: spacing.sm },
});
