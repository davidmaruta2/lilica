// Phase 23: Lilica Chat -- the client boundary for chat_threads/
// chat_messages/chat_thread_reads and their RPCs (supabase/migrations/
// 20260922120000_phase23_lilica_chat.sql, ...120100_lint_fix.sql,
// ...130000_phase23_lilica_chat_direct_messages.sql,
// ...140000_phase23_lilica_chat_record_linked.sql, ...140100_lint_fix.sql,
// ...160000_phase23_lilica_chat_subject_tagging.sql, ...160100_lint_fix.sql,
// ...170000_phase23_lilica_chat_multi_conversation.sql,
// ...180000_phase23_lilica_chat_conversation_subject.sql).
// A thin, typed wrapper, same shape as src/activity.ts -- all permission
// filtering (including who may read/write a private direct thread, or a
// record-linked thread gated on that record's own domain access),
// sender-only edit/delete enforcement and unread-count arithmetic live
// server-side.
//
// Slice 1: Lilica Chat -- Care Circle conversations for a care space.
// Slice 2: direct messages -- private conversations between the signed-in
// member and exactly one other Care Circle member.
// Slice 3: record-linked chat -- a conversation thread attached to one
// Medical Log item, created lazily on first message, never just by
// viewing the record -- still exactly ONE thread per record, unchanged
// by slice 5 below.
// Slice 4: subject tagging -- a Lilica Chat or direct message can
// optionally be tagged with a Medical Log record as its subject. That
// message is stored once, in its own conversation, and also surfaces in
// the tagged record's own conversation (listRecordConversation) alongside
// that record's own dedicated thread, if it has one. Direct product-
// owner decision (22 September 2026): DM tagging behaves exactly like
// Lilica Chat tagging -- a tagged DM message becomes visible in the
// record's shared conversation to anyone with that domain's access, a
// deliberate, knowing trade-off, not an oversight.
// Slice 5: multiple conversations, not one endless thread.
// getOrCreateCareCircleThread/getOrCreateDirectThread now mean "the most
// recently active existing conversation, or a fresh first one" --
// startNewConversation is the only way to deliberately begin a new one
// instead, and listMyConversations lists them all (most recent first) so
// an old one can be reopened.
// Slice 6 (this file, current): a conversation's own subject, chosen
// once at creation -- direct product-owner report (22 September 2026):
// the collapsed conversation list gave no indication at all what a
// conversation was about. startNewConversation takes an optional
// subjectRecordId (a real Medical Log record) alongside the existing
// free-text title -- exactly one of the two. Once a conversation has its
// own subject, every message sent into it is automatically tagged with
// it too (send_chat_message, server-side) -- no per-message re-picking.
//
// Photo attachments, read receipts and typing indicators are a
// deliberately separate next slice (see LILICA_CHAT_SCOPE_2026-09-22.txt
// on David's machine).

import { supabase } from './auth/client';
import { friendlyAuthError } from './auth/errors';

export type ChatMessage = {
  id: string;
  threadId: string;
  senderMembershipId: string;
  senderDisplayName: string;
  senderIsFormer: boolean;
  senderIsSelf: boolean;
  body?: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  // Slice 4: only ever set for a message sent into Lilica Chat (never a
  // direct message). subjectRecordTitle is resolved fresh on each read
  // by list_chat_messages/list_record_conversation -- absent on the
  // plain row send_chat_message/edit_chat_message return directly.
  subjectRecordId?: string;
  subjectRecordTitle?: string;
};

// A plain {id, title} option a picker (compose-bar subject picker, or
// "+ New conversation"'s own subject picker) chooses from -- deliberately
// not the full LilicaRecord type, so the screens that use this never need
// to know about record shapes beyond what a picker needs. The host
// (App.tsx) filters the real records list down to Medical Log items.
export type ChatSubjectOption = { id: string; title: string };

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const PAGE_SIZE = 30;

