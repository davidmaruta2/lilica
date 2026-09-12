import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing } from '../theme';
import { AppText } from './Text';

// Corrective task 4 / Phase 18 revision: the one shared Settings surface
// for Home/Calendar/To Do/People -- never a separate implementation per
// tab. Lists ONLY functionality that genuinely exists elsewhere already:
//   - Account: the existing AccountScreen, which already bundles profile,
//     the Phase 14 reminders/quiet-hours section, and sign out.
//   - Care Circle: the existing CareCircleScreen (Phase 15), when the
//     active care space is real and synced.
//   - Privacy & data (Phase 18): the PrivacyDataScreen -- what Lilica
//     stores, export, device/local data, leaving a care space and
//     account-deletion eligibility. Always offered (unlike Care Circle,
//     it's meaningful even for a local-only space).
// No Help/About row: not yet a genuinely implemented destination.
//
// Revised from an anchored dropdown card (which itself replaced an even
// earlier full-width bottom sheet) after direct product feedback: opening
// Account/Care Circle/Privacy & data used to hand off to a completely
// separate top-level screen, so returning from one landed the user back
// on the dashboard rather than back in Settings -- it never felt like one
// self-contained menu. This is now a genuine sliding drawer with its OWN
// internal section (the `section`/`children` props, driven by App.tsx's
// `settingsSection` state): opening a row swaps the drawer's body to that
// screen WITHOUT closing the drawer, and that screen's own Back returns
// to the drawer's menu list -- never out to the app. Only the drawer's
// own "Close" (or tapping the dimmed backdrop) exits entirely.
const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Product direction: 85-92% of phone width, clearly a drawer entering
// from the right edge -- never a centred popup card. Capped for very
// wide screens/tablets so it doesn't stretch edge-to-edge there.
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.88, 480);

type Section = 'menu' | 'account' | 'careCircle' | 'privacyData';

export function SettingsMenu({ visible, section, onClose, onOpenAccount, onOpenCareCircle, onOpenPrivacyData, children }: {
  visible: boolean;
  section: Section;
  onClose: () => void;
  onOpenAccount: () => void;
  onOpenCareCircle?: () => void;
  onOpenPrivacyData: () => void;
  // The active section's own screen (App.tsx builds it, since that's
  // where all the data/callbacks it needs already live) -- rendered in
  // place of the menu list whenever `section` isn't 'menu'.
  children?: ReactNode;
}) {
  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  // Keeps the Modal mounted for the duration of the close animation --
  // otherwise it would vanish instantly instead of sliding out.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(translateX, { toValue: DRAWER_WIDTH, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const entries = [
    { key: 'account', label: 'Account', description: 'Your profile, reminders and sign out', onPress: onOpenAccount },
    ...(onOpenCareCircle
      ? [{ key: 'careCircle', label: 'Care Circle', description: 'Who can help, and what they can see', onPress: onOpenCareCircle }]
      : []),
    { key: 'privacyData', label: 'Privacy & data', description: 'What Lilica stores, export, and device data', onPress: onOpenPrivacyData },
  ];

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss settings" style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
          <SafeAreaView edges={['top', 'bottom']} style={styles.drawerSafe}>
            <View style={styles.topBar}>
              <AppText variant="bodyStrong">{section === 'menu' ? 'Settings' : ' '}</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={onClose} hitSlop={8}>
                <AppText variant="secondary" tone="soft">Close</AppText>
              </Pressable>
            </View>
            {section === 'menu' ? (
              <View style={styles.list}>
                {entries.map((entry) => (
                  <Pressable
                    key={entry.key}
                    accessibilityRole="button"
                    accessibilityLabel={entry.label}
                    onPress={entry.onPress}
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
            ) : (
              <View style={styles.sectionBody}>{children}</View>
            )}
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(36,29,28,0.35)' },
  drawer: {
    marginLeft: 'auto',
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: colors.surface,
    ...shadow.soft,
  },
  drawerSafe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  list: { padding: spacing.md, gap: spacing.xs },
  // The active screen renders full-bleed inside the drawer -- it supplies
  // its own scroll/safe-area handling (Screen/Header), same as when it
  // was a top-level screen, just hosted here instead.
  sectionBody: { flex: 1 },
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
