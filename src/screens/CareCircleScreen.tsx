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
  inviteMemberGroup,
  recordInvitationGroupShareOpened,
  recordInvitationShareOpened,
  removeMember,
  revokeInvitation,
  revokeInvitationGroup,
  sendInvitationEmail,
} from '../careCircle';
import { invitationWebUrl } from '../invitationLinks';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { TextField } from '../components/TextField';
import { SecondaryPageIntro, SecondaryRolePill } from '../components/SecondaryPage';
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
  // Multi-person Care Circle invitation scope (`\downloads\perm.txt`, 15
  // September 2026): every supported person the CURRENT authenticated
  // user has the actual server-authorised ability to invite members
  // for (brief section 5) -- an active organiser of that specific care
  // space. This is a UX convenience for what checkboxes to SHOW; it is
  // never the security boundary -- invite_member_group() independently
  // re-checks organiser authority per selected care space server-side
  // regardless of what this list contains (brief section 29).
  organiserEligiblePeople?: { careSpaceId: string; displayName: string }[];
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
// Names joined the same grammatical way as the email/Edge-Function side
// (supabase/functions/send-invitation-email/email-content.ts's own
// joinNames()) -- kept as a small local copy since this is React Native
// client code, not the Edge Function's Deno module.
function joinPersonNames(names: string[]): string {
  const trimmed = names.map((name) => name.trim()).filter(Boolean);
  if (trimmed.length === 0) return 'their care';
  if (trimmed.length === 1) return trimmed[0];
  if (trimmed.length === 2) return `${trimmed[0]} and ${trimmed[1]}`;
  return `${trimmed.slice(0, -1).join(', ')} and ${trimmed[trimmed.length - 1]}`;
}

