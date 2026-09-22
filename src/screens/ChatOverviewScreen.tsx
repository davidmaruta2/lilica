import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { ChatOverviewEntry, listMyChatOverview } from '../chat';
import { colors, radius, spacing } from '../theme';

// Phase 23 slice 10 -- a real three-level structure (23 September 2026,
// direct product-owner redesign, replacing slice 9 from earlier the same
// day): "Marion" was showing up as five separate, unrelated-looking rows
// -- one per individual topic-thread -- because slice 9 flattened every
// underlying conversation straight into this top-level screen. That's
// the wrong level of the hierarchy to show first.
//
// LEVEL 1 (this screen): one row per PERSON you have DMs with (however
// many separate topic-threads they actually have), plus one summary row
// for the whole Care Circle group. Always calm, never a flat dump, no
// matter how many topics exist underneath.
// LEVEL 2 (ChatConversationListScreen): tapping a Level 1 row drills into
// that person's (or the Care Circle's) own list of named topic-threads --
// this is where "+ New conversation" belongs, and where a NEW direct
// message with someone new is still never offered (DMing stays reachable
// only via a Care Circle member's own avatar).
// LEVEL 3 (ChatThreadScreen): the actual conversation.
type Props = {
  careSpaceId?: string;
  onBack: () => void;
  onOpenCareCircle: () => void;
  onOpenDirect: (partnerMembershipId: string, partnerDisplayName: string) => void;
};

function timeLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// A Care Circle "group" summary -- collapsed across every one of its
// individual topic-threads, the way Level 1 must always present it.
type CareCircleSummary = {
  unreadCount: number;
  lastMessageAt?: string;
  lastMessageBody?: string;
  lastMessageSenderIsSelf?: boolean;
};

// One row per DM partner -- collapsed across every one of THEIR
// individual topic-threads (there is no equivalent per-thread flattening
// at this level any more).
type DirectSummary = {
  membershipId: string;
  displayName: string;
  isFormer: boolean;
  unreadCount: number;
  lastMessageAt?: string;
  lastMessageBody?: string;
  lastMessageSenderIsSelf?: boolean;
};

function summariseCareCircle(entries: ChatOverviewEntry[]): CareCircleSummary {
  const unreadCount = entries.reduce((total, entry) => total + entry.unreadCount, 0);
  const latest = entries.reduce<ChatOverviewEntry | undefined>((mostRecent, entry) => {
    if (!entry.lastMessageAt) return mostRecent;
    if (!mostRecent?.lastMessageAt || entry.lastMessageAt > mostRecent.lastMessageAt) return entry;
    return mostRecent;
  }, undefined);
  return {
    unreadCount,
    lastMessageAt: latest?.lastMessageAt,
    lastMessageBody: latest?.lastMessageBody,
    lastMessageSenderIsSelf: latest?.lastMessageSenderIsSelf,
  };
}

function summariseDirect(entries: ChatOverviewEntry[]): DirectSummary[] {
  const byPartner = new Map<string, ChatOverviewEntry[]>();
  for (const entry of entries) {
    if (!entry.otherMembershipId) continue;
    const existing = byPartner.get(entry.otherMembershipId) ?? [];
    existing.push(entry);
    byPartner.set(entry.otherMembershipId, existing);
  }
  const summaries: DirectSummary[] = [];
  for (const [membershipId, partnerEntries] of byPartner) {
    const unreadCount = partnerEntries.reduce((total, entry) => total + entry.unreadCount, 0);
    const latest = partnerEntries.reduce<ChatOverviewEntry | undefined>((mostRecent, entry) => {
      if (!entry.lastMessageAt) return mostRecent;
      if (!mostRecent?.lastMessageAt || entry.lastMessageAt > mostRecent.lastMessageAt) return entry;
      return mostRecent;
    }, undefined);
    summaries.push({
      membershipId,
      displayName: partnerEntries[0].otherDisplayName ?? 'A Lilica member',
      isFormer: Boolean(partnerEntries[0].otherIsFormer),
      unreadCount,
      lastMessageAt: latest?.lastMessageAt,
      lastMessageBody: latest?.lastMessageBody,
      lastMessageSenderIsSelf: latest?.lastMessageSenderIsSelf,
    });
  }
  // Most recently active partner first -- a partner with no messages at
  // all yet (lastMessageAt undefined) sorts last, same convention as
  // every other chat list in this app.
  summaries.sort((a, b) => {
    if (!a.lastMessageAt && !b.lastMessageAt) return 0;
    if (!a.lastMessageAt) return 1;
    if (!b.lastMessageAt) return -1;
    return b.lastMessageAt.localeCompare(a.lastMessageAt);
  });
  return summaries;
}

