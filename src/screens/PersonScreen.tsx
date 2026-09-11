import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PersonSwitcher } from '../components/PersonSwitcher';
import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { SettingsCogButton } from '../components/SettingsCogButton';
import { AppText } from '../components/Text';
import { Wordmark } from '../components/Wordmark';
import { CareCircleMember, CareCircleRole } from '../careCircle';
import { CategoryIcon, visualFor } from './HomeScreen';
import { colors, radius, spacing, tabAccent } from '../theme';
import { LilicaRecord, LilicaRecordType, LocalCareSpaceState } from '../types';

// Corrective task 10: People used to repeat Home's own record-category
// dashboard (bills, home matters, documents, care notes) under a
// different heading -- the exact same data Home's "Recently added"
// already shows, giving this tab no distinct purpose. People now centres
// on the four things Home/Calendar/To Do genuinely don't cover: who is
// being cared for, the external people/services useful to have on hand,
// who actually has Lilica access, and (unchanged, still a placeholder)
// the future assistance entry point. Bills/home/documents/care-note
// records are untouched in storage and still appear correctly in Home,
// Calendar and To Do -- nothing here deletes or hides them from those
// screens, they simply aren't duplicated a second time on this one.
type Props = {
  records: LilicaRecord[];
  displayName?: string;
  relationshipLabel?: string;
  isSelf: boolean;
  people: LocalCareSpaceState[];
  activeCareSpaceId?: string;
  onSwitchPerson: (careSpaceId: string) => void;
  onAddPerson: () => void;
  onOpenRecord: (recordId: string) => void;
  onAddType: (type: LilicaRecordType) => void;
  // Corrective task 4: opens the shared Settings sheet -- People no longer
  // has its own direct "Account" link; Account is one of the Settings
  // sheet's own entries now (see src/components/SettingsMenu.tsx).
  onOpenSettings: () => void;
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
};

function contactDetail(record: LilicaRecord): string | undefined {
  return [record.role, record.phone, record.email].filter(Boolean).join(' · ') || undefined;
}

function recentFirst(a: LilicaRecord, b: LilicaRecord) {
  return (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt);
}

function roleLabel(role: CareCircleRole) {
  if (role === 'organiser') return 'Organiser';
  if (role === 'contributor') return 'Contributor';
  return 'Viewer';
}

