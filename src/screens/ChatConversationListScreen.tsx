import { ComponentProps, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Header } from '../components/Header';
import { useScrollToEnd } from '../components/KeyboardAwareScrollView';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { ChatSubjectOption, ConversationSummary, conversationLabel, listMyConversations, startNewConversation } from '../chat';
import { colors, radius, spacing } from '../theme';

// Phase 23 slice 5: "past conversations, reopen one, or start a new one"
// -- direct product-owner decision (22 September 2026) that a single
// never-ending Lilica Chat/DM thread doesn't work. Lists every
// conversation of one kind (Lilica Chat for the whole Care Circle, or
// every DM with one specific person), most recent activity first, with a
// real "New conversation" action alongside them. Record-linked chat has
// no equivalent list screen -- it stays exactly one thread per record.
//
// Slice 6 (same day, direct report: the collapsed list gave no
// indication what a conversation was about): "+ New conversation" now
// opens a real picker first -- a Medical Log record from subjectOptions,
// or a free-text title -- before the conversation is actually created.
// That becomes the conversation's own subject, shown here in place of
// the generic "Conversation started <date>" fallback.
type Props = {
  careSpaceId?: string;
  // kind='direct' always needs BOTH partnerMembershipId (who the DMs are
  // with) and partnerDisplayName (for the header/empty state) -- never
  // one without the other.
  kind: 'care_circle' | 'direct';
  partnerMembershipId?: string;
  partnerDisplayName?: string;
  // Every Medical Log item, offered as the "+ New conversation" subject
  // picker's dropdown. Omitted or empty falls back to the free-text
  // title field alone -- never a fabricated affordance.
  subjectOptions?: ChatSubjectOption[];
  onBack: () => void;
  // subjectRecordId, alongside title, so the thread screen can offer to
  // open the linked record straight away for a conversation reopened
  // from here -- not just one just created in this session.
  onOpenConversation: (threadId: string, title?: string, subjectRecordId?: string) => void;
};

// useScrollToEnd() only resolves to the live scroll function for a
// component rendered INSIDE the enclosing <Screen>'s subtree -- calling a
// context hook at this screen's own top level (as an earlier version of
// this fix shipped, 22 September 2026) reads the context's no-op default
// instead, since the <Screen> it renders is a descendant of this
// component, never an ancestor. This wrapper is genuinely rendered as a
// child of that <Screen>, so it resolves correctly. scrollToEnd (not the
// general-purpose measure-based reveal) because this title field is
// always the very last thing in the footer -- see ChatThreadScreen.tsx's
// own comment on why that's the more robust choice (real device report,
// 23 September 2026: native Android keyboard resize is not reliable
// enough to depend on for measurement-based positioning).
function RevealingTextInput({ onFocus, ...props }: ComponentProps<typeof TextInput>) {
  const scrollToEnd = useScrollToEnd();
  return (
    <TextInput
      {...props}
      onFocus={(event) => {
        scrollToEnd();
        onFocus?.(event);
      }}
    />
  );
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Direct product-owner report (23 September 2026): a conversation
// started via a real subject (e.g. "Spinal disc injury") but with no
// messages sent yet showed no date at all -- just the bare "No messages
// yet" fallback. When it has its own real subject, name when it was
// actually created instead, so the row isn't undated.
function createdOnLabel(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `Created on ${day} at ${time}`;
}

// Extracted (23 September 2026) so ChatOverviewScreen's combined "Lilica
// Chat" entry point can offer the exact same "+ New conversation" picker
// for its own Care Circle section, without duplicating this logic.
// Direct messages deliberately never get this picker anywhere -- DMing
// stays reachable only via a Care Circle member's own avatar, never a
// second "pick someone" flow.
type NewConversationSheetProps = {
  careSpaceId?: string;
  kind: 'care_circle' | 'direct';
  partnerMembershipId?: string;
  subjectOptions?: ChatSubjectOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: (threadId: string, title?: string, subjectRecordId?: string) => void;
};

export function ChatNewConversationSheet({ careSpaceId, kind, partnerMembershipId, subjectOptions, open, onOpenChange, onStarted }: NewConversationSheetProps) {
  const [starting, setStarting] = useState(false);
  const [customTitle, setCustomTitle] = useState('');

  async function handleStart(options: { title?: string; subjectRecordId?: string }) {
    if (!careSpaceId || starting) return;
    setStarting(true);
    const result = await startNewConversation(careSpaceId, kind, partnerMembershipId, options.title, options.subjectRecordId);
    setStarting(false);
    if (!result.ok) {
      Alert.alert('Could not start a new conversation', result.message);
      return;
    }
    onOpenChange(false);
    setCustomTitle('');
    onStarted(
      result.data,
      options.subjectRecordId ? subjectOptions?.find((option) => option.id === options.subjectRecordId)?.title : options.title,
      options.subjectRecordId,
    );
  }

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start a new conversation"
        onPress={() => onOpenChange(true)}
        disabled={starting}
        style={[styles.newButton, starting && styles.newButtonDisabled]}
      >
        {starting ? <ActivityIndicator color={colors.white} /> : <AppText variant="bodyStrong" tone="white">+ New conversation</AppText>}
      </Pressable>
    );
  }

  return (
    <View style={styles.picker}>
      <AppText variant="bodyStrong">Is it related to an existing medical or care issue?</AppText>
      {subjectOptions && subjectOptions.length > 0 ? (
        <>
          <AppText variant="secondary" tone="soft">Pick a Medical Log item</AppText>
          <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled">
            {subjectOptions.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={`Start a conversation about ${option.title}`}
                onPress={() => void handleStart({ subjectRecordId: option.id })}
                disabled={starting}
                style={styles.pickerRow}
              >
                <AppText variant="secondary" numberOfLines={1}>{option.title}</AppText>
              </Pressable>
            ))}
          </ScrollView>
          <AppText variant="secondary" tone="soft">Not logged yet? Give it a title instead</AppText>
        </>
      ) : (
        <AppText variant="secondary" tone="soft">Not logged yet? Give it a title</AppText>
      )}
      <View style={styles.titleRow}>
        <RevealingTextInput
          value={customTitle}
          onChangeText={setCustomTitle}
          placeholder="e.g. Weekend visit plans"
          placeholderTextColor={colors.muted}
          style={styles.titleInput}
          accessibilityLabel="Conversation title"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start conversation with this title"
          onPress={() => void handleStart({ title: customTitle })}
          disabled={!customTitle.trim() || starting}
          style={[styles.titleButton, (!customTitle.trim() || starting) && styles.newButtonDisabled]}
        >
          <AppText variant="bodyStrong" tone="white">Start</AppText>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel" onPress={() => { onOpenChange(false); setCustomTitle(''); }} hitSlop={8}>
        <AppText variant="secondary" tone="soft" centre>Cancel</AppText>
      </Pressable>
    </View>
  );
}

