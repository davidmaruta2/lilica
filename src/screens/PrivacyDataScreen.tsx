import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { checkAccountDeletionEligibility, deleteMyAccount, exportMyData, shareExportFile, ExportFile } from '../accountLifecycle';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { RemoveCareSpaceConfirm } from '../components/RemoveCareSpaceConfirm';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
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

type Props = {
  storageOwnerId?: string;
  currentCareSpaceId?: string;
  currentCareSpaceName?: string;
  // Omitted for a local-only care space (nothing synced, nothing to
  // leave) or when the current member is the space's organiser (an
  // organiser leaves via Care Circle's own role-change/removal flow, not
  // this screen -- Leave here is for a contributor/viewer only).
  canLeaveCurrentCareSpace?: boolean;
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
  currentCareSpaceId,
  currentCareSpaceName,
  canLeaveCurrentCareSpace,
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

  function handleLeave() {
    if (!currentCareSpaceId) return;
    Alert.alert(
      `Leave ${currentCareSpaceName ?? 'this care space'}?`,
      'You\'ll lose access to its records and documents. Anything you added stays as part of its shared history. Your account and any other care spaces are unaffected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive', onPress: async () => {
            setLeaveState({ busy: true });
            const result = await leaveCareSpace(currentCareSpaceId);
            if (result.ok) {
              setLeaveState({ busy: false, message: `You've left ${currentCareSpaceName ?? 'that care space'}.`, tone: 'success' });
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
      const names = result.data.map((space) => space.careSpaceName);
      setDeletionBlockers(names);
      setDeletionState({
        busy: false,
        tone: 'danger',
        message: `You're the only organiser of ${names.join(', ')}. Make someone else an organiser there first, so it's never left without one.`,
      });
      return;
    }
    // Nothing blocks deletion -- reveal the real, final destructive
    // confirmation (Phase 18B). Never skips straight to deleting: the
    // precheck passing is a necessary, not sufficient, condition.
    setDeletionBlockers([]);
    setDeletionCleared(true);
    setDeletionState({ busy: false, tone: 'default', message: undefined });
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
        {
          text: 'Delete my account', style: 'destructive', onPress: async () => {
            setDeletionState({ busy: true });
            const result = await deleteMyAccount();
            if (!result.ok) {
              // Server deletion failed -- never touch local data (section 24/27).
              setDeletionState({ busy: false, message: result.message, tone: 'danger' });
              return;
            }
            setDeletionState({ busy: false, tone: 'success', message: 'Your account has been deleted. Signing you out...' });
            await onAccountDeleted();
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Header onBack={onBack} />
      <View style={styles.content}>
        <AppText variant="title" centre>Privacy &amp; data</AppText>

        <Section title="What Lilica stores">
          <AppText variant="body" tone="soft">
            For each person you support, Lilica keeps their appointments, tasks, bills, home or car matters, documents, contacts, care information and updates -- plus who else can see them, any reminders you've set, and a record of who added or changed what.
          </AppText>
        </Section>

        <Section title="Export your data">
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

        <Section title="Device &amp; local data">
          <AppText variant="body" tone="soft">
            Lilica keeps a local copy of your records and documents on this device so it works offline, plus anything not yet finished uploading. Clearing it only affects this device -- your care spaces' own data stays safe in the cloud.
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Clear data from this device" disabled={clearState.busy} onPress={() => void handleClear()} style={styles.destructiveRow}>
            <AppText variant="bodyStrong" tone="danger" centre>{clearState.busy ? 'Clearing…' : 'Clear data from this device'}</AppText>
          </Pressable>
          {clearState.message ? <AppText variant="secondary" tone={clearState.tone === 'danger' ? 'danger' : 'soft'}>{clearState.message}</AppText> : null}
        </Section>

        {canLeaveCurrentCareSpace && currentCareSpaceId ? (
          <Section title="Care spaces">
            <AppText variant="body" tone="soft">
              You currently have access to {currentCareSpaceName ?? 'this care space'}.
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={`Leave ${currentCareSpaceName ?? 'this care space'}`} disabled={leaveState.busy} onPress={handleLeave} style={styles.destructiveRow}>
              <AppText variant="bodyStrong" tone="danger" centre>{leaveState.busy ? 'Leaving…' : `Leave ${currentCareSpaceName ?? 'this care space'}`}</AppText>
            </Pressable>
            {leaveState.message ? <AppText variant="secondary" tone={leaveState.tone === 'danger' ? 'danger' : 'soft'}>{leaveState.message}</AppText> : null}
          </Section>
        ) : null}

        {removableCareSpaces.length > 0 ? (
          <Section title="Remove a supported person">
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

        <Section title="Delete account">
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
    </Screen>
  );
}

// Direct product-owner feedback: six always-expanded sections read as
// cluttered. Each section is now a collapsible accordion -- collapsed by
// default, tap the header (title + a drawn chevron) to open. Purely
// presentational; no section's own behaviour changed.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title} section`}
        onPress={() => setExpanded((current) => !current)}
        style={styles.sectionHeader}
      >
        <AppText variant="section" style={styles.sectionTitle}>{title}</AppText>
        <View style={[styles.sectionChevron, expanded && styles.sectionChevronExpanded]} />
      </Pressable>
      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xl },
  section: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  sectionHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionTitle: { flex: 1 },
  // Same drawn-chevron technique used throughout the app (Header's back
  // chevron, Home's avatar chevron) -- pointing down, rotating to point
  // up when this section is expanded.
  sectionChevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.primary,
    transform: [{ rotate: '-45deg' }],
  },
  sectionChevronExpanded: {
    transform: [{ rotate: '135deg' }],
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
