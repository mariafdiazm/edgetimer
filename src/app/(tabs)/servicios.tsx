import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states';
import { Button, Card, Chip, Field, Section } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { Service, ServiceIcon, useApp } from '@/context/AppContext';
import { formatCOP, formatDuration } from '@/lib/dates';

const ICONS: { id: ServiceIcon; label: string }[] = [
  { id: 'cut', label: 'Tijeras' },
  { id: 'man', label: 'Persona' },
  { id: 'sparkles', label: 'Brillo' },
  { id: 'color-wand', label: 'Varita' },
];

type Draft = { id?: string; name: string; price: string; minutes: string; icon: ServiceIcon; active: boolean };
const empty: Draft = { name: '', price: '', minutes: '30', icon: 'cut', active: true };

/** Gestión del inventario de servicios (RF012). */
export default function Servicios() {
  const { services, saveService, deleteService, reload } = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [confirmDel, setConfirmDel] = useState(false);
  const visible = services.filter(
    (s) =>
      s.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (show === 'todos' || (show === 'activos' ? s.active : !s.active)),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const remove = async () => {
    if (!draft?.id) return;
    const res = await deleteService(draft.id);
    setConfirmDel(false);
    if (!res.ok) return setError(res.message ?? 'No se pudo eliminar.');
    setError('');
    setDraft(null);
  };

  const edit = (s: Service) =>
    setDraft({ id: s.id, name: s.name, price: String(s.price), minutes: String(s.minutes), icon: s.icon, active: s.active });

  const save = async () => {
    if (!draft) return;
    const price = Number(draft.price.replace(/\D/g, ''));
    const minutes = Number(draft.minutes.replace(/\D/g, ''));
    if (draft.name.trim().length < 3) return setError('Escribe el nombre del servicio.');
    if (!price) return setError('Escribe un precio válido.');
    if (!minutes || minutes > 240) return setError('La duración debe estar entre 1 y 240 minutos.');
    setSaving(true);
    const res = await saveService({ id: draft.id, name: draft.name.trim(), price, minutes, icon: draft.icon, active: draft.active });
    setSaving(false);
    if (!res.ok) return setError(res.message ?? 'No se pudo guardar.');
    setError('');
    setDraft(null);
  };

  return (
    <Screen onRefresh={reload}>
      <Header title="Servicios" subtitle="Precios, duración y disponibilidad" />

      {draft ? (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.formTitle}>{draft.id ? 'Editar servicio' : 'Nuevo servicio'}</Text>
          <Field label="Nombre" value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} autoCapitalize="sentences" />
          <Field label="Precio (COP)" value={draft.price} onChangeText={(v) => setDraft({ ...draft, price: v })} keyboardType="number-pad" />
          <Field label="Duración (minutos)" value={draft.minutes} onChangeText={(v) => setDraft({ ...draft, minutes: v })} keyboardType="number-pad" />
          <Text style={styles.label}>Ícono</Text>
          <View style={styles.wrap}>
            {ICONS.map((i) => (
              <Chip key={i.id} label={i.label} selected={draft.icon === i.id} onPress={() => setDraft({ ...draft, icon: i.id })} />
            ))}
          </View>
          <Text style={styles.label}>Estado</Text>
          <View style={styles.wrap}>
            <Chip label="Activo" selected={draft.active} onPress={() => setDraft({ ...draft, active: true })} />
            <Chip label="Inactivo" selected={!draft.active} onPress={() => setDraft({ ...draft, active: false })} />
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.row}>
            <Button title="Cancelar" variant="ghost" onPress={() => { setDraft(null); setError(''); }} style={{ flex: 1, marginRight: spacing.sm }} />
            <Button title={saving ? 'Guardando…' : 'Guardar'} onPress={save} disabled={saving} style={{ flex: 1 }} />
          </View>
          {!!draft.id &&
            (confirmDel ? (
              <View style={styles.row}>
                <Button title="No" variant="ghost" onPress={() => setConfirmDel(false)} style={{ flex: 1, marginRight: spacing.sm }} />
                <Button title="Sí, eliminar" variant="danger" onPress={remove} style={{ flex: 1 }} />
              </View>
            ) : (
              <Button title="Eliminar servicio" variant="danger" onPress={() => setConfirmDel(true)} style={{ marginTop: spacing.sm }} />
            ))}
        </Card>
      ) : (
        <Button title="+ Nuevo servicio" onPress={() => setDraft(empty)} style={{ marginTop: spacing.md }} />
      )}

      <Section>Catálogo</Section>
      <Field label="Buscar" value={query} onChangeText={setQuery} placeholder="Nombre del servicio" />
      <View style={styles.wrap}>
        {(['todos', 'activos', 'inactivos'] as const).map((f) => (
          <Chip key={f} label={f[0].toUpperCase() + f.slice(1)} selected={show === f} onPress={() => setShow(f)} />
        ))}
      </View>
      {visible.length === 0 && <EmptyState icon="search-outline" title="No hay servicios con ese filtro" />}
      {visible.map((s) => (
        <Card key={s.id} style={[styles.item, !s.active && { opacity: 0.5 }]}>
          <Ionicons name={s.icon} size={22} color={colors.gold} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.name}>{s.name}</Text>
            <Text style={styles.muted}>
              {formatCOP(s.price)} · {formatDuration(s.minutes)} · {s.active ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
          <Button title="Editar" variant="ghost" onPress={() => edit(s)} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
        </Card>
      ))}
      <Text style={[styles.muted, { marginTop: spacing.sm }]}>
        Los servicios inactivos no aparecen al reservar, pero se conservan en las citas anteriores. Solo se puede eliminar un servicio que nunca se haya usado en una cita.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, fontSize: 13 },
  name: { color: colors.text, fontWeight: '700' },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6 },
  formTitle: { color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  row: { flexDirection: 'row', marginTop: spacing.sm },
  error: { color: colors.danger, marginBottom: spacing.sm },
});
