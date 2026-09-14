import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import {
  CareCircleDomain,
  CareCircleInvitation,
  CareCircleMember,
  CareCircleRole,
  DOMAIN_DESCRIPTIONS,
  DOMAIN_LABELS,
  inviteMember,
  recordInvitationShareOpened,
  removeMember,
  revokeInvitation,
  sendInvitationEmail,
} from '../careCircle';
import { invitationWebUrl } from '../invitationLinks';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { TextField } from '../components/TextField';
import { colors, radius, spacing } from '../theme';

type Props = {
  personName?: string;
  members: CareCircleMember[];
  invitations: CareCircleInvitation[];
  careSpaceId: string;
  onBack: () => void;
  // Re-fetches members/invitations from the server -- called after any
  // successful invite/revoke/remove so the screen always reflects real,
  // server-confirmed state rather than an optimistic local guess.
  onRefresh: () => void;
  // Phase 21C: inviting a new member is the one gated action on this
  // screen (creating a new Care Circle relationship) -- accepting/
  // declining/leaving/removing a member are all deliberately never gated
  // (see docs/PHASE_21_ARCHITECTURE.md section 9). The "Invite someone"
  // button stays visible either way; tapping it while read-only calls
  // onInviteBlocked instead of opening the invite form, so the affordance
  // is never silently disabled with no explanation.
  isReadOnly?: boolean;
  onInviteBlocked?: () => void;
  // Care Circle invitation delivery: this account's own display name, for
  // the native Share text only ("[You] has invited them..." reads
  // naturally from whoever taps Share) -- the email itself always
  // states the inviter's name authoritatively from the server, never
  // from this prop.
  inviterDisplayName?: string;
  // Care Circle invitation & joining flow completion (`\downloads\carecircle.txt`,
  // 14 September 2026): an existing user may already have Lilica and
  // want to join a DIFFERENT Care Circle by code, without waiting for
  // automatic discovery. Optional -- omitted entirely where this screen
  // is reached from a context that already offers it elsewhere.
  onJoinAnotherCareCircle?: () => void;
};

// Displayed grouped (ABCD-1234-style); stored server-side as one plain
// 8-character string (see supabase/migrations/20260916140000_invitation_code.sql).
function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function emailButtonLabel(emailed: boolean, sending: boolean) {
  if (sending) return 'Sending…';
  return emailed ? 'Resend email' : 'Send by email';
}

function shareButtonLabel(emailed: boolean, shared: boolean) {
  if (shared) return 'Share again';
  if (emailed) return 'Share instead';
  return 'Share invitation';
}

// Truthful status line for a Pending Invitations row. Final
// architectural closure (14 September 2026): both flags come straight
// from the invitation row's own server-persisted fields
// (lastEmailSentAt/lastShareOpenedAt, set only by
// record_invitation_email_sent()/record_invitation_share_opened()) --
// NEVER from local device state, so this survives app restart, a
// reinstall, or a different device/session reading the same
// invitation. A transient in-flight failure (this component's own
// local state, deliberately not persisted) takes priority over this
// while it's showing.
function deliveryStatusLine(emailed: boolean, shared: boolean) {
  if (emailed && shared) return 'Invitation emailed. Sharing also opened.';
  if (emailed) return 'Invitation emailed.';
  if (shared) return 'Sharing opened.';
  return 'Not sent yet.';
}

