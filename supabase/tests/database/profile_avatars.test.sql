begin;

set local role postgres;
drop extension if exists pgtap;
create extension pgtap with schema extensions;
set search_path = public, extensions, pgtap;

select extensions.plan(5);

insert into auth.users (id, email)
values
  ('b9000000-0000-0000-0000-000000000001', 'avatar-david@example.test'),
  ('b9000000-0000-0000-0000-000000000002', 'avatar-sarah@example.test');

-- ---------------------------------------------------------------------
-- profile-avatars storage.objects RLS (row-level only -- no real file
-- service running under pgTAP; this proves the access boundary, not
-- byte transfer -- same limitation/approach as Phase 16's own
-- document-attachments RLS coverage).
-- ---------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b9000000-0000-0000-0000-000000000001', true);
select extensions.lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('profile-avatars', 'b9000000-0000-0000-0000-000000000001/avatar.jpg', auth.uid()) $$,
  'a user can upload their own avatar object'
);
select extensions.is(
  (select count(*) from storage.objects where bucket_id = 'profile-avatars' and name = 'b9000000-0000-0000-0000-000000000001/avatar.jpg'),
  1::bigint,
  'the owner can read their own avatar object'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b9000000-0000-0000-0000-000000000002', true);
select extensions.throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('profile-avatars', 'b9000000-0000-0000-0000-000000000001/avatar.jpg', auth.uid()) $$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'a different user cannot upload into another user''s avatar path'
);
select extensions.is(
  (select count(*) from storage.objects where bucket_id = 'profile-avatars' and name like 'b9000000-0000-0000-0000-000000000001/%'),
  0::bigint,
  'a different user sees zero rows under another user''s avatar path -- avatars are not shared by default'
);
select extensions.lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('profile-avatars', 'b9000000-0000-0000-0000-000000000002/avatar.jpg', auth.uid()) $$,
  'a user can upload their own avatar object under their own id, independent of any other user''s'
);

select * from extensions.finish();
rollback;
