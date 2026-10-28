import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { ActivityIndicator, ColorValue, View } from 'react-native';

import { colors } from '@/constants/theme';
import { Role, useApp } from '@/context/AppContext';

type IconName = ComponentProps<typeof Ionicons>['name'];

const tab = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={color} />;
  };

/** Pestañas de cada rol. Las que no corresponden se ocultan (href: null). */
const TABS: { name: string; title: string; icon: IconName; roles: Role[] }[] = [
  { name: 'index', title: 'Inicio', icon: 'home', roles: ['cliente'] },
  { name: 'reservar', title: 'Reservar', icon: 'calendar', roles: ['cliente'] },
  { name: 'citas', title: 'Mis citas', icon: 'time', roles: ['cliente'] },
  { name: 'historial', title: 'Historial', icon: 'star', roles: ['cliente'] },
  { name: 'agenda', title: 'Agenda', icon: 'calendar', roles: ['barbero'] },
  { name: 'panel', title: 'Panel', icon: 'stats-chart', roles: ['admin'] },
  { name: 'servicios', title: 'Servicios', icon: 'cut', roles: ['admin'] },
  { name: 'usuarios', title: 'Usuarios', icon: 'people', roles: ['admin'] },
  { name: 'perfil', title: 'Perfil', icon: 'person', roles: ['cliente', 'barbero', 'admin'] },
];

export default function TabsLayout() {
  const { user, hasSession } = useApp();
  if (!user) {
    // Con sesión pero perfil aún cargando: esperar en vez de volver al login.
    if (hasSession) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      );
    }
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: tab(t.icon),
            href: t.roles.includes(user.role) ? undefined : null,
          }}
        />
      ))}
    </Tabs>
  );
}