// Care Circle invitation delivery: one shared row per pending invitation
// showing its own delivery state -- never sent yet, busy while sending,
// a real persisted past success (read directly from the invitation
// object -- see deliveryStatusLine() above), or a transient in-flight
// failure/cancellation (this component's own local state, deliberately
// NOT persisted -- a failure is not a truth worth remembering forever,
// and the next real attempt supersedes it). Deliberately distinguishes
// "invitation created" (already true, always) from "email delivery
// request accepted" (only once Resend's own API has genuinely accepted
// the send, AND the server has recorded that -- see
// record_invitation_email_sent()) -- never claims mailbox delivery
// itself, which no provider can guarantee (brief section 29). A failed
// send never blocks Share, and retrying never creates a second
// invitation -- both actions always target the SAME existing row.
//
// SHARE RELIABILITY, stated honestly rather than assumed: React Native's
// Share.share() resolves with { action } on iOS (sharedAction vs
// dismissedAction -- a real cancellation signal), but on Android it
// resolves as soon as the OS share sheet is successfully INVOKED,
// regardless of what the user does inside it -- Android genuinely
// cannot tell Lilica whether the user actually completed a share.
// Rather than brand-conditional wording per platform (itself a subtle
// overclaim on iOS, where "sharedAction" only means a target app was
// picked, not that a message was definitely sent), this deliberately
// uses the single strongest claim true on BOTH platforms: "Sharing
// opened." -- never "Invitation shared," which would overclaim on
// Android every time.
function DeliveryActions({
  invitation,
  personName,
  inviterDisplayName,
  onSuccess,
  busy,
  setBusy,
}: {
  invitation: Pick<CareCircleInvitation, 'id' | 'inviteCode' | 'lastEmailSentAt' | 'lastShareOpenedAt'>;
  personName?: string;
  inviterDisplayName?: string;
  // Called only after a REAL, server-confirmed success -- the parent
  // decides what that means (close the creation panel, and/or just
  // re-fetch from the server so this same invitation's row reflects
  // the new persisted state everywhere it's shown).
  onSuccess: () => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}) {
  const [transient, setTransient] = useState<{ status: 'idle' | 'sending' | 'failed'; message?: string }>({ status: 'idle' });
  const emailed = !!invitation.lastEmailSentAt;
  const shared = !!invitation.lastShareOpenedAt;

  async function handleSendEmail() {
    setBusy(true);
    setTransient({ status: 'sending' });
    const result = await sendInvitationEmail(invitation.id);
    setBusy(false);
    if (result.ok) {
      setTransient({ status: 'idle' });
      onSuccess();
    } else {
      setTransient({ status: 'failed', message: result.message });
    }
  }

  async function handleShare() {
    const person = personName?.trim() || 'their care';
    const inviter = inviterDisplayName?.trim();
    const intro = inviter ? `${inviter} has invited you to help with ${person}'s care in Lilica.` : `You've been invited to help with ${person}'s care in Lilica.`;
    // Brief section 23: the shared content must work independently of
    // the link -- wording, link, AND the invitation code together.
    const message = [
      intro,
      '',
      `Open your invitation:\n${invitationWebUrl(invitation.id, invitation.inviteCode)}`,
      '',
      `Invitation code: ${formatInviteCode(invitation.inviteCode)}`,
      '',
      "If you already have Lilica, you can also open Care Circle → Join a Care Circle and enter the code.",
    ].join('\n');
    try {
      const result = await Share.share({ message });
      // iOS reports a genuine cancellation as dismissedAction -- never
      // record delivery on that. Android has no equivalent signal (the
      // promise resolves once the sheet opens either way), so a
      // resolved, non-dismissed result is the strongest truthful signal
      // available on that platform.
      if (result.action !== Share.dismissedAction) {
        setBusy(true);
        const recordResult = await recordInvitationShareOpened(invitation.id);
        setBusy(false);
        if (recordResult.ok) onSuccess();
        // If recording fails, the share genuinely happened but Lilica
        // couldn't persist that -- silently NOT calling onSuccess()
        // undersells what happened rather than overclaiming it, which
        // is the safer direction to be wrong in.
      }
    } catch {
      // The share sheet's own failure needs no further handling --
      // nothing was created or changed either way, so no delivery
      // status is recorded.
    }
  }

  return (
    <View style={styles.deliveryActions}>
      <View style={styles.inviteCodeRow}>
        <AppText variant="secondary" tone="soft">Invitation code</AppText>
        <AppText variant="bodyStrong" tone="primary" style={styles.inviteCodeValue}>{formatInviteCode(invitation.inviteCode)}</AppText>
      </View>
      {transient.status === 'failed' ? (
        <AppText variant="secondary" tone="danger">{transient.message ?? "The invitation was created, but the email couldn't be sent."}</AppText>
      ) : null}
      <View style={styles.deliveryButtonRow}>
        <Button
          label={emailButtonLabel(emailed, transient.status === 'sending')}
          variant="secondary"
          disabled={busy}
          onPress={() => void handleSendEmail()}
          style={styles.deliveryButton}
        />
        <Button label={shareButtonLabel(emailed, shared)} variant="secondary" disabled={busy} onPress={() => void handleShare()} style={styles.deliveryButton} />
      </View>
    </View>
  );
}

