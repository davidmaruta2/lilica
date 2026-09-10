create table public.care_spaces (
  id uuid primary key default gen_random_uuid(),
  bootstrap_owner_id uuid not null references auth.users (id) on delete restrict,
  bootstrap_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint care_spaces_bootstrap_unique unique (bootstrap_owner_id, bootstrap_id)
);

create table public.supported_people (
  id uuid primary key default gen_random_uuid(),
  care_space_id uuid not null unique references public.care_spaces (id) on delete restrict,
  display_name text not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint supported_people_display_name_length
    check (char_length(btrim(display_name)) between 1 and 80)
);

create table public.care_space_memberships (
  id uuid primary key default gen_random_uuid(),
  care_space_id uuid not null references public.care_spaces (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  role text not null default 'organiser',
  relationship_type text not null,
  relationship_label text,
  bootstrap_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint care_space_memberships_user_space_unique unique (user_id, care_space_id),
  constraint care_space_memberships_user_bootstrap_unique unique (user_id, bootstrap_id),
  constraint care_space_memberships_role check (role = 'organiser'),
  constraint care_space_memberships_relationship_type check (
    relationship_type in ('Mum', 'Dad', 'Partner', 'Child', 'Grandparent', 'Other relative', 'Someone else')
  ),
  constraint care_space_memberships_relationship_label check (
    case
      when relationship_type in ('Other relative', 'Someone else')
        then char_length(btrim(relationship_label)) between 1 and 50
      else relationship_label is null
    end
  )
);

create index care_space_memberships_care_space_idx on public.care_space_memberships (care_space_id);
create index care_space_memberships_user_idx on public.care_space_memberships (user_id);

create function public.protect_membership_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.care_space_id <> old.care_space_id
    or new.user_id <> old.user_id
    or new.role <> old.role
    or new.bootstrap_id <> old.bootstrap_id then
    raise exception 'Membership ownership identifiers are immutable' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function public.protect_membership_identity() from public;
create trigger care_space_memberships_protect_identity
before update on public.care_space_memberships
for each row execute function public.protect_membership_identity();

create function public.is_care_space_member(target_care_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_space_memberships membership
    where membership.care_space_id = target_care_space_id
      and membership.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_care_space_member(uuid) from public;
grant execute on function public.is_care_space_member(uuid) to authenticated;

alter table public.care_spaces enable row level security;
alter table public.care_spaces force row level security;
alter table public.supported_people enable row level security;
alter table public.supported_people force row level security;
alter table public.care_space_memberships enable row level security;
alter table public.care_space_memberships force row level security;

revoke all on table public.care_spaces, public.supported_people, public.care_space_memberships from anon, authenticated;
grant select on table public.care_spaces, public.supported_people, public.care_space_memberships to authenticated;

create policy "members can read their care spaces"
on public.care_spaces for select to authenticated
using (public.is_care_space_member(id));

create policy "members can read supported people"
on public.supported_people for select to authenticated
using (public.is_care_space_member(care_space_id));

create policy "members can read care space memberships"
on public.care_space_memberships for select to authenticated
using (public.is_care_space_member(care_space_id));

create function public.bootstrap_supported_people(people_payload jsonb)
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
begin
  if caller_id is null or auth.role() <> 'authenticated' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(people_payload) <> 'array' or jsonb_array_length(people_payload) < 1 or jsonb_array_length(people_payload) > 20 then
    raise exception 'A roster of 1 to 20 people is required' using errcode = '22023';
  end if;

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
      insert into public.care_spaces (bootstrap_owner_id, bootstrap_id)
      values (caller_id, item_draft_id)
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

create function public.list_my_supported_people()
returns table (draft_id uuid, care_space_id uuid, supported_person_id uuid, membership_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select membership.bootstrap_id, membership.care_space_id, person.id, membership.id
  from public.care_space_memberships membership
  join public.supported_people person on person.care_space_id = membership.care_space_id
  where membership.user_id = (select auth.uid())
  order by membership.created_at, membership.id;
$$;

revoke all on function public.bootstrap_supported_people(jsonb) from public;
revoke all on function public.list_my_supported_people() from public;
revoke all on function public.bootstrap_supported_people(jsonb) from anon;
revoke all on function public.list_my_supported_people() from anon;
grant execute on function public.bootstrap_supported_people(jsonb) to authenticated;
grant execute on function public.list_my_supported_people() to authenticated;

comment on table public.care_spaces is 'One security and ownership boundary for one supported person.';
comment on column public.care_spaces.bootstrap_owner_id is 'Idempotency metadata only; access is granted exclusively through membership.';
comment on table public.care_space_memberships is 'Connects an authenticated user to a care space; relationship is relative to this member.';
