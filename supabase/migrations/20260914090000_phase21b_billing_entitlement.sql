-- Phase 21B: Billing, Subscription & Entitlement -- server-authoritative
-- data model and enforcement, per the approved docs/PHASE_21_ARCHITECTURE_PROPOSAL.md
-- (as superseded by the product owner's two later corrections: £8.99/year,
-- and a 60-day free period, not 30). See docs/PHASE_21_ARCHITECTURE.md for
-- the full design writeup.
--
-- Architectural principle, reused from Phase 15/20B's own established
-- pattern: one small, shared decision function
-- (public.care_space_has_active_entitlement) is called consistently from
-- every gated RPC, rather than duplicating billing logic bespoke per RPC.
-- Commercial entitlement is layered ON TOP of Phase 15's existing
-- role/domain-grant security model -- it never replaces RLS, and RLS never
-- substitutes for it. Every mutation RPC redefined below is redefined from
-- its CURRENT (already Phase 15/16/20B-corrected) body, verified by direct
-- inspection immediately before writing this migration -- not from an
-- earlier historical version. This is a deliberate safeguard: an earlier
-- phase in this same project once nearly shipped a redefinition based on a
-- stale function body, which would have silently regressed a real
-- permission fix. That mistake is not repeated here.

-- ---------------------------------------------------------------------
-- 1. Commercial ownership: care_spaces.commercial_owner_id.
--
-- Distinct from bootstrap_owner_id ("idempotency metadata only; access is
-- granted exclusively through membership" -- see that column's own
-- existing comment, unchanged) and from care_space_memberships.role
-- (security/collaboration, unchanged). commercial_owner_id answers only
-- "which Lilica account's commercial entitlement currently supports
-- active management of this care space" -- it grants no read permission,
-- makes nobody an organiser, bypasses no RLS, creates no membership, and
-- grants no domain access.
--
-- Backfill: every EXISTING care space (all created before this migration,
-- all pre-launch/development data) gets commercial_owner_id set to its own
-- bootstrap_owner_id -- the same account that already, structurally,
-- created it. This is a one-time structural default, not an invented
-- commercial/trial history (no entitlement row is created or backdated by
-- this backfill -- see section 9 below for how existing accounts actually
-- receive entitlement state).
-- ---------------------------------------------------------------------

alter table public.care_spaces
  add column commercial_owner_id uuid references auth.users (id) on delete set null;

update public.care_spaces set commercial_owner_id = bootstrap_owner_id;

comment on column public.care_spaces.commercial_owner_id is
  'Phase 21B: which Lilica account''s commercial entitlement currently supports ACTIVE MANAGEMENT of this care space. Grants nothing by itself -- never read access, never a role, never a domain grant. See care_space_has_active_entitlement().';

-- ---------------------------------------------------------------------
-- 2. public.entitlements: one row per Lilica account. The one
--    authoritative commercial-state fact per user. Never written directly
--    by any client -- only by security-definer functions (the trial-start
--    path inside bootstrap_supported_people(), and the webhook-driven
--    apply_entitlement_update() below).
-- ---------------------------------------------------------------------

create table public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'TRIAL_ACTIVE',
  trial_started_at timestamptz not null default statement_timestamp(),
  trial_expires_at timestamptz not null default (statement_timestamp() + interval '60 days'),
  provider text,
  provider_app_user_id text,
  entitlement_expires_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint entitlements_status check (status in (
    'TRIAL_ACTIVE', 'TRIAL_EXPIRED', 'SUBSCRIPTION_ACTIVE', 'GRACE_PERIOD',
    'BILLING_RETRY', 'SUBSCRIPTION_EXPIRED', 'REVOKED', 'UNKNOWN'
  ))
);

alter table public.entitlements enable row level security;
alter table public.entitlements force row level security;

revoke all on table public.entitlements from anon, authenticated;
grant select on table public.entitlements to authenticated;

-- The row's own owner only -- a Care Circle collaborator relying on this
-- account's entitlement to keep a shared care space active never reads
-- this row directly; they only ever learn the functional yes/no result via
-- get_care_space_commercial_status() below (brief section 41's own
-- explicit minimal-disclosure requirement).
create policy "a user reads only their own entitlement"
on public.entitlements for select to authenticated
using (user_id = (select auth.uid()));

comment on table public.entitlements is
  'Phase 21B: one authoritative commercial-entitlement row per Lilica account. Never written by any client directly -- see bootstrap_supported_people() (trial start) and apply_entitlement_update() (provider-driven transitions).';

-- ---------------------------------------------------------------------
-- 3. public.entitlement_events: append-only audit trail, mirroring
--    care_space_activity's own established immutable-log pattern exactly
--    (same before-update/delete-raises-exception trigger technique).
--    provider_event_id gives idempotent webhook processing -- a redelivered
--    RevenueCat event can never be applied twice.
-- ---------------------------------------------------------------------

