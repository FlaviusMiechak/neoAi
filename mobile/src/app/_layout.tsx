import { Stack } from 'expo-router';
import 'react-native-reanimated';

import { CurrentProjectProvider } from '@/store/current-project';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  return (
    <CurrentProjectProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F4EF' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true }} />
      </Stack>
    </CurrentProjectProvider>
  );
}
