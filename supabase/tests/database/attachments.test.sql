-- =============================================================================
-- Team Tomate HQ — files attached to tasks: the rows, the bucket, who reaches them.
-- Run with: npx supabase test db   (self-contained, rolled back at the end)
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

-- Fixtures: alice (first user → active), bob (invited → active), carl (not invited → pending),
-- and one task of the seeded project « Application ».
delete from public.members;
delete from public.member_invites;
insert into public.member_invites (email, role) values ('bob@test.local', 'member');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'authenticated', 'authenticated', 'alice@test.local', '{"full_name":"Alice Admin"}', '2026-01-01 09:00+00'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'authenticated', 'authenticated', 'bob@test.local', '{"full_name":"Bob B."}', '2026-01-01 09:01+00'),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'authenticated', 'authenticated', 'carl@test.local', '{}', '2026-01-01 09:02+00');

insert into public.tasks (id, project_id, title)
values ('70000000-0000-4000-8000-000000000001', (select id from public.projects where slug = 'application'), 'Tâche avec fichiers'),
       ('70000000-0000-4000-8000-000000000002', (select id from public.projects where slug = 'application'), 'Tâche à supprimer');

-- ----------------------------------------------------------------------------- the table
select has_table('public', 'task_attachments', 'task_attachments table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.task_attachments'::regclass),
  true,
  'row level security is enabled on task_attachments'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select count(*) from public.task_attachments $$,
  '42501', null,
  'anon cannot read attachments'
);
reset role;

-- An active member adds a file, in their own name, at the server's time.
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select lives_ok(
  $$ insert into public.task_attachments (id, task_id, uploader_id, name, mime_type, size, storage_path, thumb_path, created_at)
     values ('71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001',
             'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Maquette d''accueil.png', 'image/png', 482113,
             '70000000-0000-4000-8000-000000000001/71000000-0000-4000-8000-000000000001/maquette-d-accueil.png',
             '70000000-0000-4000-8000-000000000001/71000000-0000-4000-8000-000000000001/apercu.webp',
             '2020-01-01 00:00+00') $$,
  'an active member can attach a file to a task'
);
select is(
  (select created_at > '2025-01-01'::timestamptz from public.task_attachments where id = '71000000-0000-4000-8000-000000000001'),
  true,
  'the time is the server''s, whatever the client sent'
);
select throws_ok(
  $$ insert into public.task_attachments (id, task_id, uploader_id, name, size, storage_path)
     values ('71000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001',
             'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'usurpation.txt', 10,
             '70000000-0000-4000-8000-000000000001/71000000-0000-4000-8000-000000000002/usurpation.txt') $$,
  '42501', null,
  'a file cannot be attached in someone else''s name'
);
select throws_ok(
  $$ insert into public.task_attachments (id, task_id, uploader_id, name, size, storage_path)
     values ('71000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000001',
             'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'trop-gros.mov', 104857601,
             '70000000-0000-4000-8000-000000000001/71000000-0000-4000-8000-000000000003/trop-gros.mov') $$,
  '23514', null,
  'a file over 100 MB is refused'
);
select throws_ok(
  $$ insert into public.task_attachments (id, task_id, uploader_id, name, size, storage_path)
     values ('71000000-0000-4000-8000-000000000004', '70000000-0000-4000-8000-000000000001',
             'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'ailleurs.txt', 10,
             '70000000-0000-4000-8000-000000000002/71000000-0000-4000-8000-000000000004/ailleurs.txt') $$,
  '23514', null,
  'a row cannot point to the folder of another task'
);
select throws_ok(
  $$ insert into public.task_attachments (id, task_id, uploader_id, name, size, storage_path, thumb_path)
     values ('71000000-0000-4000-8000-000000000005', '70000000-0000-4000-8000-000000000001',
             'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'vignette.png', 10,
             '70000000-0000-4000-8000-000000000001/71000000-0000-4000-8000-000000000005/vignette.png',
             '70000000-0000-4000-8000-000000000001/71000000-0000-4000-8000-000000000001/maquette-d-accueil.png') $$,
  '23514', null,
  'nor can its thumbnail be someone else''s file'
);
select throws_ok(
  $$ update public.task_attachments set name = 'autre.png' where id = '71000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'a file is never edited'
);

