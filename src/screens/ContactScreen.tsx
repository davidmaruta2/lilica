import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { colors, radius, spacing } from '../theme';

// Contact menu item, under Help -- direct product-owner request. Static
// content plus a real mailto: action (same Linking.openURL pattern already
// used by SubscriptionScreen.tsx's "Manage subscription" link) -- no new
// backend, no form, no data collected by Lilica itself.
export const SUPPORT_EMAIL = 'admin@luxfordinteractive.com';

function emailSupport() {
  void Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => undefined);
}

export function ContactScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen>
      <Header onBack={onBack} />
      <View style={styles.content}>
        <AppText variant="title" centre>Contact</AppText>
        <AppText variant="body" tone="soft" centre>
          Can't find what you're looking for in the FAQ? Get in touch and we'll help.
        </AppText>
        <View style={styles.card}>
          <AppText variant="bodyStrong">Get in touch</AppText>
          <AppText variant="body" tone="soft">{SUPPORT_EMAIL}</AppText>
          <Button label="Email us" variant="secondary" onPress={emailSupport} style={styles.button} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  button: { borderRadius: radius.md },
});
