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

export const PRIVACY_DECLARATION_VERSION = 'privacy-basis-v2';

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
          <View style={styles.pointNumber}>
            <AppText variant="bodyStrong" style={styles.pointNumberText}>1</AppText>
          </View>
          <View style={styles.pointCopy}>
            <AppText variant="bodyStrong">Get permission from the person you support</AppText>
            <AppText variant="secondary" tone="soft" style={styles.pointBody}>
              Ask them before you add their information. If you make decisions for them, make sure you have the right authority.
            </AppText>
          </View>
        </View>
        <View style={styles.point}>
          <View style={styles.pointNumber}>
            <AppText variant="bodyStrong" style={styles.pointNumberText}>2</AppText>
          </View>
          <View style={styles.pointCopy}>
            <AppText variant="bodyStrong">Keep them involved</AppText>
            <AppText variant="secondary" tone="soft" style={styles.pointBody}>
              Tell them what you add and who you share it with. Respect their choices and update anything they want changed.
            </AppText>
          </View>
        </View>
        <View style={styles.point}>
          <View style={styles.pointNumber}>
            <AppText variant="bodyStrong" style={styles.pointNumberText}>3</AppText>
          </View>
          <View style={styles.pointCopy}>
            <AppText variant="bodyStrong">Lilica keeps their information private</AppText>
            <AppText variant="secondary" tone="soft" style={styles.pointBody}>
              Lilica will not share their information unless you choose to, or we are required to by law. We handle personal information in line with UK GDPR.
            </AppText>
          </View>
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
          I understand that I need permission or the right authority to add this person's information, and that I am responsible for respecting their privacy.
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
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  point: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  pointNumber: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.oliveSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointNumberText: {
    color: colors.primary,
  },
  pointCopy: {
    flex: 1,
  },
  pointBody: { marginTop: spacing.xxs },
  declaration: {
    marginTop: spacing.lg,
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