-- The history says it, in the uploader's name.
select results_eq(
  $$ select kind, new_value, actor_id from public.task_events
     where task_id = '70000000-0000-4000-8000-000000000001' and kind = 'attached' $$,
  $$ values ('attached', 'Maquette d''accueil.png', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid) $$,
  'adding a file is written in the task''s history'
);

-- A teammate sees it, and may remove it (as they may delete the task itself).
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
select is(
  (select count(*)::int from public.task_attachments where task_id = '70000000-0000-4000-8000-000000000001'),
  1,
  'a teammate sees the file'
);

-- Someone whose access is pending sees nothing and adds nothing.
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';
select is_empty($$ select 1 from public.task_attachments $$, 'a pending account sees no attachment');
select throws_ok(
  $$ insert into public.task_attachments (id, task_id, uploader_id, name, size, storage_path)
     values ('71000000-0000-4000-8000-000000000006', '70000000-0000-4000-8000-000000000001',
             'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'en-attente.txt', 10,
             '70000000-0000-4000-8000-000000000001/71000000-0000-4000-8000-000000000006/en-attente.txt') $$,
  '42501', null,
  'a pending account cannot attach a file'
);
delete from public.task_attachments where id = '71000000-0000-4000-8000-000000000001';
reset role;
select is(
  (select count(*)::int from public.task_attachments where id = '71000000-0000-4000-8000-000000000001'),
  1,
  'nor remove one'
);

-- ----------------------------------------------------------------------------- the bucket
select results_eq(
  $$ select public, file_size_limit from storage.buckets where id = 'task-files' $$,
  $$ values (false, 104857600::bigint) $$,
  'the bucket is private and stops at 100 MB a file'
);

-- The storage server writes objects as the member, under these same policies.
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('task-files', '70000000-0000-4000-8000-000000000001/71000000-0000-4000-8000-000000000001/maquette-d-accueil.png',
             'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') $$,
  'an active member can store a file under a task'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('task-files', '00000000-0000-4000-8000-00000000dead/71000000-0000-4000-8000-000000000009/perdu.png',
             'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') $$,
  '42501', null,
  'not under a task that does not exist'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('task-files', 'en-vrac.png', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') $$,
  '42501', null,
  'nor at the root of the bucket'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'task-files'),
  1,
  'a member reads what is stored'
);

set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';
select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'task-files' $$,
  'a pending account reads nothing in the bucket'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('task-files', '70000000-0000-4000-8000-000000000001/71000000-0000-4000-8000-00000000000a/pending.png',
             'cccccccc-cccc-4ccc-8ccc-cccccccccccc') $$,
  '42501', null,
  'and stores nothing in it'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'task-files' $$,
  'anon reads nothing in the bucket'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('task-files', '70000000-0000-4000-8000-000000000001/71000000-0000-4000-8000-00000000000b/anon.png') $$,
  '42501', null,
  'and stores nothing in it'
);
reset role;

-- ----------------------------------------------------------------------------- with the task
-- A task that goes takes the rows of its files with it (the app removes the stored bytes).
insert into public.task_attachments (id, task_id, uploader_id, name, size, storage_path)
values ('71000000-0000-4000-8000-00000000000c', '70000000-0000-4000-8000-000000000002',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'notes.txt', 42,
        '70000000-0000-4000-8000-000000000002/71000000-0000-4000-8000-00000000000c/notes.txt');
delete from public.tasks where id = '70000000-0000-4000-8000-000000000002';
select is_empty(
  $$ select 1 from public.task_attachments where task_id = '70000000-0000-4000-8000-000000000002' $$,
  'deleting a task removes the rows of its files'
);

-- A member who leaves: the file stays, without a name on it.
delete from auth.users where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select results_eq(
  $$ select name, uploader_id from public.task_attachments where id = '71000000-0000-4000-8000-000000000001' $$,
  $$ values ('Maquette d''accueil.png', null::uuid) $$,
  'a file outlives the account of whoever added it'
);

select is(
  (select count(*)::int from pg_catalog.pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_attachments'),
  1,
  'task_attachments is in the realtime publication'
);

select * from finish();
rollback;
