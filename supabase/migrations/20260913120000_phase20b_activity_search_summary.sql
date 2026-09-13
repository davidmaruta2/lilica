-- Phase 20B: Recent Activity / Care History foundation.
--
-- Search (Feature B) and Care Summary (Feature C) need no schema change --
-- both are client-side projections over records/care-circle data already
-- synced locally, per this phase's own "one source of truth, multiple
-- projections" principle (see docs/PHASE_20_ARCHITECTURE.md). Only Feature
-- A (Recent Activity) requires new, append-only server state, since it must
-- truthfully reflect OTHER Care Circle members' actions, not just this
-- device's own local mutations.
--
-- No true immutable cross-record activity/event store existed before this
-- migration (confirmed by inspection: record_mutation_receipts is an
-- idempotency ledger keyed by operation_id, not a queryable activity feed,
-- and carries no human-readable "what changed" semantics). This migration
-- adds the smallest correct one, and reuses record_mutation_receipts'
-- established actor_membership_id/security-definer/RLS conventions rather
-- than inventing new ones.
--
-- Per the brief's explicit anti-fabrication instruction (section 6), this
-- table starts EMPTY -- no historical backfill is attempted. Activity is
-- generated only for events from this migration forward, by extending the
-- existing mutation RPCs (apply_record_mutation, mark_attachment_upload_status,
-- accept_invitation, remove_member, leave_care_space) at the exact point
-- each already knows a real, authoritative state transition occurred.
-- Nothing here infers or guesses who did something in the past.

create table public.care_space_activity (
  id uuid primary key,
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  -- The membership this event is ATTRIBUTED to -- the actor for
  -- record/document events, or the subject member for member-lifecycle
  -- events (member_joined/member_left/member_removed use the joining/
  -- leaving/removed membership itself, not whoever performed the removal --
  -- see docs/PHASE_20_ARCHITECTURE.md for why this reading was chosen).
  -- Never deleted when a membership is later detached/revoked/former --
  -- historical attribution survives; only current security access changes,
  -- exactly like every other historically-attributed row in this schema
  -- (records.created_by_membership_id, assignments, etc).
  actor_membership_id uuid not null references public.care_space_memberships (id) on delete restrict,
  event_type text not null,
  -- Null for member-lifecycle events; the record this event concerns for
  -- everything else. Never hard-deleted (records/attachments are always
  -- soft-deleted), so this reference always resolves for as long as the
  -- activity row itself exists.
  record_id uuid references public.records (id) on delete restrict,
  -- Copied at insert time (never a live join) so this row's own permission
  -- filtering never depends on the referenced record still existing in a
  -- particular state -- 'general' for member-lifecycle events, matching
  -- every active member's baseline visibility.
  record_domain text not null,
  -- Small, deliberately non-sensitive descriptive fields only (a title, a
  -- record type, an attachment display name, the new assignee's membership
  -- id) -- never a duplicate copy of sensitive record content, never an
  -- email address (brief section 12).
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint care_space_activity_event_type check (event_type in (
    'record_created', 'record_completed', 'record_reopened',
    'assignment_changed', 'date_changed', 'document_uploaded',
    'member_joined', 'member_left', 'member_removed'
  )),
  constraint care_space_activity_domain check (record_domain in ('general', 'health', 'financial', 'home', 'documents')),
  constraint care_space_activity_metadata_object check (jsonb_typeof(metadata) = 'object')
);

-- Immutable by convention (no update/delete grant is ever given to
-- authenticated -- see the revokes below); an explicit trigger closes the
-- gap for completeness and to make the immutability guarantee testable.
create function public.care_space_activity_is_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Activity events are immutable' using errcode = '42501';
end;
$$;

revoke all on function public.care_space_activity_is_immutable() from public;
create trigger care_space_activity_no_update
before update on public.care_space_activity
for each row execute function public.care_space_activity_is_immutable();
create trigger care_space_activity_no_delete
before delete on public.care_space_activity
for each row execute function public.care_space_activity_is_immutable();

