-- Phase 23 slice 9: a single combined "Lilica Chat" overview -- direct
-- product-owner report (23 September 2026): DMing was reachable via a
-- Care Circle member's avatar, but the main "Lilica Chat" entry point
-- only ever showed shared Care Circle conversations, with no way to see
-- your direct messages from there at all. Incoherent -- one entry point,
-- both kinds, but never merged into one undifferentiated list (a DM is
-- private between two people, Care Circle chat is visible to the whole
-- circle) -- the client renders this as two clearly-labelled sections.
--
-- list_my_chat_overview() unions every care_circle conversation the
-- caller can see with every direct conversation they are a participant
-- of (across ALL partners, not just one) -- unlike list_my_conversations,
-- which always needs one specific kind (and, for direct, one specific
-- partner) chosen up front. Same row shape as list_my_conversations plus
-- kind/other_membership_id/other_display_name/other_is_former, so a
-- direct row can be labelled with who it's with. Starting a NEW
-- conversation is unchanged: still start_new_conversation for Care
-- Circle (offered from within this same overview), and still via a
-- Care Circle member for DMs -- this is a read/list surface only.

create function public.list_my_chat_overview(target_care_space_id uuid)
returns table (
  thread_id uuid,
  kind text,
  title text,
  subject_record_id uuid,
  subject_record_title text,
  other_membership_id uuid,
  other_display_name text,
  other_is_former boolean,
  created_at timestamptz,
  last_message_at timestamptz,
  last_message_body text,
  last_message_sender_is_self boolean,
  unread_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  return query
  with rows as (
    select
      t.id as row_thread_id,
      t.kind as row_kind,
      t.title as row_title,
      t.subject_record_id as row_subject_record_id,
      sr.record_data->>'title' as row_subject_record_title,
      other.id as row_other_membership_id,
      case when t.kind <> 'direct' then null
           when other.membership_status = 'former' then coalesce(other.former_display_name, 'Former member')
           else coalesce(p.display_name, 'A Lilica member') end as row_other_display_name,
      (t.kind = 'direct' and other.membership_status = 'former') as row_other_is_former,
      t.created_at as row_created_at,
      (select max(m.created_at) from public.chat_messages m where m.thread_id = t.id) as row_last_message_at,
      (select m.body from public.chat_messages m where m.thread_id = t.id and m.deleted_at is null order by m.created_at desc limit 1) as row_last_message_body,
      (select m.sender_membership_id = caller_membership_id from public.chat_messages m where m.thread_id = t.id order by m.created_at desc limit 1) as row_last_message_sender_is_self,
      coalesce((
        select count(*) from public.chat_messages m
        left join public.chat_thread_reads r on r.thread_id = t.id and r.membership_id = caller_membership_id
        where m.thread_id = t.id
          and m.deleted_at is null
          and m.sender_membership_id <> caller_membership_id
          and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
      ), 0)::integer as row_unread_count
    from public.chat_threads t
    left join public.records sr on sr.id = t.subject_record_id
    left join public.care_space_memberships other
      on t.kind = 'direct' and other.id = (case when t.direct_member_a = caller_membership_id then t.direct_member_b else t.direct_member_a end)
    left join public.profiles p on p.id = other.user_id
    where t.care_space_id = target_care_space_id
      and t.kind in ('care_circle', 'direct')
      and (
        (t.kind = 'care_circle' and public.is_care_space_member(target_care_space_id))
        or (t.kind = 'direct' and caller_membership_id in (t.direct_member_a, t.direct_member_b))
      )
  )
  select row_thread_id, row_kind, row_title, row_subject_record_id, row_subject_record_title, row_other_membership_id, row_other_display_name, row_other_is_former, row_created_at, row_last_message_at, row_last_message_body, row_last_message_sender_is_self, row_unread_count
  from rows
  order by coalesce(row_last_message_at, row_created_at) desc;
end;
$$;

revoke all on function public.list_my_chat_overview(uuid) from public, anon, authenticated;
grant execute on function public.list_my_chat_overview(uuid) to authenticated;