export function ChatConversationListScreen({ careSpaceId, kind, partnerMembershipId, partnerDisplayName, subjectOptions, onBack, onOpenConversation }: Props) {
  const [conversations, setConversations] = useState<ConversationSummary[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const isDirect = kind === 'direct';
  const headerTitle = isDirect ? (partnerDisplayName ? `Chat with ${partnerDisplayName}` : 'Direct messages') : 'Lilica Chat';

  useEffect(() => {
    let cancelled = false;
    if (!careSpaceId) { setLoading(false); return; }
    setLoading(true);
    setError(undefined);
    listMyConversations(careSpaceId, kind, partnerMembershipId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) { setError(result.message); return; }
      setConversations(result.data);
    });
    return () => { cancelled = true; };
  }, [careSpaceId, kind, partnerMembershipId]);

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <ChatNewConversationSheet
            careSpaceId={careSpaceId}
            kind={kind}
            partnerMembershipId={partnerMembershipId}
            subjectOptions={subjectOptions}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onStarted={onOpenConversation}
          />
        </View>
      }
    >
      <Header title={headerTitle} onBack={onBack} />
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <AppText variant="secondary" tone="danger">{error}</AppText>
      ) : !conversations || conversations.length === 0 ? (
        <AppText variant="secondary" tone="soft">
          {isDirect
            ? `No conversations with ${partnerDisplayName ?? 'them'} yet - start one below.`
            : 'No conversations yet - start one below.'}
        </AppText>
      ) : (
        <View style={styles.list}>
          {conversations.map((conversation) => (
            <Pressable
              key={conversation.threadId}
              accessibilityRole="button"
              accessibilityLabel={`Open ${conversationLabel(conversation)}`}
              onPress={() => onOpenConversation(conversation.threadId, conversationLabel(conversation), conversation.subjectRecordId)}
              style={styles.row}
            >
              <View style={styles.rowCopy}>
                <AppText variant="bodyStrong" numberOfLines={1}>{conversationLabel(conversation)}</AppText>
                {conversation.lastMessageBody ? (
                  <AppText variant="secondary" tone="soft" numberOfLines={1}>
                    {conversation.lastMessageSenderIsSelf ? 'You: ' : ''}{conversation.lastMessageBody}
                  </AppText>
                ) : conversation.subjectRecordTitle || conversation.title ? (
                  <AppText variant="meta" tone="soft">{createdOnLabel(conversation.createdAt)}</AppText>
                ) : (
                  <AppText variant="secondary" tone="soft">No messages yet</AppText>
                )}
              </View>
              <View style={styles.rowMeta}>
                {conversation.lastMessageAt ? (
                  <AppText variant="meta" tone="soft">{timeLabel(conversation.lastMessageAt)}</AppText>
                ) : null}
                {conversation.unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <AppText variant="meta" tone="white" style={styles.unreadBadgeLabel}>
                      {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  newButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newButtonDisabled: {
    opacity: 0.6,
  },
  picker: {
    gap: spacing.xs,
  },
  pickerList: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pickerRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  titleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  titleInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  titleButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