create index care_space_activity_space_created_idx on public.care_space_activity (care_space_id, created_at desc);

alter table public.care_space_activity enable row level security;
alter table public.care_space_activity force row level security;

revoke all on table public.care_space_activity from anon, authenticated;
grant select on table public.care_space_activity to authenticated;

-- Reuses the exact same domain-grant decision every record/occurrence read
-- already uses (see 20260911120000_phase15_care_circle.sql) -- an activity
-- row about a financial-domain record is invisible to a member without
-- financial read access, for exactly the same reason the record itself
-- would be. Former/revoked members reading as themselves get nothing (no
-- active membership row matches), independent of whose actions the
-- activity rows describe.
create policy "active members can read authorised activity"
on public.care_space_activity for select to authenticated
using (public.can_access_care_space_records(care_space_id, record_domain, 'read'));

comment on table public.care_space_activity is
  'Phase 20B: append-only, truthful-only-from-this-point-forward activity log. Never backfilled. Permission-filtered identically to the record it concerns.';

-- ---------------------------------------------------------------------
-- Internal helper, not exposed to authenticated directly (no execute grant
-- below) -- only the security-definer mutation RPCs below call it, and a
-- security-definer function runs as its owner regardless of grants on
-- functions it calls internally. Centralising the insert here means every
-- call site only needs to say WHAT happened, not how to write the row.
-- ---------------------------------------------------------------------

