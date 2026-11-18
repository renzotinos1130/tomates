-- =============================================================================
-- Team Tomate HQ — several people on one task: the list and the old single
-- column always agree, whoever writes; the log and the announcements follow.
-- Run with: npx supabase test db   (self-contained, rolled back at the end)
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

-- Fixtures: alice (first user → active), bob and dana (invited → active).
delete from public.members;
delete from public.member_invites;
delete from public.push_outbox;
insert into public.member_invites (email, role) values ('bob@test.local', 'member'), ('dana@test.local', 'member');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'authenticated', 'authenticated', 'alice@test.local', '{"full_name":"Alice Admin"}', '2026-01-01 09:00+00'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'authenticated', 'authenticated', 'bob@test.local', '{"full_name":"Bob B."}', '2026-01-01 09:01+00'),
  ('00000000-0000-0000-0000-000000000000', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   'authenticated', 'authenticated', 'dana@test.local', '{"full_name":"Dana D."}', '2026-01-01 09:02+00');

select has_column('public', 'tasks', 'assignee_ids', 'a task has a list of people');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

-- ----------------------------------------------------------------------------- creating
-- A page that knows one person per task (the previous version of the app, still open somewhere).
insert into public.tasks (id, project_id, title, assignee_id)
values ('10000000-0000-4000-8000-0000000000c1', (select id from public.projects where slug = 'application'), 'Une personne', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select results_eq(
  $$ select assignee_id, assignee_ids from public.tasks where id = '10000000-0000-4000-8000-0000000000c1' $$,
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, array['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']::uuid[]) $$,
  'created with one person the old way: the list is that person'
);

-- The app as it is now: a list. The old column is its first.
insert into public.tasks (id, project_id, title, assignee_ids)
values ('10000000-0000-4000-8000-0000000000c2', (select id from public.projects where slug = 'application'), 'Deux personnes',
        array['dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']::uuid[]);
select results_eq(
  $$ select assignee_id, cardinality(assignee_ids) from public.tasks where id = '10000000-0000-4000-8000-0000000000c2' $$,
  $$ values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, 2) $$,
  'created with two people: both are kept, the old column holds the first'
);

insert into public.tasks (id, project_id, title)
values ('10000000-0000-4000-8000-0000000000c3', (select id from public.projects where slug = 'application'), 'Personne');
select results_eq(
  $$ select assignee_id, assignee_ids from public.tasks where id = '10000000-0000-4000-8000-0000000000c3' $$,
  $$ values (null::uuid, '{}'::uuid[]) $$,
  'created for nobody: an empty list, and nothing in the old column'
);

-- ----------------------------------------------------------------------------- changing
update public.tasks set assignee_ids = assignee_ids || 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid where id = '10000000-0000-4000-8000-0000000000c1';
select results_eq(
  $$ select assignee_id, assignee_ids from public.tasks where id = '10000000-0000-4000-8000-0000000000c1' $$,
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, array['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[]) $$,
  'a second person is added: the first stays first'
);

-- Blanks and repeats are cleaned, the order kept.
update public.tasks
set assignee_ids = array['dddddddd-dddd-4ddd-8ddd-dddddddddddd', null, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd']::uuid[]
where id = '10000000-0000-4000-8000-0000000000c3';
select is(
  (select assignee_ids from public.tasks where id = '10000000-0000-4000-8000-0000000000c3'),
  array['dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']::uuid[],
  'nobody is on a task twice, and a blank is not somebody'
);

-- An old page changes « the » person of a task two people share: it becomes that person's alone.
update public.tasks set assignee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where id = '10000000-0000-4000-8000-0000000000c2';
select results_eq(
  $$ select assignee_id, assignee_ids from public.tasks where id = '10000000-0000-4000-8000-0000000000c2' $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[]) $$,
  'the old way of changing the person replaces the list by that person'
);
update public.tasks set assignee_id = null where id = '10000000-0000-4000-8000-0000000000c2';
select is((select assignee_ids from public.tasks where id = '10000000-0000-4000-8000-0000000000c2'), '{}'::uuid[], '…and the old way of clearing empties it');

-- A write that touches neither column leaves both alone.
update public.tasks set title = 'Une personne, puis deux' where id = '10000000-0000-4000-8000-0000000000c1';
select is((select cardinality(assignee_ids) from public.tasks where id = '10000000-0000-4000-8000-0000000000c1'), 2, 'renaming a task changes nobody');

-- When both are sent (the app sends the list and its first), the list wins.
update public.tasks
set assignee_ids = array['dddddddd-dddd-4ddd-8ddd-dddddddddddd']::uuid[], assignee_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
where id = '10000000-0000-4000-8000-0000000000c2';
select results_eq(
  $$ select assignee_id, assignee_ids from public.tasks where id = '10000000-0000-4000-8000-0000000000c2' $$,
  $$ values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid, array['dddddddd-dddd-4ddd-8ddd-dddddddddddd']::uuid[]) $$,
  'the list is what counts when both columns are written'
);

