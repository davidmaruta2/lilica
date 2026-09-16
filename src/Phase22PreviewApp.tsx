import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Phase22FoundationPreview } from './components/Phase22FoundationPreview';
import { colors } from './theme';

export default function Phase22PreviewApp() {
  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <StatusBar style="dark" />
        <Phase22FoundationPreview />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