export function PersonScreen({
  records,
  displayName,
  relationshipLabel,
  isSelf,
  people,
  activeCareSpaceId,
  onSwitchPerson,
  onAddPerson,
  onOpenRecord,
  onAddType,
  onOpenSettings,
  onOpenCareCircle,
  pendingInvitationCount = 0,
  onOpenInvitations,
  careCircleMembers = [],
}: Props) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const name = displayName?.trim() || 'Them';

  // Key contacts (section 2): external people/services with no Lilica
  // account of their own -- still exactly the established `contact`
  // record type/creation architecture, never a new store.
  const contacts = useMemo(
    () => records
      .filter((record) => record.type === 'contact' && record.status !== 'cancelled')
      .sort(recentFirst),
    [records],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <ScreenBackdrop deep={tabAccent.people.deep} tint={tabAccent.people.tint} gap={spacing.lg}>
      {/* Visual pass: header sits on the shared deep/tint backdrop (see
          ScreenBackdrop) -- title, wordmark and the Invitations link
          switch to light-on-dark. */}
      <View style={styles.header}>
        <View>
          <Wordmark size="compact" tone="light" />
          <AppText variant="title" tone="white">People</AppText>
        </View>
        <View style={styles.headerLinks}>
          {onOpenInvitations && pendingInvitationCount > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Invitations (${pendingInvitationCount})`} onPress={onOpenInvitations} hitSlop={8}>
              <AppText variant="secondary" style={[styles.accountLink, styles.onDarkLink]}>Invitations ({pendingInvitationCount})</AppText>
            </Pressable>
          ) : null}
          <SettingsCogButton onPress={onOpenSettings} />
        </View>
      </View>

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
            {!isSelf && relationshipLabel ? <AppText variant="secondary" tone="soft">{relationshipLabel}</AppText> : null}
          </View>
          {people.length > 1 ? <View style={styles.personChevron} /> : null}
        </Pressable>
      </View>

      {/* Section 2: KEY CONTACTS -- useful external people/services (GP,
          pharmacy, a neighbour), kept strictly distinct from the
          authenticated Care circle members below. */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="section" tone="white">Key contacts</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Add a contact" onPress={() => onAddType('contact')} hitSlop={8}>
            <AppText variant="secondary" style={styles.onDarkLink}>Add</AppText>
          </Pressable>
        </View>
        {contacts.length > 0 ? (
          <View style={styles.sectionList}>
            {contacts.map((record) => {
              const visual = visualFor(record.type);
              const detail = contactDetail(record);
              return (
                <Pressable
                  key={record.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${record.title}`}
                  onPress={() => onOpenRecord(record.id)}
                  style={styles.row}
                >
                  <View style={[styles.iconChip, { backgroundColor: visual.tint }]}>
                    <CategoryIcon type={record.type} color={visual.accent} />
                  </View>
                  <View style={styles.rowCopy}>
                    <AppText variant="bodyStrong" numberOfLines={2}>{record.title}</AppText>
                    {detail ? <AppText variant="secondary" tone="soft" numberOfLines={2}>{detail}</AppText> : null}
                  </View>
                  <View style={styles.chevron} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <AppText variant="secondary" style={styles.onDarkSoft}>
            No key contacts saved for {isSelf ? 'you' : name} yet - GP, pharmacy, a neighbour or anyone else useful to have on hand.
          </AppText>
        )}
      </View>

      {/* Section 3: CARE CIRCLE -- authenticated Lilica members who
          actually have access, never conflated with the external
          contacts above. Reads the same real membership list Settings'
          own Care Circle screen already reads (see App.tsx); an empty
          list (local-only care space, nothing synced yet) shows the
          honest "just you" state rather than a fabricated member. */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="section" tone="white">Care circle</AppText>
          {onOpenCareCircle ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Manage Care Circle" onPress={onOpenCareCircle} hitSlop={8}>
              <AppText variant="secondary" style={styles.onDarkLink}>Manage</AppText>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.sectionList}>
          {careCircleMembers.length > 0 ? careCircleMembers.map((member) => (
            <View key={member.membershipId} style={styles.row}>
              <View style={[styles.iconChip, { backgroundColor: colors.primarySoft }]}>
                <AppText variant="bodyStrong" tone="primary">
                  {(member.isSelf ? 'You' : member.displayName).charAt(0).toUpperCase()}
                </AppText>
              </View>
              <View style={styles.rowCopy}>
                <AppText variant="bodyStrong">
                  {member.isSelf ? 'You' : member.displayName} - {roleLabel(member.role)}
                </AppText>
                <AppText variant="secondary" tone="soft">{member.relationshipLabel || member.relationshipType}</AppText>
              </View>
            </View>
          )) : (
            <View style={styles.row}>
              <View style={[styles.iconChip, { backgroundColor: colors.primarySoft }]}>
                <AppText variant="bodyStrong" tone="primary">Y</AppText>
              </View>
              <View style={styles.rowCopy}>
                <AppText variant="bodyStrong">You</AppText>
                <AppText variant="secondary" tone="soft">The only person with access right now.</AppText>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Section 4: ASK LILICA -- re-homed from Home exactly as it already
          existed. No AI functionality is implemented here; this stays
          the same non-interactive placeholder for a future phase. */}
      <View style={styles.ask}>
        <View>
          <AppText variant="meta" tone="primary">Ask Lilica</AppText>
          <AppText variant="bodyStrong">What is coming up?</AppText>
        </View>
        <View style={styles.askMark}>
          <AppText variant="bodyStrong" tone="white">?</AppText>
        </View>
      </View>

      <PersonSwitcher
        visible={switcherOpen}
        people={people}
        activeId={activeCareSpaceId}
        onClose={() => setSwitcherOpen(false)}
        onSelect={onSwitchPerson}
        onAdd={onAddPerson}
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
    paddingBottom: spacing.xxl,
  },
  header: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  accountLink: {
    fontWeight: '700',
  },
  onDarkLink: {
    color: colors.white,
    fontWeight: '700',
  },
  onDarkSoft: {
    color: 'rgba(255,255,255,0.8)',
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionList: {
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
  // Same drawn-chevron-down technique as Home's own switcher card.
  personChevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.primary,
    transform: [{ rotate: '-45deg' }],
  },
  // Visual pass: pure white (not colors.surface), matching the same
  // "white cards on a coloured backdrop" treatment used across
  // Home/Calendar/To Do too.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  chevron: {
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.muted,
    transform: [{ rotate: '45deg' }],
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
  askMark: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