-- ----------------------------------------------------------------------------- refusals
select throws_ok(
  $$ update public.tasks set assignee_ids = array['99999999-9999-4999-8999-999999999999']::uuid[] where id = '10000000-0000-4000-8000-0000000000c3' $$,
  '23503', null, 'someone who is not a member cannot be given a task'
);
select throws_ok(
  $$ insert into public.tasks (project_id, title, assignee_id) values ((select id from public.projects limit 1), 'Fantôme', '99999999-9999-4999-8999-999999999999') $$,
  '23503', null, '…the old way either'
);

-- ----------------------------------------------------------------------------- the log and the announcements
reset role;
select results_eq(
  $$ select old_value, new_value from public.task_events where task_id = '10000000-0000-4000-8000-0000000000c1' and kind = 'assignee' order by created_at, id $$,
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb,aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  'the activity log says who was on the task before, and who is now'
);
select is(
  (select count(*)::int from public.task_events where task_id = '10000000-0000-4000-8000-0000000000c2' and kind = 'assignee' and new_value is null),
  1,
  'a task left to nobody is logged with nobody'
);
-- Alice added herself to c1: nobody to tell (she did it). She gave c3 to Dana and Bob: two announcements, one each.
select results_eq(
  $$ select task_id, detail ->> 'assignee_id' from public.push_outbox where kind = 'task_assigned' and task_id = '10000000-0000-4000-8000-0000000000c3' order by detail ->> 'assignee_id' $$,
  $$ values ('10000000-0000-4000-8000-0000000000c3'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), ('10000000-0000-4000-8000-0000000000c3'::uuid, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') $$,
  'a task given to two people at once announces itself to each'
);
select is(
  (select count(*)::int from public.push_outbox where kind = 'task_assigned' and task_id = '10000000-0000-4000-8000-0000000000c1'),
  1,
  'adding a person announces the task to that person, once'
);
select is(
  (select detail ->> 'assignee_id' from public.push_outbox where kind = 'task_assigned' and task_id = '10000000-0000-4000-8000-0000000000c1'),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '…the one who was added, not the one who was already there'
);

-- Taking someone off announces nothing.
delete from public.push_outbox;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
update public.tasks set assignee_ids = array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']::uuid[] where id = '10000000-0000-4000-8000-0000000000c1';
reset role;
select is((select count(*)::int from public.push_outbox), 0, 'taking someone off a task announces nothing');

-- ----------------------------------------------------------------------------- too many
select throws_ok(
  $$ update public.tasks set assignee_ids = (select array_agg(gen_random_uuid()) from generate_series(1, 13)) where id = '10000000-0000-4000-8000-0000000000c3' $$,
  null, null, 'a task is not given to thirteen people'
);

-- ----------------------------------------------------------------------------- a member leaves
set local request.jwt.claims = '{"role":"service_role"}';
update public.tasks set assignee_ids = array['dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']::uuid[] where id = '10000000-0000-4000-8000-0000000000c3';
update public.tasks set assignee_ids = array['dddddddd-dddd-4ddd-8ddd-dddddddddddd']::uuid[] where id = '10000000-0000-4000-8000-0000000000c2';
delete from auth.users where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
select results_eq(
  $$ select assignee_id, assignee_ids from public.tasks where id = '10000000-0000-4000-8000-0000000000c3' $$,
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, array['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']::uuid[]) $$,
  'a member who is deleted is taken off the tasks they shared: the next person becomes the first'
);
select results_eq(
  $$ select assignee_id, assignee_ids from public.tasks where id = '10000000-0000-4000-8000-0000000000c2' $$,
  $$ values (null::uuid, '{}'::uuid[]) $$,
  '…and a task that was theirs alone is nobody''s'
);
select is(
  (select count(*)::int from public.tasks where assignee_id is distinct from assignee_ids[1]),
  0,
  'everywhere, the old column is the first of the list'
);
select is(
  (select count(*)::int from public.tasks t where exists (select 1 from unnest(t.assignee_ids) a (id) where not exists (select 1 from public.members m where m.id = a.id))),
  0,
  'and no list names someone who is gone'
);
select is(
  (select count(*)::int from public.tasks where id in ('10000000-0000-4000-8000-0000000000c1', '10000000-0000-4000-8000-0000000000c2', '10000000-0000-4000-8000-0000000000c3')),
  3,
  'the tasks themselves stay'
);

select * from finish();
rollback;
