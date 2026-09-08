import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { colors, radius, spacing } from '../theme';

type Props = {
  accepted: boolean;
  onBack: () => void;
  onToggleAccepted: () => void;
  onContinue: () => void;
};

export const PRIVACY_DECLARATION_VERSION = 'privacy-basis-v1';

export function PrivacyConsentScreen({ accepted, onBack, onToggleAccepted, onContinue }: Props) {
  return (
    <Screen footer={<Button label="Continue" disabled={!accepted} onPress={onContinue} />}>
      <Header onBack={onBack} />
      <View style={styles.headingRow}>
        <View style={styles.symbol}>
          <View style={styles.keyStem} />
          <View style={styles.keyHead} />
        </View>
        <AppText variant="title" style={styles.heading}>Respecting their privacy</AppText>
      </View>

      <View style={styles.points}>
        <View style={styles.point}>
          <AppText variant="bodyStrong">Add only what you can share</AppText>
          <AppText variant="secondary" tone="soft" style={styles.pointBody}>
            Lilica may hold personal and sensitive information. Only add information you are entitled to access, store and share.
          </AppText>
        </View>
        <View style={styles.point}>
          <AppText variant="bodyStrong">Keep them involved</AppText>
          <AppText variant="secondary" tone="soft" style={styles.pointBody}>
            If they can make their own decisions, involve them and respect their wishes. If you act for a child or someone who cannot make a particular decision, make sure you have the right authority.
          </AppText>
        </View>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        onPress={onToggleAccepted}
        style={({ pressed }) => [styles.declaration, accepted && styles.declarationAccepted, pressed && styles.pressed]}
      >
        <View style={[styles.checkbox, accepted && styles.checkboxAccepted]}>
          {accepted ? <View style={styles.checkboxTick} /> : null}
        </View>
        <AppText variant="secondary" style={styles.declarationText}>
          I understand that I must have an appropriate basis for adding and sharing this person's information, and that I am responsible for respecting their privacy.
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  heading: { flex: 1 },
  symbol: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: colors.oliveSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyStem: {
    width: 31,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    transform: [{ rotate: '-35deg' }],
    marginLeft: 10,
  },
  keyHead: {
    position: 'absolute',
    width: 19,
    height: 19,
    borderRadius: radius.pill,
    borderWidth: 5,
    borderColor: colors.primary,
    left: 15,
    top: 18,
  },
  points: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  point: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  pointBody: { marginTop: spacing.xxs },
  declaration: {
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  declarationAccepted: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  pressed: { opacity: 0.86 },
  checkbox: {
    width: 27,
    height: 27,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxAccepted: { backgroundColor: colors.primary },
  checkboxTick: {
    width: 12,
    height: 7,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.white,
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
  declarationText: { flex: 1 },
});