create table public.entitlement_events (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null check (event_type in (
    'trial_started', 'purchase_verified', 'renewed', 'grace_period_entered',
    'billing_retry_entered', 'expired', 'revoked', 'restored', 'ownership_transferred'
  )),
  provider_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  constraint entitlement_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

-- Partial unique index: only webhook-originated events carry a
-- provider_event_id, and exactly those must never be applied twice.
-- trial_started/ownership_transferred (server-internal events) never set
-- this column, so they are unaffected by this constraint.
create unique index entitlement_events_provider_event_id_idx
  on public.entitlement_events (provider_event_id) where provider_event_id is not null;

create index entitlement_events_user_created_idx on public.entitlement_events (user_id, created_at desc);

create function public.entitlement_events_is_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- The one permitted mutation: user_id's own "on delete set null" FK
  -- cascade from auth.users, firing when the account is deleted
  -- (delete_my_account()) -- every other field must stay byte-identical,
  -- and no other update (nor any delete) is ever allowed. Without this
  -- exception, deleting an account whose entitlement events reference it
  -- would itself raise this same "immutable" error and abort the whole
  -- deletion -- a real bug caught by this migration's own pgTAP run
  -- against the existing Phase 18B account-deletion suite, not invented
  -- speculatively.
  if tg_op = 'UPDATE'
    and new.user_id is null and old.user_id is not null
    and old.id = new.id
    and old.event_type = new.event_type
    and old.provider_event_id is not distinct from new.provider_event_id
    and old.metadata = new.metadata
    and old.created_at = new.created_at
  then
    return new;
  end if;
  raise exception 'Entitlement events are immutable' using errcode = '42501';
end;
$$;

revoke all on function public.entitlement_events_is_immutable() from public;
create trigger entitlement_events_no_update
before update on public.entitlement_events
for each row execute function public.entitlement_events_is_immutable();
create trigger entitlement_events_no_delete
before delete on public.entitlement_events
for each row execute function public.entitlement_events_is_immutable();

alter table public.entitlement_events enable row level security;
alter table public.entitlement_events force row level security;

revoke all on table public.entitlement_events from anon, authenticated;
grant select on table public.entitlement_events to authenticated;

create policy "a user reads only their own entitlement events"
on public.entitlement_events for select to authenticated
using (user_id = (select auth.uid()));

comment on table public.entitlement_events is
  'Phase 21B: append-only commercial-state audit trail, distinct from entitlements'' current-state row. Immutable by trigger, matching care_space_activity''s own established pattern.';

-- ---------------------------------------------------------------------
-- 4. Shared entitlement decision functions.
--
-- user_has_active_entitlement(): is THIS account currently entitled to
-- actively manage care. TRIAL_ACTIVE is computed against trial_expires_at
-- AT QUERY TIME (never a stale stored boolean) since nothing else flips it
-- the instant 60 days elapses -- there is no cron job, and there must not
-- need to be one for this decision to be correct. SUBSCRIPTION_ACTIVE and
-- GRACE_PERIOD are both treated as active, matching the platforms' own
-- intended grace-period leniency (brief section 32). Every other state
-- (TRIAL_EXPIRED, SUBSCRIPTION_EXPIRED, BILLING_RETRY, REVOKED, UNKNOWN,
-- or no entitlement row at all) is inactive.
-- ---------------------------------------------------------------------

create function public.user_has_active_entitlement(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when e.status in ('SUBSCRIPTION_ACTIVE', 'GRACE_PERIOD') then true
      when e.status = 'TRIAL_ACTIVE' and e.trial_expires_at > now() then true
      else false
    end
    from public.entitlements e
    where e.user_id = target_user_id
  ), false);
$$;

revoke all on function public.user_has_active_entitlement(uuid) from public, anon;
grant execute on function public.user_has_active_entitlement(uuid) to authenticated;

-- care_space_has_active_entitlement(): the one function every gated
-- mutation RPC below calls. A care space with no commercial_owner_id
-- (owner account deleted, ownership never transferred) is correctly
-- inactive -- coalesce to false, never an exception, so a read-only care
-- space is a normal, well-defined state rather than an error condition.
create function public.care_space_has_active_entitlement(target_care_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.user_has_active_entitlement(cs.commercial_owner_id)
    from public.care_spaces cs
    where cs.id = target_care_space_id
  ), false);
$$;

revoke all on function public.care_space_has_active_entitlement(uuid) from public, anon;
grant execute on function public.care_space_has_active_entitlement(uuid) to authenticated;