export async function getOrCreateCareCircleThread(careSpaceId: string): Promise<Result<string>> {
  const { data, error } = await supabase.rpc('get_or_create_care_circle_thread', {
    target_care_space_id: careSpaceId,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  return { ok: true, data: data as string };
}

// Idempotent -- the same pair of members always resolves to the same
// thread (server-canonicalised), regardless of who calls this first.
export async function getOrCreateDirectThread(careSpaceId: string, otherMembershipId: string): Promise<Result<string>> {
  const { data, error } = await supabase.rpc('get_or_create_direct_thread', {
    target_care_space_id: careSpaceId,
    other_membership_id: otherMembershipId,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  return { ok: true, data: data as string };
}

// Never creates a thread -- a plain read, safe to call every time a
// Medical Log item's detail view renders. undefined (no data) means no
// conversation has started yet ("Start a conversation about this");
// otherwise messageCount drives "View conversation (N)". messageCount now
// includes Lilica Chat messages tagged with this record as their subject
// (slice 4), not only its own dedicated thread -- threadId can be
// undefined even with messageCount > 0 (every message came from tagging,
// no dedicated thread was ever created) -- getOrCreateRecordThread still
// creates one on demand when the user actually opens/replies in it.
export async function getRecordThreadInfo(recordId: string): Promise<Result<{ threadId?: string; messageCount: number } | undefined>> {
  const { data, error } = await supabase.rpc('get_record_thread_info', { target_record_id: recordId });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  const rows = (data ?? []) as Array<{ thread_id: string | null; message_count: number }>;
  const row = rows[0];
  return { ok: true, data: row ? { threadId: row.thread_id ?? undefined, messageCount: row.message_count } : undefined };
}

// Idempotent -- one thread per record, created lazily the first time
// this is called (i.e. the first time someone actually sends a message).
export async function getOrCreateRecordThread(recordId: string): Promise<Result<string>> {
  const { data, error } = await supabase.rpc('get_or_create_record_thread', { target_record_id: recordId });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  return { ok: true, data: data as string };
}

// Slice 5: the only way to deliberately begin a NEW conversation rather
// than continuing the most recently active one (which
// getOrCreateCareCircleThread/getOrCreateDirectThread return). Never used
// for record-linked chat -- that stays exactly one thread per record.
//
// Slice 6 (22 September 2026 report: the collapsed conversation list gave
// no indication what a conversation was about): a conversation now has
// ONE subject, chosen once at creation -- either a real Medical Log
// record (subjectRecordId) or a free-text title, never both. Passing
// both is rejected server-side (send_chat_message's own check).
export async function startNewConversation(
  careSpaceId: string,
  kind: 'care_circle' | 'direct',
  otherMembershipId?: string,
  title?: string,
  subjectRecordId?: string,
): Promise<Result<string>> {
  const { data, error } = await supabase.rpc('start_new_conversation', {
    target_care_space_id: careSpaceId,
    thread_kind: kind,
    other_membership_id: otherMembershipId ?? null,
    conversation_title: title ?? null,
    subject_record_id: subjectRecordId ?? null,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  return { ok: true, data: data as string };
}

// Slice 7: a conversation's subject is amendable after the fact --
// direct product-owner report (22 September 2026): a message might
// concern a medical/care issue that isn't logged in Medical Log yet when
// the conversation starts. Pass a record id to link/relink it, a
// free-text title to rename it, or neither to clear back to no subject
// -- exactly one of the two, same as startNewConversation. New messages
// sent afterwards inherit the change automatically; already-sent
// messages keep whatever they were tagged with at the time.
export async function setConversationSubject(
  threadId: string,
  options: { title?: string; subjectRecordId?: string },
): Promise<Result<void>> {
  const { error } = await supabase.rpc('set_conversation_subject', {
    target_thread_id: threadId,
    subject_record_id: options.subjectRecordId ?? null,
    conversation_title: options.title ?? null,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  return { ok: true, data: undefined };
}

// Slice 9: a single combined overview -- every Care Circle conversation
// AND every direct message conversation (across all partners), in one
// list. Direct product-owner report (23 September 2026): DMing was
// reachable via a Care Circle member's avatar, but the main "Lilica
// Chat" entry point only ever showed Care Circle conversations, with no
// way to see DMs from there. otherMembershipId/otherDisplayName/
// otherIsFormer are only ever set for a kind='direct' row.
export type ChatOverviewEntry = {
  threadId: string;
  kind: 'care_circle' | 'direct';
  title?: string;
  subjectRecordId?: string;
  subjectRecordTitle?: string;
  otherMembershipId?: string;
  otherDisplayName?: string;
  otherIsFormer?: boolean;
  createdAt: string;
  lastMessageAt?: string;
  lastMessageBody?: string;
  lastMessageSenderIsSelf?: boolean;
  unreadCount: number;
};

export async function listMyChatOverview(careSpaceId: string): Promise<Result<ChatOverviewEntry[]>> {
  const { data, error } = await supabase.rpc('list_my_chat_overview', {
    target_care_space_id: careSpaceId,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  const rows = (data ?? []) as Array<{
    thread_id: string;
    kind: 'care_circle' | 'direct';
    title: string | null;
    subject_record_id: string | null;
    subject_record_title: string | null;
    other_membership_id: string | null;
    other_display_name: string | null;
    other_is_former: boolean | null;
    created_at: string;
    last_message_at: string | null;
    last_message_body: string | null;
    last_message_sender_is_self: boolean | null;
    unread_count: number;
  }>;
  return {
    ok: true,
    data: rows.map((row) => ({
      threadId: row.thread_id,
      kind: row.kind,
      title: row.title ?? undefined,
      subjectRecordId: row.subject_record_id ?? undefined,
      subjectRecordTitle: row.subject_record_title ?? undefined,
      otherMembershipId: row.other_membership_id ?? undefined,
      otherDisplayName: row.other_display_name ?? undefined,
      otherIsFormer: row.other_is_former ?? undefined,
      createdAt: row.created_at,
      lastMessageAt: row.last_message_at ?? undefined,
      lastMessageBody: row.last_message_body ?? undefined,
      lastMessageSenderIsSelf: row.last_message_sender_is_self ?? undefined,
      unreadCount: row.unread_count,
    })),
  };
}

export type ConversationSummary = {
  threadId: string;
  title?: string;
  // Slice 6: resolved fresh on each read (the record's real current
  // title), same as message-level subjects -- never a stale copy.
  subjectRecordId?: string;
  subjectRecordTitle?: string;
  createdAt: string;
  lastMessageAt?: string;
  lastMessageBody?: string;
  lastMessageSenderIsSelf?: boolean;
  unreadCount: number;
};

// Slice 5: every conversation of this kind the caller can access, most
// recently active first -- the data source for a real "past
// conversations, reopen one" list. For kind='direct', otherMembershipId
// is required (lists every DM thread with that one specific person, not
// every DM across everyone).
export async function listMyConversations(
  careSpaceId: string,
  kind: 'care_circle' | 'direct',
  otherMembershipId?: string,
): Promise<Result<ConversationSummary[]>> {
  const { data, error } = await supabase.rpc('list_my_conversations', {
    target_care_space_id: careSpaceId,
    thread_kind: kind,
    other_membership_id: otherMembershipId ?? null,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  const rows = (data ?? []) as Array<{
    thread_id: string;
    title: string | null;
    subject_record_id: string | null;
    subject_record_title: string | null;
    created_at: string;
    last_message_at: string | null;
    last_message_body: string | null;
    last_message_sender_is_self: boolean | null;
    unread_count: number;
  }>;
  return {
    ok: true,
    data: rows.map((row) => ({
      threadId: row.thread_id,
      title: row.title ?? undefined,
      subjectRecordId: row.subject_record_id ?? undefined,
      subjectRecordTitle: row.subject_record_title ?? undefined,
      createdAt: row.created_at,
      lastMessageAt: row.last_message_at ?? undefined,
      lastMessageBody: row.last_message_body ?? undefined,
      lastMessageSenderIsSelf: row.last_message_sender_is_self ?? undefined,
      unreadCount: row.unread_count,
    })),
  };
}

// A conversation's own subject -- a real Medical Log record's current
// title, or a free-text title, or (only when neither was ever set) the
// one, singular default conversation every scope starts with. Never
// invents a topic it doesn't actually know. Redesign (23 September
// 2026): "General" replaces the old "Conversation started <date>"
// fallback -- that date-based label read as if it belonged to the same
// family as a real named topic, which is exactly the ambiguity a direct
// product-owner report called out ("Marion" / "Conversation started 22
// Sept" sitting as two unexplained, disconnected-looking rows).
export function conversationLabel(conversation: ConversationSummary): string {
  if (conversation.subjectRecordTitle) return conversation.subjectRecordTitle;
  if (conversation.title) return conversation.title;
  return 'General';
}

// Whether a conversation has a REAL subject of its own (a linked record
// or a deliberately-chosen title) -- as opposed to conversationLabel()'s
// display fallback, which always returns something to show in a list row
// even when there isn't one. Real device bug (23 September 2026): a
// screen naively treated conversationLabel()'s fallback string as if it
// were a real, editable subject, and offered to "open" a person's name
// or the word "General" as though it were a Medical Log record. Anything
// that decides whether to offer "Change subject"/"Open <record>" must
// check this, never just "is the label non-empty".
export function conversationHasOwnSubject(conversation: ConversationSummary): boolean {
  return Boolean(conversation.subjectRecordTitle || conversation.title);
}

export type DirectThreadSummary = {
  threadId: string;
  otherMembershipId: string;
  otherDisplayName: string;
  otherIsFormer: boolean;
  unreadCount: number;
  lastMessageAt?: string;
};

export async function listMyDirectThreads(careSpaceId: string): Promise<Result<DirectThreadSummary[]>> {
  const { data, error } = await supabase.rpc('list_my_direct_threads', {
    target_care_space_id: careSpaceId,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  const rows = (data ?? []) as Array<{
    thread_id: string;
    other_membership_id: string;
    other_display_name: string;
    other_is_former: boolean;
    unread_count: number;
    last_message_at: string | null;
  }>;
  return {
    ok: true,
    data: rows.map((row) => ({
      threadId: row.thread_id,
      otherMembershipId: row.other_membership_id,
      otherDisplayName: row.other_display_name,
      otherIsFormer: row.other_is_former,
      unreadCount: row.unread_count,
      lastMessageAt: row.last_message_at ?? undefined,
    })),
  };
}

function mapMessageRow(row: {
  id: string;
  thread_id: string;
  sender_membership_id: string;
  sender_display_name: string;
  sender_is_former: boolean;
  sender_is_self: boolean;
  body: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  subject_record_id?: string | null;
  subject_record_title?: string | null;
}): ChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    senderMembershipId: row.sender_membership_id,
    senderDisplayName: row.sender_display_name,
    senderIsFormer: row.sender_is_former,
    senderIsSelf: row.sender_is_self,
    body: row.body ?? undefined,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    subjectRecordId: row.subject_record_id ?? undefined,
    subjectRecordTitle: row.subject_record_title ?? undefined,
  };
}

// Returns messages OLDEST FIRST (reversed from the server's newest-first
// page) -- the natural order for a chat screen's scroll view, matching how
// every chat UI reads top-to-bottom.
export async function listChatMessages(
  threadId: string,
  beforeCreatedAt?: string,
): Promise<Result<{ messages: ChatMessage[]; hasMore: boolean }>> {
  const { data, error } = await supabase.rpc('list_chat_messages', {
    target_thread_id: threadId,
    before_created_at: beforeCreatedAt ?? null,
    page_size: PAGE_SIZE,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  const rows = (data ?? []) as Parameters<typeof mapMessageRow>[0][];
  return {
    ok: true,
    data: {
      messages: rows.map(mapMessageRow).reverse(),
      hasMore: rows.length >= PAGE_SIZE,
    },
  };
}

// Slice 4: a record's FULL conversation -- its own dedicated
// record-linked thread (if any) plus any Lilica Chat messages tagged
// with it as subject, merged newest-first then reversed to oldest-first
// same as listChatMessages. This is what RecordDetail's "View
// conversation" should actually open for a Medical Log item, not
// listChatMessages against a single thread id -- a record's messages can
// now live in two different threads at once.
export async function listRecordConversation(
  recordId: string,
  beforeCreatedAt?: string,
): Promise<Result<{ messages: ChatMessage[]; hasMore: boolean }>> {
  const { data, error } = await supabase.rpc('list_record_conversation', {
    target_record_id: recordId,
    before_created_at: beforeCreatedAt ?? null,
    page_size: PAGE_SIZE,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  const rows = (data ?? []) as Array<Parameters<typeof mapMessageRow>[0] & { via_lilica_chat: boolean }>;
  return {
    ok: true,
    data: {
      messages: rows.map(mapMessageRow).reverse(),
      hasMore: rows.length >= PAGE_SIZE,
    },
  };
}

export async function sendChatMessage(threadId: string, body: string, subjectRecordId?: string): Promise<Result<ChatMessage>> {
  const { data, error } = await supabase.rpc('send_chat_message', {
    target_thread_id: threadId,
    message_body: body,
    subject_record_id: subjectRecordId ?? null,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  return { ok: true, data: mapMessageRow(data as Parameters<typeof mapMessageRow>[0]) };
}

export async function editChatMessage(messageId: string, body: string): Promise<Result<ChatMessage>> {
  const { data, error } = await supabase.rpc('edit_chat_message', {
    target_message_id: messageId,
    new_body: body,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  return { ok: true, data: mapMessageRow(data as Parameters<typeof mapMessageRow>[0]) };
}

export async function deleteChatMessage(messageId: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('delete_chat_message', { target_message_id: messageId });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  return { ok: true, data: undefined };
}

export async function markChatThreadRead(threadId: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('mark_chat_thread_read', { target_thread_id: threadId });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  return { ok: true, data: undefined };
}

export async function getChatUnreadCount(careSpaceId: string): Promise<Result<number>> {
  const { data, error } = await supabase.rpc('get_chat_unread_count', {
    target_care_space_id: careSpaceId,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  return { ok: true, data: (data as number) ?? 0 };
}

// A short, calm preview line for the Lilica Chat card -- "Sarah: Picking
// up the..." -- truncated on word boundaries where practical, never mid-
// word. Deleted messages show the same honest placeholder the thread
// screen itself will use, never blank.
export function previewChatMessage(message: ChatMessage, maxLength = 60): string {
  const who = message.senderIsSelf ? 'You' : message.senderDisplayName;
  const text = message.deletedAt ? 'Message deleted' : (message.body ?? '');
  if (text.length <= maxLength) return `${who}: ${text}`;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${who}: ${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}
