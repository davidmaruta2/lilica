import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { ChatOverviewEntry, ChatSubjectOption, listMyChatOverview } from '../chat';
import { colors, radius, spacing } from '../theme';
import { ChatNewConversationSheet } from './ChatConversationListScreen';

// Phase 23 slice 9: a single combined "Lilica Chat" entry point -- direct
// product-owner report (23 September 2026): "while it's possible to
// start a DM through the care circle avatar, not seeing DMs through the
// main Lilica Chat space seems odd" -- one entry point, both kinds, but
// never merged into one undifferentiated list (a DM is private between
// two people, Care Circle chat is visible to the whole circle), so this
// renders two clearly-labelled sections instead of blending them.
//
// Starting a NEW Care Circle conversation is still offered here (same
// picker as ChatConversationListScreen). Starting a NEW direct message is
// deliberately NOT offered here -- same day, same decision: DMing stays
// reachable only via a Care Circle member's own avatar (the popup's
// "Message" button), never duplicated as a second "pick someone" flow
// here. This screen only ever lists DMs that already exist.
type Props = {
  careSpaceId?: string;
  subjectOptions?: ChatSubjectOption[];
  onBack: () => void;
  onOpenConversation: (threadId: string, title?: string, subjectRecordId?: string) => void;
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

function createdOnLabel(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `Created on ${day} at ${time}`;
}

// A care_circle row is known by its own subject/title (falling back to
// when it started); a direct row is known by WHO it's with first -- the
// same "who am I talking to" identity every messaging app leads with --
// and its own subject/title (if it has one) is secondary context.
function headline(entry: ChatOverviewEntry): string {
  if (entry.kind === 'direct') return entry.otherDisplayName ?? 'Direct message';
  if (entry.subjectRecordTitle) return entry.subjectRecordTitle;
  if (entry.title) return entry.title;
  const date = new Date(entry.createdAt);
  return `Conversation started ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

function subjectContext(entry: ChatOverviewEntry): string | undefined {
  if (entry.kind !== 'direct') return undefined;
  return entry.subjectRecordTitle ?? entry.title;
}

function OverviewRow({ entry, onOpen }: { entry: ChatOverviewEntry; onOpen: () => void }) {
  const context = subjectContext(entry);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${headline(entry)}`}
      onPress={onOpen}
      style={styles.row}
    >
      <View style={styles.rowCopy}>
        <AppText variant="bodyStrong" numberOfLines={1}>{headline(entry)}</AppText>
        {entry.lastMessageBody ? (
          <AppText variant="secondary" tone="soft" numberOfLines={1}>
            {entry.lastMessageSenderIsSelf ? 'You: ' : ''}{entry.lastMessageBody}
          </AppText>
        ) : context ? (
          <AppText variant="secondary" tone="soft" numberOfLines={1}>Re: {context}</AppText>
        ) : entry.kind === 'care_circle' && (entry.subjectRecordTitle || entry.title) ? (
          <AppText variant="meta" tone="soft">{createdOnLabel(entry.createdAt)}</AppText>
        ) : (
          <AppText variant="secondary" tone="soft">No messages yet</AppText>
        )}
      </View>
      <View style={styles.rowMeta}>
        {entry.lastMessageAt ? (
          <AppText variant="meta" tone="soft">{timeLabel(entry.lastMessageAt)}</AppText>
        ) : null}
        {entry.unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <AppText variant="meta" tone="white" style={styles.unreadBadgeLabel}>
              {entry.unreadCount > 9 ? '9+' : entry.unreadCount}
            </AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ChatOverviewScreen({ careSpaceId, subjectOptions, onBack, onOpenConversation }: Props) {
  const [entries, setEntries] = useState<ChatOverviewEntry[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [pickerOpen, setPickerOpen] = useState(false);

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

  const careCircleEntries = entries?.filter((entry) => entry.kind === 'care_circle') ?? [];
  const directEntries = entries?.filter((entry) => entry.kind === 'direct') ?? [];

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <ChatNewConversationSheet
            careSpaceId={careSpaceId}
            kind="care_circle"
            subjectOptions={subjectOptions}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onStarted={(threadId, title, subjectRecordId) => onOpenConversation(threadId, title, subjectRecordId)}
          />
        </View>
      }
    >
      <Header title="Lilica Chat" onBack={onBack} />
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <AppText variant="secondary" tone="danger">{error}</AppText>
      ) : (
        <View style={styles.sections}>
          <View style={styles.section}>
            <AppText variant="section" style={styles.sectionTitle}>Care Circle</AppText>
            {careCircleEntries.length === 0 ? (
              <AppText variant="secondary" tone="soft">No conversations yet - start one below.</AppText>
            ) : (
              <View style={styles.list}>
                {careCircleEntries.map((entry) => (
                  <OverviewRow
                    key={entry.threadId}
                    entry={entry}
                    onOpen={() => onOpenConversation(entry.threadId, headline(entry), entry.subjectRecordId)}
                  />
                ))}
              </View>
            )}
          </View>
          <View style={styles.section}>
            <AppText variant="section" style={styles.sectionTitle}>Direct Messages</AppText>
            {directEntries.length === 0 ? (
              <AppText variant="secondary" tone="soft">
                No direct messages yet - start one from a Care Circle member's profile.
              </AppText>
            ) : (
              <View style={styles.list}>
                {directEntries.map((entry) => (
                  <OverviewRow
                    key={entry.threadId}
                    entry={entry}
                    onOpen={() => onOpenConversation(entry.threadId, headline(entry), entry.subjectRecordId)}
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
  footer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