create function public.log_care_space_activity(
  target_care_space_id uuid,
  actor_membership_id uuid,
  event_type text,
  target_record_id uuid,
  target_domain text,
  event_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.care_space_activity (
    id, care_space_id, actor_membership_id, event_type, record_id, record_domain, metadata
  ) values (
    gen_random_uuid(), target_care_space_id, actor_membership_id, event_type, target_record_id,
    coalesce(target_domain, 'general'), coalesce(event_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_care_space_activity(uuid, uuid, text, uuid, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Read path: list_recent_activity. Deliberately does NOT gate on the
-- caller having 'general' domain access (a contributor might only ever
-- have been granted, say, 'financial' access, and must still be able to
-- open Recent Activity and see just their own domain's events) -- the
-- per-row can_access_care_space_records() check does the real filtering,
-- identical in shape to how the `records` table's own RLS policy works.
-- Idempotency-safe pagination: strictly-less-than on created_at, so a
-- caller paging through never re-sees or skips a row even if new activity
-- is inserted between pages.
-- ---------------------------------------------------------------------

create function public.list_recent_activity(
  target_care_space_id uuid,
  before_created_at timestamptz default null,
  page_size integer default 20
)
returns table (
  id uuid,
  event_type text,
  record_id uuid,
  record_domain text,
  metadata jsonb,
  created_at timestamptz,
  actor_membership_id uuid,
  actor_display_name text,
  actor_is_former boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id, a.event_type, a.record_id, a.record_domain, a.metadata, a.created_at,
    a.actor_membership_id,
    case when m.membership_status = 'former' then coalesce(m.former_display_name, 'Former member')
         else coalesce(p.display_name, 'A Lilica member') end,
    m.membership_status = 'former'
  from public.care_space_activity a
  left join public.care_space_memberships m on m.id = a.actor_membership_id
  left join public.profiles p on p.id = m.user_id
  where a.care_space_id = target_care_space_id
    and public.can_access_care_space_records(target_care_space_id, a.record_domain, 'read')
    and (before_created_at is null or a.created_at < before_created_at)
  order by a.created_at desc
  limit greatest(1, least(coalesce(page_size, 20), 100));
$$;

revoke all on function public.list_recent_activity(uuid, timestamptz, integer) from public;
revoke all on function public.list_recent_activity(uuid, timestamptz, integer) from anon;
grant execute on function public.list_recent_activity(uuid, timestamptz, integer) to authenticated;

comment on function public.list_recent_activity(uuid, timestamptz, integer) is
  'Phase 20B: bounded, paginated, permission-filtered recent-activity read for the People screen. Never returns an event the caller could not already see the underlying record/domain for.';

-- ---------------------------------------------------------------------
-- Extend apply_record_mutation (same signature, same established
-- redefinition pattern Phase 15 already used) to log a meaningful,
-- truthful activity event at the exact point each transition is already
-- known to be genuine. Idempotency comes for free: a replayed operation_id
-- short-circuits to the existing 'duplicate' branch above the point where
-- any of this new code runs, so a retried outbox mutation never logs
-- twice. Only genuinely meaningful transitions are logged (brief section
-- 5/6) -- a plain notes/title/amount edit with none of these also
-- changing intentionally produces no activity event, to keep the feed
-- calm rather than noisy.
-- ---------------------------------------------------------------------

create or replace function public.apply_record_mutation(
  operation_id uuid,
  target_record_id uuid,
  target_care_space_id uuid,
  mutation_kind text,
  base_version integer,
  mutation_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  existing_receipt public.record_mutation_receipts%rowtype;
  current_record public.records%rowtype;
  result_record public.records%rowtype;
  payload_type text;
  payload_local_id text;
  payload_data jsonb;
  payload_responsibility text;
  payload_attachments jsonb;
  base_data jsonb;
  base_responsibility text;
  base_attachments jsonb;
  merged_data jsonb;
  merged_responsibility text;
  merged_attachments jsonb;
  changed_key text;
  derived_source text;
  derived_responsibility_source text;
  mutation_domain text;
  assignee_id text;
  activity_type text;
  old_completed boolean;
  new_completed boolean;
  old_assigned text;
  new_assigned text;
  old_due text;
  new_due text;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  if mutation_kind not in ('create', 'import', 'update', 'delete') then
    raise exception 'Unsupported record mutation' using errcode = '22023';
  end if;

  select * into existing_receipt
  from public.record_mutation_receipts receipt
  where receipt.operation_id = apply_record_mutation.operation_id;

  if found then
    if existing_receipt.care_space_id <> target_care_space_id
      or existing_receipt.record_id <> target_record_id
      or existing_receipt.actor_membership_id <> caller_membership_id
      or existing_receipt.mutation_kind <> mutation_kind then
      raise exception 'Operation identity cannot be reused' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'status', 'duplicate',
      'version', existing_receipt.result_version,
      'change_sequence', existing_receipt.result_change_sequence
    );
  end if;

  if mutation_kind in ('create', 'import', 'update') then
    if mutation_payload is null or jsonb_typeof(mutation_payload) <> 'object' then
      raise exception 'Record payload must be an object' using errcode = '22023';
    end if;
    payload_type := mutation_payload->>'record_type';
    payload_local_id := mutation_payload->>'local_record_id';
    payload_data := mutation_payload->'record_data';
    payload_responsibility := nullif(mutation_payload->>'legacy_responsibility_text', '');
    payload_attachments := coalesce(mutation_payload->'attachment_manifest', '[]'::jsonb);
    base_data := mutation_payload->'base_record_data';
    base_responsibility := nullif(mutation_payload->>'base_legacy_responsibility_text', '');
    base_attachments := mutation_payload->'base_attachment_manifest';

    if payload_type not in ('appointment', 'task', 'bill', 'homeMatter', 'document', 'contact', 'careNote', 'update')
      or char_length(coalesce(payload_local_id, '')) < 1
      or jsonb_typeof(payload_data) <> 'object'
      or jsonb_typeof(payload_attachments) <> 'array' then
      raise exception 'Invalid record payload' using errcode = '22023';
    end if;

    mutation_domain := public.record_domain_for_type(payload_type);
    if not public.can_access_care_space_records(target_care_space_id, mutation_domain, 'write') then
      raise exception 'Insufficient permission for this record domain' using errcode = '42501';
    end if;
  end if;

  if mutation_kind in ('create', 'import') then
    if base_version <> 0 then
      return jsonb_build_object('status', 'conflict', 'reason', 'invalid_create_base');
    end if;

    select * into current_record from public.records where id = target_record_id for update;
    if found then
      return jsonb_build_object('status', 'conflict', 'reason', 'record_already_exists', 'version', current_record.version);
    end if;

    derived_source := case mutation_kind when 'import' then 'phase1_import' else 'native' end;
    derived_responsibility_source := case
      when payload_responsibility is null then null
      when mutation_kind = 'import' then 'legacy_local_record'
      else 'native_free_text'
    end;

    assignee_id := payload_data->>'assignedMembershipId';
    if assignee_id is not null then
      if not exists (
        select 1 from public.care_space_memberships assignee
        where assignee.id = assignee_id::uuid
          and assignee.care_space_id = target_care_space_id
          and assignee.membership_status = 'active'
      ) or not public.membership_has_domain_access(assignee_id::uuid, mutation_domain, 'read') then
        raise exception 'Assignee does not have access to this record' using errcode = '42501';
      end if;
    end if;

    insert into public.records (
      id, care_space_id, local_record_id, record_type, record_data,
      legacy_responsibility_text, responsibility_source, attachment_manifest,
      source, created_by_membership_id, updated_by_membership_id
    ) values (
      target_record_id, target_care_space_id, payload_local_id, payload_type, payload_data,
      payload_responsibility, derived_responsibility_source, payload_attachments,
      derived_source, caller_membership_id, caller_membership_id
    ) returning * into result_record;

    -- Phase 20B: a genuine new record just came into existence -- a
    -- meaningful, truthful "David added a task" (etc) event.
    perform public.log_care_space_activity(
      target_care_space_id, caller_membership_id, 'record_created', result_record.id, result_record.record_domain,
      jsonb_build_object('recordType', result_record.record_type, 'title', result_record.record_data->>'title')
    );
  else
    select * into current_record
    from public.records
    where id = target_record_id and care_space_id = target_care_space_id
    for update;

    if not found then
      return jsonb_build_object('status', 'conflict', 'reason', 'record_missing');
    end if;

    if mutation_kind = 'delete' then
      mutation_domain := public.record_domain_for_type(current_record.record_type);
      if not public.can_access_care_space_records(target_care_space_id, mutation_domain, 'write') then
        raise exception 'Insufficient permission for this record domain' using errcode = '42501';
      end if;
    end if;

    if current_record.deleted_at is not null then
      return jsonb_build_object('status', 'conflict', 'reason', 'record_deleted', 'version', current_record.version);
    end if;

    if mutation_kind = 'update' then
      if payload_type <> current_record.record_type or payload_local_id <> current_record.local_record_id then
        raise exception 'Record identity cannot be changed' using errcode = '42501';
      end if;
      merged_data := payload_data;
      merged_responsibility := payload_responsibility;
      merged_attachments := payload_attachments;

      if current_record.version <> base_version then
        if jsonb_typeof(base_data) <> 'object' or jsonb_typeof(base_attachments) <> 'array' then
          return jsonb_build_object('status', 'conflict', 'reason', 'stale_version', 'version', current_record.version);
        end if;
        merged_data := current_record.record_data;
        for changed_key in select key from jsonb_object_keys(payload_data || base_data) as key
        loop
          if payload_data->changed_key is distinct from base_data->changed_key
            or (payload_data ? changed_key) <> (base_data ? changed_key) then
            if current_record.record_data->changed_key is distinct from base_data->changed_key
              or (current_record.record_data ? changed_key) <> (base_data ? changed_key) then
              return jsonb_build_object('status', 'conflict', 'reason', 'same_field', 'field', changed_key, 'version', current_record.version);
            end if;
            if payload_data ? changed_key then
              merged_data := jsonb_set(merged_data, array[changed_key], payload_data->changed_key, true);
            else
              merged_data := merged_data - changed_key;
            end if;
          end if;
        end loop;
        if payload_responsibility is distinct from base_responsibility then
          if current_record.legacy_responsibility_text is distinct from base_responsibility then
            return jsonb_build_object('status', 'conflict', 'reason', 'same_field', 'field', 'legacy_responsibility_text', 'version', current_record.version);
          end if;
        else
          merged_responsibility := current_record.legacy_responsibility_text;
        end if;
        if payload_attachments is distinct from base_attachments then
          if current_record.attachment_manifest is distinct from base_attachments then
            return jsonb_build_object('status', 'conflict', 'reason', 'same_field', 'field', 'attachment_manifest', 'version', current_record.version);
          end if;
        else
          merged_attachments := current_record.attachment_manifest;
        end if;
      end if;

      assignee_id := merged_data->>'assignedMembershipId';
      if assignee_id is not null then
        if not exists (
          select 1 from public.care_space_memberships assignee
          where assignee.id = assignee_id::uuid
            and assignee.care_space_id = target_care_space_id
            and assignee.membership_status = 'active'
        ) or not public.membership_has_domain_access(assignee_id::uuid, mutation_domain, 'read') then
          raise exception 'Assignee does not have access to this record' using errcode = '42501';
        end if;
      end if;

      derived_responsibility_source := case
        when merged_responsibility is null then null
        when current_record.responsibility_source = 'legacy_local_record'
          and merged_responsibility is not distinct from current_record.legacy_responsibility_text
          then 'legacy_local_record'
        else 'native_free_text'
      end;
      update public.records
      set record_data = merged_data,
          legacy_responsibility_text = merged_responsibility,
          responsibility_source = derived_responsibility_source,
          attachment_manifest = merged_attachments,
          updated_by_membership_id = caller_membership_id
      where id = target_record_id
      returning * into result_record;

      -- Phase 20B: derive at most one meaningful activity event from a
      -- truthful before/after comparison of the record's own stored data
      -- -- never fabricated, never guessing intent beyond what the data
      -- itself proves changed. Checked in this order because a record
      -- that is completed AND reassigned in the same save should surface
      -- as completion (the more significant change) rather than
      -- assignment. A plain edit (notes/title/amount/etc, none of these
      -- fields) intentionally produces no event.
      old_completed := coalesce((current_record.record_data->>'completed')::boolean, false);
      new_completed := coalesce((result_record.record_data->>'completed')::boolean, false);
      old_assigned := current_record.record_data->>'assignedMembershipId';
      new_assigned := result_record.record_data->>'assignedMembershipId';
      old_due := coalesce(current_record.record_data->>'dueDate', current_record.record_data->>'eventDate');
      new_due := coalesce(result_record.record_data->>'dueDate', result_record.record_data->>'eventDate');

      activity_type := null;
      if new_completed and not old_completed then
        activity_type := 'record_completed';
      elsif old_completed and not new_completed then
        activity_type := 'record_reopened';
      elsif new_assigned is distinct from old_assigned then
        activity_type := 'assignment_changed';
      elsif new_due is distinct from old_due then
        activity_type := 'date_changed';
      end if;

      if activity_type is not null then
        perform public.log_care_space_activity(
          target_care_space_id, caller_membership_id, activity_type, result_record.id, result_record.record_domain,
          jsonb_build_object(
            'recordType', result_record.record_type,
            'title', result_record.record_data->>'title',
            'assignedMembershipId', new_assigned
          )
        );
      end if;
    else
      if current_record.version <> base_version then
        return jsonb_build_object('status', 'conflict', 'reason', 'stale_version', 'version', current_record.version);
      end if;
      update public.records
      set deleted_at = statement_timestamp(),
          updated_by_membership_id = caller_membership_id
      where id = target_record_id
      returning * into result_record;
      -- Deletion is deliberately NOT logged as activity this phase (brief
      -- section 5 does not list it among meaningful examples, and a
      -- deleted-record reference would need its own careful permission
      -- treatment) -- see docs/PHASE_20_ARCHITECTURE.md's named scope note.
    end if;
  end if;

  insert into public.record_mutation_receipts (
    operation_id, care_space_id, record_id, actor_membership_id, mutation_kind,
    result_version, result_change_sequence
  ) values (
    operation_id, target_care_space_id, target_record_id, caller_membership_id, mutation_kind,
    result_record.version, result_record.change_sequence
  );

  return jsonb_build_object(
    'status', 'applied',
    'version', result_record.version,
    'change_sequence', result_record.change_sequence
  );
end;
$$;

revoke all on function public.apply_record_mutation(uuid, uuid, uuid, text, integer, jsonb) from public;
revoke all on function public.apply_record_mutation(uuid, uuid, uuid, text, integer, jsonb) from anon;
grant execute on function public.apply_record_mutation(uuid, uuid, uuid, text, integer, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- mark_attachment_upload_status: log a real, byte-confirmed document
-- upload -- only on a genuine transition INTO 'uploaded' (never on a
-- retry that was already uploaded, and never merely on upload having been
-- attempted/failed).
-- ---------------------------------------------------------------------

create or replace function public.mark_attachment_upload_status(target_attachment_id uuid, new_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attachment_row public.record_attachments%rowtype;
  owning_record public.records%rowtype;
  caller_membership_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if new_status not in ('pending', 'uploaded', 'failed') then
    raise exception 'Unsupported upload status' using errcode = '22023';
  end if;

  select * into attachment_row from public.record_attachments where id = target_attachment_id and deleted_at is null;
  if not found then
    raise exception 'Attachment not found' using errcode = '42501';
  end if;

  select * into owning_record from public.records where id = attachment_row.record_id;

  if not public.can_access_care_space_records(attachment_row.care_space_id, owning_record.record_domain, 'write') then
    raise exception 'Insufficient permission for this record domain' using errcode = '42501';
  end if;

  update public.record_attachments
  set upload_status = new_status, updated_at = statement_timestamp()
  where id = target_attachment_id;

  if new_status = 'uploaded' and attachment_row.upload_status is distinct from 'uploaded' then
    caller_membership_id := public.active_care_space_membership_id(attachment_row.care_space_id);
    if caller_membership_id is not null then
      perform public.log_care_space_activity(
        attachment_row.care_space_id, caller_membership_id, 'document_uploaded', attachment_row.record_id, owning_record.record_domain,
        jsonb_build_object('recordType', owning_record.record_type, 'title', owning_record.record_data->>'title', 'attachmentName', attachment_row.display_name)
      );
    end if;
  end if;
end;
$$;

revoke all on function public.mark_attachment_upload_status(uuid, text) from public;
revoke all on function public.mark_attachment_upload_status(uuid, text) from anon;
grant execute on function public.mark_attachment_upload_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Care Circle lifecycle events. Attributed to the SUBJECT membership
-- (the person who joined/left/was removed), not whoever performed a
-- removal -- see the care_space_activity.actor_membership_id comment
-- above. Each of these RPCs already fails outright on a retry (the
-- invitation is no longer 'pending'; the membership is no longer
-- 'active') before reaching this new code, so a retried call can never
-- log a duplicate lifecycle event.
-- ---------------------------------------------------------------------

create or replace function public.accept_invitation(
  target_invitation_id uuid,
  operation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_email text;
  invitation public.care_space_invitations%rowtype;
  new_membership_id uuid;
  domain_value text;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select lower(email) into caller_email from auth.users where id = (select auth.uid());

  select * into invitation
  from public.care_space_invitations
  where id = target_invitation_id
  for update;

  if not found or caller_email is null or lower(invitation.invitee_email) <> caller_email then
    raise exception 'Invitation not found' using errcode = '42501';
  end if;

  if invitation.status <> 'pending' or invitation.expires_at <= now() then
    if invitation.status = 'pending' then
      update public.care_space_invitations set status = 'expired' where id = invitation.id;
    end if;
    raise exception 'This invitation is no longer open' using errcode = '22023';
  end if;

  select id into new_membership_id
  from public.care_space_memberships
  where care_space_id = invitation.care_space_id
    and user_id = (select auth.uid());

  if new_membership_id is not null then
    update public.care_space_memberships
    set role = invitation.role,
        relationship_type = invitation.relationship_type,
        relationship_label = invitation.relationship_label,
        membership_status = 'active'
    where id = new_membership_id;
    delete from public.care_space_domain_grants where membership_id = new_membership_id;
  else
    insert into public.care_space_memberships (
      id, care_space_id, user_id, role, relationship_type, relationship_label, bootstrap_id
    ) values (
      operation_id, invitation.care_space_id, (select auth.uid()), invitation.role,
      invitation.relationship_type, invitation.relationship_label, operation_id
    )
    returning id into new_membership_id;
  end if;

  foreach domain_value in array invitation.granted_domains loop
    insert into public.care_space_domain_grants (
      membership_id, domain, can_read, can_write, granted_by_membership_id
    ) values (
      new_membership_id, domain_value, true, invitation.role = 'contributor',
      invitation.invited_by_membership_id
    )
    on conflict (membership_id, domain) do nothing;
  end loop;

  update public.care_space_invitations
  set status = 'accepted', responded_at = now(), accepted_membership_id = new_membership_id
  where id = invitation.id;

  perform public.log_care_space_activity(
    invitation.care_space_id, new_membership_id, 'member_joined', null, 'general', '{}'::jsonb
  );

  return new_membership_id;
end;
$$;

revoke all on function public.accept_invitation(uuid, uuid) from public;
revoke all on function public.accept_invitation(uuid, uuid) from anon;
grant execute on function public.accept_invitation(uuid, uuid) to authenticated;

create or replace function public.remove_member(target_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_membership public.care_space_memberships%rowtype;
  caller_is_organiser boolean;
  organiser_count integer;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into target_membership
  from public.care_space_memberships
  where id = target_membership_id and membership_status = 'active'
  for update;

  if not found then
    raise exception 'Membership not found' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.care_space_memberships organiser_membership
    where organiser_membership.care_space_id = target_membership.care_space_id
      and organiser_membership.user_id = (select auth.uid())
      and organiser_membership.role = 'organiser'
      and organiser_membership.membership_status = 'active'
  ) into caller_is_organiser;

  if not caller_is_organiser then
    raise exception 'Only an active organiser can remove a member' using errcode = '42501';
  end if;

  if target_membership.role = 'organiser' then
    select count(*) into organiser_count
    from public.care_space_memberships
    where care_space_id = target_membership.care_space_id
      and role = 'organiser'
      and membership_status = 'active';

    if organiser_count <= 1 then
      raise exception 'A care space must always keep at least one organiser' using errcode = '22023';
    end if;
  end if;

  update public.care_space_memberships
  set membership_status = 'revoked'
  where id = target_membership_id;

  perform public.log_care_space_activity(
    target_membership.care_space_id, target_membership_id, 'member_removed', null, 'general', '{}'::jsonb
  );
end;
$$;

revoke all on function public.remove_member(uuid) from public;
revoke all on function public.remove_member(uuid) from anon;
grant execute on function public.remove_member(uuid) to authenticated;

create or replace function public.leave_care_space(target_care_space_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership public.care_space_memberships%rowtype;
  organiser_count integer;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into caller_membership
  from public.care_space_memberships
  where care_space_id = target_care_space_id
    and user_id = (select auth.uid())
    and membership_status = 'active'
  for update;

  if not found then
    raise exception 'Membership not found' using errcode = '42501';
  end if;

  if caller_membership.role = 'organiser' then
    select count(*) into organiser_count
    from public.care_space_memberships
    where care_space_id = target_care_space_id
      and role = 'organiser'
      and membership_status = 'active';

    if organiser_count <= 1 then
      raise exception 'Make someone else an organiser before you leave, so this care space is never left without one' using errcode = '22023';
    end if;
  end if;

  update public.care_space_memberships
  set membership_status = 'revoked'
  where id = caller_membership.id;

  perform public.log_care_space_activity(
    target_care_space_id, caller_membership.id, 'member_left', null, 'general', '{}'::jsonb
  );
end;
$$;

revoke all on function public.leave_care_space(uuid) from public;
revoke all on function public.leave_care_space(uuid) from anon;
grant execute on function public.leave_care_space(uuid) to authenticated;
