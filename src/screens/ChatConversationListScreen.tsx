import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { ConversationSummary, conversationLabel, listMyConversations, startNewConversation } from '../chat';
import { colors, radius, spacing } from '../theme';

// Phase 23 slice 5: "past conversations, reopen one, or start a new one"
// -- direct product-owner decision (22 September 2026) that a single
// never-ending Lilica Chat/DM thread doesn't work. Lists every
// conversation of one kind (Lilica Chat for the whole Care Circle, or
// every DM with one specific person), most recent activity first, with a
// real "New conversation" action alongside them. Record-linked chat has
// no equivalent list screen -- it stays exactly one thread per record.
type Props = {
  careSpaceId?: string;
  // kind='direct' always needs BOTH partnerMembershipId (who the DMs are
  // with) and partnerDisplayName (for the header/empty state) -- never
  // one without the other.
  kind: 'care_circle' | 'direct';
  partnerMembershipId?: string;
  partnerDisplayName?: string;
  onBack: () => void;
  onOpenConversation: (threadId: string, title?: string) => void;
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

export function ChatConversationListScreen({ careSpaceId, kind, partnerMembershipId, partnerDisplayName, onBack, onOpenConversation }: Props) {
  const [conversations, setConversations] = useState<ConversationSummary[]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [starting, setStarting] = useState(false);
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

  async function handleStartNew() {
    if (!careSpaceId || starting) return;
    setStarting(true);
    const result = await startNewConversation(careSpaceId, kind, partnerMembershipId);
    setStarting(false);
    if (!result.ok) {
      Alert.alert('Could not start a new conversation', result.message);
      return;
    }
    onOpenConversation(result.data);
  }

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a new conversation"
            onPress={() => void handleStartNew()}
            disabled={starting}
            style={[styles.newButton, starting && styles.newButtonDisabled]}
          >
            {starting ? <ActivityIndicator color={colors.white} /> : <AppText variant="bodyStrong" tone="white">+ New conversation</AppText>}
          </Pressable>
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
              onPress={() => onOpenConversation(conversation.threadId, conversation.title)}
              style={styles.row}
            >
              <View style={styles.rowCopy}>
                <AppText variant="bodyStrong" numberOfLines={1}>{conversationLabel(conversation)}</AppText>
                {conversation.lastMessageBody ? (
                  <AppText variant="secondary" tone="soft" numberOfLines={1}>
                    {conversation.lastMessageSenderIsSelf ? 'You: ' : ''}{conversation.lastMessageBody}
                  </AppText>
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
});
