-- Profile avatars: lets an organiser add a real photo to their own
-- account, replacing the initial-letter circle Account/Care
-- Circle/People have always shown. `profiles.avatar_path` already existed
-- (Phase 5) but nothing ever wrote or read it -- this migration is the
-- storage side; the client (src/profileAvatar.ts) is what actually
-- writes profiles.avatar_path.
--
-- Deliberately narrow, mirroring the exact document-attachments pattern
-- (Phase 16) rather than inventing a new one: a private bucket, one
-- object per user at a fixed path ("{auth.uid()}/avatar.jpg", upsert
-- overwrites), RLS scoped to the owner only. Scope reduction, named
-- rather than silently assumed: this pass only lets a user manage and
-- see their OWN avatar -- showing one member's photo to other care-
-- circle members (e.g. in Care Circle's own member list) is a real,
-- separate product decision (a new read policy, likely scoped by shared
-- care-space membership) not made here; today only the account's own
-- Account screen displays it.

insert into storage.buckets (id, name, public, file_size_limit)
values ('profile-avatars', 'profile-avatars', false, 5242880)
on conflict (id) do nothing;

-- Path convention: "{auth.uid()}/avatar.jpg" -- the folder segment IS
-- the owning user's id, so ownership is checked directly against it,
-- exactly as document-attachments checks a care_space_id folder segment
-- against domain access. One fixed filename per user (upsert replaces
-- it), so changing your photo never accumulates orphaned old files.

create policy "profile avatar: owner can read their own"
on storage.objects for select to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "profile avatar: owner can upload their own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "profile avatar: owner can replace their own"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "profile avatar: owner can remove their own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
