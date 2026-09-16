import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { RemoveCareSpaceConfirm } from '../components/RemoveCareSpaceConfirm';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { CareCircleMember, CareSpaceDeletionStatus, DeletionReason } from '../careCircle';
import { colors, radius, spacing } from '../theme';

// Phase 20D, Part C (approved `\downloads\20-22.txt`): "Manage [Name]'s
// care" -- the one consolidated destination for INFREQUENT care-space
// administration (archive/restore, organiser handoff, permanent removal).
// Deliberately not a replacement for People or ordinary Care Circle
// browsing -- day-to-day membership/role browsing still lives there; this
// screen links out to it rather than duplicating it (brief section 25).
//
// Dangerous-action hierarchy (brief section 26): ordinary status/handoff
// controls first, Archive/Restore (reversible) next, permanent removal
// last, visually separated as its own danger area -- never visually
// equated with Archive.
type Props = {
  careSpaceId: string;
  personName: string;
  status: 'active' | 'archived';
  members: CareCircleMember[];
  deletionStatus?: CareSpaceDeletionStatus;
  selfMembershipId?: string;
  onBack: () => void;
  onOpenCareCircle: () => void;
  onArchive: () => Promise<{ ok: boolean; message?: string }>;
  onRestore: () => Promise<{ ok: boolean; message?: string }>;
  onPromote: (membershipId: string) => Promise<{ ok: boolean; message?: string }>;
  onRemove: () => Promise<{ ok: boolean; message?: string }>;
  onRequestDeletion: (reason?: DeletionReason) => Promise<{ ok: boolean; message?: string; deletedImmediately?: boolean }>;
  onApproveDeletion: () => Promise<{ ok: boolean; message?: string }>;
  onDeclineDeletion: () => Promise<{ ok: boolean; message?: string }>;
  onCancelDeletion: () => Promise<{ ok: boolean; message?: string }>;
  onRefreshDeletionStatus: () => void;
};

type SectionState = { busy: boolean; message?: string; tone?: 'default' | 'danger' | 'success' };

