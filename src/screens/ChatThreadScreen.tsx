import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import {
  ChatMessage,
  deleteChatMessage,
  editChatMessage,
  getOrCreateCareCircleThread,
  getOrCreateDirectThread,
  listChatMessages,
  markChatThreadRead,
  sendChatMessage,
} from '../chat';
import { colors, radius, spacing } from '../theme';

// Phase 23: one screen for both the shared Care Circle conversation
// (slice 1) and a private direct-message thread with one other member
// (slice 2) -- the two differ only in which thread gets loaded and the
// header/placeholder copy, never in how sending/editing/deleting/reading
// works, so a single screen with a mode switch is simpler and more
// honest than two near-identical copies.
//
// Shared mode: pass careSpaceId, leave directPartnerMembershipId unset --
// loads (or lazily creates) the one shared thread for that care space.
// Direct mode: pass BOTH careSpaceId and directPartnerMembershipId --
// loads (or lazily creates) the private thread with that one member.
// Either way, "load on mount, page further only on demand" matches the
// same shape RecentActivityScreen already established for this app.
type Props = {
  careSpaceId?: string;
  directPartnerMembershipId?: string;
  directPartnerDisplayName?: string;
  onBack: () => void;
  onMessagesChanged?: () => void;
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function ChatThreadScreen({ careSpaceId, directPartnerMembershipId, directPartnerDisplayName, onBack, onMessagesChanged }: Props) {
  const [threadId, setThreadId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [editDraft, setEditDraft] = useState('');
  const inputRef = useRef<TextInput>(null);
  const isDirect = Boolean(directPartnerMembershipId);
  const headerTitle = isDirect ? (directPartnerDisplayName ?? 'Direct message') : 'Lilica Chat';
  const composePlaceholder = isDirect ? `Message ${directPartnerDisplayName ?? 'them'}` : 'Message your Care Circle';
  const emptyStateText = isDirect
    ? `No messages yet - send the first one to ${directPartnerDisplayName ?? 'them'}.`
    : 'No messages yet - send the first one to start talking with your Care Circle.';

  useEffect(() => {
    let cancelled = false;
    if (!careSpaceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(undefined);
    (async () => {
      const threadResult = directPartnerMembershipId
        ? await getOrCreateDirectThread(careSpaceId, directPartnerMembershipId)
        : await getOrCreateCareCircleThread(careSpaceId);
      if (cancelled) return;
      if (!threadResult.ok) {
        setLoading(false);
        setError(threadResult.message);
        return;
      }
      setThreadId(threadResult.data);
      const messagesResult = await listChatMessages(threadResult.data);
      if (cancelled) return;
      setLoading(false);
      if (!messagesResult.ok) {
        setError(messagesResult.message);
        return;
      }
      setMessages(messagesResult.data.messages);
      void markChatThreadRead(threadResult.data);
      onMessagesChanged?.();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careSpaceId, directPartnerMembershipId]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !threadId || sending) return;
    setSending(true);
    const result = await sendChatMessage(threadId, body);
    setSending(false);
    if (!result.ok) {
      Alert.alert('Message not sent', result.message);
      return;
    }
    setMessages((current) => [...current, result.data]);
    setDraft('');
    onMessagesChanged?.();
  }

  function startEdit(message: ChatMessage) {
    setEditingId(message.id);
    setEditDraft(message.body ?? '');
  }

  async function handleSaveEdit() {
    const body = editDraft.trim();
    if (!body || !editingId) return;
    const result = await editChatMessage(editingId, body);
    if (!result.ok) {
      Alert.alert('Could not save', result.message);
      return;
    }
    setMessages((current) => current.map((m) => (m.id === result.data.id ? result.data : m)));
    setEditingId(undefined);
    setEditDraft('');
  }

  function handleDelete(message: ChatMessage) {
    Alert.alert('Delete this message?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteChatMessage(message.id);
          if (!result.ok) {
            Alert.alert('Could not delete', result.message);
            return;
          }
          setMessages((current) => current.map((m) => (
            m.id === message.id ? { ...m, body: undefined, deletedAt: new Date().toISOString() } : m
          )));
          onMessagesChanged?.();
        },
      },
    ]);
  }

  return (
    <Screen
      footer={
        threadId ? (
          <View style={styles.composeRow}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder={composePlaceholder}
              placeholderTextColor={colors.muted}
              multiline
              style={styles.composeInput}
              accessibilityLabel="Write a message"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              onPress={() => void handleSend()}
              disabled={!draft.trim() || sending}
              style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
            >
              {sending ? <ActivityIndicator color={colors.white} /> : <AppText variant="bodyStrong" tone="white">Send</AppText>}
            </Pressable>
          </View>
        ) : undefined
      }
    >
      <Header title={headerTitle} onBack={onBack} />
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <AppText variant="secondary" tone="danger">{error}</AppText>
      ) : messages.length === 0 ? (
        <AppText variant="secondary" tone="soft">
          {emptyStateText}
        </AppText>
      ) : (
        <View style={styles.messages}>
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const showSender = !message.senderIsSelf && (!previous || previous.senderMembershipId !== message.senderMembershipId);
            const isEditing = editingId === message.id;
            return (
              <View
                key={message.id}
                style={[styles.messageRow, message.senderIsSelf ? styles.messageRowSelf : styles.messageRowOther]}
              >
                {showSender ? (
                  <AppText variant="meta" tone="soft" style={styles.senderLabel}>
                    {message.senderIsFormer ? `${message.senderDisplayName} (former member)` : message.senderDisplayName}
                  </AppText>
                ) : null}
                {isEditing ? (
                  <View style={styles.editWrap}>
                    <TextInput
                      value={editDraft}
                      onChangeText={setEditDraft}
                      multiline
                      style={styles.editInput}
                      autoFocus
                      accessibilityLabel="Edit message text"
                    />
                    <View style={styles.editActions}>
                      <Pressable accessibilityRole="button" accessibilityLabel="Cancel edit" onPress={() => setEditingId(undefined)} hitSlop={8}>
                        <AppText variant="secondary" tone="soft">Cancel</AppText>
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel="Save edit" onPress={() => void handleSaveEdit()} hitSlop={8}>
                        <AppText variant="secondary" tone="primary" style={styles.saveLabel}>Save</AppText>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.bubble, message.senderIsSelf ? styles.bubbleSelf : styles.bubbleOther]}>
                    <AppText
                      variant="body"
                      tone={message.senderIsSelf ? 'white' : undefined}
                      style={message.deletedAt ? styles.deletedText : undefined}
                    >
                      {message.deletedAt ? 'Message deleted' : message.body}
                    </AppText>
                  </View>
                )}
                <View style={[styles.metaRow, message.senderIsSelf ? styles.metaRowSelf : styles.metaRowOther]}>
                  <AppText variant="meta" tone="soft">
                    {timeLabel(message.createdAt)}{message.editedAt && !message.deletedAt ? ' - Edited' : ''}
                  </AppText>
                  {message.senderIsSelf && !message.deletedAt && !isEditing ? (
                    <>
                      <Pressable accessibilityRole="button" accessibilityLabel="Edit message" onPress={() => startEdit(message)} hitSlop={8}>
                        <AppText variant="meta" tone="primary">Edit</AppText>
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel="Delete message" onPress={() => handleDelete(message)} hitSlop={8}>
                        <AppText variant="meta" tone="danger">Delete</AppText>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  messages: {
    gap: spacing.md,
  },
  messageRow: {
    maxWidth: '82%',
    gap: spacing.xxs,
  },
  messageRowSelf: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageRowOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderLabel: {
    paddingHorizontal: spacing.xs,
  },
  bubble: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  bubbleSelf: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderBottomLeftRadius: 4,
  },
  deletedText: {
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  metaRowSelf: {
    justifyContent: 'flex-end',
  },
  metaRowOther: {
    justifyContent: 'flex-start',
  },
  editWrap: {
    width: '100%',
    gap: spacing.xxs,
  },
  editInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.ink,
    minHeight: 44,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  saveLabel: {
    fontWeight: '700',
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.sm : spacing.md,
  },
  composeInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  sendButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
