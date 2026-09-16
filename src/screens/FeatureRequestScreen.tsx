import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { colors, spacing } from '../theme';

export const FEATURE_REQUEST_EMAIL = 'admin@luxfordinteractive.com';

function submitFeatureRequest() {
  const subject = encodeURIComponent('Lilica feature request');
  void Linking.openURL(`mailto:${FEATURE_REQUEST_EMAIL}?subject=${subject}`).catch(() => undefined);
}

export function FeatureRequestScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen>
      <Header title="Suggest a feature" onBack={onBack} />
      <View style={styles.content}>
        <AppText variant="secondary" tone="soft">
          Tell us what would make Lilica more useful for you and the people you support.
        </AppText>
        <View style={styles.card}>
          <AppText variant="bodyStrong">Share your idea</AppText>
          <AppText variant="body" tone="soft">Your email will be addressed to {FEATURE_REQUEST_EMAIL}.</AppText>
          <Button label="Email a feature request" variant="secondary" onPress={submitFeatureRequest} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  card: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