function DeliveryActions({
  invitation,
  personNames,
  inviterDisplayName,
  onSuccess,
  busy,
  setBusy,
}: {
  invitation: Pick<CareCircleInvitation, 'id' | 'inviteCode' | 'lastEmailSentAt' | 'lastShareOpenedAt' | 'groupId'>;
  personNames?: string[];
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
  const isGroup = !!invitation.groupId;

  async function handleSendEmail() {
    setBusy(true);
    setTransient({ status: 'sending' });
    const result = isGroup
      ? await sendInvitationEmail({ invitationGroupId: invitation.groupId as string })
      : await sendInvitationEmail({ invitationId: invitation.id });
    setBusy(false);
    if (result.ok) {
      setTransient({ status: 'idle' });
      onSuccess();
    } else {
      setTransient({ status: 'failed', message: result.message });
    }
  }

  async function handleShare() {
    const person = joinPersonNames(personNames ?? []) || 'their care';
    const inviter = inviterDisplayName?.trim();
    // Brief section 10: keep the exact single-person wording when only
    // one person is involved; the multi-person wording only ever
    // appears when there genuinely is more than one.
    const helpPhrase = (personNames?.length ?? 0) > 1 ? `help support ${person}` : `help with ${person}'s care`;
    const intro = inviter ? `${inviter} has invited you to ${helpPhrase} in Lilica.` : `You've been invited to ${helpPhrase} in Lilica.`;
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
        const recordResult = isGroup
          ? await recordInvitationGroupShareOpened(invitation.groupId as string)
          : await recordInvitationShareOpened(invitation.id);
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

// The state populated directly from the create call's own result
// (inviteMember()/inviteMemberGroup()), never looked up from the
// `invitations` prop -- that prop is scoped to ONE care space, and a
// grouped invitation may not even include the currently active one
// (brief section 35: inviting an existing member to an ADDITIONAL
// person, viewed from that additional person's own screen). Delivery
// state (never sent yet) is trivially correct at creation regardless.
type JustCreated = {
  id: string;
  groupId?: string;
  inviteCode: string;
  personNames: string[];
  alreadyHasAccessNames: string[];
};

export function CareCircleScreen({ personName, members, invitations, careSpaceId, onBack, onRefresh, isReadOnly, onInviteBlocked, inviterDisplayName, onJoinAnotherCareCircle, organiserEligiblePeople = [] }: Props) {
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'contributor' | 'viewer'>('contributor');
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<CareCircleDomain[]>(['general']);
  // Multi-person Care Circle invitation scope (`\downloads\perm.txt`, 15
  // September 2026): brief section 4 -- the person whose Care Circle
  // screen this is stays preselected by default (the current context),
  // but nothing else is silently preselected. Reset to just [careSpaceId]
  // every time the form is (re)opened.
  const [selectedCareSpaceIds, setSelectedCareSpaceIds] = useState<string[]>([careSpaceId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [infoMessage, setInfoMessage] = useState<string>();
  const [justCreated, setJustCreated] = useState<JustCreated>();

  const organiserCount = members.filter((member) => member.role === 'organiser').length;
  // Invitation delivery UX correction: while the "Invitation created"
  // panel is showing for a just-created invitation, it is deliberately
  // excluded here -- the two are two views of the SAME invitation, and
  // must never both render at once (the exact duplicate-UI bug this
  // fixed). It rejoins this list the moment the panel closes, whatever
  // the reason (a successful send, or Dismiss). Matched by groupId when
  // grouped (the row shown here for this one care space IS that same
  // group), otherwise by id.
  const pendingInvitations = invitations.filter(
    (invitation) =>
      invitation.status === 'pending' &&
      invitation.id !== justCreated?.id &&
      !(justCreated?.groupId && invitation.groupId === justCreated.groupId),
  );

  function toggleDomain(domain: CareCircleDomain) {
    setSelectedDomains((current) =>
      current.includes(domain) ? current.filter((value) => value !== domain) : [...current, domain],
    );
  }

  function toggleSelectedPerson(id: string) {
    setSelectedCareSpaceIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function openInviteForm() {
    setSelectedCareSpaceIds([careSpaceId]);
    setInfoMessage(undefined);
    setShowInvite(true);
  }

  async function submitInvite() {
    if (!email.trim() || !relationshipLabel.trim()) {
      setError('Enter their email and how they know you.');
      return;
    }
    if (selectedCareSpaceIds.length === 0) {
      setError('Choose at least one person they can help with.');
      return;
    }
    setBusy(true);
    setError(undefined);

    function resetForm() {
      setShowInvite(false);
      setEmail('');
      setRelationshipLabel('');
      setSelectedDomains(['general']);
    }

    // Brief section 17: exactly one person selected behaves EXACTLY as
    // the ordinary, pre-existing single-care-space invitation always
    // has -- never routed through the group machinery at all.
    if (selectedCareSpaceIds.length === 1) {
      const result = await inviteMember({
        careSpaceId: selectedCareSpaceIds[0],
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
      resetForm();
      setJustCreated({
        id: result.data.invitationId,
        inviteCode: result.data.inviteCode,
        personNames: [personName?.trim() || 'this person'],
        alreadyHasAccessNames: [],
      });
      onRefresh();
      return;
    }

    const result = await inviteMemberGroup({
      careSpaceIds: selectedCareSpaceIds,
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
    resetForm();
    const invitedNames = result.data.results.filter((row) => row.outcome === 'invited').map((row) => row.supportedPersonName);
    const alreadyNames = result.data.results.filter((row) => row.outcome === 'already_has_access').map((row) => row.supportedPersonName);
    if (!result.data.groupId || !result.data.representativeInvitationId) {
      // Brief sections 35/36: every selected person already had active
      // access -- truthfully nothing to invite, never a duplicate.
      setJustCreated(undefined);
      setInfoMessage(`${email.trim()} already has access to everyone you selected.`);
      onRefresh();
      return;
    }
    setJustCreated({
      id: result.data.representativeInvitationId,
      groupId: result.data.groupId,
      inviteCode: result.data.inviteCode as string,
      personNames: invitedNames,
      alreadyHasAccessNames: alreadyNames,
    });
    onRefresh();
  }

  async function handleRevoke(invitation: Pick<CareCircleInvitation, 'id' | 'groupId'>) {
    setBusy(true);
    // Multi-person Care Circle invitation scope: Cancel acts on the
    // WHOLE group when this row is one -- brief section 19, never
    // leaving "Maggie revoked, Ben still pending" without the organiser
    // clearly understanding that.
    const result = invitation.groupId ? await revokeInvitationGroup(invitation.groupId) : await revokeInvitation(invitation.id);
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
        <SecondaryPageIntro>
          Who can see and help with {personName?.trim() || 'this'}'s care -- and exactly what they can see.
        </SecondaryPageIntro>

        <View style={styles.personContext}>
          <View style={styles.personAvatar}><AppText variant="bodyStrong" tone="primary">{(personName?.trim() || 'P').charAt(0).toUpperCase()}</AppText></View>
          <View style={styles.cardCopy}>
            <AppText variant="bodyStrong">{personName?.trim() || 'This person'}</AppText>
            <AppText variant="secondary" tone="soft">People supporting their care</AppText>
          </View>
        </View>

        {error ? <AppText variant="secondary" tone="danger">{error}</AppText> : null}

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <AppText variant="section" tone="primary" style={styles.sectionTitle}>Members</AppText>
            {onJoinAnotherCareCircle ? <Button label="Join a Care Circle" variant="text" onPress={onJoinAnotherCareCircle} style={styles.joinButton} /> : null}
          </View>
          {onJoinAnotherCareCircle ? <AppText variant="secondary" tone="soft">Have an invitation code? Enter it to join a Care Circle.</AppText> : null}
          {members.map((member) => (
            <View key={member.membershipId} style={styles.card}>
              <View style={styles.memberAvatar}><AppText variant="bodyStrong" tone="primary">{member.displayName.charAt(0).toUpperCase()}</AppText></View>
              <View style={styles.cardCopy}>
                <View style={styles.cardHeader}>
                  <AppText variant="bodyStrong">{member.displayName}</AppText>
                  <SecondaryRolePill tone={member.role === 'organiser' ? 'plum' : 'blue'}>
                    {member.role === 'organiser' ? 'Organiser' : member.role === 'contributor' ? 'Contributor' : 'Viewer'}
                  </SecondaryRolePill>
                </View>
                <AppText variant="secondary" tone="soft">{roleDescription(member.role)}</AppText>
                {member.role !== 'organiser' ? (
                  <AppText variant="secondary" tone="muted">
                    Can see: {member.grantedDomains.length > 0
                      ? member.grantedDomains.map((domain) => DOMAIN_OPTIONS.find((option) => option.value === domain)?.label ?? domain).join(', ')
                      : 'Nothing shared yet'}
                  </AppText>
                ) : null}
                {!member.isSelf && !(member.role === 'organiser' && organiserCount <= 1) ? (
                  <Button label="Remove" variant="text" disabled={busy} onPress={() => handleRemove(member.membershipId, member.displayName)} style={styles.removeButton} />
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {infoMessage ? (
          <View style={styles.section}>
            <AppText variant="secondary" tone="soft">{infoMessage}</AppText>
            <Button label="OK" variant="text" onPress={() => setInfoMessage(undefined)} />
          </View>
        ) : null}

        {justCreated ? (
          <View style={styles.section}>
            <AppText variant="section" tone="primary">Invitation created</AppText>
            {/* Multi-person Care Circle invitation scope (`\downloads\perm.txt`,
                15 September 2026): shows every person this ONE invitation
                covers, plus a truthful note for anyone already excluded
                because they already have access (brief sections 35/36). */}
            <AppText variant="secondary" tone="soft">
              {justCreated.personNames.length > 1
                ? `Send it by email, or share the link yourself. It covers helping with: ${joinPersonNames(justCreated.personNames)}.`
                : 'Send it by email, or share the link yourself.'}
            </AppText>
            {justCreated.alreadyHasAccessNames.length > 0 ? (
              <AppText variant="secondary" tone="muted">
                Already has access to: {joinPersonNames(justCreated.alreadyHasAccessNames)} -- not included in this invitation.
              </AppText>
            ) : null}
            <DeliveryActions
              invitation={{ id: justCreated.id, groupId: justCreated.groupId, inviteCode: justCreated.inviteCode, lastEmailSentAt: undefined, lastShareOpenedAt: undefined }}
              personNames={justCreated.personNames}
              inviterDisplayName={inviterDisplayName}
              onSuccess={() => {
                // A real, server-confirmed success closes this panel
                // automatically -- the invitation immediately reappears
                // exactly once, in Pending invitations, showing that
                // same real outcome (re-fetched from the server, since
                // delivery state now lives there, not locally).
                onRefresh();
                setJustCreated(undefined);
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
                setJustCreated(undefined);
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
                  {/* Multi-person Care Circle invitation scope: a grouped
                      row states plainly which OTHER people this same
                      invitation also covers, even though this list is
                      scoped to just this one care space (brief section
                      23 -- "the organiser sent ONE invitation to one
                      human"). */}
                  {invitation.groupParticipantNames && invitation.groupParticipantNames.length > 1 ? (
                    <AppText variant="secondary" tone="muted">
                      This invitation also covers: {joinPersonNames(invitation.groupParticipantNames)}
                    </AppText>
                  ) : null}
                  <AppText variant="secondary" tone={emailed || shared ? 'success' : 'muted'}>
                    {deliveryStatusLine(emailed, shared)}
                  </AppText>
                  <DeliveryActions
                    invitation={invitation}
                    personNames={invitation.groupParticipantNames ?? [personName ?? '']}
                    inviterDisplayName={inviterDisplayName}
                    onSuccess={onRefresh}
                    busy={busy}
                    setBusy={setBusy}
                  />
                  <Button
                    label="Cancel invitation"
                    variant="text"
                    disabled={busy}
                    onPress={() => handleRevoke(invitation)}
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
            {/* Multi-person Care Circle invitation scope (`\downloads\perm.txt`,
                15 September 2026): brief section 3 -- only shown when the
                organiser has more than one eligible person, matching
                section 17's "don't make every invitation needlessly
                complex" instruction. Only people this account genuinely
                organises are listed (brief section 5) -- server-side,
                invite_member_group() independently re-checks this
                regardless of what is shown here. */}
            {organiserEligiblePeople.length > 1 ? (
              <>
                <AppText variant="secondary" tone="soft" style={styles.fieldLabel}>Who can they help with?</AppText>
                <View style={styles.domainList}>
                  {organiserEligiblePeople.map((person) => {
                    const selected = selectedCareSpaceIds.includes(person.careSpaceId);
                    return (
                      <Pressable
                        key={person.careSpaceId}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={selected ? `${person.displayName}, selected` : `${person.displayName}, not selected`}
                        onPress={() => toggleSelectedPerson(person.careSpaceId)}
                        style={[styles.domainRow, selected && styles.domainRowSelected]}
                      >
                        <View style={styles.domainRowHeader}>
                          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                            {selected ? <View style={styles.checkboxTick} /> : null}
                          </View>
                          <AppText variant="bodyStrong" tone={selected ? 'primary' : 'default'} style={styles.domainRowLabel}>
                            {person.displayName}
                          </AppText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <AppText variant="secondary" tone="muted">
                  They'll only be able to see information for the people you select.
                </AppText>
              </>
            ) : null}
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
            {/* Direct product-owner correction (15 September 2026): this
                button only ever CREATES the invitation -- the actual
                send (email/Share/code) happens on the next screen
                (DeliveryActions, below), so "Send invitation" overclaimed
                what this specific tap does. */}
            <Button label="Continue" onPress={submitInvite} disabled={busy || selectedCareSpaceIds.length === 0} />
            <Button label="Cancel" variant="text" onPress={() => setShowInvite(false)} disabled={busy} />
          </View>
        ) : (
          <Button label="Invite someone" onPress={() => (isReadOnly ? onInviteBlocked?.() : openInviteForm())} />
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitleRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sectionTitle: { fontSize: 17, lineHeight: 22 },
  joinButton: { width: 'auto', minHeight: 40, paddingHorizontal: spacing.sm },
  personContext: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  personAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E8DFD6',
  },
  memberAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0, gap: 2 },
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
