import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing } from '../theme';
import { AppText } from './Text';

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
//   - Privacy & data (Phase 18): opens the new PrivacyDataScreen -- what
//     Lilica stores, export, device/local data, leaving a care space and
//     account-deletion eligibility. Always offered (unlike Care Circle,
//     it's meaningful even for a local-only space).
// No Help/About row: not yet a standalone, already-implemented
// destination, so none is offered here rather than inventing one.
export function SettingsMenu({ visible, onClose, onOpenAccount, onOpenCareCircle, onOpenPrivacyData }: {
  visible: boolean;
  onClose: () => void;
  onOpenAccount: () => void;
  onOpenCareCircle?: () => void;
  onOpenPrivacyData: () => void;
}) {
  const entries = [
    { key: 'account', label: 'Account', description: 'Your profile, reminders and sign out', onPress: onOpenAccount },
    ...(onOpenCareCircle
      ? [{ key: 'careCircle', label: 'Care Circle', description: 'Who can help, and what they can see', onPress: onOpenCareCircle }]
      : []),
    { key: 'privacyData', label: 'Privacy & data', description: 'What Lilica stores, export, and device data', onPress: onOpenPrivacyData },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Dismiss settings" style={styles.backdrop} onPress={onClose}>
        {/* Anchored near the Settings cog (top-right of every tab header)
            rather than a full-width bottom sheet -- the previous layout
            opened far down the screen, disconnected from the button that
            triggered it. */}
        <SafeAreaView edges={['top']} style={styles.anchor} pointerEvents="box-none">
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.header}>
              <AppText variant="bodyStrong">Settings</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={onClose} hitSlop={8}>
                <AppText variant="secondary" tone="soft">Close</AppText>
              </Pressable>
            </View>
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
                    <AppText variant="bodyStrong" style={styles.rowLabel}>{entry.label}</AppText>
                    <AppText variant="secondary" tone="soft" style={styles.rowDescription}>{entry.description}</AppText>
                  </View>
                  <View style={styles.chevron} />
                </Pressable>
              ))}
            </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(36,29,28,0.35)' },
  // Same top offset every tab header uses before its own content
  // (spacing.md) plus roughly the cog's own height, so the panel sits
  // just under the button that opened it rather than at the screen edge.
  anchor: { alignItems: 'flex-end', paddingTop: spacing.xl, paddingRight: spacing.lg },
  sheet: { width: 260, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, gap: spacing.sm, ...shadow.soft },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: spacing.xs },
  row: {
    minHeight: 50,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  copy: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 14, lineHeight: 18 },
  rowDescription: { fontSize: 12, lineHeight: 16 },
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
