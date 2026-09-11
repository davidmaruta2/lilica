import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, shadow, spacing } from '../theme';
import { AppText } from './Text';
import { Button } from './Button';

// Corrective task 4: the one shared Settings surface for Home/Calendar/To
// Do/People -- never a separate implementation per tab. Lists ONLY
// functionality that genuinely exists elsewhere already:
//   - Account: opens the existing AccountScreen, which already bundles
//     profile, the Phase 14 reminders/quiet-hours section, and sign out.
//     Nothing here duplicates that -- there is deliberately no separate
//     "Notifications" or "Sign out" row, since AccountScreen already is
//     that destination.
//   - Care Circle: opens the existing CareCircleScreen (Phase 15), when
//     the active care space is real and synced -- matching exactly the
//     same condition Person's own former link used.
// No Privacy/Help/About row: neither is reachable as a standalone,
// already-implemented destination outside onboarding, so none is offered
// here rather than inventing one.
export function SettingsMenu({ visible, onClose, onOpenAccount, onOpenCareCircle }: {
  visible: boolean;
  onClose: () => void;
  onOpenAccount: () => void;
  onOpenCareCircle?: () => void;
}) {
  const entries = [
    { key: 'account', label: 'Account', description: 'Your profile, reminders and sign out', onPress: onOpenAccount },
    ...(onOpenCareCircle
      ? [{ key: 'careCircle', label: 'Care Circle', description: 'Who can help, and what they can see', onPress: onOpenCareCircle }]
      : []),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close settings" style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <AppText variant="section">Settings</AppText>
          <View style={styles.list}>
            {entries.map((entry) => (
              <Pressable
                key={entry.key}
                accessibilityRole="button"
                accessibilityLabel={entry.label}
                onPress={() => { onClose(); entry.onPress(); }}
                style={styles.row}
              >
                <View style={styles.copy}>
                  <AppText variant="bodyStrong">{entry.label}</AppText>
                  <AppText variant="secondary" tone="soft">{entry.description}</AppText>
                </View>
                <View style={styles.chevron} />
              </Pressable>
            ))}
          </View>
          <Button label="Done" variant="secondary" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(36,29,28,0.35)' },
  sheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surface, gap: spacing.md, ...shadow.soft },
  list: { gap: spacing.xs },
  row: {
    minHeight: 62,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  copy: { flex: 1, gap: 2 },
  // Same drawn-chevron technique as Header.tsx's back chevron, pointing
  // right here (top+right border) to read as "opens something further".
  chevron: {
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.muted,
    transform: [{ rotate: '45deg' }],
  },
});
