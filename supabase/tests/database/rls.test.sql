-- =============================================================================
-- Team Tomate HQ — RLS, triggers and membership logic.
-- Run with: npx supabase test db
--
-- Self-contained: everything happens in one transaction that is rolled back.
-- The seeded members are removed inside the transaction so handle_new_user's
-- "first user becomes super administrator" branch can be exercised on a clean slate. The
-- suite passes with or without the demo data of `npm run seed:local`.
--
-- Users are simulated with:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(94);

-- -----------------------------------------------------------------------------
-- Fixtures
--   alice  aaaaaaaa-…  first user              → active super administrator
--   bob    bbbbbbbb-…  invited as member        → active member
--   carl   cccccccc-…  not invited              → pending
--   dana   dddddddd-…  invited as admin         → active admin
-- -----------------------------------------------------------------------------

delete from public.members;
delete from public.member_invites;
-- Demo meetings, if any, would collide with the week used below (one meeting per week).
delete from public.meetings;

insert into public.member_invites (email, role) values
  ('bob@test.local',  'member'),
  ('dana@test.local', 'admin');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'authenticated', 'authenticated', 'alice@test.local', '{"full_name":"Alice Admin"}',
        '2026-01-01 09:00+00');

-- Mixed-case email + no full_name: invite match must be case-insensitive.
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'authenticated', 'authenticated', 'Bob@Test.Local', '{}',
        '2026-01-01 09:01+00');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'authenticated', 'authenticated', 'carl.martin@test.local', '{}',
        '2026-01-01 09:02+00');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values ('00000000-0000-0000-0000-000000000000', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'authenticated', 'authenticated', 'dana@test.local', '{"full_name":"Dana D."}',
        '2026-01-01 09:03+00');


-- =============================================================================
-- 1. handle_new_user
-- =============================================================================

select results_eq(
  $$ select email, full_name, role::text, active from public.members
     where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  $$ values ('alice@test.local', 'Alice Admin', 'super_admin', true) $$,
  'first user becomes the active super administrator, full_name from user metadata'
);

select results_eq(
  $$ select email, full_name, role::text, active from public.members
     where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  $$ values ('bob@test.local', 'Bob', 'member', true) $$,
  'invited user is activated with the invite role; email lowercased; name from email local part'
);

select is_empty(
  $$ select 1 from public.member_invites where email = 'bob@test.local' $$,
  'the invite is consumed on sign-up'
);

select results_eq(
  $$ select email, full_name, role::text, active from public.members
     where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' $$,
  $$ values ('carl.martin@test.local', 'Carl Martin', 'member', false) $$,
  'non-invited user is pending (inactive member)'
);

select results_eq(
  $$ select full_name, role::text, active from public.members
     where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' $$,
  $$ values ('Dana D.', 'admin', true) $$,
  'invite role admin is honoured'
);

select results_eq(
  $$ select color from public.members order by created_at $$,
  $$ values ('teal'), ('amber'), ('indigo'), ('rose') $$,
  'colors cycle through the palette by member count'
);

