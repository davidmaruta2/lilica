-- Post-build implementation batch (lilbatch.txt, 17 September 2026):
-- structured Medical Log -- diagnosed conditions and prescribed medicines.
--
-- Care needs deliberately reuse the existing 'careNote' record type -- it
-- already meets every requirement the brief lists for care needs (viewable,
-- editable, attributable to the correct care space, persisted/synced
-- through the established architecture, subject to existing care-space
-- permissions). No schema change is needed or made for care needs.
--
-- Conditions and medicines are genuinely new record types because they
-- need their own explicit active/closed lifecycle (closedAt, added as a
-- plain client-side field on the existing generic record_data JSONB --
-- see src/types.ts -- no new column is needed for it, exactly like
-- assignedMembershipId/remindersEnabled before it). Both are 'health'
-- domain, same as careNote: a Care Circle member only sees them if
-- explicitly granted the health domain, exactly like existing care notes.
--
-- This migration only widens the two structural defences records already
-- have for their type -- the records_type CHECK constraint, and
-- record_domain_for_type()'s explicit per-type mapping (which raises
-- loudly on anything unmapped, see its own header comment in
-- 20260916090000_fix_assignments_domain_scoped_read.sql). apply_record_
-- mutation() itself is untouched: it already calls record_domain_for_type()
-- generically rather than hardcoding a type list, so no redefinition is
-- needed there.

alter table public.records
  drop constraint records_type;

alter table public.records
  add constraint records_type check (
    record_type in (
      'appointment', 'task', 'bill', 'homeMatter', 'document', 'contact',
      'careNote', 'update', 'condition', 'medicine'
    )
  );

create or replace function public.record_domain_for_type(value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  case value
    when 'careNote' then return 'health';
    when 'condition' then return 'health';
    when 'medicine' then return 'health';
    when 'bill' then return 'financial';
    when 'homeMatter' then return 'home';
    when 'document' then return 'documents';
    when 'appointment', 'task', 'contact', 'update' then return 'general';
    else
      raise exception 'record_domain_for_type: unmapped record type "%" -- every record type must have an explicit permission domain', value
        using errcode = '22023';
  end case;
end;
$$;

-- apply_record_mutation() carries its OWN earlier explicit payload_type
-- whitelist (found and documented by
-- supabase/tests/database/record_domain_fail_closed.test.sql: it is an
-- even earlier layer of defence than the records_type CHECK constraint,
-- since it rejects before the INSERT is attempted at all). This redefines
-- ONLY that one whitelist line to include 'condition'/'medicine' -- every
-- other line is byte-identical to the version in
-- 20260914090000_phase21b_billing_entitlement.sql (the current latest
-- definition), so this migration's diff review can be checked directly
-- against that file's body.
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

  -- Phase 21B: a genuinely NEW mutation attempt only, per the comment
  -- above -- an already-applied replay never reaches this line.
  if not public.care_space_has_active_entitlement(target_care_space_id) then
    raise exception 'Subscription required to continue managing this care space' using errcode = '42501';
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

    if payload_type not in ('appointment', 'task', 'bill', 'homeMatter', 'document', 'contact', 'careNote', 'update', 'condition', 'medicine')
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
