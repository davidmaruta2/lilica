import { ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

const ZERO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

import { colors, radius, shadow, spacing } from '../theme';
import { FoundationIcon, FoundationIconComponent } from './FoundationIcon';
import { ArchiveIcon, BookOpenIcon, CircleHelpIcon, ClipboardListIcon, CreditCardIcon, FileTextIcon, ForwardIcon, HeartHandshakeIcon, LightbulbIcon, LockIcon, MailIcon, PhoneIcon, PillIcon, UserIcon, UsersRoundIcon, XIcon } from './foundationIcons';
import { SecondaryIconCircle } from './SecondaryPage';
import { SecondaryPageCloseProvider } from './Header';
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
//   - Help (direct product-owner request): "How to use Lilica", "FAQ",
//     and "Contact" (a real support-email mailto: action), all static
//     reference content, always offered regardless of sync state, same
//     as Account. No About row: not yet a genuinely implemented
//     destination.
//   - Key contacts (Phase 23): the existing ContactsListScreen, moved
//     here from the Care Circle page now that page centres on Care
//     Circle membership and Lilica Chat -- GP/pharmacy/etc. never
//     message anyone, so they no longer sit beside a chat feature.
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

type Section = 'menu' | 'careSummary' | 'documents' | 'medicalLog' | 'manageCare' | 'archivedCare' | 'account' | 'careCircle' | 'joinCareCircle' | 'privacyData' | 'subscription' | 'faq' | 'howTo' | 'featureRequest' | 'contact';

// Phase 20C (approved Option 2): the drawer becomes a small hybrid --
// person-scoped navigation ABOVE the existing account/app settings group,
// not a wholesale navigation-hub conversion. Recent Activity now belongs
// to the notification bell on every primary tab, while Care Summary remains
// here as a person-scoped destination.
export function SettingsMenu({
  visible,
  section,
  onClose,
  personName,
  onOpenCareSummary,
  onOpenDocuments,
  onOpenMedicalLog,
  onOpenManageCare,
  onOpenContacts,
  onOpenAccount,
  onOpenCareCircle,
  onOpenJoinCareCircle,
  onOpenPrivacyData,
  onOpenSubscription,
  subscriptionSummary,
  onOpenArchivedCare,
  onOpenHowTo,
  onOpenFaq,
  onOpenFeatureRequest,
  onOpenContact,
  children,
}: {
  visible: boolean;
  section: Section;
  onClose: () => void;
  // The current supported person's first name, for the "[Name]'s care"
  // group label -- the exact same source every other screen already
  // reads from (App.tsx), never a second person-name state. Omitted
  // (falls back to a generic label) only in the unlikely case no name is
  // available at all.
  personName?: string;
  // Both omitted together for a local-only (never-synced) care space --
  // the same guard (`careCircleAvailable` in App.tsx) already used for
  // onOpenCareCircle below, reused rather than inventing a second rule.
  // Opens the existing Care Summary screen in-drawer (App.tsx's
  // settingsSection state, exactly like Account/Care Circle/Privacy & data).
  onOpenCareSummary?: () => void;
  // Phase 20D: same care-space availability guard as Care Summary.
  // onOpenManageCare is FURTHER restricted to organisers only (App.tsx) --
  // every one of its own actions requires organiser authority, so a
  // contributor/viewer is never shown a destination full of controls they
  // cannot use (this app's established "never a fake affordance" rule).
  onOpenDocuments?: () => void;
  // Post-build implementation batch (lilbatch.txt, 17 September 2026):
  // same care-space availability guard as Care Summary/Documents.
  onOpenMedicalLog?: () => void;
  onOpenManageCare?: () => void;
  // Phase 23: Key contacts (GP, pharmacy, a neighbour) moved here from
  // the Care Circle page -- person-scoped like Care Summary/Documents/
  // Medical Log above, since it's about this supported person's own
  // useful contacts, not about Care Circle sharing/access or the signed-
  // in user's account. Unlike Documents/Medical Log, App.tsx always
  // supplies this regardless of careCircleAvailable -- contacts are a
  // plain local `contact` record with no sync dependency, and the Care
  // Circle page itself always offered this for a local-only space before
  // this move, so that stays true here too.
  onOpenContacts?: () => void;
  onOpenAccount: () => void;
  onOpenCareCircle?: () => void;
  // Optional only so existing tests that render this component in
  // isolation need not supply every prop -- the real app (App.tsx)
  // always supplies it; see the "Join a Care Circle" row's own header
  // comment below for why it must be offered regardless of
  // onOpenCareCircle/careCircleAvailable.
  onOpenJoinCareCircle?: () => void;
  onOpenPrivacyData: () => void;
  // Phase 21B: always offered, like Privacy & data -- meaningful
  // regardless of whether the active care space is real/synced, since
  // entitlement is an account-level fact, not a per-care-space one.
  onOpenSubscription: () => void;
  // Phase 20D: only offered when this account has at least one genuinely
  // archived care space -- omitted rather than shown as a permanently
  // empty destination (again, the same "never a fake affordance" rule).
  // Account-scoped, not person-scoped: by definition an archived care
  // space is never the currently active person, so it cannot live inside
  // "[Name]'s care" -- see docs/REVISION_LOG.md for this judgement call.
  onOpenArchivedCare?: () => void;
  // A short, calm one-line status ("12 days left in your free period" /
  // "Lilica Annual · £8.99/year · Active") shown as this row's own
  // description -- never a separate badge/countdown elsewhere in the app
  // (brief section 21's own placement guidance). Falls back to a neutral
  // description while entitlement hasn't loaded yet.
  subscriptionSummary?: string;
  // Direct product-owner request: static, always-available help content --
  // no data, no permission check, always offered regardless of care-space
  // sync state, same as Account.
  onOpenHowTo: () => void;
  onOpenFaq: () => void;
  onOpenFeatureRequest?: () => void;
  onOpenContact: () => void;
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

  const personCareEntries = [
    ...(onOpenCareSummary
      ? [{ key: 'careSummary', label: 'Care Summary', description: 'A quick view of what matters right now', icon: ClipboardListIcon, onPress: onOpenCareSummary }]
      : []),
    ...(onOpenDocuments
      ? [{ key: 'documents', label: 'Documents', description: 'Every document saved for them', icon: FileTextIcon, onPress: onOpenDocuments }]
      : []),
    ...(onOpenMedicalLog
      ? [{ key: 'medicalLog', label: 'Medical Log', description: 'Care needs, conditions and medicines', icon: PillIcon, onPress: onOpenMedicalLog }]
      : []),
    ...(onOpenManageCare
      ? [{ key: 'manageCare', label: personName ? `Manage ${personName}'s care` : 'Manage their care', description: 'Archive, handoff and permanent removal', icon: HeartHandshakeIcon, onPress: onOpenManageCare }]
      : []),
    ...(onOpenContacts
      ? [{ key: 'contacts', label: 'Key contacts', description: 'GP, pharmacy, and other useful contacts', icon: PhoneIcon, onPress: onOpenContacts }]
      : []),
  ];

  // 20 September 2026 grouping correction (direct product-owner report):
  // Care Circle/Join a Care Circle/Archived care are about who else has
  // access to this care space, never about the signed-in user's own
  // account -- a different mental category from Account/Privacy &
  // data/Subscription, exactly the split serious multi-user apps make
  // (Notion "Members" vs "My account", 1Password "People" vs "Account",
  // Slack "Team members" vs "Profile & account", Dropbox "Sharing" vs
  // "Account"). Kept as its own group below, separate from accountEntries.
  const careCircleEntries = [
    ...(onOpenCareCircle
      ? [{ key: 'careCircle', label: 'Care Circle', description: 'Who can help, and what they can see', icon: UsersRoundIcon, onPress: onOpenCareCircle }]
      : []),
    // Real gap reported directly (15 September 2026): the manual
    // invitation-code entry point (JoinCareCircleScreen) was only ever
    // reachable from INSIDE an already-open Care Circle screen, itself
    // gated behind having a real, synced care space of one's own
    // (`careCircleAvailable` in App.tsx). Someone with nothing of their
    // own set up yet -- exactly who a fresh invitation code is most
    // likely to reach -- had no way to find it at all. Always offered
    // here (App.tsx always supplies onOpenJoinCareCircle), regardless of
    // onOpenCareCircle/careCircleAvailable, for that reason -- and
    // (20 September 2026, explicit product-owner decision) this is
    // exactly why the "Care Circle" group heading itself still appears
    // for someone with nothing set up yet, showing only this row.
    ...(onOpenJoinCareCircle
      ? [{ key: 'joinCareCircle', label: 'Join a Care Circle', description: 'Enter an invitation code you\'ve been sent', icon: HeartHandshakeIcon, onPress: onOpenJoinCareCircle }]
      : []),
    ...(onOpenArchivedCare
      ? [{ key: 'archivedCare', label: 'Archived care', description: 'Care spaces you\'ve paused', icon: ArchiveIcon, onPress: onOpenArchivedCare }]
      : []),
  ];

  const accountEntries = [
    { key: 'account', label: 'Account', description: 'Your profile, reminders and sign out', icon: UserIcon, onPress: onOpenAccount },
    { key: 'privacyData', label: 'Privacy & data', description: 'What Lilica stores, export, and device data', icon: LockIcon, onPress: onOpenPrivacyData },
    { key: 'subscription', label: 'Subscription', description: subscriptionSummary ?? 'Your Lilica subscription', icon: CreditCardIcon, onPress: onOpenSubscription },
  ];

  const helpEntries = [
    { key: 'howTo', label: 'How to use Lilica', description: 'Guides and tips', icon: BookOpenIcon, onPress: onOpenHowTo },
    { key: 'faq', label: 'FAQ', description: 'Common questions', icon: CircleHelpIcon, onPress: onOpenFaq },
    ...(onOpenFeatureRequest
      ? [{ key: 'featureRequest', label: 'Suggest a feature', description: 'Tell us what would help', icon: LightbulbIcon, onPress: onOpenFeatureRequest }]
      : []),
    { key: 'contact', label: 'Contact', description: 'Get in touch', icon: MailIcon, onPress: onOpenContact },
  ];

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss settings" style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
          <View style={[styles.drawerSafe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {section === 'menu' ? (
              <>
                <View style={styles.topBar}>
                  <Wordmark size="compact" tone="dark" />
                  <Pressable accessibilityRole="button" accessibilityLabel="Close settings" onPress={onClose} hitSlop={8} style={styles.closeButton}>
                    <FoundationIcon icon={XIcon} role="navigation" color={colors.primary} />
                  </Pressable>
                </View>
                {/* Real bug found by direct product-owner report: as more
                    rows were added the menu needed to remain scrollable. */}
                <ScrollView style={styles.listWrap} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                <View style={styles.list}>
                  {personName ? (
                    <View style={styles.personRow}>
                      <View style={styles.personAvatar}><AppText variant="bodyStrong" tone="primary">{personName.charAt(0).toUpperCase()}</AppText></View>
                      <View style={styles.copy}>
                        <AppText variant="bodyStrong">{personName}</AppText>
                        <AppText variant="secondary" tone="soft">View and manage their care</AppText>
                      </View>
                    </View>
                  ) : null}
                  {personCareEntries.length > 0 ? (
                    <View style={styles.group}>
                      <AppText variant="meta" tone="muted" style={styles.groupLabel}>
                        {personName ? `${personName}'s care` : 'This care space'}
                      </AppText>
                      {personCareEntries.map((entry) => (
                        <SettingsRow key={entry.key} icon={entry.icon} label={entry.label} description={entry.description} onPress={entry.onPress} />
                      ))}
                    </View>
                  ) : null}
                  {careCircleEntries.length > 0 ? (
                    <View style={styles.group}>
                      <AppText variant="meta" tone="muted" style={styles.groupLabel}>Care Circle</AppText>
                      {careCircleEntries.map((entry) => (
                        <SettingsRow key={entry.key} icon={entry.icon} label={entry.label} description={entry.description} onPress={entry.onPress} />
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.group}>
                    <AppText variant="meta" tone="muted" style={styles.groupLabel}>Account</AppText>
                    {accountEntries.map((entry) => (
                      <SettingsRow key={entry.key} icon={entry.icon} label={entry.label} description={entry.description} onPress={entry.onPress} />
                    ))}
                  </View>
                  <View style={styles.group}>
                    <AppText variant="meta" tone="muted" style={styles.groupLabel}>Help</AppText>
                    {helpEntries.map((entry) => (
                      <SettingsRow key={entry.key} icon={entry.icon} label={entry.label} description={entry.description} onPress={entry.onPress} />
                    ))}
                  </View>
                </View>
                <View style={styles.footer}>
                  <Wordmark size="compact" tone="dark" />
                </View>
                </ScrollView>
              </>
            ) : (
              <SecondaryPageCloseProvider onClose={onClose}>
                <View style={styles.sectionBody}>{children}</View>
              </SecondaryPageCloseProvider>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// Extracted only to avoid repeating the identical row JSX for both groups
// -- the row's own visual language (elevated card, accent mark, chevron)
// is completely unchanged from before this task, just reused for a
// second group heading above it.
function SettingsRow({ icon, label, description, onPress }: { icon: FoundationIconComponent; label: string; description: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <SecondaryIconCircle icon={icon} tone="plum" />
      <View style={styles.copy}>
        <AppText variant="bodyStrong" style={styles.rowLabel}>{label}</AppText>
        <AppText variant="secondary" tone="soft" style={styles.rowDescription}>{description}</AppText>
      </View>
      <FoundationIcon icon={ForwardIcon} role="navigation" color={colors.primary} />
    </Pressable>
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
    backgroundColor: colors.canvas,
  },
  topBarTitle: { fontSize: 22 },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
  },
  closeLabel: { fontWeight: '700' },
  listWrap: { flex: 1 },
  listContent: { flexGrow: 1, justifyContent: 'space-between' },
  list: { padding: spacing.md, gap: spacing.md },
  // Phase 20C: the smallest coherent visual addition -- the existing
  // uppercase, letter-spaced "meta" caption style (already used
  // throughout the app for category eyebrow labels) as a plain, static
  // group heading. No new typography token, no new colour.
  group: { gap: spacing.xxs },
  groupLabel: { paddingHorizontal: spacing.xs, fontSize: 11, lineHeight: 15 },
  personRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  personAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
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
    minHeight: 54,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#E8DFD6',
  },
  rowPressed: { opacity: 0.85 },
  copy: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 14, lineHeight: 18 },
  rowDescription: { fontSize: 11, lineHeight: 15 },
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