select is(
  (select created_at from public.members where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '2026-01-01 09:00+00'::timestamptz,
  'members.created_at mirrors auth.users.created_at'
);

update auth.users set email = 'Alice.New@test.local' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(
  (select email from public.members where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'alice.new@test.local',
  'members.email follows email changes in auth.users (lowercased)'
);


-- =============================================================================
-- 2. anon gets nothing
-- =============================================================================

select is(
  (select count(*)::int
   from pg_catalog.pg_tables t
   cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) as p(priv)
   where t.schemaname = 'public'
     and has_table_privilege('anon', format('public.%I', t.tablename), p.priv)),
  0,
  'anon has no privilege on any public table'
);

select ok(
  not has_function_privilege('anon', 'public.is_admin()', 'execute')
  and not has_function_privilege('anon', 'public.is_active_member()', 'execute'),
  'anon cannot execute the RLS helper functions'
);

select is(
  (select count(*)::int from pg_catalog.pg_tables
   where schemaname = 'public' and not rowsecurity),
  0,
  'RLS is enabled on every public table'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok($$ select * from public.tasks $$,    '42501', null, 'anon cannot read tasks');
select throws_ok($$ select * from public.members $$,  '42501', null, 'anon cannot read members');
select throws_ok($$ select * from public.projects $$, '42501', null, 'anon cannot read projects');
select throws_ok(
  $$ insert into public.tasks (project_id, title)
     select id, 'anon task' from public.projects limit 1 $$,
  '42501', null, 'anon cannot insert tasks'
);

reset role;


-- =============================================================================
-- 3. Active member CRUD on tasks (bob)
-- =============================================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select ok(public.is_active_member(), 'bob is an active member');
select ok(not public.is_admin(), 'bob is not an admin');

select results_eq(
  $$ select slug from public.projects order by position $$,
  $$ values ('application'), ('site-web'), ('medias-sociaux') $$,
  'active member sees the three seeded projects'
);

select lives_ok(
  $$ insert into public.tasks (id, project_id, title)
     values ('10000000-0000-4000-8000-000000000001',
             (select id from public.projects where slug = 'application'),
             'Préparer la démo') $$,
  'active member can insert a task'
);

select results_eq(
  $$ select created_by, status::text, priority::text, description, completed_at is null
     from public.tasks where id = '10000000-0000-4000-8000-000000000001' $$,
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 'todo', 'normal', '', true) $$,
  'task defaults: created_by = auth.uid(), todo, normal, empty description, not completed'
);

select results_eq(
  $$ select kind, actor_id, old_value, new_value from public.task_events
     where task_id = '10000000-0000-4000-8000-000000000001' $$,
  $$ values ('created', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, null::text, 'Préparer la démo') $$,
  'insert writes a created event (actor = auth.uid(), new_value = title)'
);

select lives_ok(
  $$ update public.tasks set description = 'Avec la maquette v2'
     where id = '10000000-0000-4000-8000-000000000001' $$,
  'active member can update a task'
);

select is(
  (select description from public.tasks where id = '10000000-0000-4000-8000-000000000001'),
  'Avec la maquette v2',
  'task update is visible'
);

select lives_ok(
  $$ insert into public.subtasks (task_id, title)
     values ('10000000-0000-4000-8000-000000000001', 'Écrire le script') $$,
  'active member can insert a subtask'
);

select lives_ok(
  $$ insert into public.meetings (id, week_start) values ('20000000-0000-4000-8000-000000000001', '2026-11-11');
     insert into public.meeting_items (meeting_id, kind, body)
       values ('20000000-0000-4000-8000-000000000001', 'decision', 'On lance la bêta');
     insert into public.meeting_priorities (meeting_id, task_id)
       values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001') $$,
  'active member can create a meeting, an item and a priority'
);

select lives_ok(
  $$ insert into public.tasks (id, project_id, title)
     values ('10000000-0000-4000-8000-000000000002',
             (select id from public.projects where slug = 'site-web'), 'À supprimer');
     delete from public.tasks where id = '10000000-0000-4000-8000-000000000002' $$,
  'active member can delete a task'
);

select is_empty(
  $$ select 1 from public.tasks where id = '10000000-0000-4000-8000-000000000002' $$,
  'deleted task is gone'
);


-- =============================================================================
-- 4. completed_at / status_changed_at
-- =============================================================================

select lives_ok(
  $$ insert into public.tasks (id, project_id, title, status, completed_at, created_at, updated_at, status_changed_at)
     values
       -- todo with a stray completed_at → cleared
       ('10000000-0000-4000-8000-000000000003', (select id from public.projects where slug = 'application'),
        'Todo', 'todo', '2026-02-01 12:00+00', '2026-01-10 08:00+00', '2026-01-10 08:00+00', '2026-01-10 08:00+00'),
       -- done without completed_at → now()
       ('10000000-0000-4000-8000-000000000004', (select id from public.projects where slug = 'application'),
        'Done now', 'done', null, '2026-01-10 08:00+00', '2026-01-10 08:00+00', '2026-01-10 08:00+00'),
       -- done with a backdated completed_at → kept
       ('10000000-0000-4000-8000-000000000005', (select id from public.projects where slug = 'application'),
        'Done before', 'done', '2026-01-15 17:00+00', '2026-01-10 08:00+00', '2026-01-10 08:00+00', '2026-01-12 08:00+00') $$,
  'insert tasks with backdated timestamps'
);

select results_eq(
  $$ select id::text, completed_at, created_at, updated_at, status_changed_at
     from public.tasks
     where id in ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004',
                  '10000000-0000-4000-8000-000000000005')
     order by id $$,
  $$ values
       ('10000000-0000-4000-8000-000000000003', null::timestamptz,
        '2026-01-10 08:00+00'::timestamptz, '2026-01-10 08:00+00'::timestamptz, '2026-01-10 08:00+00'::timestamptz),
       ('10000000-0000-4000-8000-000000000004', now(),
        '2026-01-10 08:00+00'::timestamptz, '2026-01-10 08:00+00'::timestamptz, '2026-01-10 08:00+00'::timestamptz),
       ('10000000-0000-4000-8000-000000000005', '2026-01-15 17:00+00'::timestamptz,
        '2026-01-10 08:00+00'::timestamptz, '2026-01-10 08:00+00'::timestamptz, '2026-01-12 08:00+00'::timestamptz) $$,
  'BEFORE INSERT: completed_at derived from status, provided timestamps respected'
);

