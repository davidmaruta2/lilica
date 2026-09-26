import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { checkAccountDeletionEligibility, deleteMyAccount, exportMyData, shareExportFile, ExportFile } from '../accountLifecycle';
import { Button } from '../components/Button';
import { DeleteAccountOrganiserConfirm } from '../components/DeleteAccountOrganiserConfirm';
import { Header } from '../components/Header';
import { RemoveCareSpaceConfirm } from '../components/RemoveCareSpaceConfirm';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { FoundationIcon, FoundationIconComponent } from '../components/FoundationIcon';
import { DownloadIcon, FileTextIcon, ForwardIcon, HeartHandshakeIcon, LockIcon, SmartphoneIcon, TrashIcon } from '../components/foundationIcons';
import { SecondaryIconCircle, SecondaryPageIntro } from '../components/SecondaryPage';
import { leaveCareSpace } from '../careCircle';
import { pendingLocalWork } from '../localData';
import { colors, radius, spacing } from '../theme';
import { LilicaRecord } from '../types';

// Phase 18: "Privacy & data" -- the one place Lilica answers, truthfully,
// "what does Lilica hold, who can see it, how do I get a copy, and what
// happens if I leave/clear this phone/delete my account?" Reuses the
// existing Settings entry point (src/components/SettingsMenu.tsx); this
// is not a second settings system, just one more destination from it.
//
// Every action here calls a real, already-tested function
// (src/accountLifecycle.ts, src/localData.ts, src/careCircle.ts) --
// nothing on this screen is a toggle or button that does nothing (brief
// section 43).
//
// Direct product-owner feedback: with six sections all expanded at once,
// this screen read as cluttered rather than calm. Each section is now a
// collapsible accordion (collapsed by default, tap the header to open) --
// purely presentational, nothing about what each section does changed.
export type RemovableCareSpace = {
  careSpaceId: string;
  displayName: string;
  // How many OTHER active members currently have access -- shown in the
  // confirmation so an organiser removing a shared space knows
  // collaborators lose access too. 0 for a local-only or single-organiser
  // space.
  collaboratorCount: number;
};

export type LeavableCareSpace = {
  careSpaceId: string;
  displayName: string;
};

type Props = {
  storageOwnerId?: string;
  // Direct product-owner report, 26 September 2026: "a contributor has no
  // way of leaving a care circle if they want to" -- this used to be
  // scoped to only the currently active care space
  // (canLeaveCurrentCareSpace/currentCareSpaceId), the exact same
  // "only offers one, not every one" shape as the removableCareSpaces bug
  // fixed below. Every synced care space this account is an active
  // CONTRIBUTOR/VIEWER of (never the organiser -- an organiser leaves via
  // Care Circle's own role-change/removal flow, not this screen; never a
  // local-only space -- nothing synced, nothing to leave) now appears
  // here, not only whichever the switcher happens to have selected.
  // Empty array (never undefined) when none are leavable.
  leavableCareSpaces: LeavableCareSpace[];
  // Remove-supported-person: EVERY care space this account actively
  // organises -- not only the currently active one. Direct product-owner
  // report: "I have two supported people but it only offers to remove
  // one" -- an organiser of several people needs to see and remove any
  // of them from this one screen, not just whichever the switcher
  // happens to have selected. Empty array (never undefined) when none
  // are removable.
  removableCareSpaces: RemovableCareSpace[];
  currentRecords: LilicaRecord[];
  onBack: () => void;
  onCareSpaceLeft: () => void;
  // Remove-supported-person: called with the SPECIFIC care space id being
  // removed (one screen can now offer several) -- only after the real
  // deletion (server RPC for a synced space, or a direct local removal
  // for a local-only one) has genuinely succeeded does the caller update
  // local state.
  onRemoveCareSpace?: (careSpaceId: string) => Promise<{ ok: boolean; message?: string }>;
  onClearLocalData: () => Promise<void>;
  // Phase 18B: called only after delete_my_account() has genuinely
  // succeeded server-side. Mirrors onClearLocalData's own local-cleanup
  // pattern (App.tsx clears this account's local data, then signs out) --
  // server deletion always happens first (brief section 24).
  onAccountDeleted: () => Promise<void>;
};

