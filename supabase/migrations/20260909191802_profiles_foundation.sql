create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_path text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint profiles_display_name_length
    check (char_length(btrim(display_name)) between 1 and 100),
  constraint profiles_avatar_path_length
    check (avatar_path is null or char_length(btrim(avatar_path)) between 1 and 1024)
);

comment on table public.profiles is
  'Private Lilica application profiles. The primary key is the separate Supabase Auth account identity.';
comment on column public.profiles.avatar_path is
  'Optional private storage path reserved for Phase 5; not a public URL.';

create function public.set_profile_audit_timestamps()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function public.set_profile_audit_timestamps() from public;

create trigger profiles_set_audit_timestamps
before update on public.profiles
for each row
execute function public.set_profile_audit_timestamps();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.profiles from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;

create policy "profile owners can read their profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profile owners can create their profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profile owners can update their profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