update public.tasks set priority = 'high' where id = '10000000-0000-4000-8000-000000000003';

select results_eq(
  $$ select updated_at, status_changed_at from public.tasks where id = '10000000-0000-4000-8000-000000000003' $$,
  $$ values (now(), '2026-01-10 08:00+00'::timestamptz) $$,
  'update without status change: updated_at bumped, status_changed_at untouched'
);

update public.tasks set status = 'in_progress' where id = '10000000-0000-4000-8000-000000000003';

select results_eq(
  $$ select status_changed_at, completed_at from public.tasks where id = '10000000-0000-4000-8000-000000000003' $$,
  $$ values (now(), null::timestamptz) $$,
  'status change bumps status_changed_at, completed_at stays null'
);

update public.tasks set status = 'done' where id = '10000000-0000-4000-8000-000000000003';

select is(
  (select completed_at from public.tasks where id = '10000000-0000-4000-8000-000000000003'),
  now(),
  'moving to done sets completed_at'
);

update public.tasks set title = 'Done before (renamed)' where id = '10000000-0000-4000-8000-000000000005';

select is(
  (select completed_at from public.tasks where id = '10000000-0000-4000-8000-000000000005'),
  '2026-01-15 17:00+00'::timestamptz,
  'editing a done task keeps its completed_at'
);

update public.tasks set status = 'review' where id = '10000000-0000-4000-8000-000000000005';

select results_eq(
  $$ select completed_at, status_changed_at from public.tasks where id = '10000000-0000-4000-8000-000000000005' $$,
  $$ values (null::timestamptz, now()) $$,
  'leaving done clears completed_at'
);


-- =============================================================================
-- 5. task_events on update
-- =============================================================================

update public.tasks
set status      = 'in_progress',
    priority    = 'high',
    assignee_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    due_date    = '2026-12-01',
    title       = 'Préparer la démo client'
where id = '10000000-0000-4000-8000-000000000001';

