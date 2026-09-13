-- Remove-supported-person: a real, previously-missing organiser capability.
--
-- Direct product-owner question ("as organiser, how do I remove a supported
-- person if they no longer need support?") surfaced a genuine gap: no
-- function anywhere in this schema actually deletes a care space and its
-- data. delete_my_account() only ever DETACHES memberships (Phase 18B) --
-- the care space and every record under it survive forever, ownerless.
-- leave_care_space()/remove_member() only ever end ONE membership. This
-- migration adds the one thing that was missing: a genuine, irreversible,
-- organiser-initiated deletion of an entire care space and everything it
-- owns.
--
-- Scope, deliberately narrow: this is the removal path for a supported
-- person who no longer needs support, not a new account-lifecycle concept.
-- It reuses the exact existing care-space/organiser/RLS model -- no new
-- table, no new role, no new permission concept. Any active organiser of
-- the target care space may call it (mirroring remove_member()'s own "any
-- active organiser" authority, not requiring sole-organiser status --
-- deleting the space is squarely within an organiser's existing ceiling of
-- authority over it, the same authority that already lets them remove any
-- member or change any role).
--
-- Every table with a foreign key to care_spaces (or transitively to
-- records/occurrences/recurrence_rules/recurrence_series/care_space_
-- memberships) uses ON DELETE RESTRICT, not CASCADE (confirmed by direct
-- inspection of information_schema.referential_constraints before writing
-- this function, not assumed) -- this is deliberate defence-in-depth
-- elsewhere in the schema, but means a genuine full deletion must delete
-- every dependent row itself, in the correct dependency order, or the
-- final `delete from care_spaces` fails outright. The order below was
-- derived directly from that FK graph: leaf/history tables first
-- (occurrence_versions, the two mutation-receipt ledgers), then anything
-- referencing occurrences/records/recurrence state (assignments, activity,
-- links, attachments), then occurrences themselves, then recurrence_rules/
-- recurrence_series (occurrences reference both), then records, then the
-- remaining care-space-level tables (contacts, invitations), then
-- memberships (referenced by nearly everything above), then
-- supported_people, and finally care_spaces itself.
--
-- care_space_activity's own immutability trigger (Phase 20B) unconditionally
-- blocks every update AND delete against it -- a genuine second obstacle
-- found only by running the tests below, not by reading the schema (the
-- trigger's own name only describes "immutable", the actual code blocks
-- delete too). Narrowed here to the exact same deliberate-single-exception
-- pattern already established for entitlement_events' own immutability
-- trigger (Phase 21B): a transaction-local flag, set only inside
-- delete_care_space() immediately around its own activity purge, is the
-- one thing that may bypass it -- a raw client delete/update is still
-- rejected exactly as before.
create or replace function public.care_space_activity_is_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('lilica.deleting_care_space', true), '') = 'true' then
    return old;
  end if;
  raise exception 'Activity events are immutable' using errcode = '42501';
end;
$$;

-- Storage cleanup (the private document-attachments bucket) cannot happen
-- inside this function -- Postgres has no access to Storage objects. The
-- client (src/careSpaces.ts) fetches every attachment's storage_object_path
-- for this care space BEFORE calling this function, then best-effort
-- removes those objects from Storage afterward, queuing any failure for
-- retry via the same durable AsyncStorage-backed mechanism Phase 18 already
-- built for document cleanup (src/documentCleanupQueue.ts) -- reused, not
-- duplicated.
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

  -- Idempotency: a retry against a care space already deleted (the client
  -- never saw the first call's response, or the app was closed mid-call)
  -- is a safe, silent no-op -- the terminal state is already reached.
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

  -- Tables referencing occurrences/records/memberships, none of which are
  -- themselves referenced by anything else deleted below.
  delete from public.assignments where care_space_id = target_care_space_id;

  -- See the care_space_activity_is_immutable() trigger's own comment above
  -- -- this is the one deliberate, narrow, transaction-scoped exception to
  -- it. Reset immediately after so nothing else in this same transaction
  -- could ever rely on the flag still being set.
  perform set_config('lilica.deleting_care_space', 'true', true);
  delete from public.care_space_activity where care_space_id = target_care_space_id;
  perform set_config('lilica.deleting_care_space', 'false', true);

  delete from public.record_links where care_space_id = target_care_space_id;
  delete from public.record_attachments where care_space_id = target_care_space_id;

  -- Occurrences reference records AND recurrence_rules AND
  -- recurrence_series -- must be gone before any of those three.
  delete from public.occurrences where care_space_id = target_care_space_id;

  -- recurrence_rules references recurrence_series and records -- must be
  -- gone before both.
  delete from public.recurrence_rules where care_space_id = target_care_space_id;
  delete from public.recurrence_series where care_space_id = target_care_space_id;

  -- Records themselves, once nothing above still references them.
  delete from public.records where care_space_id = target_care_space_id;

  -- Remaining care-space-level tables referencing memberships.
  delete from public.care_space_contacts where care_space_id = target_care_space_id;
  delete from public.care_space_invitations where care_space_id = target_care_space_id;

  -- care_space_domain_grants.membership_id cascades automatically (the
  -- one genuine ON DELETE CASCADE in this whole graph), but its OWN
  -- granted_by_membership_id column is a separate, non-cascading FK
  -- (confirmed only by running this exact deletion, not by the earlier
  -- inspection pass -- an organiser's own membership row could not be
  -- deleted while a grant they once ISSUED to someone else still pointed
  -- back at them). Both directions are always intra-space (only an
  -- organiser of THIS care space can grant one of its own domains), so
  -- deleting every grant row via either column, scoped to this care
  -- space's own memberships, is correct and complete.
  delete from public.care_space_domain_grants
  where membership_id in (select id from public.care_space_memberships where care_space_id = target_care_space_id)
     or granted_by_membership_id in (select id from public.care_space_memberships where care_space_id = target_care_space_id);

  delete from public.care_space_memberships where care_space_id = target_care_space_id;

  -- supported_people has no dependents of its own (confirmed by
  -- inspection -- nothing in this schema references supported_people.id).
  delete from public.supported_people where care_space_id = target_care_space_id;

  -- The care space itself, last.
  delete from public.care_spaces where id = target_care_space_id;
end;
$$;

revoke all on function public.delete_care_space(uuid) from public;
revoke all on function public.delete_care_space(uuid) from anon;
grant execute on function public.delete_care_space(uuid) to authenticated;