type SectionState = { busy: boolean; message?: string; tone?: 'default' | 'danger' | 'success' };
type ExportState = SectionState & { files?: ExportFile[] };

export function PrivacyDataScreen({
  storageOwnerId,
  leavableCareSpaces,
  removableCareSpaces,
  currentRecords,
  onBack,
  onCareSpaceLeft,
  onRemoveCareSpace,
  onClearLocalData,
  onAccountDeleted,
}: Props) {
  const [exportState, setExportState] = useState<ExportState>({ busy: false });
  const [clearState, setClearState] = useState<SectionState>({ busy: false });
  const [leaveState, setLeaveState] = useState<SectionState>({ busy: false });
  const [removeState, setRemoveState] = useState<SectionState>({ busy: false });
  const [removeTarget, setRemoveTarget] = useState<RemovableCareSpace>();
  const [deletionState, setDeletionState] = useState<SectionState>({ busy: false });
  const [deletionBlockers, setDeletionBlockers] = useState<string[]>([]);
  const [deletionCleared, setDeletionCleared] = useState(false);
  const [showOrganiserConfirm, setShowOrganiserConfirm] = useState(false);

  async function handleRemoveCareSpace() {
    if (!onRemoveCareSpace || !removeTarget) return;
    setRemoveState({ busy: true });
    const result = await onRemoveCareSpace(removeTarget.careSpaceId);
    if (!result.ok) {
      setRemoveState({ busy: false, message: result.message, tone: 'danger' });
      return;
    }
    setRemoveTarget(undefined);
    setRemoveState({ busy: false, tone: 'success', message: `${removeTarget.displayName} has been removed.` });
  }

  async function handleExport() {
    setExportState({ busy: true });
    const result = await exportMyData();
    if (!result.ok) {
      setExportState({ busy: false, message: result.message, tone: 'danger' });
      return;
    }
    const skippedNote = result.data.skippedDocuments > 0
      ? ` ${result.data.skippedDocuments} document${result.data.skippedDocuments === 1 ? '' : 's'} couldn't be included (unavailable) -- everything else is ready below.`
      : '';
    setExportState({
      busy: false,
      files: result.data.files,
      tone: 'success',
      message: `Your data was prepared.${skippedNote} Share each file below.`,
    });
  }

  async function handleShareExportFile(file: ExportFile) {
    const result = await shareExportFile(file);
    if (!result.ok) setExportState((current) => ({ ...current, message: result.message, tone: 'danger' }));
  }

  async function handleClear() {
    if (!storageOwnerId) return;
    setClearState({ busy: true });
    const pending = await pendingLocalWork(storageOwnerId, currentRecords);
    const warnings = [
      pending.hasPendingMutations && 'changes you\'ve made that haven\'t finished saving to the cloud yet',
      pending.hasPendingUploads && 'a document file that hasn\'t finished uploading yet',
      pending.hasPendingCleanup && 'a deleted document that hasn\'t finished being removed from the cloud yet',
    ].filter(Boolean) as string[];

    const proceed = () => {
      onClearLocalData().then(() => {
        setClearState({ busy: false, message: 'This device\'s local data has been cleared. Sign in again to continue.', tone: 'success' });
      });
    };

    if (warnings.length > 0) {
      Alert.alert(
        'Clear data from this device?',
        `This device still has ${warnings.join(', and ')}. Clearing now could lose it permanently if it hasn't reached the cloud. This never affects Beauty's shared records or documents themselves -- only what's cached on this device.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setClearState({ busy: false }) },
          { text: 'Clear anyway', style: 'destructive', onPress: proceed },
        ],
      );
      return;
    }

    Alert.alert(
      'Clear data from this device?',
      'This removes what\'s cached on this device only -- your care spaces\' shared records and documents remain safely in the cloud, and will download again next time you sign in.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setClearState({ busy: false }) },
        { text: 'Clear', style: 'destructive', onPress: proceed },
      ],
    );
  }

  function handleLeave(space: LeavableCareSpace) {
    Alert.alert(
      `Leave ${space.displayName}?`,
      'You\'ll lose access to its records and documents. Anything you added stays as part of its shared history. Your account and any other care spaces are unaffected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive', onPress: async () => {
            setLeaveState({ busy: true });
            const result = await leaveCareSpace(space.careSpaceId);
            if (result.ok) {
              setLeaveState({ busy: false, message: `You've left ${space.displayName}.`, tone: 'success' });
              onCareSpaceLeft();
            } else {
              setLeaveState({ busy: false, message: result.message, tone: 'danger' });
            }
          },
        },
      ],
    );
  }

  async function handleCheckDeletion() {
    setDeletionState({ busy: true });
    setDeletionCleared(false);
    const result = await checkAccountDeletionEligibility();
    if (!result.ok) {
      setDeletionState({ busy: false, message: result.message, tone: 'danger' });
      return;
    }
    if (result.data.length > 0) {
      // Direct product-owner decision, 26 September 2026: being a sole
      // active organiser no longer BLOCKS deletion (delete_my_account()
      // itself no longer refuses this server-side either -- see the 26
      // September migration). Instead, show a clear warning and require
      // typing DELETE before proceeding -- DeleteAccountOrganiserConfirm
      // below, not a dead end.
      const names = result.data.map((space) => space.careSpaceName);
      setDeletionBlockers(names);
      setDeletionState({ busy: false });
      setShowOrganiserConfirm(true);
      return;
    }
    // Nothing blocks deletion -- reveal the real, final destructive
    // confirmation (Phase 18B). Never skips straight to deleting: the
    // precheck passing is a necessary, not sufficient, condition.
    setDeletionBlockers([]);
    setDeletionCleared(true);
    setDeletionState({ busy: false, tone: 'default', message: undefined });
  }

  // Shared by both confirmation paths below (the plain Alert for a
  // non-organiser, and DeleteAccountOrganiserConfirm's typed DELETE for
  // a sole organiser) -- the actual destructive call is identical either
  // way, only the warning/confirmation UI in front of it differs.
  async function performDeletion() {
    setDeletionState({ busy: true });
    const result = await deleteMyAccount();
    if (!result.ok) {
      // Server deletion failed -- never touch local data (section 24/27).
      setDeletionState({ busy: false, message: result.message, tone: 'danger' });
      return;
    }
    setShowOrganiserConfirm(false);
    setDeletionState({ busy: false, tone: 'success', message: 'Your account has been deleted.' });
    // Real-device report, 26 September 2026: this inline message was
    // never actually seen -- onAccountDeleted() immediately clears local
    // data and signs out, which navigates away (to sign-in/Welcome)
    // before anyone could read text on a screen that no longer exists.
    // A real, blocking confirmation the user must acknowledge -- not
    // text that gets superseded by a screen change a moment later -- is
    // shown first; sign-out only proceeds once they dismiss it.
    Alert.alert(
      'Account deleted',
      'Your account has been permanently deleted. You will now be signed out.',
      [{ text: 'OK', onPress: () => void onAccountDeleted() }],
      { cancelable: false },
    );
  }

  function handleConfirmDeletion() {
    Alert.alert(
      'Delete your Lilica account?',
      // Phase 21B, brief section 16: deleting a Lilica account can never
      // cancel an Apple/Google subscription on the user's behalf --
      // neither store gives a third-party server that ability. Stated
      // plainly here, before the destructive action, rather than left
      // for the user to discover as a surprise later charge.
      'This permanently deletes your account and sign-in -- you will lose all future access. Shared care records, documents and their relationships stay intact for anyone else who still has access to them, and your work stays truthfully attributed to you. This cannot be undone.\n\nDeleting your Lilica account does NOT automatically cancel an active App Store or Google Play subscription -- manage or cancel it directly in your App Store/Google Play account settings to stop future charges.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete my account', style: 'destructive', onPress: () => void performDeletion() },
      ],
    );
  }

  return (
    <Screen>
      <Header title="Privacy & data" onBack={onBack} />
      <View style={styles.content}>
        <SecondaryPageIntro>Manage your data and understand how Lilica keeps it safe and private.</SecondaryPageIntro>

        <Section title="What Lilica stores" description="A clear guide to the information we store" icon={FileTextIcon}>
          <AppText variant="body" tone="soft">
            For each person you support, Lilica keeps their appointments, tasks, bills, home or car matters, documents, contacts, care information and updates -- plus who else can see them, any reminders you've set, and a record of who added or changed what.
          </AppText>
        </Section>

        <Section title="Export your data" description="Download a copy of your information" icon={DownloadIcon}>
          <AppText variant="body" tone="soft">
            Get a copy of everything you're currently able to see across every care space you belong to -- including the actual document files, not just their details -- plus how records relate to each other.
          </AppText>
          <Button label={exportState.busy ? 'Preparing…' : 'Export your data'} variant="secondary" disabled={exportState.busy} onPress={() => void handleExport()} style={styles.button} />
          {exportState.message ? <AppText variant="secondary" tone={exportState.tone === 'danger' ? 'danger' : 'soft'}>{exportState.message}</AppText> : null}
          {exportState.files?.map((file) => (
            <Pressable
              key={file.uri}
              accessibilityRole="button"
              accessibilityLabel={`Share ${file.label}`}
              onPress={() => void handleShareExportFile(file)}
              style={styles.exportFileRow}
            >
              <AppText variant="secondary" numberOfLines={1} style={styles.exportFileName}>{file.label}</AppText>
              <AppText variant="secondary" tone="primary">Share</AppText>
            </Pressable>
          ))}
        </Section>

        <Section title="Device &amp; local data" description="What's stored on your device" icon={SmartphoneIcon}>
          <AppText variant="body" tone="soft">
            Lilica keeps a local copy of your records and documents on this device so it works offline, plus anything not yet finished uploading. Clearing it only affects this device -- your care spaces' own data stays safe in the cloud.
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Clear data from this device" disabled={clearState.busy} onPress={() => void handleClear()} style={styles.destructiveRow}>
            <AppText variant="bodyStrong" tone="danger" centre>{clearState.busy ? 'Clearing…' : 'Clear data from this device'}</AppText>
          </Pressable>
          {clearState.message ? <AppText variant="secondary" tone={clearState.tone === 'danger' ? 'danger' : 'soft'}>{clearState.message}</AppText> : null}
        </Section>

        {leavableCareSpaces.length > 0 ? (
          <Section title="Care spaces" description="Data for the people you care for" icon={LockIcon}>
            <AppText variant="body" tone="soft">
              {leavableCareSpaces.length === 1
                ? `You currently have access to ${leavableCareSpaces[0].displayName}.`
                : `You currently have access to ${leavableCareSpaces.length} care spaces as a contributor.`}
            </AppText>
            {leavableCareSpaces.map((space) => (
              <Pressable
                key={space.careSpaceId}
                accessibilityRole="button"
                accessibilityLabel={`Leave ${space.displayName}`}
                disabled={leaveState.busy}
                onPress={() => handleLeave(space)}
                style={styles.destructiveRow}
              >
                <AppText variant="bodyStrong" tone="danger" centre>{leaveState.busy ? 'Leaving…' : `Leave ${space.displayName}`}</AppText>
              </Pressable>
            ))}
            {leaveState.message ? <AppText variant="secondary" tone={leaveState.tone === 'danger' ? 'danger' : 'soft'}>{leaveState.message}</AppText> : null}
          </Section>
        ) : null}

        {removableCareSpaces.length > 0 ? (
          <Section title="Remove a supported person" description="Permanently remove a care space" icon={HeartHandshakeIcon} destructive>
            <AppText variant="body" tone="soft">
              If someone you support no longer needs support, you can remove them from Lilica -- this permanently deletes everything saved for them. You organise {removableCareSpaces.length === 1 ? '1 person' : `${removableCareSpaces.length} people`}.
            </AppText>
            {removableCareSpaces.map((space) => (
              <Pressable
                key={space.careSpaceId}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${space.displayName}`}
                disabled={removeState.busy}
                onPress={() => { setRemoveState({ busy: false }); setRemoveTarget(space); }}
                style={styles.destructiveRow}
              >
                <AppText variant="bodyStrong" tone="danger" centre>Remove {space.displayName}</AppText>
              </Pressable>
            ))}
            {removeState.message ? <AppText variant="secondary" tone={removeState.tone === 'danger' ? 'danger' : 'soft'}>{removeState.message}</AppText> : null}
          </Section>
        ) : null}

        <Section title="Delete account" description="Permanently delete your Lilica account" icon={TrashIcon} destructive>
          <AppText variant="body" tone="soft">
            Permanently removes your Lilica account and sign-in. Shared care records, documents and their relationships stay intact for anyone else who still has access to them, and your work stays truthfully attributed to you.
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Check if my account can be deleted" disabled={deletionState.busy} onPress={() => void handleCheckDeletion()} style={styles.destructiveRow}>
            <AppText variant="bodyStrong" tone="danger" centre>{deletionState.busy ? 'Checking…' : 'Delete account'}</AppText>
          </Pressable>
          {deletionState.message ? <AppText variant="secondary" tone={deletionState.tone === 'danger' ? 'danger' : 'soft'}>{deletionState.message}</AppText> : null}
          {deletionCleared && deletionBlockers.length === 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Delete my account" disabled={deletionState.busy} onPress={handleConfirmDeletion} style={styles.destructiveRow}>
              <AppText variant="bodyStrong" tone="danger" centre>{deletionState.busy ? 'Deleting…' : 'Delete my account'}</AppText>
            </Pressable>
          ) : null}
        </Section>
      </View>
      <RemoveCareSpaceConfirm
        visible={Boolean(removeTarget)}
        careSpaceName={removeTarget?.displayName ?? 'this supported person'}
        collaboratorCount={removeTarget?.collaboratorCount}
        busy={removeState.busy}
        error={removeState.tone === 'danger' ? removeState.message : undefined}
        onConfirm={() => void handleRemoveCareSpace()}
        onCancel={() => setRemoveTarget(undefined)}
      />
      <DeleteAccountOrganiserConfirm
        visible={showOrganiserConfirm}
        careSpaceNames={deletionBlockers}
        busy={deletionState.busy}
        error={deletionState.tone === 'danger' ? deletionState.message : undefined}
        onConfirm={() => void performDeletion()}
        onCancel={() => setShowOrganiserConfirm(false)}
      />
    </Screen>
  );
}

// Direct product-owner feedback: six always-expanded sections read as
// cluttered. Each section is now a collapsible accordion -- collapsed by
// default, tap the header (title + a drawn chevron) to open. Purely
// presentational; no section's own behaviour changed.
function Section({ title, description, icon, destructive, children }: { title: string; description: string; icon: FoundationIconComponent; destructive?: boolean; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title} section`}
        onPress={() => setExpanded((current) => !current)}
        style={[styles.sectionHeader, destructive && styles.sectionHeaderDanger]}
      >
        <SecondaryIconCircle icon={icon} tone={destructive ? 'danger' : 'plum'} />
        <View style={styles.sectionHeaderCopy}>
          <AppText variant="bodyStrong" tone={destructive ? 'danger' : 'default'} style={styles.sectionTitle}>{title}</AppText>
          <AppText variant="secondary" tone={destructive ? 'danger' : 'soft'} style={styles.sectionDescription}>{description}</AppText>
        </View>
        <View style={[styles.sectionChevron, expanded && styles.sectionChevronExpanded]}><FoundationIcon icon={ForwardIcon} role="navigation" color={destructive ? colors.danger : colors.primary} /></View>
      </Pressable>
      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xs, paddingBottom: spacing.xl },
  section: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  sectionHeader: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  sectionHeaderDanger: { backgroundColor: '#FDECEC' },
  sectionHeaderCopy: { flex: 1 },
  sectionTitle: { fontSize: 15, lineHeight: 19 },
  sectionDescription: { fontSize: 12, lineHeight: 16 },
  // Same drawn-chevron technique used throughout the app (Header's back
  // chevron, Home's avatar chevron) -- pointing down, rotating to point
  // up when this section is expanded.
  sectionChevron: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionChevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  sectionBody: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  button: { borderRadius: radius.md },
  exportFileRow: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  exportFileName: { flex: 1 },
  destructiveRow: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
});
