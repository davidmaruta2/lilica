import { ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

const ZERO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

import { colors, radius, shadow, spacing } from '../theme';
import { AppText } from './Text';
import { Wordmark } from './Wordmark';

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

type Section = 'menu' | 'account' | 'careCircle' | 'privacyData' | 'subscription';

export function SettingsMenu({ visible, section, onClose, onOpenAccount, onOpenCareCircle, onOpenPrivacyData, onOpenSubscription, subscriptionSummary, children }: {
  visible: boolean;
  section: Section;
  onClose: () => void;
  onOpenAccount: () => void;
  onOpenCareCircle?: () => void;
  onOpenPrivacyData: () => void;
  // Phase 21B: always offered, like Privacy & data -- meaningful
  // regardless of whether the active care space is real/synced, since
  // entitlement is an account-level fact, not a per-care-space one.
  onOpenSubscription: () => void;
  // A short, calm one-line status ("12 days left in your free period" /
  // "Lilica Annual · £8.99/year · Active") shown as this row's own
  // description -- never a separate badge/countdown elsewhere in the app
  // (brief section 21's own placement guidance). Falls back to a neutral
  // description while entitlement hasn't loaded yet.
  subscriptionSummary?: string;
  // The active section's own screen (App.tsx builds it, since that's
  // where all the data/callbacks it needs already live) -- rendered in
  // place of the menu list whenever `section` isn't 'menu'.
  children?: ReactNode;
}) {
  // Visual-quality correction (12 September 2026): read OUTSIDE the
  // Modal, in SettingsMenu's own place in the React tree (a normal
  // descendant of App.tsx's top-level SafeAreaProvider). Modal portals
  // its children to a separate native surface, and a SafeAreaView
  // measuring INSIDE that portal was not reliably reading this device's
  // real insets there -- physical QA showed the header colliding with
  // the status bar/notch. Reading the value out here, where measurement
  // is already correct everywhere else in the app, and applying it as
  // plain padding inside the Modal sidesteps that entirely -- no
  // safe-area measurement ever happens inside the portal itself.
  // A plain useContext read (not the library's useSafeAreaInsets hook,
  // which throws when no provider is present -- e.g. a unit test
  // rendering this component in isolation) -- falls back to zero insets
  // rather than crashing; the real app always has a SafeAreaProvider at
  // its root (App.tsx), so this reads the correct value there.
  const insets = useContext(SafeAreaInsetsContext) ?? ZERO_INSETS;
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
    { key: 'subscription', label: 'Subscription', description: subscriptionSummary ?? 'Your Lilica subscription', onPress: onOpenSubscription },
  ];

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss settings" style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
          <View style={[styles.drawerSafe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.topBar}>
              <AppText variant="section" tone="primary" style={styles.topBarTitle}>
                {section === 'menu' ? 'Settings' : ' '}
              </AppText>
              <Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={onClose} hitSlop={8} style={styles.closeButton}>
                <AppText variant="secondary" tone="primary" style={styles.closeLabel}>Close</AppText>
              </Pressable>
            </View>
            {section === 'menu' ? (
              <View style={styles.listWrap}>
                <View style={styles.list}>
                  {entries.map((entry) => (
                    <Pressable
                      key={entry.key}
                      accessibilityRole="button"
                      accessibilityLabel={entry.label}
                      onPress={entry.onPress}
                      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    >
                      <View style={styles.rowMark} />
                      <View style={styles.copy}>
                        <AppText variant="bodyStrong" style={styles.rowLabel}>{entry.label}</AppText>
                        <AppText variant="secondary" tone="soft" style={styles.rowDescription}>{entry.description}</AppText>
                      </View>
                      <View style={styles.chevron} />
                    </Pressable>
                  ))}
                </View>
                <View style={styles.footer}>
                  <Wordmark size="compact" tone="dark" />
                </View>
              </View>
            ) : (
              <View style={styles.sectionBody}>{children}</View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(36,29,28,0.4)' },
  drawer: {
    marginLeft: 'auto',
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: colors.canvas,
    ...shadow.soft,
  },
  drawerSafe: { flex: 1 },
  // Visual-quality correction: a plain thin-bordered bar with small text
  // read as a generic system sheet, not part of Lilica's own visual
  // language -- this now matches every other screen's own header
  // treatment (a bold "section"-weight title in the app's primary
  // burgundy accent) rather than a muted, undersized label.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  topBarTitle: { fontSize: 22 },
  closeButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  closeLabel: { fontWeight: '700' },
  listWrap: { flex: 1, justifyContent: 'space-between' },
  list: { padding: spacing.lg, gap: spacing.sm },
  // The active screen renders full-bleed inside the drawer -- it supplies
  // its own scroll/safe-area handling (Screen/Header), same as when it
  // was a top-level screen, just hosted here instead.
  sectionBody: { flex: 1 },
  // Visual-quality correction: the previous plain grey-bordered card
  // (identical weight to a disabled/inert control) is replaced with the
  // same soft-shadow, borderless "elevated card" language every other
  // screen's own record/summary cards already use (see e.g.
  // ToDoScreen's row cards) -- plus a small coloured accent mark and a
  // primary-toned chevron, so a row visibly invites a tap rather than
  // reading as a static list item.
  row: {
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.soft,
  },
  rowPressed: { opacity: 0.85 },
  rowMark: {
    width: 6,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  copy: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16 },
  rowDescription: { fontSize: 13, lineHeight: 17 },
  // Same drawn-chevron technique as Header.tsx's back chevron, pointing
  // right here (top+right border) to read as "opens something further".
  chevron: {
    width: 11,
    height: 11,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: colors.primary,
    transform: [{ rotate: '45deg' }],
  },
  // A small, quiet brand mark rather than leaving the drawer's own
  // unused space beneath a short menu list looking like an unfinished
  // blank void.
  footer: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
});
