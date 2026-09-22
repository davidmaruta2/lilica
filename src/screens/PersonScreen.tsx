import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MemberDetailPopup } from '../components/MemberDetailPopup';
import { PersonSwitcher } from '../components/PersonSwitcher';
import { PrimaryTabHeader } from '../components/PrimaryTabHeader';
import { NotificationAnchor } from '../components/NotificationBellButton';
import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { AppText } from '../components/Text';
import { CareCircleMember, CareCircleRole } from '../careCircle';
import { resolveAvatarUrl } from '../profileAvatar';
import { colors, radius, spacing, tabAccent } from '../theme';
import { LocalCareSpaceState } from '../types';

// Corrective task 10: People used to repeat Home's own record-category
// dashboard (bills, home matters, documents, care notes) under a
// different heading -- the exact same data Home's "Recently added"
// already shows, giving this tab no distinct purpose. People now centres
// on the things Home/Calendar/To Do genuinely don't cover: who is being
// cared for, who actually has Lilica access, talking to them (Lilica
// Chat), and (unchanged, still a placeholder) the future assistance entry
// point. Bills/home/documents/care-note records are untouched in storage
// and still appear correctly in Home, Calendar and To Do -- nothing here
// deletes or hides them from those screens, they simply aren't duplicated
// a second time on this one.
//
// Phase 23: Key contacts (GP, pharmacy, a neighbour -- external people/
// services with no Lilica account, never part of a conversation) moved
// OUT of this page and into the Settings drawer, alongside Care Summary/
// Documents/Medical Log (see SettingsMenu.tsx's personCareEntries) -- it
// never messages anyone, so keeping it here next to Care circle/Lilica
// Chat blurred a real distinction. This tab was also renamed from
// "People" to "Care Circle" in the same change (TabBar.tsx) -- Care
// circle moved up to the second section (immediately after the supported
// person), and Lilica Chat is new, directly beneath it.
type Props = {
  displayName?: string;
  relationshipLabel?: string;
  isSelf: boolean;
  people: LocalCareSpaceState[];
  activeCareSpaceId?: string;
  onSwitchPerson: (careSpaceId: string) => void;
  onAddPerson: () => void;
  // Corrective task 4: opens the shared Settings sheet -- People no longer
  // has its own direct "Account" link; Account is one of the Settings
  // sheet's own entries now (see src/components/SettingsMenu.tsx).
  onOpenSettings: () => void;
  notificationCount?: number;
  onOpenNotifications?: (origin?: NotificationAnchor) => void;
  // Phase 15: omitted for a local-only care space (never synced, so there
  // is nothing to collaborate on yet) -- see App.tsx's showCareCircle wiring.
  onOpenCareCircle?: () => void;
  // Phase 15: how many invitations addressed to this account are still
  // pending -- shown only when greater than 0, as the way back into the
  // invitations screen after "Not now" dismissed its auto-open.
  pendingInvitationCount?: number;
  onOpenInvitations?: () => void;
  // Corrective task 10: the active care space's real, authenticated
  // members -- the same list Settings' own Care Circle screen reads (see
  // App.tsx). Never fabricated and never inferred from a contact record
  // or a relationship label; empty for a local-only care space, which
  // shows the honest "just you" state below rather than a fake member.
  careCircleMembers?: CareCircleMember[];
  // Profile picture: the signed-in organiser's own avatar path
  // (auth.profile?.avatarPath) -- shown for their own ("You") tile in
  // the Care circle preview and detail popup only. Care Circle member
  // data (CareCircleMember) has no avatarPath of its own -- showing
  // OTHER members' photos to each other is a separate, real product
  // decision not made here (see src/profileAvatar.ts's own scope note).
  selfAvatarPath?: string;
  // Phase 20B: omitted for a local-only care space, exactly like
  // onOpenCareCircle above -- there is nothing to summarise/have activity
  // on until the space is genuinely synced. See docs/PHASE_20_ARCHITECTURE.md.
  onOpenCareSummary?: () => void;
  onOpenRecentActivity?: () => void;
  // Phase 23 slice 1: same availability guard as Care circle/Care
  // Summary above -- omitted for a local-only care space, since there is
  // no one else to message yet.
  onOpenChat?: () => void;
  chatUnreadCount?: number;
  // A short, already-formatted preview line (src/chat.ts's
  // previewChatMessage) -- undefined shows the empty state, never a
  // fabricated placeholder message.
  chatPreviewText?: string;
};