function SummaryRow({
  label,
  formerLabel,
  lastMessageAt,
  lastMessageBody,
  lastMessageSenderIsSelf,
  unreadCount,
  emptyText,
  onPress,
}: {
  label: string;
  formerLabel?: boolean;
  lastMessageAt?: string;
  lastMessageBody?: string;
  lastMessageSenderIsSelf?: boolean;
  unreadCount: number;
  emptyText: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${label}`} onPress={onPress} style={styles.row}>
      <View style={styles.rowCopy}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {formerLabel ? `${label} (former member)` : label}
        </AppText>
        {lastMessageBody ? (
          <AppText variant="secondary" tone="soft" numberOfLines={1}>
            {lastMessageSenderIsSelf ? 'You: ' : ''}{lastMessageBody}
          </AppText>
        ) : (
          <AppText variant="secondary" tone="soft">{emptyText}</AppText>
        )}
      </View>
      <View style={styles.rowMeta}>
        {lastMessageAt ? <AppText variant="meta" tone="soft">{timeLabel(lastMessageAt)}</AppText> : null}
        {unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <AppText variant="meta" tone="white" style={styles.unreadBadgeLabel}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ChatOverviewScreen({ careSpaceId, onBack, onOpenCareCircle, onOpenDirect }: Props) {
  const [entries, setEntries] = useState<ChatOverviewEntry[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    if (!careSpaceId) { setLoading(false); return; }
    setLoading(true);
    setError(undefined);
    listMyChatOverview(careSpaceId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) { setError(result.message); return; }
      setEntries(result.data);
    });
    return () => { cancelled = true; };
  }, [careSpaceId]);

  const careCircle = summariseCareCircle(entries?.filter((entry) => entry.kind === 'care_circle') ?? []);
  const directSummaries = summariseDirect(entries?.filter((entry) => entry.kind === 'direct') ?? []);

  return (
    <Screen>
      <Header title="Lilica Chat" onBack={onBack} />
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <AppText variant="secondary" tone="danger">{error}</AppText>
      ) : (
        <View style={styles.sections}>
          <View style={styles.section}>
            <AppText variant="section" style={styles.sectionTitle}>Care Circle</AppText>
            <SummaryRow
              label="Care Circle"
              lastMessageAt={careCircle.lastMessageAt}
              lastMessageBody={careCircle.lastMessageBody}
              lastMessageSenderIsSelf={careCircle.lastMessageSenderIsSelf}
              unreadCount={careCircle.unreadCount}
              emptyText="No conversations yet"
              onPress={onOpenCareCircle}
            />
          </View>
          <View style={styles.section}>
            <AppText variant="section" style={styles.sectionTitle}>Direct Messages</AppText>
            {directSummaries.length === 0 ? (
              <AppText variant="secondary" tone="soft">
                No direct messages yet - start one from a Care Circle member's profile.
              </AppText>
            ) : (
              <View style={styles.list}>
                {directSummaries.map((summary) => (
                  <SummaryRow
                    key={summary.membershipId}
                    label={summary.displayName}
                    formerLabel={summary.isFormer}
                    lastMessageAt={summary.lastMessageAt}
                    lastMessageBody={summary.lastMessageBody}
                    lastMessageSenderIsSelf={summary.lastMessageSenderIsSelf}
                    unreadCount={summary.unreadCount}
                    emptyText="No messages yet"
                    onPress={() => onOpenDirect(summary.membershipId, summary.displayName)}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
