// Phase 23: Lilica Chat -- the client boundary for chat_threads/
// chat_messages/chat_thread_reads and their RPCs (supabase/migrations/
// 20260922120000_phase23_lilica_chat.sql, ...120100_lint_fix.sql,
// ...130000_phase23_lilica_chat_direct_messages.sql,
// ...140000_phase23_lilica_chat_record_linked.sql, ...140100_lint_fix.sql,
// ...160000_phase23_lilica_chat_subject_tagging.sql, ...160100_lint_fix.sql,
// ...170000_phase23_lilica_chat_multi_conversation.sql).
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
// Slice 5 (this file, current): multiple conversations, not one endless
// thread. getOrCreateCareCircleThread/getOrCreateDirectThread now mean
// "the most recently active existing conversation, or a fresh first one"
// -- startNewConversation is the only way to deliberately begin a new one
// instead, and listMyConversations lists them all (most recent first) so
// an old one can be reopened.
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
export async function startNewConversation(
  careSpaceId: string,
  kind: 'care_circle' | 'direct',
  otherMembershipId?: string,
  title?: string,
): Promise<Result<string>> {
  const { data, error } = await supabase.rpc('start_new_conversation', {
    target_care_space_id: careSpaceId,
    thread_kind: kind,
    other_membership_id: otherMembershipId ?? null,
    conversation_title: title ?? null,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  return { ok: true, data: data as string };
}

export type ConversationSummary = {
  threadId: string;
  title?: string;
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
      createdAt: row.created_at,
      lastMessageAt: row.last_message_at ?? undefined,
      lastMessageBody: row.last_message_body ?? undefined,
      lastMessageSenderIsSelf: row.last_message_sender_is_self ?? undefined,
      unreadCount: row.unread_count,
    })),
  };
}

// A short, calm fallback label for a conversation with no title of its
// own -- "Conversation started 22 Sept" -- never invents a subject/topic
// it doesn't actually know.
export function conversationLabel(conversation: ConversationSummary): string {
  if (conversation.title) return conversation.title;
  const date = new Date(conversation.createdAt);
  return `Conversation started ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
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