export function ManageCareScreen({
  careSpaceId: _careSpaceId,
  personName,
  status,
  members,
  deletionStatus,
  selfMembershipId,
  onBack,
  onOpenCareCircle,
  onArchive,
  onRestore,
  onPromote,
  onRemove,
  onRequestDeletion,
  onApproveDeletion,
  onDeclineDeletion,
  onCancelDeletion,
  onRefreshDeletionStatus,
}: Props) {
  const [statusState, setStatusState] = useState<SectionState>({ busy: false });
  const [handoffState, setHandoffState] = useState<SectionState>({ busy: false });
  const [deletionState, setDeletionState] = useState<SectionState>({ busy: false });
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  useEffect(() => {
    onRefreshDeletionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeOrganisers = members.filter((member) => member.role === 'organiser');
  const eligibleForHandoff = members.filter((member) => member.role !== 'organiser' && !member.isSelf);
  const isSoleOrganiser = activeOrganisers.length <= 1;
  const isRequester = deletionStatus && deletionStatus.requestedByMembershipId === selfMembershipId;
  const hasApproved = deletionStatus && selfMembershipId && deletionStatus.approvedMembershipIds.includes(selfMembershipId);

  async function handleArchiveToggle() {
    setStatusState({ busy: true });
    const result = status === 'active' ? await onArchive() : await onRestore();
    setStatusState({ busy: false, message: result.message, tone: result.ok ? 'success' : 'danger' });
  }

  async function handlePromote(membershipId: string) {
    setHandoffState({ busy: true });
    const result = await onPromote(membershipId);
    setHandoffState({ busy: false, message: result.message ?? (result.ok ? 'Done.' : undefined), tone: result.ok ? 'success' : 'danger' });
  }

  async function handleConfirmRemoval() {
    setDeletionState({ busy: true });
    const result = isSoleOrganiser ? await onRemove() : await onRequestDeletion();
    setDeletionState({ busy: false, message: result.message, tone: result.ok ? 'success' : 'danger' });
    if (result.ok) {
      setShowRemoveConfirm(false);
      onRefreshDeletionStatus();
    }
  }

  async function handleApprove() {
    setDeletionState({ busy: true });
    const result = await onApproveDeletion();
    setDeletionState({ busy: false, message: result.message, tone: result.ok ? 'success' : 'danger' });
    onRefreshDeletionStatus();
  }

  async function handleDecline() {
    setDeletionState({ busy: true });
    const result = await onDeclineDeletion();
    setDeletionState({ busy: false, message: result.message, tone: result.ok ? 'success' : 'danger' });
    onRefreshDeletionStatus();
  }

  async function handleCancel() {
    setDeletionState({ busy: true });
    const result = await onCancelDeletion();
    setDeletionState({ busy: false, message: result.message, tone: result.ok ? 'success' : 'danger' });
    onRefreshDeletionStatus();
  }

  return (
    <Screen>
      <Header title={`Manage ${personName}'s care`} onBack={onBack} />
      <View style={styles.content}>

        <View style={styles.section}>
          <AppText variant="section">Care status</AppText>
          <AppText variant="body" tone="soft">
            {status === 'active'
              ? `${personName}'s care is active.`
              : `${personName}'s care is archived. Everything is preserved, but ordinary changes are paused.`}
          </AppText>
          <Button
            label={statusState.busy ? 'Working…' : status === 'active' ? `Archive ${personName}'s care` : `Restore ${personName}'s care`}
            variant="secondary"
            disabled={statusState.busy}
            onPress={() => void handleArchiveToggle()}
            style={styles.button}
          />
          {statusState.message ? <AppText variant="secondary" tone={statusState.tone === 'danger' ? 'danger' : 'soft'}>{statusState.message}</AppText> : null}
        </View>

        <View style={styles.section}>
          <AppText variant="section">Responsibility</AppText>
          {isSoleOrganiser ? (
            <AppText variant="body" tone="soft">You're currently the only organiser.</AppText>
          ) : (
            <AppText variant="body" tone="soft">{activeOrganisers.length} people currently organise this care space.</AppText>
          )}
          {eligibleForHandoff.length > 0 ? (
            <>
              <AppText variant="body" tone="soft">Make someone else an organiser:</AppText>
              {eligibleForHandoff.map((member) => (
                <Pressable
                  key={member.membershipId}
                  accessibilityRole="button"
                  accessibilityLabel={`Make ${member.displayName} an organiser`}
                  disabled={handoffState.busy}
                  onPress={() => void handlePromote(member.membershipId)}
                  style={styles.row}
                >
                  <AppText variant="bodyStrong">{member.displayName}</AppText>
                  <AppText variant="secondary" tone="primary">Make organiser</AppText>
                </Pressable>
              ))}
            </>
          ) : null}
          {handoffState.message ? <AppText variant="secondary" tone={handoffState.tone === 'danger' ? 'danger' : 'soft'}>{handoffState.message}</AppText> : null}
          <Button label="Manage Care Circle" variant="text" onPress={onOpenCareCircle} />
        </View>

        <View style={[styles.section, styles.dangerSection]}>
          <AppText variant="section" tone="danger">Permanent removal</AppText>
          <AppText variant="body" tone="soft">
            Permanently deletes everything saved for {personName} -- this cannot be undone.
          </AppText>

          {!isSoleOrganiser && deletionStatus ? (
            <View style={styles.consentCard}>
              <AppText variant="bodyStrong">
                Waiting for {Math.max(0, deletionStatus.organiserCount - deletionStatus.approvedCount)} more organiser{deletionStatus.organiserCount - deletionStatus.approvedCount === 1 ? '' : 's'}
              </AppText>
              <AppText variant="secondary" tone="soft">
                Because {personName}'s care has more than one organiser, all organisers must agree before it can be permanently removed.
              </AppText>
              {isRequester ? (
                <Button label={deletionState.busy ? 'Working…' : 'Cancel this request'} variant="secondary" disabled={deletionState.busy} onPress={() => void handleCancel()} style={styles.button} />
              ) : !hasApproved ? (
                <>
                  <AppText variant="secondary" tone="soft">
                    Approving is permanent once every organiser agrees, and does not itself cancel an App Store or Google Play subscription.
                  </AppText>
                  <Button label={deletionState.busy ? 'Working…' : 'Approve permanent removal'} disabled={deletionState.busy} onPress={() => void handleApprove()} style={styles.button} />
                  <Button label={deletionState.busy ? 'Working…' : 'Decline'} variant="secondary" disabled={deletionState.busy} onPress={() => void handleDecline()} style={styles.button} />
                </>
              ) : (
                <AppText variant="secondary" tone="soft">You've already approved. Waiting on the other organiser(s).</AppText>
              )}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${personName}`}
              disabled={deletionState.busy}
              onPress={() => setShowRemoveConfirm(true)}
              style={styles.destructiveRow}
            >
              <AppText variant="bodyStrong" tone="danger" centre>Remove {personName}</AppText>
            </Pressable>
          )}
          {deletionState.message ? <AppText variant="secondary" tone={deletionState.tone === 'danger' ? 'danger' : 'soft'}>{deletionState.message}</AppText> : null}
        </View>
      </View>

      <RemoveCareSpaceConfirm
        visible={showRemoveConfirm}
        careSpaceName={personName}
        collaboratorCount={members.filter((member) => !member.isSelf).length}
        requiresAllOrganisers={!isSoleOrganiser}
        busy={deletionState.busy}
        error={deletionState.tone === 'danger' ? deletionState.message : undefined}
        onConfirm={() => void handleConfirmRemoval()}
        onCancel={() => setShowRemoveConfirm(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  section: {
    gap: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  dangerSection: {
    borderColor: colors.danger,
  },
  button: { borderRadius: radius.md },
  row: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  consentCard: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
  },
  destructiveRow: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
});