const DOMAIN_OPTIONS: { value: CareCircleDomain; label: string }[] = (
  Object.entries(DOMAIN_LABELS) as [CareCircleDomain, string][]
).map(([value, label]) => ({ value, label }));

function roleDescription(role: CareCircleRole) {
  if (role === 'organiser') return 'Full access, can manage the care circle';
  if (role === 'contributor') return 'Can view and update what you share with them';
  return 'Can view what you share with them';
}

export function CareCircleScreen({ personName, members, invitations, careSpaceId, onBack, onRefresh, isReadOnly, onInviteBlocked, inviterDisplayName, onJoinAnotherCareCircle }: Props) {
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'contributor' | 'viewer'>('contributor');
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<CareCircleDomain[]>(['general']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // The invitation just created this session, for the "Invitation
  // created -- Send by email / Share" panel immediately below the form.
  // Only the id is tracked locally -- its own code/delivery fields are
  // read straight from the `invitations` prop once submitInvite()'s own
  // onRefresh() call has re-fetched it from the server (final
  // architectural closure, 14 September 2026: delivery state is now
  // server-authoritative, never local-only).
  const [justCreatedInvitationId, setJustCreatedInvitationId] = useState<string>();
  const justCreatedInvitation = invitations.find((invitation) => invitation.id === justCreatedInvitationId);

  const organiserCount = members.filter((member) => member.role === 'organiser').length;
  // Invitation delivery UX correction: while the "Invitation created"
  // panel is showing for a just-created invitation, it is deliberately
  // excluded here -- the two are two views of the SAME invitation, and
  // must never both render at once (the exact duplicate-UI bug this
  // fixed). It rejoins this list the moment the panel closes, whatever
  // the reason (a successful send, or Dismiss).
  const pendingInvitations = invitations.filter(
    (invitation) => invitation.status === 'pending' && invitation.id !== justCreatedInvitationId,
  );

  function toggleDomain(domain: CareCircleDomain) {
    setSelectedDomains((current) =>
      current.includes(domain) ? current.filter((value) => value !== domain) : [...current, domain],
    );
  }

  async function submitInvite() {
    if (!email.trim() || !relationshipLabel.trim()) {
      setError('Enter their email and how they know you.');
      return;
    }
    setBusy(true);
    setError(undefined);
    const result = await inviteMember({
      careSpaceId,
      email: email.trim(),
      role,
      grantedDomains: selectedDomains,
      relationshipType: 'Someone else',
      relationshipLabel: relationshipLabel.trim(),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setShowInvite(false);
    setEmail('');
    setRelationshipLabel('');
    setSelectedDomains(['general']);
    setJustCreatedInvitationId(result.data.invitationId);
    onRefresh();
  }

  async function handleRevoke(invitationId: string) {
    setBusy(true);
    const result = await revokeInvitation(invitationId);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onRefresh();
  }

  // Product-owner report (14 September 2026): removing a member took
  // effect immediately with no confirmation at all -- a real gap, since
  // this is immediate-effect (they lose access right away, per
  // docs/PHASE_15_ARCHITECTURE.md) and not reversible from the removed
  // member's own side. Confirms first, matching the exact Alert pattern
  // PrivacyDataScreen.tsx's own "Leave"/"Clear data" actions already use.
  function handleRemove(membershipId: string, memberName: string) {
    Alert.alert(
      `Remove ${memberName}?`,
      `${memberName} will lose access to this care circle immediately. This can't be undone from their side -- they would need to be invited again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            setBusy(true);
            const result = await removeMember(membershipId);
            setBusy(false);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            onRefresh();
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Header title="Care Circle" onBack={onBack} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText variant="secondary" tone="soft">
          Who can see and help with {personName?.trim() || 'this'}'s care -- and exactly what they can see.
        </AppText>

        {error ? <AppText variant="secondary" tone="danger">{error}</AppText> : null}

        <View style={styles.section}>
          <AppText variant="section" tone="primary">Members</AppText>
          {members.map((member) => (
            <View key={member.membershipId} style={styles.card}>
              <View style={styles.cardHeader}>
                <AppText variant="body" tone="primary">{member.displayName}</AppText>
                <AppText variant="secondary" tone="soft">
                  {member.role === 'organiser' ? 'Organiser' : member.role === 'contributor' ? 'Contributor' : 'Viewer'}
                </AppText>
              </View>
              <AppText variant="secondary" tone="soft">
                {roleDescription(member.role)}
              </AppText>
              {member.role !== 'organiser' ? (
                <AppText variant="secondary" tone="muted">
                  Can see: {member.grantedDomains.length > 0
                    ? member.grantedDomains.map((domain) => DOMAIN_OPTIONS.find((option) => option.value === domain)?.label ?? domain).join(', ')
                    : 'Nothing shared yet'}
                </AppText>
              ) : null}
              {!member.isSelf && !(member.role === 'organiser' && organiserCount <= 1) ? (
                <Button
                  label="Remove"
                  variant="text"
                  disabled={busy}
                  onPress={() => handleRemove(member.membershipId, member.displayName)}
                  style={styles.removeButton}
                />
              ) : null}
            </View>
          ))}
          {onJoinAnotherCareCircle ? (
            // Brief section 13: an existing Lilica user may receive an
            // invitation to a DIFFERENT Care Circle -- automatic
            // discovery already surfaces that on its own, but this is
            // the deliberate, discoverable manual alternative
            // ("Care Circle → Join a Care Circle" the email/Share text
            // itself now mentions). Reuses the exact same code-entry/
            // review/accept flow as the onboarding fork -- one join
            // route, not two.
            <Button label="Join another Care Circle" variant="text" onPress={onJoinAnotherCareCircle} />
          ) : null}
        </View>

        {justCreatedInvitation ? (
          <View style={styles.section}>
            <AppText variant="section" tone="primary">Invitation created</AppText>
            <AppText variant="secondary" tone="soft">Send it by email, or share the link yourself.</AppText>
            <DeliveryActions
              invitation={justCreatedInvitation}
              personName={personName}
              inviterDisplayName={inviterDisplayName}
              onSuccess={() => {
                // A real, server-confirmed success closes this panel
                // automatically -- the invitation immediately reappears
                // exactly once, in Pending invitations, showing that
                // same real outcome (re-fetched from the server, since
                // delivery state now lives there, not locally).
                onRefresh();
                setJustCreatedInvitationId(undefined);
              }}
              busy={busy}
              setBusy={setBusy}
            />
            <Button
              label="Dismiss"
              variant="text"
              onPress={() => {
                // Dismiss never destroys the invitation and never
                // records a delivery status that didn't happen -- it
                // only closes this panel, so the invitation reappears
                // in Pending invitations as "Not sent yet.", with the
                // same Send/Share actions still available there.
                setJustCreatedInvitationId(undefined);
              }}
            />
          </View>
        ) : null}

        {pendingInvitations.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="section" tone="primary">Pending invitations</AppText>
            {pendingInvitations.map((invitation) => {
              const emailed = !!invitation.lastEmailSentAt;
              const shared = !!invitation.lastShareOpenedAt;
              return (
                <View key={invitation.id} style={styles.card}>
                  <AppText variant="body" tone="primary">{invitation.inviteeEmail}</AppText>
                  <AppText variant="secondary" tone="soft">
                    Invited as {invitation.role === 'contributor' ? 'Contributor' : 'Viewer'} · not a member yet
                  </AppText>
                  <AppText variant="secondary" tone={emailed || shared ? 'success' : 'muted'}>
                    {deliveryStatusLine(emailed, shared)}
                  </AppText>
                  <DeliveryActions
                    invitation={invitation}
                    personName={personName}
                    inviterDisplayName={inviterDisplayName}
                    onSuccess={onRefresh}
                    busy={busy}
                    setBusy={setBusy}
                  />
                  <Button
                    label="Cancel invitation"
                    variant="text"
                    disabled={busy}
                    onPress={() => handleRevoke(invitation.id)}
                    style={styles.removeButton}
                  />
                </View>
              );
            })}
          </View>
        ) : null}

        {showInvite ? (
          <View style={styles.section}>
            <AppText variant="section" tone="primary">Invite someone</AppText>
            <TextField
              label="Their email"
              placeholder="name@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextField
              label="How you know them"
              placeholder="e.g. Cousin, neighbour"
              value={relationshipLabel}
              onChangeText={setRelationshipLabel}
            />
            <AppText variant="secondary" tone="soft" style={styles.fieldLabel}>Role</AppText>
            <View style={styles.pillRow}>
              {(['contributor', 'viewer'] as const).map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: role === option }}
                  onPress={() => setRole(option)}
                  style={[styles.pill, role === option && styles.pillSelected]}
                >
                  <AppText variant="secondary" tone={role === option ? 'primary' : 'soft'}>
                    {option === 'contributor' ? 'Contributor' : 'Viewer'}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <AppText variant="secondary" tone="soft" style={styles.fieldLabel}>
              What can they see? Review this before sending.
            </AppText>
            <View style={styles.domainList}>
              {DOMAIN_OPTIONS.map((option) => {
                const selected = selectedDomains.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    // Direct product-owner request: a screen reader must
                    // be told the domain name, whether it's selected, AND
                    // what access it grants -- never relying on colour or
                    // visual expansion alone. Composed here rather than
                    // left to be assembled from the two child Text nodes,
                    // since accessibility tree traversal order across a
                    // conditionally-rendered child cannot be relied on.
                    accessibilityLabel={selected ? `${option.label}, selected. Grants access to: ${DOMAIN_DESCRIPTIONS[option.value]}` : `${option.label}, not selected`}
                    onPress={() => toggleDomain(option.value)}
                    style={[styles.domainRow, selected && styles.domainRowSelected]}
                  >
                    <View style={styles.domainRowHeader}>
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected ? <View style={styles.checkboxTick} /> : null}
                      </View>
                      <AppText variant="bodyStrong" tone={selected ? 'primary' : 'default'} style={styles.domainRowLabel}>
                        {option.label}
                      </AppText>
                    </View>
                    {selected ? (
                      <AppText variant="secondary" tone="soft" style={styles.domainRowDescription}>
                        {DOMAIN_DESCRIPTIONS[option.value]}
                      </AppText>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <Button label="Send invitation" onPress={submitInvite} disabled={busy} />
            <Button label="Cancel" variant="text" onPress={() => setShowInvite(false)} disabled={busy} />
          </View>
        ) : (
          <Button label="Invite someone" onPress={() => (isReadOnly ? onInviteBlocked?.() : setShowInvite(true))} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  deliveryActions: {
    gap: spacing.xs,
  },
  inviteCodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  inviteCodeValue: {
    letterSpacing: 1,
  },
  deliveryButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deliveryButton: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeButton: {
    alignSelf: 'flex-start',
  },
  fieldLabel: {
    marginTop: spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  pillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  // Direct product-owner request: each permission domain is compact when
  // unselected and reveals its own real access description immediately
  // when selected -- deliberately a vertical list rather than the
  // wrapping pill row above, since a wrapped row can't cleanly show one
  // option's own description growing beneath just that option. Still the
  // same visual language (border/radius/soft-fill-when-selected) as every
  // other pill on this screen -- not a new card system or a modal.
  domainList: { gap: spacing.sm },
  domainRow: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  domainRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  domainRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  domainRowLabel: { flex: 1 },
  domainRowDescription: {
    marginLeft: 34, // aligns under the label, past the checkbox
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
  },
  checkboxTick: {
    width: 9,
    height: 6,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.white,
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
});
