-- Invitation code rate-limit security correction (14 September 2026,
-- GPT/product-owner review of the final architectural closure).
--
-- REAL DEFECT: the prior migration split rate limiting into a
-- CLIENT-INVOKED sequence -- record_invitation_code_attempt(), then
-- resolve_invitation_by_code() -- both independently granted EXECUTE to
-- `authenticated`. Nothing stopped an authenticated client from calling
-- resolve_invitation_by_code() directly, skipping the counter entirely.
-- A security control must never depend on an honest client calling a
-- throttle function first -- this was not genuinely server-enforced
-- rate limiting.
--
-- FIX: exactly ONE client-callable entry point.
-- resolve_invitation_by_code() now does the entire job itself --
-- authentication, rate-limit accounting, the threshold check, the
-- lookup, and the minimal preview result -- in one atomic call. The
-- separate record_invitation_code_attempt() RPC is DROPPED entirely
-- (not merely left unused -- an unused-but-still-callable function
-- would still be the exact same bypass path).
--
-- THE ORIGINAL TRANSACTION BUG (increment counter, then RAISE
-- "not found", which rolls the increment back) is fixed properly this
-- time, not worked around with client sequencing: every business-level
-- outcome that used to RAISE an exception (not found / no longer
-- active / too many attempts) now instead RETURNS a structured result
-- row with a `result_status` discriminator. Since the function always
-- completes normally (returns), Postgres never rolls anything back --
-- the counter increment and the lookup outcome commit together, in the
-- same statement, unconditionally. Only a genuine authentication
-- failure still raises (nothing has been written yet at that point, so
-- there is nothing to lose).

-- ---------------------------------------------------------------------
-- 1. Remove the bypass path entirely.
-- ---------------------------------------------------------------------
drop function if exists public.record_invitation_code_attempt();

-- ---------------------------------------------------------------------
-- 2. The one, single, client-callable resolver. Threshold/window
--    UNCHANGED from the prior migration (10 attempts / rolling 5
--    minutes / per authenticated account) -- no technical correction
--    to the policy itself was required, only to its enforcement.
-- ---------------------------------------------------------------------
drop function if exists public.resolve_invitation_by_code(text);

create function public.resolve_invitation_by_code(code_input text)
returns table (
  result_status text,
  id uuid,
  care_space_name text,
  invited_by_display_name text,
  role text,
  granted_domains text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_seconds constant int := 300;
  max_attempts constant int := 10;
  existing_attempt public.invitation_code_attempts%rowtype;
  throttled boolean := false;
  normalised_code text;
  invitation public.care_space_invitations%rowtype;
  person_name text;
  inviter_name text;
begin
  -- Authentication failure is the ONE case still allowed to raise --
  -- nothing has been written yet, so there is nothing a rollback could
  -- lose, and every other RPC in this codebase raises identically for
  -- this exact condition.
  if auth.uid() is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Rate-limit accounting FIRST, unconditionally, for every call --
  -- INCLUDING a call that will go on to find nothing, or find an
  -- inactive invitation, or a malformed code. This is what makes the
  -- limiter genuinely count every attempt: no code path below this
  -- point can ever cause today's accounting to be undone, because
  -- nothing after this point raises.
  select * into existing_attempt
  from public.invitation_code_attempts
  where user_id = (select auth.uid())
  for update;

  if not found then
    insert into public.invitation_code_attempts (user_id, window_start, attempt_count)
    values ((select auth.uid()), now(), 1);
  elsif existing_attempt.window_start <= now() - (window_seconds || ' seconds')::interval then
    update public.invitation_code_attempts
    set window_start = now(), attempt_count = 1
    where user_id = (select auth.uid());
  elsif existing_attempt.attempt_count >= max_attempts then
    throttled := true;
  else
    update public.invitation_code_attempts
    set attempt_count = attempt_count + 1
    where user_id = (select auth.uid());
  end if;

  if throttled then
    -- A structured result, not a raise -- but even if it raised here,
    -- nothing has been written THIS call (the throttle check happens
    -- before any write in the branches above), so there would be
    -- nothing to lose either way. Kept as a structured result purely
    -- for a single, uniform response shape the client always expects.
    return query select 'throttled'::text, null::uuid, null::text, null::text, null::text, null::text[];
    return;
  end if;

  normalised_code := upper(regexp_replace(coalesce(code_input, ''), '[^A-Za-z0-9]', '', 'g'));
  if normalised_code = '' then
    return query select 'invalid_input'::text, null::uuid, null::text, null::text, null::text, null::text[];
    return;
  end if;

  -- Lazy expiry, mirroring the established pattern exactly -- a plain
  -- UPDATE, no exception involved, so it never interacts with the
  -- rollback problem either way.
  update public.care_space_invitations inv
  set status = 'expired'
  where inv.invite_code = normalised_code
    and inv.status = 'pending'
    and inv.expires_at <= now();

  select * into invitation
  from public.care_space_invitations
  where invite_code = normalised_code;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::text, null::text, null::text[];
    return;
  end if;

  if invitation.status <> 'pending' then
    return query select 'inactive'::text, null::uuid, null::text, null::text, null::text, null::text[];
    return;
  end if;

  select display_name into person_name
  from public.supported_people
  where care_space_id = invitation.care_space_id;

  select profile.display_name into inviter_name
  from public.care_space_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  where membership.id = invitation.invited_by_membership_id;

  return query
  select
    'ok'::text,
    invitation.id,
    coalesce(person_name, 'a Lilica care space'),
    coalesce(inviter_name, 'The organiser'),
    invitation.role,
    invitation.granted_domains;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. EXECUTE grants, audited. `invitation_code_attempts` itself
--    already has RLS enabled/forced with ZERO policies (unchanged from
--    the prior migration) -- no authenticated/anon grant on the TABLE
--    exists at all, so it is unreachable by direct query regardless of
--    function grants. The ONLY function that ever touches it is this
--    one, and it is the ONLY code-resolution entry point granted to
--    authenticated clients -- there is no second, internal helper left
--    over to audit.
-- ---------------------------------------------------------------------
revoke all on function public.resolve_invitation_by_code(text) from public;
revoke all on function public.resolve_invitation_by_code(text) from anon;
grant execute on function public.resolve_invitation_by_code(text) to authenticated;