const CARE_CIRCLE_PREVIEW_LIMIT = 3;
const EMPTY_CARE_CIRCLE_MEMBERS: CareCircleMember[] = [];
// Cycles through existing palette tones only -- no new colour introduced
// for this. Deterministic by position, never per-name/random, so a given
// member's avatar tint doesn't shift between renders.
const MEMBER_AVATAR_TONES = [
  { chip: colors.primarySoft, text: colors.primary },
  { chip: colors.tealSoft, text: colors.teal },
  { chip: colors.blueSoft, text: colors.blue },
];

function roleLabel(role: CareCircleRole) {
  if (role === 'organiser') return 'Organiser';
  if (role === 'contributor') return 'Contributor';
  return 'Viewer';
}

export function PersonScreen({
  displayName,
  relationshipLabel,
  isSelf,
  people,
  activeCareSpaceId,
  onSwitchPerson,
  onAddPerson,
  onOpenSettings,
  notificationCount = 0,
  onOpenNotifications,
  onOpenCareCircle,
  pendingInvitationCount = 0,
  onOpenInvitations,
  careCircleMembers = EMPTY_CARE_CIRCLE_MEMBERS,
  selfAvatarPath,
  onOpenCareSummary,
  onOpenRecentActivity,
  onOpenChat,
  chatUnreadCount = 0,
  chatPreviewText,
}: Props) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [openMember, setOpenMember] = useState<{ member: CareCircleMember; tone: { chip: string; text: string } }>();
  const [selfAvatarUrl, setSelfAvatarUrl] = useState<string>();
  // Direct product-owner report (14 September 2026): a fellow Care
  // Circle member's real photo (e.g. Gillian's) never showed here --
  // only self's own did. Resolved the same way self's already is
  // (resolveAvatarUrl(), a short-lived signed URL for a private
  // bucket), now readable for a fellow member too because
  // shared_avatar_visibility.sql's own RLS policy allows it. Keyed by
  // membershipId, since two members could theoretically share an
  // avatarPath format collision otherwise -- they can't in practice
  // (paths are per-user-id), but membershipId is the row identity this
  // list already keys everything else by.
  const [memberAvatarUrls, setMemberAvatarUrls] = useState<Record<string, string>>({});
  const name = displayName?.trim() || 'Them';

  useEffect(() => {
    let active = true;
    resolveAvatarUrl(selfAvatarPath).then((url) => { if (active) setSelfAvatarUrl(url); });
    return () => { active = false; };
  }, [selfAvatarPath]);

  useEffect(() => {
    let active = true;
    const membersWithPhotos = careCircleMembers.filter((member) => !member.isSelf && member.avatarPath);
    Promise.all(
      membersWithPhotos.map((member) => resolveAvatarUrl(member.avatarPath).then((url) => [member.membershipId, url] as const)),
    ).then((resolved) => {
      if (!active) return;
      const next: Record<string, string> = {};
      for (const [membershipId, url] of resolved) {
        if (url) next[membershipId] = url;
      }
      setMemberAvatarUrls(next);
    });
    return () => { active = false; };
  }, [careCircleMembers]);

  const namedMembers = careCircleMembers.length > 0
    ? careCircleMembers
    : [{ membershipId: 'self', displayName: 'You', role: 'organiser' as CareCircleRole, relationshipType: 'Myself' as const, relationshipLabel: undefined, isSelf: true, grantedDomains: [] }];
  const memberPreview = namedMembers.slice(0, CARE_CIRCLE_PREVIEW_LIMIT);
  const extraMemberCount = namedMembers.length - memberPreview.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <ScreenBackdrop
      deep={tabAccent.people.deep}
      tint={tabAccent.people.tint}
      gap={spacing.lg}
      stretch
      stops={[
        { color: tabAccent.people.deep, location: 0 },
        { color: '#3E837E', location: 0.28 },
        { color: '#72AAA5', location: 0.55 },
        { color: '#A6CBC7', location: 0.78 },
        { color: tabAccent.people.tint, location: 1 },
      ]}
    >
      {/* Visual pass: header sits on the shared deep/tint backdrop (see
          ScreenBackdrop) -- title, wordmark and the Invitations link
          switch to light-on-dark. */}
      <PrimaryTabHeader
        title="Care Circle"
        tone="light"
        supporting="The people who help, and how you talk to each other."
        notificationCount={notificationCount}
        onOpenNotifications={onOpenNotifications}
        actions={onOpenInvitations && pendingInvitationCount > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Invitations (${pendingInvitationCount})`} onPress={onOpenInvitations} style={styles.headerActionLink}>
              <AppText variant="secondary" style={[styles.accountLink, styles.onDarkLink]}>Invitations ({pendingInvitationCount})</AppText>
            </Pressable>
          ) : undefined}
        onOpenSettings={onOpenSettings}
      />

      {/* Section 1: SUPPORTED PEOPLE -- who this account organises care
          for. Tapping opens the existing PersonSwitcher, unchanged --
          never redesigned, never re-implemented here. The standalone
          "The people involved in care." subtitle was removed -- it said
          the same thing as this section's own heading, one line below.
          This heading, and Key contacts/Care circle's below, sit within
          the backdrop's deep zone for any realistic amount of content,
          so all three go white -- see ScreenBackdrop. */}
      <View style={styles.section}>
        <AppText variant="section" tone="white">Person being supported</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Switch person, currently ${name}`}
          onPress={() => setSwitcherOpen(true)}
          style={styles.personCard}
        >
          <View style={styles.personIcon}>
            <AppText variant="title" tone="primary">{name.charAt(0).toUpperCase()}</AppText>
          </View>
          <View style={styles.personCopy}>
            <AppText variant="title">{isSelf ? 'You' : name}</AppText>
          </View>
          {people.length > 1 ? <View style={styles.personChevron} /> : null}
        </Pressable>
        {onOpenCareSummary ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View exportable care summary"
            onPress={onOpenCareSummary}
            style={styles.careSummaryLink}
          >
            <AppText variant="secondary" style={styles.onDarkLink}>Exportable Care Summary</AppText>
            <View style={styles.viewAllChevron} />
          </Pressable>
        ) : null}
      </View>

      {/* Section 2: CARE CIRCLE -- authenticated Lilica members who
          actually have access, never conflated with the external
          contacts above. Reads the same real membership list Settings'
          own Care Circle screen already reads (see App.tsx); an empty
          list (local-only care space, nothing synced yet) shows the
          honest "just you" state rather than a fabricated member.
          Final mock: a SUMMARY, not a management surface -- its own
          stable, opaque card (never fading with the page gradient
          behind it), one heading, one "Manage" action, and a bounded
          member preview. Every other Care Circle control (invite,
          permissions, roles, removal) lives behind Manage only -- never
          duplicated here. */}
      <View style={styles.careCircleCard}>
        <View style={styles.careCircleHeader}>
          <View style={styles.careCircleHeaderCopy}>
            <AppText variant="section">Care circle</AppText>
            <AppText variant="secondary" tone="soft" style={styles.careCircleSubtitle}>
              People who can help, what they can see, and how they're involved.
            </AppText>
          </View>
          {onOpenCareCircle ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Manage Care Circle" onPress={onOpenCareCircle} hitSlop={8} style={styles.manageButton}>
              <AppText variant="bodyStrong" tone="primary" style={styles.manageLabel}>Manage</AppText>
              <View style={styles.manageChevron} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.memberPreviewRow}>
          {memberPreview.map((member, index) => {
            const tone = MEMBER_AVATAR_TONES[index % MEMBER_AVATAR_TONES.length];
            const label = member.isSelf ? 'You' : member.displayName;
            return (
              <Pressable
                key={member.membershipId}
                accessibilityRole="button"
                accessibilityLabel={`View details for ${label}`}
                onPress={() => setOpenMember({ member, tone })}
                style={styles.memberPreviewItem}
              >
                <View style={[styles.memberAvatar, { backgroundColor: tone.chip }]}>
                  {member.isSelf && selfAvatarUrl ? (
                    <Image source={{ uri: selfAvatarUrl }} style={styles.memberAvatarImage} />
                  ) : !member.isSelf && memberAvatarUrls[member.membershipId] ? (
                    <Image source={{ uri: memberAvatarUrls[member.membershipId] }} style={styles.memberAvatarImage} />
                  ) : (
                    <AppText variant="bodyStrong" style={[styles.memberAvatarInitial, { color: tone.text }]}>
                      {label.charAt(0).toUpperCase()}
                    </AppText>
                  )}
                </View>
                <AppText variant="secondary" style={styles.memberName} numberOfLines={1}>{label}</AppText>
                <AppText variant="secondary" tone="soft" style={styles.memberRole} numberOfLines={1}>{roleLabel(member.role)}</AppText>
              </Pressable>
            );
          })}
          {extraMemberCount > 0 ? (
            <View style={styles.memberPreviewItem}>
              <View style={[styles.memberAvatar, { backgroundColor: colors.tealSoft }]}>
                <AppText variant="bodyStrong" style={[styles.memberAvatarInitial, { color: colors.teal }]}>+{extraMemberCount}</AppText>
              </View>
              <AppText variant="secondary" style={styles.memberName} numberOfLines={1}>More</AppText>
              <AppText variant="secondary" tone="soft" style={styles.memberRole} numberOfLines={1}>Members</AppText>
            </View>
          ) : null}
        </View>
        {onOpenRecentActivity ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View recent activity"
            onPress={onOpenRecentActivity}
            style={styles.recentActivityLink}
          >
            <AppText variant="secondary" tone="primary" style={styles.recentActivityLabel}>Recent activity</AppText>
            <View style={styles.manageChevron} />
          </Pressable>
        ) : null}
      </View>

      {/* Section 3: LILICA CHAT -- Phase 23 slice 1. Immediately beneath
          Care circle, matching its own visual weight (a stable, opaque
          card, never a fourth "section" competing with it). Omitted
          entirely for a local-only care space, same availability guard as
          Care circle/Care Summary above -- there is no one else to
          message yet. Shows a short, real, already-formatted preview of
          the most recent message (chatPreviewText, computed in App.tsx via
          src/chat.ts's previewChatMessage) or the honest empty state, and
          an unread badge when chatUnreadCount is greater than 0. */}
      {onOpenChat ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={chatUnreadCount > 0 ? `Lilica Chat, ${chatUnreadCount} unread` : 'Lilica Chat'}
          onPress={onOpenChat}
          style={styles.chatCard}
        >
          <View style={styles.chatIconWrap}>
            <View style={styles.chatIcon} />
            {chatUnreadCount > 0 ? (
              <View style={styles.chatBadge}>
                <AppText variant="meta" tone="white" style={styles.chatBadgeLabel}>
                  {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                </AppText>
              </View>
            ) : null}
          </View>
          <View style={styles.chatCopy}>
            <AppText variant="section">Lilica Chat</AppText>
            <AppText variant="secondary" tone="soft" numberOfLines={1}>
              {chatPreviewText ?? 'Message everyone in your Care Circle'}
            </AppText>
          </View>
          <View style={styles.chevron} />
        </Pressable>
      ) : null}

      {/* Section 4: ASK LILICA -- re-homed from Home exactly as it already
          existed. No AI functionality is implemented here; this stays
          the same non-interactive placeholder for a future phase. */}
      <View style={styles.ask}>
        <View style={styles.askCopy}>
          <AppText variant="meta" tone="primary">Ask Lilica</AppText>
          <AppText variant="bodyStrong">What is coming up?</AppText>
          <AppText variant="secondary" tone="soft">
            Ask about {isSelf ? 'your' : `${name}'s`} appointments, tasks or care information.
          </AppText>
        </View>
        <View style={styles.askMark}>
          <AppText variant="bodyStrong" tone="white">?</AppText>
        </View>
      </View>
      <View testID="people-bottom-clearance" style={styles.bottomClearance} />

      <PersonSwitcher
        visible={switcherOpen}
        people={people}
        activeId={activeCareSpaceId}
        onClose={() => setSwitcherOpen(false)}
        onSelect={onSwitchPerson}
        onAdd={onAddPerson}
      />
      <MemberDetailPopup
        visible={Boolean(openMember)}
        member={openMember?.member}
        avatarTone={openMember?.tone ?? MEMBER_AVATAR_TONES[0]}
        selfAvatarUrl={selfAvatarUrl}
        memberAvatarUrl={openMember ? memberAvatarUrls[openMember.member.membershipId] : undefined}
        onClose={() => setOpenMember(undefined)}
      />
    </ScreenBackdrop>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  accountLink: {
    fontWeight: '700',
  },
  headerActionLink: {
    minHeight: 44,
    justifyContent: 'center',
  },
  onDarkLink: {
    color: colors.white,
    fontWeight: '700',
  },
  viewAllChevron: {
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.white,
    transform: [{ rotate: '45deg' }],
  },
  section: {
    gap: spacing.sm,
  },
  personCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  personIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personCopy: {
    flex: 1,
    gap: 2,
  },
  // Phase 20B: a small, restrained entry point under the person card --
  // deliberately not a card of its own, so it reads as a footnote link
  // rather than a fourth "section" competing with Key contacts/Care circle.
  careSummaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    marginTop: spacing.xxs,
  },
  recentActivityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
  },
  recentActivityLabel: {
    fontWeight: '700',
  },
  personChevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.primary,
    transform: [{ rotate: '-45deg' }],
  },
  chevron: {
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.muted,
    transform: [{ rotate: '45deg' }],
  },
  // Final mock: Care circle is its own stable, opaque surface -- a solid
  // fill (never transparent, never a gradient), so it reads exactly the
  // same regardless of where it lands on the page's own fading backdrop
  // behind it.
  careCircleCard: {
    backgroundColor: colors.tealSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  careCircleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  careCircleHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  careCircleSubtitle: {
    lineHeight: 18,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  manageLabel: {
    fontSize: 14,
  },
  manageChevron: {
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.primary,
    transform: [{ rotate: '45deg' }],
  },
  memberPreviewRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  memberPreviewItem: {
    alignItems: 'center',
    width: 64,
    gap: 2,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberAvatarImage: {
    width: '100%',
    height: '100%',
  },
  memberAvatarInitial: {
    fontSize: 18,
  },
  memberName: {
    fontWeight: '700',
  },
  memberRole: {
    fontSize: 11.5,
  },
  // Phase 23 slice 1: same opaque-card, "white surface on a coloured
  // backdrop" treatment as careCircleCard immediately above it, so the two
  // read as one visual family (Care circle, then Lilica Chat beneath).
  chatCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chatIconWrap: {
    position: 'relative',
  },
  chatIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.tealSoft,
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  chatBadgeLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
  chatCopy: {
    flex: 1,
    gap: 2,
  },
  ask: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  askCopy: {
    flex: 1,
    gap: 2,
  },
  askMark: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomClearance: {
    height: spacing.xxxl,
  },
});
