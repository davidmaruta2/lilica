import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Header } from '../components/Header';
import { useRevealFocusedInput } from '../components/KeyboardAwareScrollView';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import {
  ChatMessage,
  ChatSubjectOption,
  deleteChatMessage,
  editChatMessage,
  getOrCreateCareCircleThread,
  getOrCreateDirectThread,
  getOrCreateRecordThread,
  listChatMessages,
  listRecordConversation,
  markChatThreadRead,
  sendChatMessage,
  setConversationSubject,
} from '../chat';
import { colors, radius, spacing } from '../theme';

// Phase 23: one screen for a Care Circle conversation (slice 1), a
// private direct-message conversation with one other member (slice 2),
// and a conversation attached to a single Medical Log item (slice 3) --
// the three differ only in which thread gets loaded and the header/
// placeholder copy, never in how sending/editing/deleting/reading works,
// so a single screen with a mode switch is simpler and more honest than
// three near-identical copies.
//
// Shared mode: pass careSpaceId only -- loads (or lazily creates) the
// most recently active Lilica Chat conversation for that care space.
// Direct mode: pass careSpaceId AND directPartnerMembershipId -- loads
// (or lazily creates) the most recently active private conversation with
// that one member.
// Record mode: pass recordId (and recordTitle for the header/copy) --
// loads (or lazily creates) that record's own conversation thread (still
// exactly one per record -- slice 5's multi-conversation change never
// applied to this mode).
// Slice 5: pass explicitThreadId (with explicitThreadTitle) to open one
// SPECIFIC past conversation instead of "the most recent" -- this is how
// ChatConversationListScreen reopens an older Lilica Chat/DM conversation
// rather than always landing on the latest one. Combine with
// careSpaceId/directPartnerMembershipId/directPartnerDisplayName as
// normal so sending/subject-tagging still know the right context.
// Exactly one of directPartnerMembershipId/recordId is ever set.
// Either way, "load on mount, page further only on demand" matches the
// same shape RecentActivityScreen already established for this app.
type Props = {
  careSpaceId?: string;
  directPartnerMembershipId?: string;
  directPartnerDisplayName?: string;
  recordId?: string;
  recordTitle?: string;
  explicitThreadId?: string;
  explicitThreadTitle?: string;
  // Slice 4: shown in shared AND direct mode (never record mode) --
  // omitted or empty means no subject picker shows at all, same "never a
  // fabricated affordance" pattern as everywhere else in this app.
  subjectOptions?: ChatSubjectOption[];
  onBack: () => void;
  onMessagesChanged?: () => void;
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function ChatThreadScreen({ careSpaceId, directPartnerMembershipId, directPartnerDisplayName, recordId, recordTitle, explicitThreadId, explicitThreadTitle, subjectOptions, onBack, onMessagesChanged }: Props) {
  const [threadId, setThreadId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [editDraft, setEditDraft] = useState('');
  const inputRef = useRef<TextInput>(null);
  // Real gap found by direct product-owner report (22 September 2026):
  // every other text input in this app (TextField.tsx) calls this on
  // focus so KeyboardAwareScrollView actually scrolls it above the
  // keyboard -- this screen's own compose/edit TextInputs never did,
  // leaving the compose box hidden behind the keyboard with nothing
  // visible to type into.
  const revealFocusedInput = useRevealFocusedInput();
  const isDirect = Boolean(directPartnerMembershipId);
  const isRecord = Boolean(recordId);
  // Slice 6/7: a conversation's subject lives on the conversation itself,
  // not re-picked per message -- offered in shared AND direct mode (a
  // direct product-owner decision -- DM tagging behaves exactly like
  // Lilica Chat tagging, including surfacing in the record's shared
  // conversation). Never in record mode, which is already about exactly
  // its own record.
  const canHaveSubject = !isRecord;
  const [conversationSubject, setConversationSubjectLabel] = useState<string | undefined>(explicitThreadTitle);
  const [subjectPanelOpen, setSubjectPanelOpen] = useState(false);
  const [subjectCustomTitle, setSubjectCustomTitle] = useState('');
  const [savingSubject, setSavingSubject] = useState(false);
  const headerTitle = conversationSubject
    ? conversationSubject
    : isDirect ? (directPartnerDisplayName ?? 'Direct message') : isRecord ? (recordTitle ?? 'Conversation') : 'Lilica Chat';
  const composePlaceholder = isDirect ? `Message ${directPartnerDisplayName ?? 'them'}` : isRecord ? 'Write a message' : 'Message your Care Circle';
  const emptyStateText = isDirect
    ? `No messages yet - send the first one to ${directPartnerDisplayName ?? 'them'}.`
    : isRecord
    ? `No messages yet - start the conversation about ${recordTitle ?? 'this'}.`
    : 'No messages yet - send the first one to start talking with your Care Circle.';

  useEffect(() => {
    let cancelled = false;
    if (!careSpaceId && !recordId && !explicitThreadId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(undefined);
    (async () => {
      const threadResult = explicitThreadId
        ? ({ ok: true, data: explicitThreadId } as const)
        : recordId
        ? await getOrCreateRecordThread(recordId)
        : directPartnerMembershipId && careSpaceId
        ? await getOrCreateDirectThread(careSpaceId, directPartnerMembershipId)
        : careSpaceId
        ? await getOrCreateCareCircleThread(careSpaceId)
        : undefined;
      if (cancelled) return;
      if (!threadResult) {
        setLoading(false);
        return;
      }
      if (!threadResult.ok) {
        setLoading(false);
        setError(threadResult.message);
        return;
      }
      setThreadId(threadResult.data);
      // Slice 4: a record's conversation can include messages tagged
      // from Lilica Chat, living in a DIFFERENT thread than this one's
      // own dedicated thread -- listRecordConversation merges both;
      // listChatMessages(threadId) alone would miss the tagged ones.
      const messagesResult = recordId
        ? await listRecordConversation(recordId)
        : await listChatMessages(threadResult.data);
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
  }, [careSpaceId, directPartnerMembershipId, recordId, explicitThreadId]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !threadId || sending) return;
    setSending(true);
    // No explicit per-message subject any more -- a new message inherits
    // whatever subject the conversation itself already has (server-side,
    // send_chat_message reads chat_threads.subject_record_id).
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

  async function handleSaveSubject(options: { title?: string; subjectRecordId?: string }) {
    if (!threadId || savingSubject) return;
    setSavingSubject(true);
    const result = await setConversationSubject(threadId, options);
    setSavingSubject(false);
    if (!result.ok) {
      Alert.alert('Could not update subject', result.message);
      return;
    }
    const label = options.subjectRecordId
      ? subjectOptions?.find((option) => option.id === options.subjectRecordId)?.title
      : options.title;
    setConversationSubjectLabel(label);
    setSubjectPanelOpen(false);
    setSubjectCustomTitle('');
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
          <View>
            <View style={styles.composeRow}>
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                onFocus={(event) => revealFocusedInput(event.nativeEvent.target)}
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
          </View>
        ) : undefined
      }
    >
      <Header title={headerTitle} onBack={onBack} />
      {canHaveSubject && threadId ? (
        <View style={styles.subjectArea}>
          {subjectPanelOpen ? (
            <View style={styles.subjectPanel}>
              <AppText variant="bodyStrong">Is it related to an existing medical or care issue?</AppText>
              {subjectOptions && subjectOptions.length > 0 ? (
                <>
                  <AppText variant="secondary" tone="soft">Pick a Medical Log item</AppText>
                  <ScrollView style={styles.subjectPicker} keyboardShouldPersistTaps="handled">
                    {subjectOptions.map((option) => (
                      <Pressable
                        key={option.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Set the subject to ${option.title}`}
                        onPress={() => void handleSaveSubject({ subjectRecordId: option.id })}
                        disabled={savingSubject}
                        style={styles.subjectPickerRow}
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
              <View style={styles.subjectTitleRow}>
                <TextInput
                  value={subjectCustomTitle}
                  onChangeText={setSubjectCustomTitle}
                  onFocus={(event) => revealFocusedInput(event.nativeEvent.target)}
                  placeholder="e.g. Weekend visit plans"
                  placeholderTextColor={colors.muted}
                  style={styles.subjectTitleInput}
                  accessibilityLabel="Conversation subject title"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Save subject title"
                  onPress={() => void handleSaveSubject({ title: subjectCustomTitle })}
                  disabled={!subjectCustomTitle.trim() || savingSubject}
                  style={[styles.subjectTitleButton, (!subjectCustomTitle.trim() || savingSubject) && styles.subjectTitleButtonDisabled]}
                >
                  <AppText variant="bodyStrong" tone="white">Save</AppText>
                </Pressable>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancel changing subject" onPress={() => { setSubjectPanelOpen(false); setSubjectCustomTitle(''); }} hitSlop={8}>
                <AppText variant="secondary" tone="soft">Cancel</AppText>
              </Pressable>
            </View>
          ) : conversationSubject ? (
            // The header above already shows this conversation's subject
            // -- repeating it here as its own chip would just be noise.
            // Only the "Change" action itself is worth a second row.
            <Pressable accessibilityRole="button" accessibilityLabel="Change subject" onPress={() => setSubjectPanelOpen(true)} style={styles.subjectAddButton}>
              <AppText variant="meta" tone="primary" style={styles.subjectChipText}>Change subject</AppText>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Is it related to an existing medical or care issue?"
              onPress={() => setSubjectPanelOpen(true)}
              style={styles.subjectAddButton}
            >
              <AppText variant="meta" tone="primary" style={styles.subjectChipText}>
                Is it related to an existing medical or care issue?
              </AppText>
            </Pressable>
          )}
        </View>
      ) : null}
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
                {message.subjectRecordId && message.subjectRecordTitle && !message.deletedAt ? (
                  <View style={styles.messageSubjectChip}>
                    <AppText variant="meta" tone="soft" numberOfLines={1}>Re: {message.subjectRecordTitle}</AppText>
                  </View>
                ) : null}
                {isEditing ? (
                  <View style={styles.editWrap}>
                    <TextInput
                      value={editDraft}
                      onChangeText={setEditDraft}
                      onFocus={(event) => revealFocusedInput(event.nativeEvent.target)}
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
  messageSubjectChip: {
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
  subjectArea: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  subjectPanel: {
    gap: spacing.xs,
  },
  subjectTitleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  subjectTitleInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  subjectTitleButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectTitleButtonDisabled: {
    opacity: 0.6,
  },
  subjectAddButton: {
    alignSelf: 'flex-start',
    minHeight: 28,
    justifyContent: 'center',
  },
  subjectChipText: {
    fontWeight: '700',
    flexShrink: 1,
  },
  subjectPicker: {
    marginTop: spacing.xxs,
    maxHeight: 160,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  subjectPickerRow: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
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
