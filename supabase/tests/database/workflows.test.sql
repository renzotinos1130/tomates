-- =============================================================================
-- Team Tomate HQ — workflows: access rules and server-side stamps.
-- Run with: npx supabase test db   (self-contained, rolled back at the end)
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- Fixtures: alice (first user → active admin), carl (not invited → pending).
delete from public.members;
delete from public.member_invites;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'authenticated', 'authenticated', 'alice@test.local', '{"full_name":"Alice Admin"}', '2026-01-01 09:00+00');
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'authenticated', 'authenticated', 'carl@test.local', '{}', '2026-01-01 09:02+00');

select has_table('public', 'workflows', 'workflows table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.workflows'::regclass),
  true,
  'row level security is enabled on workflows'
);

-- anon: nothing
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select count(*) from public.workflows $$,
  '42501', null,
  'anon cannot read workflows'
);
reset role;

-- active member: full CRUD, stamps decided by the server
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$ insert into public.workflows (id, name, created_by, updated_by)
     values ('99999999-0000-4000-8000-000000000001', 'Publication',
             'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc') $$,
  'an active member can create a workflow'
);
select results_eq(
  $$ select created_by, updated_by from public.workflows where id = '99999999-0000-4000-8000-000000000001' $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid) $$,
  'created_by / updated_by are the caller, whatever the client sent'
);
select is(
  (select graph from public.workflows where id = '99999999-0000-4000-8000-000000000001'),
  '{"nodes": [], "edges": []}'::jsonb,
  'graph defaults to an empty canvas'
);

update public.workflows
set graph = '{"nodes":[{"id":"a","position":{"x":0,"y":0},"data":{"label":"A","detail":"","kind":"trigger"}}],"edges":[]}',
    created_by = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    updated_at = '2020-01-01'
where id = '99999999-0000-4000-8000-000000000001';

select results_eq(
  $$ select created_by, updated_at > '2025-01-01'::timestamptz, jsonb_array_length(graph -> 'nodes')
     from public.workflows where id = '99999999-0000-4000-8000-000000000001' $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, true, 1) $$,
  'update saves the graph, keeps created_by and stamps updated_at on the server'
);

select throws_ok(
  $$ update public.workflows set graph = '[]'::jsonb where id = '99999999-0000-4000-8000-000000000001' $$,
  '23514', null,
  'a malformed graph is rejected'
);
select throws_ok(
  $$ insert into public.workflows (name) values ('   ') $$,
  '23514', null,
  'a blank name is rejected'
);

-- pending member: sees nothing, cannot write
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.workflows $$,
  'a pending member sees no workflow'
);
select throws_ok(
  $$ insert into public.workflows (name) values ('Intrus') $$,
  '42501', null,
  'a pending member cannot create a workflow'
);
update public.workflows set name = 'Piraté' where id = '99999999-0000-4000-8000-000000000001';
reset role;
select is(
  (select name from public.workflows where id = '99999999-0000-4000-8000-000000000001'),
  'Publication',
  'a pending member cannot modify a workflow'
);

-- Deleting what a canvas refers to (its author, its project) must neither be blocked by the
-- stamp trigger nor count as an edit. Timestamps are backdated: now() is constant in a transaction.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'authenticated', 'authenticated', 'erin@test.local', '{}', '2026-01-01 09:03+00');
insert into public.projects (id, slug, name, created_by)
values ('99999999-0000-4000-8000-0000000000aa', 'wf-test', 'Projet test', null);

set local request.jwt.claims = '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}';
insert into public.workflows (id, name, project_id, created_at, updated_at)
values ('99999999-0000-4000-8000-000000000002', 'Canevas d''Erin',
        '99999999-0000-4000-8000-0000000000aa', '2020-01-01', '2020-01-01');
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$ delete from auth.users where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  'a member who created a canvas can be removed'
);
select results_eq(
  $$ select created_by, updated_by, updated_at from public.workflows where id = '99999999-0000-4000-8000-000000000002' $$,
  $$ values (null::uuid, null::uuid, '2020-01-01'::timestamptz) $$,
  'their canvas stays, without an author, and is not marked as modified'
);
select lives_ok(
  $$ delete from public.projects where id = '99999999-0000-4000-8000-0000000000aa' $$,
  'the project a canvas is linked to can be deleted'
);
select results_eq(
  $$ select project_id, updated_by, updated_at from public.workflows where id = '99999999-0000-4000-8000-000000000002' $$,
  $$ values (null::uuid, null::uuid, '2020-01-01'::timestamptz) $$,
  'the canvas is unlinked from the project without being marked as modified'
);

select ok(
  exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workflows'
  ),
  'workflows is in the supabase_realtime publication'
);

select * from finish();

rollback;