-- get_care_space_commercial_status(): the ONLY entitlement-adjacent fact a
-- Care Circle collaborator may ever learn about another account's billing
-- -- a plain yes/no "is this space actively manageable right now", plus
-- whether the CALLER THEMSELVES happens to be the commercial owner (so the
-- client can decide whether to show "Manage subscription" or "ask the
-- owner to renew"). Never exposes the owner's own entitlement row, status
-- detail, or identity beyond what the caller already knows from Care
-- Circle membership. Returns no row at all for a non-member (brief section
-- 41's own explicit requirement).
create function public.get_care_space_commercial_status(target_care_space_id uuid)
returns table (is_active boolean, is_commercial_owner boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.care_space_has_active_entitlement(target_care_space_id),
    exists (
      select 1 from public.care_spaces cs
      where cs.id = target_care_space_id and cs.commercial_owner_id = (select auth.uid())
    )
  where exists (
    select 1 from public.care_space_memberships m
    where m.care_space_id = target_care_space_id
      and m.user_id = (select auth.uid())
      and m.membership_status = 'active'
  );
$$;

revoke all on function public.get_care_space_commercial_status(uuid) from public, anon;
grant execute on function public.get_care_space_commercial_status(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Commercial ownership transfer -- a narrow, explicit, audited RPC.
--    NOT a general arbitrary-user transfer feature: it only ever reassigns
--    which already-active organiser is commercially responsible for a
--    care space they already have full security access to. It never
--    touches Care Circle roles and never touches the underlying Apple/
--    Google purchase itself.
-- ---------------------------------------------------------------------

create function public.transfer_care_space_commercial_ownership(
  target_care_space_id uuid,
  new_owner_membership_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  care_space public.care_spaces%rowtype;
  new_owner_membership public.care_space_memberships%rowtype;
  caller_is_current_owner boolean;
  current_owner_membership_active boolean;
  caller_is_active_organiser boolean;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into care_space from public.care_spaces where id = target_care_space_id for update;
  if not found then
    raise exception 'Care space not found' using errcode = '42501';
  end if;

  select * into new_owner_membership
  from public.care_space_memberships
  where id = new_owner_membership_id
    and care_space_id = target_care_space_id
    and role = 'organiser'
    and membership_status = 'active';
  if not found then
    raise exception 'The new commercial owner must be an active organiser of this care space' using errcode = '22023';
  end if;

  caller_is_current_owner := care_space.commercial_owner_id is not distinct from (select auth.uid());

  select exists (
    select 1 from public.care_space_memberships m
    where m.care_space_id = target_care_space_id
      and m.user_id = care_space.commercial_owner_id
      and m.membership_status = 'active'
  ) into current_owner_membership_active;

  select exists (
    select 1 from public.care_space_memberships m
    where m.care_space_id = target_care_space_id
      and m.user_id = (select auth.uid())
      and m.role = 'organiser'
      and m.membership_status = 'active'
  ) into caller_is_active_organiser;

  if not caller_is_current_owner
    and not (current_owner_membership_active = false and caller_is_active_organiser) then
    raise exception 'Only the current commercial owner, or an active organiser once the current owner is no longer active, can transfer commercial ownership' using errcode = '42501';
  end if;

  update public.care_spaces
  set commercial_owner_id = new_owner_membership.user_id, updated_at = statement_timestamp()
  where id = target_care_space_id;

  insert into public.entitlement_events (id, user_id, event_type, metadata)
  values (
    gen_random_uuid(), new_owner_membership.user_id, 'ownership_transferred',
    jsonb_build_object('careSpaceId', target_care_space_id, 'previousOwnerId', care_space.commercial_owner_id)
  );
end;
$$;

revoke all on function public.transfer_care_space_commercial_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_care_space_commercial_ownership(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. apply_entitlement_update(): the ONE server-side write path for
--    provider-driven state changes, called only from the RevenueCat
--    webhook Edge Function (never directly by any client -- no execute
--    grant to authenticated at all). Idempotent via provider_event_id;
--    the unique index above turns a redelivered webhook into a harmless
--    no-op rather than requiring bespoke duplicate-detection logic here.
-- ---------------------------------------------------------------------

create function public.apply_entitlement_update(
  target_user_id uuid,
  new_status text,
  new_provider text,
  new_provider_app_user_id text,
  new_entitlement_expires_at timestamptz,
  event_type text,
  provider_event_id text,
  event_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new_status not in (
    'TRIAL_ACTIVE', 'TRIAL_EXPIRED', 'SUBSCRIPTION_ACTIVE', 'GRACE_PERIOD',
    'BILLING_RETRY', 'SUBSCRIPTION_EXPIRED', 'REVOKED', 'UNKNOWN'
  ) then
    raise exception 'Unsupported entitlement status' using errcode = '22023';
  end if;

  insert into public.entitlements (
    user_id, status, provider, provider_app_user_id, entitlement_expires_at, last_verified_at
  ) values (
    target_user_id, new_status, new_provider, new_provider_app_user_id, new_entitlement_expires_at, statement_timestamp()
  )
  on conflict (user_id) do update set
    status = excluded.status,
    provider = excluded.provider,
    provider_app_user_id = excluded.provider_app_user_id,
    entitlement_expires_at = excluded.entitlement_expires_at,
    last_verified_at = excluded.last_verified_at,
    updated_at = statement_timestamp();

  insert into public.entitlement_events (id, user_id, event_type, provider_event_id, metadata)
  values (gen_random_uuid(), target_user_id, event_type, provider_event_id, coalesce(event_metadata, '{}'::jsonb));
exception
  when unique_violation then
    -- A redelivered webhook (same provider_event_id) -- already applied,
    -- safe no-op. Never re-raises, never re-applies.
    null;
end;
$$;

-- No execute grant to authenticated or anon at all -- this is the
-- webhook-Edge-Function-only write path, invoked with the service role,
-- never callable by a client of any kind.
revoke all on function public.apply_entitlement_update(uuid, text, text, text, timestamptz, text, text, jsonb) from public, anon, authenticated;

comment on function public.apply_entitlement_update(uuid, text, text, text, timestamptz, text, text, jsonb) is
  'Phase 21B: the sole write path for provider-driven (RevenueCat webhook) entitlement transitions. Callable only via the service role from supabase/functions/entitlement-webhook -- no client (including authenticated) may call this directly.';

-- ---------------------------------------------------------------------
-- 7. bootstrap_supported_people(): extended (same signature) to start the
--    trial on the first-ever new care space for an account, and to gate
--    every SUBSEQUENT new care space on that account's own entitlement.
--    A retry of an already-processed draft_id is completely unaffected --
--    the existing space_id lookup already skips straight past all of this
--    new logic for anything that already exists.
-- ---------------------------------------------------------------------

create or replace function public.bootstrap_supported_people(people_payload jsonb)
returns table (draft_id uuid, care_space_id uuid, supported_person_id uuid, membership_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  item jsonb;
  item_draft_id uuid;
  item_name text;
  item_relationship text;
  item_label text;
  space_id uuid;
  person_id uuid;
  member_id uuid;
  entitlement_exists boolean;
begin
  if caller_id is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(people_payload) <> 'array' or jsonb_array_length(people_payload) < 1 or jsonb_array_length(people_payload) > 20 then
    raise exception 'A roster of 1 to 20 people is required' using errcode = '22023';
  end if;

  select exists (select 1 from public.entitlements where user_id = caller_id) into entitlement_exists;

  for item in select value from jsonb_array_elements(people_payload)
  loop
    item_draft_id := (item->>'draft_id')::uuid;
    item_name := btrim(item->>'display_name');
    item_relationship := item->>'relationship_type';
    item_label := nullif(btrim(item->>'relationship_label'), '');

    if char_length(item_name) not between 1 and 80 then
      raise exception 'Invalid supported-person name' using errcode = '22023';
    end if;

    select cs.id, sp.id, csm.id
      into space_id, person_id, member_id
    from public.care_spaces cs
    join public.supported_people sp on sp.care_space_id = cs.id
    join public.care_space_memberships csm on csm.care_space_id = cs.id and csm.user_id = caller_id
    where cs.bootstrap_owner_id = caller_id and cs.bootstrap_id = item_draft_id;

    if space_id is null then
      -- Genuinely a NEW care space for this account this call. This is
      -- either the first one this account has ever created (starts the
      -- trial, never gated) or a subsequent one (gated on the account's
      -- own current entitlement -- brief section 30/section 11's "creation
      -- of additional supported people/care spaces after the first
      -- trial-starting bootstrap").
      if not entitlement_exists then
        insert into public.entitlements (user_id, status, trial_started_at, trial_expires_at)
        values (caller_id, 'TRIAL_ACTIVE', statement_timestamp(), statement_timestamp() + interval '60 days')
        on conflict (user_id) do nothing;
        insert into public.entitlement_events (id, user_id, event_type, metadata)
        values (gen_random_uuid(), caller_id, 'trial_started', '{}'::jsonb);
        -- Subsequent NEW spaces within this SAME call (a first-ever
        -- multi-person roster) must not re-enter this branch or log a
        -- second trial_started event -- the trial just started above.
        entitlement_exists := true;
      else
        if not public.user_has_active_entitlement(caller_id) then
          raise exception 'Subscribe to add another supported person' using errcode = '42501';
        end if;
      end if;

      insert into public.care_spaces (bootstrap_owner_id, bootstrap_id, commercial_owner_id)
      values (caller_id, item_draft_id, caller_id)
      returning id into space_id;

      insert into public.supported_people (care_space_id, display_name)
      values (space_id, item_name)
      returning id into person_id;

      insert into public.care_space_memberships (
        care_space_id, user_id, role, relationship_type, relationship_label, bootstrap_id
      ) values (
        space_id, caller_id, 'organiser', item_relationship, item_label, item_draft_id
      ) returning id into member_id;
    end if;

    draft_id := item_draft_id;
    care_space_id := space_id;
    supported_person_id := person_id;
    membership_id := member_id;
    return next;
  end loop;
end;
$$;

revoke all on function public.bootstrap_supported_people(jsonb) from public;
revoke all on function public.bootstrap_supported_people(jsonb) from anon;
grant execute on function public.bootstrap_supported_people(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 8. apply_record_mutation(): entitlement check added right after the
--    existing idempotent-duplicate short-circuit and BEFORE any new-work
--    validation -- deliberately placed there so a replay of an ALREADY-
--    APPLIED mutation (an outbox retry of something that already
--    succeeded) always returns the harmless 'duplicate' status regardless
--    of CURRENT entitlement, and only a genuinely NEW mutation attempt is
--    ever entitlement-gated. This is what makes brief section 28's
--    "held mutation, retried later, no duplicate writes" behaviour work
--    correctly on the client side. Every existing check (domain write
--    access, assignee-visibility, conflict/merge, activity logging from
--    Phase 20B) is preserved completely unchanged below.
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

revoke all on function public.apply_record_mutation(uuid, uuid, uuid, text, integer, jsonb) from public;
revoke all on function public.apply_record_mutation(uuid, uuid, uuid, text, integer, jsonb) from anon;
grant execute on function public.apply_record_mutation(uuid, uuid, uuid, text, integer, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 9. Attachment/link mutations -- each gated the same way, right after
--    their existing permission check and before the actual write. Reads
--    (list_record_links, any attachment metadata select) are untouched.
-- ---------------------------------------------------------------------

create or replace function public.upsert_record_attachment(
  attachment_id uuid,
  target_record_id uuid,
  target_care_space_id uuid,
  attachment_kind text,
  attachment_display_name text,
  attachment_mime_type text,
  attachment_size_bytes bigint,
  attachment_storage_object_path text
)
returns public.record_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  target_record public.records%rowtype;
  result_row public.record_attachments%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  if attachment_kind not in ('file', 'scan') then
    raise exception 'Unsupported attachment kind' using errcode = '22023';
  end if;

  select * into target_record from public.records
    where id = target_record_id and care_space_id = target_care_space_id and deleted_at is null;
  if not found then
    raise exception 'Record not found in this care space' using errcode = '42501';
  end if;

  if not public.can_access_care_space_records(target_care_space_id, target_record.record_domain, 'write') then
    raise exception 'Insufficient permission for this record domain' using errcode = '42501';
  end if;

  if not public.care_space_has_active_entitlement(target_care_space_id) then
    raise exception 'Subscription required to continue managing this care space' using errcode = '42501';
  end if;

  insert into public.record_attachments (
    id, care_space_id, record_id, kind, display_name, mime_type, size_bytes,
    storage_object_path, created_by_membership_id
  ) values (
    attachment_id, target_care_space_id, target_record_id, attachment_kind, attachment_display_name,
    attachment_mime_type, attachment_size_bytes, attachment_storage_object_path, caller_membership_id
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    mime_type = excluded.mime_type,
    size_bytes = excluded.size_bytes,
    updated_at = statement_timestamp()
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.upsert_record_attachment(uuid, uuid, uuid, text, text, text, bigint, text) from public;
revoke all on function public.upsert_record_attachment(uuid, uuid, uuid, text, text, text, bigint, text) from anon;
grant execute on function public.upsert_record_attachment(uuid, uuid, uuid, text, text, text, bigint, text) to authenticated;

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

  -- Phase 21B: marking an upload's own status is part of the same
  -- document-upload action apply_record_mutation() and
  -- upsert_record_attachment() are already gated for -- gated identically,
  -- not exempted, so a modified client cannot bypass entitlement by
  -- skipping straight to this call.
  if not public.care_space_has_active_entitlement(attachment_row.care_space_id) then
    raise exception 'Subscription required to continue managing this care space' using errcode = '42501';
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

create or replace function public.remove_record_attachment(target_attachment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attachment_row public.record_attachments%rowtype;
  owning_record public.records%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into attachment_row from public.record_attachments where id = target_attachment_id and deleted_at is null;
  if not found then
    raise exception 'Attachment not found' using errcode = '42501';
  end if;

  select * into owning_record from public.records where id = attachment_row.record_id;

  if not public.can_access_care_space_records(attachment_row.care_space_id, owning_record.record_domain, 'write') then
    raise exception 'Insufficient permission for this record domain' using errcode = '42501';
  end if;

  if not public.care_space_has_active_entitlement(attachment_row.care_space_id) then
    raise exception 'Subscription required to continue managing this care space' using errcode = '42501';
  end if;

  update public.record_attachments set deleted_at = statement_timestamp() where id = target_attachment_id;
end;
$$;

revoke all on function public.remove_record_attachment(uuid) from public;
revoke all on function public.remove_record_attachment(uuid) from anon;
grant execute on function public.remove_record_attachment(uuid) to authenticated;

create or replace function public.create_record_link(
  target_care_space_id uuid,
  source_record_id uuid,
  target_record_id uuid,
  link_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  source_record public.records%rowtype;
  target_record public.records%rowtype;
  existing_link_id uuid;
  new_link_id uuid;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  caller_membership_id := public.active_care_space_membership_id(target_care_space_id);
  if caller_membership_id is null then
    raise exception 'Active care-space membership required' using errcode = '42501';
  end if;

  if link_type not in ('related_to', 'action_for') then
    raise exception 'Unsupported link type' using errcode = '22023';
  end if;

  if source_record_id = target_record_id then
    raise exception 'A record cannot be linked to itself' using errcode = '22023';
  end if;

  select * into source_record from public.records
    where id = source_record_id and care_space_id = target_care_space_id and deleted_at is null;
  if not found then
    raise exception 'Source record not found in this care space' using errcode = '42501';
  end if;

  select * into target_record from public.records
    where id = target_record_id and care_space_id = target_care_space_id and deleted_at is null;
  if not found then
    raise exception 'Target record not found in this care space' using errcode = '42501';
  end if;

  if not public.can_access_care_space_records(target_care_space_id, source_record.record_domain, 'write') then
    raise exception 'Insufficient permission to link this record' using errcode = '42501';
  end if;
  if not public.can_access_care_space_records(target_care_space_id, target_record.record_domain, 'read') then
    raise exception 'Insufficient permission to link to this record' using errcode = '42501';
  end if;

  if not public.care_space_has_active_entitlement(target_care_space_id) then
    raise exception 'Subscription required to continue managing this care space' using errcode = '42501';
  end if;

  select id into existing_link_id from public.record_links
    where record_links.source_record_id = create_record_link.source_record_id
      and record_links.target_record_id = create_record_link.target_record_id
      and record_links.link_type = create_record_link.link_type
      and deleted_at is null;
  if existing_link_id is not null then
    return existing_link_id;
  end if;

  insert into public.record_links (
    care_space_id, source_record_id, target_record_id, link_type, created_by_membership_id
  ) values (
    target_care_space_id, source_record_id, target_record_id, link_type, caller_membership_id
  )
  returning id into new_link_id;

  return new_link_id;
exception
  when unique_violation then
    select id into existing_link_id from public.record_links
      where record_links.source_record_id = create_record_link.source_record_id
        and record_links.target_record_id = create_record_link.target_record_id
        and record_links.link_type = create_record_link.link_type
        and deleted_at is null;
    return existing_link_id;
end;
$$;

revoke all on function public.create_record_link(uuid, uuid, uuid, text) from public;
revoke all on function public.create_record_link(uuid, uuid, uuid, text) from anon;
grant execute on function public.create_record_link(uuid, uuid, uuid, text) to authenticated;

create or replace function public.remove_record_link(target_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_row public.record_links%rowtype;
  source_record public.records%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into link_row from public.record_links where id = target_link_id and deleted_at is null;
  if not found then
    raise exception 'Link not found' using errcode = '42501';
  end if;

  select * into source_record from public.records where id = link_row.source_record_id;

  if not public.can_access_care_space_records(link_row.care_space_id, source_record.record_domain, 'write') then
    raise exception 'Insufficient permission to remove this link' using errcode = '42501';
  end if;

  if not public.care_space_has_active_entitlement(link_row.care_space_id) then
    raise exception 'Subscription required to continue managing this care space' using errcode = '42501';
  end if;

  update public.record_links set deleted_at = statement_timestamp() where id = target_link_id;
end;
$$;

revoke all on function public.remove_record_link(uuid) from public;
revoke all on function public.remove_record_link(uuid) from anon;
grant execute on function public.remove_record_link(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 10. Care Circle collaborative-management mutations -- invite/revoke/
--     change-role are gated (genuine active collaborative management,
--     brief section 11). remove_member and leave_care_space are
--     DELIBERATELY NOT gated -- see docs/PHASE_21_ARCHITECTURE.md's
--     explicit resolution of the tension between brief section 11's
--     inventory (which lists "remove member") and section 14's safety
--     principle ("an organiser must retain enough safety/account-control
--     capability to remove a member where appropriate even if entitlement
--     has expired... do not trap users inside a data-sharing relationship
--     because payment lapsed"). The more specific, safety-framed
--     instruction governs: a member must always be removable/able to
--     leave, regardless of commercial state.
-- ---------------------------------------------------------------------

create or replace function public.invite_member(
  target_care_space_id uuid,
  invitee_email_input text,
  member_role text,
  granted_domains text[],
  member_relationship_type text,
  member_relationship_label text,
  operation_id uuid
)
returns public.care_space_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_membership_id uuid;
  normalised_email text;
  domain_value text;
  result_row public.care_space_invitations%rowtype;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select id into caller_membership_id
  from public.care_space_memberships
  where care_space_id = target_care_space_id
    and user_id = (select auth.uid())
    and role = 'organiser'
    and membership_status = 'active';

  if caller_membership_id is null then
    raise exception 'Only an active organiser can invite members' using errcode = '42501';
  end if;

  if not public.care_space_has_active_entitlement(target_care_space_id) then
    raise exception 'Subscription required to continue managing this care space' using errcode = '42501';
  end if;

  if member_role not in ('contributor', 'viewer') then
    raise exception 'Invitations may only offer Contributor or Viewer' using errcode = '22023';
  end if;

  if member_relationship_type is null or member_relationship_type not in
    ('Mum', 'Dad', 'Partner', 'Child', 'Grandparent', 'Other relative', 'Someone else') then
    raise exception 'Invalid relationship type' using errcode = '22023';
  end if;

  if member_relationship_type in ('Other relative', 'Someone else') then
    if char_length(btrim(coalesce(member_relationship_label, ''))) not between 1 and 50 then
      raise exception 'A short relationship label is required for this relationship type' using errcode = '22023';
    end if;
  else
    member_relationship_label := null;
  end if;

  normalised_email := lower(trim(invitee_email_input));
  if normalised_email is null or normalised_email = ''
    or normalised_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.care_space_memberships existing
    join auth.users existing_user on existing_user.id = existing.user_id
    where existing.care_space_id = target_care_space_id
      and existing.membership_status = 'active'
      and lower(existing_user.email) = normalised_email
  ) then
    raise exception 'This person already has access to this care space' using errcode = '22023';
  end if;

  if granted_domains is null then
    granted_domains := '{}';
  end if;
  foreach domain_value in array granted_domains loop
    if domain_value not in ('general', 'health', 'financial', 'home', 'documents') then
      raise exception 'Invalid domain in grant list' using errcode = '22023';
    end if;
  end loop;

  insert into public.care_space_invitations (
    care_space_id, invited_by_membership_id, invitee_email, role,
    relationship_type, relationship_label, granted_domains, operation_id
  ) values (
    target_care_space_id, caller_membership_id, normalised_email, member_role,
    member_relationship_type, member_relationship_label, granted_domains, operation_id
  )
  on conflict (care_space_id, lower(invitee_email)) where status = 'pending'
  do update set
    role = excluded.role,
    relationship_type = excluded.relationship_type,
    relationship_label = excluded.relationship_label,
    granted_domains = excluded.granted_domains,
    operation_id = excluded.operation_id,
    expires_at = statement_timestamp() + interval '14 days'
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.invite_member(uuid, text, text, text[], text, text, uuid) from public;
revoke all on function public.invite_member(uuid, text, text, text[], text, text, uuid) from anon;
grant execute on function public.invite_member(uuid, text, text, text[], text, text, uuid) to authenticated;

create or replace function public.revoke_invitation(target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.care_space_invitations%rowtype;
  caller_is_organiser boolean;
begin
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into invitation
  from public.care_space_invitations
  where id = target_invitation_id
  for update;

  if not found then
    raise exception 'Invitation not found' using errcode = '42501';
  end if;

  select exists (
    select 1 from public.care_space_memberships organiser_membership
    where organiser_membership.care_space_id = invitation.care_space_id
      and organiser_membership.user_id = (select auth.uid())
      and organiser_membership.role = 'organiser'
      and organiser_membership.membership_status = 'active'
  ) into caller_is_organiser;

  if not caller_is_organiser then
    raise exception 'Only an active organiser can revoke an invitation' using errcode = '42501';
  end if;

  if not public.care_space_has_active_entitlement(invitation.care_space_id) then
    raise exception 'Subscription required to continue managing this care space' using errcode = '42501';
  end if;

  if invitation.status <> 'pending' then
    raise exception 'This invitation is no longer open' using errcode = '22023';
  end if;

  update public.care_space_invitations
  set status = 'revoked', responded_at = now()
  where id = invitation.id;
end;
$$;

revoke all on function public.revoke_invitation(uuid) from public;
revoke all on function public.revoke_invitation(uuid) from anon;
grant execute on function public.revoke_invitation(uuid) to authenticated;

create or replace function public.change_member_role(
  target_membership_id uuid,
  new_role text,
  new_granted_domains text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_membership public.care_space_memberships%rowtype;
  caller_is_organiser boolean;
  organiser_count integer;
  domain_value text;
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
    raise exception 'Only an active organiser can change a member''s role' using errcode = '42501';
  end if;

  if not public.care_space_has_active_entitlement(target_membership.care_space_id) then
    raise exception 'Subscription required to continue managing this care space' using errcode = '42501';
  end if;

  if new_role not in ('organiser', 'contributor', 'viewer') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;

  if target_membership.role = 'organiser' and new_role <> 'organiser' then
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
  set role = new_role
  where id = target_membership_id;

  delete from public.care_space_domain_grants where membership_id = target_membership_id;

  if new_role <> 'organiser' then
    if new_granted_domains is null then
      new_granted_domains := '{}';
    end if;
    foreach domain_value in array new_granted_domains loop
      if domain_value not in ('general', 'health', 'financial', 'home', 'documents') then
        raise exception 'Invalid domain in grant list' using errcode = '22023';
      end if;
      insert into public.care_space_domain_grants (
        membership_id, domain, can_read, can_write, granted_by_membership_id
      ) values (
        target_membership_id, domain_value, true, new_role = 'contributor',
        (select id from public.care_space_memberships
         where care_space_id = target_membership.care_space_id
           and user_id = (select auth.uid())
           and role = 'organiser'
           and membership_status = 'active'
         limit 1)
      );
    end loop;
  end if;
end;
$$;

revoke all on function public.change_member_role(uuid, text, text[]) from public;
revoke all on function public.change_member_role(uuid, text, text[]) from anon;
grant execute on function public.change_member_role(uuid, text, text[]) to authenticated;

-- remove_member() and leave_care_space() are intentionally NOT redefined
-- here -- see the comment at the top of this section. Their Phase 20B
-- bodies (safety-action removal/leaving, plus member_removed/member_left
-- activity logging) are unchanged and remain ungated by entitlement.

-- ---------------------------------------------------------------------
-- 11. delete_my_account(): extended (same signature) to detach commercial
--     ownership on the affected care spaces and remove the caller's own
--     entitlement row, exactly mirroring how it already detaches
--     bootstrap_owner_id and care_space_memberships.user_id. Never
--     entitlement-gated -- unchanged, account deletion always works
--     regardless of commercial state.
-- ---------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_membership_ids uuid[];
  caller_display_name text;
  blocked_space_name text;
begin
  if caller_id is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Idempotency: a retry against an identity already deleted (e.g. the
  -- client never saw the first call's response) is a safe, silent
  -- no-op -- the terminal state is already reached, nothing to redo.
  if not exists (select 1 from auth.users where id = caller_id) then
    return;
  end if;

  -- Re-run the sole-organiser safety check server-side -- never trust a
  -- client-side account_deletion_precheck() call alone. Uses the exact
  -- same "count of active organisers = 1" decision that function itself
  -- makes, and the same rule leave_care_space()/remove_member() already
  -- enforce for the same underlying reason (Phase 15).
  select coalesce(person.display_name, 'A Lilica care space') into blocked_space_name
  from public.care_space_memberships m
  left join public.supported_people person on person.care_space_id = m.care_space_id
  where m.user_id = caller_id
    and m.membership_status = 'active'
    and m.role = 'organiser'
    and (
      select count(*) from public.care_space_memberships organiser_count
      where organiser_count.care_space_id = m.care_space_id
        and organiser_count.role = 'organiser'
        and organiser_count.membership_status = 'active'
    ) = 1
  limit 1;

  if blocked_space_name is not null then
    raise exception 'Cannot delete account: % still depends on you as its only organiser. Appoint another organiser first.', blocked_space_name
      using errcode = 'P0001';
  end if;

  select array_agg(id) into caller_membership_ids
  from public.care_space_memberships
  where user_id = caller_id;

  select display_name into caller_display_name from public.profiles where id = caller_id;

  -- Snapshot + detach every membership this identity holds, whatever its
  -- current status (active or already-revoked-but-still-live-user_id).
  -- Data minimisation: only a short display-name snapshot is retained,
  -- never the email/login identity that is about to be deleted.
  update public.care_space_memberships
  set former_display_name = coalesce(nullif(btrim(caller_display_name), ''), 'Former member'),
      membership_status = 'former',
      user_id = null
  where id = any(coalesce(caller_membership_ids, '{}'::uuid[]));

  -- Detach the second, separate auth.users reference (see the migration
  -- header comment) -- never deletes the care_spaces row itself.
  update public.care_spaces
  set bootstrap_owner_id = null
  where bootstrap_owner_id = caller_id;

  -- Phase 21B: detach commercial ownership too, on exactly the same
  -- nullable-on-delete pattern -- a care space this account commercially
  -- owned becomes unowned (effectively read-only, per
  -- care_space_has_active_entitlement()'s own coalesce-to-false handling
  -- of a null commercial_owner_id) unless another active organiser
  -- explicitly claims it via transfer_care_space_commercial_ownership()
  -- before or after this deletion. Never silently reassigned.
  update public.care_spaces set commercial_owner_id = null where commercial_owner_id = caller_id;

  -- Revoke this account's own still-pending SENT invitations only.
  -- Already-accepted memberships (now former, above) and invitations
  -- created by other organisers are untouched.
  update public.care_space_invitations
  set status = 'revoked', responded_at = statement_timestamp()
  where status = 'pending'
    and invited_by_membership_id = any(coalesce(caller_membership_ids, '{}'::uuid[]));

  -- Records/occurrences/assignments/record_links/record_attachments all
  -- reference membership.id, never user_id -- untouched by the above,
  -- and never touched here. No device-registration or server-side
  -- reminder/notification table exists in this schema (Phase 14 is
  -- local-device-only by design -- see docs/PHASE_14_ARCHITECTURE.md),
  -- so there is nothing further to revoke server-side for those; the
  -- client clears its own local reminder/notification state after this
  -- call succeeds (see src/accountLifecycle.ts).

  -- Phase 21B: the entitlement row is account-scoped personal commercial
  -- data, not shared care-space history -- removed outright here rather
  -- than left for the on-delete-cascade below, so it is gone even if a
  -- future change ever detaches auth.users deletion from this function.
  -- The audit trail (entitlement_events) survives with user_id set to
  -- null by its own on-delete-set-null FK, preserving minimal
  -- provider-transaction evidence without retaining it against a live
  -- account (see docs/PHASE_21_ARCHITECTURE.md's retention policy).
  delete from public.entitlements where user_id = caller_id;

  -- profiles.id references auth.users(id) on delete cascade (Phase 5) --
  -- deleting the auth identity below removes the live profile row too;
  -- deleting it a second time here would be duplicate logic, not defence
  -- in depth.
  delete from auth.users where id = caller_id;
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Phase 18B/21B: deletes the CALLING user''s own auth identity (derived from auth.uid() only -- never a caller-supplied id). Refuses if they are any care space''s sole active organiser. Detaches (never deletes) every membership they hold, snapshotting a minimal display name and marking it former; detaches bootstrap_owner_id and commercial_owner_id on care spaces they held; revokes their own pending sent invitations; removes their entitlement row; then deletes the auth.users row, which cascades to their profile. Idempotent -- a retry after the identity is already gone is a safe no-op. Shared care-space records, occurrences, assignments, documents, attachments and links are never touched by this function -- they reference membership.id, which is never deleted or regenerated.';
