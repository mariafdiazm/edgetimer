import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useApp } from '@/context/AppContext';

export default function Entry() {
  const { ready, user } = useApp();
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}