select results_eq(
  $$ select e.kind, e.old_value, e.new_value, e.actor_id, e.project_id = t.project_id
     from public.task_events e
     join public.tasks t on t.id = e.task_id
     where e.task_id = '10000000-0000-4000-8000-000000000001' and e.kind <> 'created'
     order by e.kind $$,
  $$ values
       ('assignee', null::text, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, true),
       ('due_date', null::text, '2026-12-01',                           'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, true),
       ('priority', 'normal',   'high',                                 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, true),
       ('status',   'todo',     'in_progress',                          'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, true),
       ('title',    'Préparer la démo', 'Préparer la démo client',      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, true) $$,
  'one event per changed field, actor = auth.uid(); description change is not logged'
);

select is(
  (select count(*)::int from public.task_events where task_id = '10000000-0000-4000-8000-000000000001'),
  6,
  'no event for untracked columns (description update earlier)'
);

-- Switch actor: alice archives, moves and unarchives the task.
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

update public.tasks set archived_at = '2026-11-11 10:00+00' where id = '10000000-0000-4000-8000-000000000001';

select results_eq(
  $$ select old_value, new_value, actor_id from public.task_events
     where task_id = '10000000-0000-4000-8000-000000000001' and kind = 'archived' $$,
  $$ values (null::text, '2026-11-11T10:00:00+00:00', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid) $$,
  'archiving writes an archived event (ISO timestamp) with the new actor'
);

update public.tasks set archived_at = null where id = '10000000-0000-4000-8000-000000000001';

select results_eq(
  $$ select old_value, new_value from public.task_events
     where task_id = '10000000-0000-4000-8000-000000000001' and kind = 'unarchived' $$,
  $$ values ('2026-11-11T10:00:00+00:00', null::text) $$,
  'unarchiving writes an unarchived event'
);

update public.tasks
set project_id = (select id from public.projects where slug = 'site-web'),
    due_date = null
where id = '10000000-0000-4000-8000-000000000001';

select results_eq(
  $$ select e.kind, e.old_value, e.new_value, e.project_id
     from public.task_events e
     where e.task_id = '10000000-0000-4000-8000-000000000001' and e.kind in ('project', 'due_date')
       and e.actor_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     order by e.kind $$,
  $$ select 'due_date', '2026-12-01', null::text, s.id
     from public.projects s where s.slug = 'site-web'
     union all
     select 'project', a.id::text, s.id::text, s.id
     from public.projects a, public.projects s where a.slug = 'application' and s.slug = 'site-web' $$,
  'moving project logs old/new project ids; event project_id is the new project'
);


-- =============================================================================
-- 6. Pending member (carl) sees and writes nothing
-- =============================================================================

set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';

select ok(not public.is_active_member(), 'carl is not an active member');
select is_empty($$ select 1 from public.tasks $$,       'pending member sees no tasks');
select is_empty($$ select 1 from public.projects $$,    'pending member sees no projects');
select is_empty($$ select 1 from public.task_events $$, 'pending member sees no task events');
select is_empty($$ select 1 from public.meetings $$,    'pending member sees no meetings');

select results_eq(
  $$ select id from public.members $$,
  $$ values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid) $$,
  'pending member only sees their own members row'
);

select throws_ok(
  $$ insert into public.tasks (project_id, title)
     values ((select id from public.projects limit 1), 'Pending task') $$,
  '42501', null, 'pending member cannot insert tasks'
);

select throws_ok(
  $$ update public.members set active = true where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' $$,
  '42501', null, 'pending member cannot activate themselves'
);

select lives_ok(
  $$ update public.members set full_name = 'Carl M.' where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' $$,
  'pending member can edit their own display name'
);


-- =============================================================================
-- 7. members guard (bob = non-admin, alice = super administrator)
-- =============================================================================

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select throws_ok(
  $$ update public.members set role = 'admin' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  '42501', null, 'non-admin cannot make themselves admin'
);

select throws_ok(
  $$ update public.members set active = false where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  '42501', null, 'non-admin cannot change their own active flag'
);

select throws_ok(
  $$ update public.members set email = 'bob2@test.local' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  '42501', null, 'non-admin cannot change their email'
);

select lives_ok(
  $$ update public.members set full_name = 'Bob B.', color = 'sky', avatar_url = 'https://x.test/b.png'
     where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  'non-admin can edit full_name, color and avatar_url on their own row'
);

update public.members set full_name = 'Hacked' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
delete from public.members where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

reset role;

select results_eq(
  $$ select (select full_name from public.members where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
            (select count(*)::int from public.members where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc') $$,
  $$ values ('Alice Admin', 1) $$,
  'non-admin cannot edit or delete other members (RLS filters the rows)'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$ update public.members set active = true where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' $$,
  'admin can activate a pending member'
);

select lives_ok(
  $$ update public.members set role = 'member' where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' $$,
  'the super administrator can demote an administrator'
);

select throws_ok(
  $$ update public.members set role = 'member' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  'P0001', null, 'the last active super administrator cannot demote themselves'
);

select throws_ok(
  $$ update public.members set active = false where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  'P0001', null, 'the last active super administrator cannot deactivate themselves'
);

select throws_ok(
  $$ update public.members set id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  '42501', null, 'members.id is immutable from the API'
);

-- Carl is now active: he can see tasks.
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';

select isnt_empty($$ select 1 from public.tasks $$, 'once activated, carl sees tasks');


-- =============================================================================
-- 8. comments
-- =============================================================================

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select throws_ok(
  $$ insert into public.comments (task_id, author_id, body)
     values ('10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Usurpation') $$,
  '42501', null, 'cannot post a comment as someone else'
);

select lives_ok(
  $$ insert into public.comments (id, task_id, body)
     values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Je m''en occupe') $$,
  'can post a comment (author_id defaults to auth.uid())'
);

select results_eq(
  $$ select kind, actor_id, old_value, new_value from public.task_events
     where task_id = '10000000-0000-4000-8000-000000000001' and kind = 'commented' $$,
  $$ values ('commented', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, null::text, '30000000-0000-4000-8000-000000000001') $$,
  'comment insert writes a commented event (new_value = comment id)'
);

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

update public.comments set body = 'Modifié par Alice' where id = '30000000-0000-4000-8000-000000000001';
delete from public.comments where id = '30000000-0000-4000-8000-000000000001';

select is(
  (select body from public.comments where id = '30000000-0000-4000-8000-000000000001'),
  'Je m''en occupe',
  'cannot edit or delete someone else''s comment'
);


-- =============================================================================
-- 9. task_events is read-only for clients
-- =============================================================================

select throws_ok(
  $$ insert into public.task_events (task_id, project_id, kind)
     select id, project_id, 'created' from public.tasks limit 1 $$,
  '42501', null, 'clients cannot insert into task_events'
);

select throws_ok(
  $$ update public.task_events set new_value = 'x' $$,
  '42501', null, 'clients cannot update task_events'
);

select throws_ok(
  $$ delete from public.task_events $$,
  '42501', null, 'clients cannot delete task_events'
);


-- =============================================================================
-- 10. member_invites are admin-only
-- =============================================================================

select lives_ok(
  $$ insert into public.member_invites (email) values ('eve@test.local') $$,
  'admin can invite'
);

select is(
  (select invited_by from public.member_invites where email = 'eve@test.local'),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'invited_by defaults to the admin'
);

select throws_ok(
  $$ insert into public.member_invites (email) values ('Frank@Test.local') $$,
  '23514', null, 'invite emails must be lowercase'
);

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select is_empty($$ select 1 from public.member_invites $$, 'non-admin cannot read invites');

select throws_ok(
  $$ insert into public.member_invites (email) values ('mallory@test.local') $$,
  '42501', null, 'non-admin cannot invite'
);

reset role;


-- =============================================================================
-- 11. Super administrator, administrators and passwords
--     alice = super administrator · dana = administrator · bob, carl = partners
-- =============================================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select ok(public.is_super_admin() and public.is_admin(), 'the first member is the super administrator (and an administrator)');

select ok(
  not has_function_privilege('anon', 'public.is_super_admin()', 'execute'),
  'anon cannot call is_super_admin()'
);

select lives_ok(
  $$ update public.members set role = 'admin' where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' $$,
  'the super administrator names an administrator'
);

-- Dana, administrator: the access of partners, not the roles, not the other administrators.
set local request.jwt.claims = '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}';

select ok(public.is_admin() and not public.is_super_admin(), 'an administrator is not a super administrator');

select throws_ok(
  $$ update public.members set role = 'admin' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  '42501', null, 'an administrator cannot change a role'
);

select throws_ok(
  $$ update public.members set active = false where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501', null, 'an administrator cannot touch the super administrator'
);

select throws_ok(
  $$ delete from public.members where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '42501', null, 'an administrator cannot remove the super administrator'
);

select lives_ok(
  $$ update public.members set active = false where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  'an administrator can deactivate a partner'
);

select lives_ok(
  $$ update public.members set active = true where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  'and give the access back'
);

select throws_ok(
  $$ update public.members set must_change_password = true where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  '42501', null, 'the password flag is not written from the API, even by an administrator'
);

select throws_ok(
  $$ insert into public.member_invites (email, role) values ('grace@test.local', 'admin') $$,
  '42501', null, 'an administrator cannot invite an administrator'
);

select lives_ok(
  $$ insert into public.member_invites (email, role) values ('grace@test.local', 'member') $$,
  'an administrator can invite a partner'
);

reset role;

select throws_ok(
  $$ insert into public.member_invites (email, role) values ('heidi@test.local', 'super_admin') $$,
  '23514', null, 'an invitation never makes a super administrator'
);

-- The server sets a temporary password for bob: until he has chosen his own, he is not an
-- active member — he sees his own row, and nothing else.
update public.members set must_change_password = true where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select ok(not public.is_active_member(), 'a member who must change their password is not an active member');

select is_empty($$ select 1 from public.tasks $$, 'and sees no task');

select results_eq(
  $$ select must_change_password from public.members $$,
  $$ values (true) $$,
  'but sees their own row, and only it'
);

select throws_ok(
  $$ update public.members set must_change_password = false where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  '42501', null, 'and cannot clear the flag themselves'
);

reset role;
-- The server clears it once the password has been changed.
update public.members set must_change_password = false where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select isnt_empty($$ select 1 from public.tasks $$, 'once the password is changed, the member sees the tasks again');

reset role;

-- An account created by the server with a temporary password: active at once (it was invited
-- in the same breath), and flagged from its first second.
insert into public.member_invites (email, role) values ('ivan@test.local', 'member');
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at)
values ('00000000-0000-0000-0000-000000000000', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'authenticated', 'authenticated', 'ivan@test.local', '{"full_name":"Ivan I."}',
        '{"must_change_password": true}', '2026-01-01 09:04+00');

select results_eq(
  $$ select full_name, role::text, active, must_change_password from public.members
     where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' $$,
  $$ values ('Ivan I.', 'member', true, true) $$,
  'an account created with a temporary password is active and must change it'
);

-- What the Auth server really does: it inserts the user, then writes the app metadata with an
-- UPDATE in the same transaction; and it writes them again each time the server sets a password.
insert into public.member_invites (email, role) values ('judy@test.local', 'member');
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at)
values ('00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        'authenticated', 'authenticated', 'judy@test.local', '{"full_name":"Judy J."}',
        '{"provider": "email"}', '2026-01-01 09:05+00');
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"must_change_password": true}'
where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

select is(
  (select must_change_password from public.members where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
  true,
  'the flag written in the app metadata after the insert reaches the member'
);

update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"providers": ["email"]}'
where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

select is(
  (select must_change_password from public.members where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
  true,
  'another write of the app metadata leaves the flag as it is'
);

update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"must_change_password": false}'
where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

select is(
  (select must_change_password from public.members where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
  false,
  'and it is cleared the same way, once the member has chosen a password'
);


-- =============================================================================
-- 12. Realtime publication
-- =============================================================================

select is(
  (select array_agg(tablename::text order by tablename::text)
   from pg_catalog.pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public'),
  array['chat_conversations', 'chat_messages', 'chat_participants', 'comments', 'meeting_items',
        'meeting_priorities', 'meetings', 'member_invites', 'members', 'projects', 'subtasks',
        'task_attachments', 'task_events', 'tasks', 'tower_runs', 'tower_team_crates', 'tower_team_towers',
        'workflows'],
  'all app tables are in the supabase_realtime publication'
);

select * from finish();

rollback;
