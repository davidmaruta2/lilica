-- Phase 23 slice 7: a conversation's subject is amendable after the
-- fact -- direct product-owner report (22 September 2026): a message
-- might concern a medical/care issue that isn't logged in Medical Log
-- yet when the conversation starts, so the subject needs to be
-- addable/changeable retrospectively, not locked in at creation only.
--
-- set_conversation_subject() sets BOTH fields directly (either may be
-- null): pass a real record id to link it, a free-text title to rename
-- it, or both null to clear back to no subject. Mutually exclusive, same
-- as start_new_conversation -- a conversation has ONE subject. Any
-- active member who can already access the thread may change it (not
-- restricted to whoever created it -- same "the Care Circle owns this
-- together" spirit as everything else in Lilica Chat).
--
-- Once a conversation's own subject changes, NEW messages sent into it
-- inherit the new value automatically (send_chat_message already reads
-- chat_threads.subject_record_id at send time) -- existing messages'
-- own subject_record_id are untouched (they keep whatever they were
-- tagged with at the time, which is the honest, non-rewriting-history
-- behaviour every other edit in this app already follows).

create function public.set_conversation_subject(
  target_thread_id uuid,
  subject_record_id uuid default null,
  conversation_title text default null
)
returns public.chat_threads
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_thread public.chat_threads%rowtype;
  trimmed_title text;
  subject_record public.records%rowtype;
  subject_domain text;
  result_thread public.chat_threads%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select ct.* into target_thread from public.chat_threads ct where ct.id = target_thread_id;
  if not found or not public.can_access_chat_thread(target_thread_id) then
    raise exception 'Thread not found' using errcode = '42501';
  end if;

  if target_thread.kind not in ('care_circle', 'direct') then
    raise exception 'This conversation does not have an editable subject' using errcode = '22023';
  end if;

  trimmed_title := nullif(btrim(coalesce(conversation_title, '')), '');
  if trimmed_title is not null and char_length(trimmed_title) > 80 then
    raise exception 'Conversation title is too long' using errcode = '22023';
  end if;

  if trimmed_title is not null and subject_record_id is not null then
    raise exception 'A conversation has one subject -- a record or a title, never both' using errcode = '22023';
  end if;

  if subject_record_id is not null then
    select * into subject_record from public.records where id = subject_record_id;
    if not found or subject_record.deleted_at is not null or subject_record.care_space_id <> target_thread.care_space_id then
      raise exception 'Subject record not found' using errcode = '42501';
    end if;

    subject_domain := public.record_domain_for_type(subject_record.record_type);
    if not public.can_access_care_space_records(target_thread.care_space_id, subject_domain, 'read') then
      raise exception 'Insufficient permission for this record domain' using errcode = '42501';
    end if;
  end if;

  update public.chat_threads
  set subject_record_id = set_conversation_subject.subject_record_id,
      title = trimmed_title
  where id = target_thread_id
  returning * into result_thread;

  return result_thread;
end;
$$;

revoke all on function public.set_conversation_subject(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_conversation_subject(uuid, uuid, text) to authenticated;
