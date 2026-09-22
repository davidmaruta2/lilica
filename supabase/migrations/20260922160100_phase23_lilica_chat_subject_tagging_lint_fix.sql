-- Phase 23 slice 4 lint fix: list_record_conversation's RETURNS TABLE
-- declares an output column named `id`, which the function body's own
-- `where id = target_record_id` then collided with (public.records.id vs
-- the PL/pgSQL output variable) -- the same class of bug as
-- 20260922120100 and 20260922140100's fixes. Fixed by table-aliasing the
-- lookup, same signature.

create or replace function public.list_record_conversation(
  target_record_id uuid,
  before_created_at timestamptz default null,
  page_size integer default 30
)
returns table (
  id uuid,
  thread_id uuid,
  sender_membership_id uuid,
  sender_display_name text,
  sender_is_former boolean,
  sender_is_self boolean,
  body text,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  via_lilica_chat boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_record public.records%rowtype;
  record_domain text;
  caller_membership_id uuid;
  record_thread_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select r.* into target_record from public.records r where r.id = target_record_id;
  if not found then
    raise exception 'Record not found' using errcode = '42501';
  end if;

  record_domain := public.record_domain_for_type(target_record.record_type);
  if not public.can_access_care_space_records(target_record.care_space_id, record_domain, 'read') then
    raise exception 'Insufficient permission for this record domain' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_record.care_space_id);

  select ct.id into record_thread_id from public.chat_threads ct where ct.record_id = target_record_id and ct.kind = 'record';

  return query
  with combined as (
    select m.id, m.thread_id, m.sender_membership_id, m.body, m.created_at, m.edited_at, m.deleted_at,
           (record_thread_id is not null and m.thread_id = record_thread_id) as row_via_thread
    from public.chat_messages m
    where (record_thread_id is not null and m.thread_id = record_thread_id)
       or m.subject_record_id = target_record_id
  )
  select
    c.id, c.thread_id, c.sender_membership_id,
    case when mm.membership_status = 'former' then coalesce(mm.former_display_name, 'Former member')
         else coalesce(p.display_name, 'A Lilica member') end,
    mm.membership_status = 'former',
    c.sender_membership_id = caller_membership_id,
    c.body, c.created_at, c.edited_at, c.deleted_at,
    not c.row_via_thread
  from combined c
  left join public.care_space_memberships mm on mm.id = c.sender_membership_id
  left join public.profiles p on p.id = mm.user_id
  where before_created_at is null or c.created_at < before_created_at
  order by c.created_at desc
  limit greatest(1, least(coalesce(page_size, 30), 100));
end;
$$;
