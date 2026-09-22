-- Fix: delete_care_space() never learned about Phase 23's chat_threads
-- table. chat_threads.care_space_id is `references care_spaces (id) on
-- delete restrict` (deliberately, like every other care-space-scoped
-- table in this schema -- see 20260922120000's own comments), and
-- chat_messages/chat_thread_reads both reference chat_threads(id) the
-- same restrictive way. Since Phase 23 shipped after this RPC was
-- written, removing a care space that has ANY chat activity (even just
-- the shared thread being lazily created) now fails outright with a
-- foreign-key violation -- caught for real today (22 September 2026)
-- trying to remove a stray Apple-review test care space, both via the
-- app's own "Remove" button and this exact RPC called directly.
--
-- Fixed by adding the same three-table cleanup, in the same
-- leaf-tables-first style as the rest of this function, right alongside
-- the other "no further dependents" deletes near its start.

create or replace function public.delete_care_space(target_care_space_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership public.care_space_memberships%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.care_spaces where id = target_care_space_id) then
    return;
  end if;

  select * into caller_membership
  from public.care_space_memberships
  where care_space_id = target_care_space_id
    and user_id = (select auth.uid())
    and membership_status = 'active'
    and role = 'organiser'
  for update;

  if not found then
    raise exception 'Only an active organiser of this care space can remove it' using errcode = '42501';
  end if;

  -- Leaf/history tables with no further dependents.
  delete from public.occurrence_versions
  where occurrence_id in (select id from public.occurrences where care_space_id = target_care_space_id);
  delete from public.occurrence_mutation_receipts where care_space_id = target_care_space_id;
  delete from public.record_mutation_receipts where care_space_id = target_care_space_id;

  -- Phase 23: chat activity for this care space -- chat_thread_reads and
  -- chat_messages both reference chat_threads(id) on delete restrict, so
  -- they must go first, in that order.
  delete from public.chat_thread_reads
  where thread_id in (select id from public.chat_threads where care_space_id = target_care_space_id);
  delete from public.chat_messages where care_space_id = target_care_space_id;
  delete from public.chat_threads where care_space_id = target_care_space_id;

  -- Tables referencing occurrences/records/memberships, none of which are
  -- themselves referenced by anything else deleted below.
  delete from public.assignments where care_space_id = target_care_space_id;

  perform set_config('lilica.deleting_care_space', 'true', true);
  delete from public.care_space_activity where care_space_id = target_care_space_id;
  perform set_config('lilica.deleting_care_space', 'false', true);

  delete from public.record_links where care_space_id = target_care_space_id;
  delete from public.record_attachments where care_space_id = target_care_space_id;

  delete from public.occurrences where care_space_id = target_care_space_id;

  delete from public.recurrence_rules where care_space_id = target_care_space_id;
  delete from public.recurrence_series where care_space_id = target_care_space_id;

  delete from public.records where care_space_id = target_care_space_id;

  delete from public.care_space_contacts where care_space_id = target_care_space_id;
  delete from public.care_space_invitations where care_space_id = target_care_space_id;

  delete from public.care_space_domain_grants
  where membership_id in (select id from public.care_space_memberships where care_space_id = target_care_space_id)
     or granted_by_membership_id in (select id from public.care_space_memberships where care_space_id = target_care_space_id);

  delete from public.care_space_memberships where care_space_id = target_care_space_id;

  delete from public.supported_people where care_space_id = target_care_space_id;

  delete from public.care_spaces where id = target_care_space_id;
end;
$$;
