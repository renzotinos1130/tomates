-- =============================================================================
-- Team Tomate HQ — a task that depends on another waits for it: blocked while
-- the other is still to do, freed by itself the moment it is finished.
-- Run with: npx supabase test db   (self-contained, rolled back at the end)
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(42);

-- Fixtures: alice (first user → active), bob (invited → active).
delete from public.members;
delete from public.member_invites;
delete from public.push_outbox;
insert into public.member_invites (email, role) values ('bob@test.local', 'member');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'authenticated', 'authenticated', 'alice@test.local', '{"full_name":"Alice Admin"}', '2026-01-01 09:00+00'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'authenticated', 'authenticated', 'bob@test.local', '{"full_name":"Bob B."}', '2026-01-01 09:01+00');

select has_column('public', 'tasks', 'depends_on', 'a task has the list of tasks it waits for');
select has_column('public', 'tasks', 'waiting', '…and says whether it is waiting');

-- A project of its own, to be deleted at the end.
insert into public.projects (id, name, slug) values ('50000000-0000-4000-8000-000000000001', 'Chantier', 'chantier-test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

-- ----------------------------------------------------------------------------- waiting
-- a1 « visuels », and a2 « texte » which depends on it.
insert into public.tasks (id, project_id, title)
values ('20000000-0000-4000-8000-0000000000a1', (select id from public.projects where slug = 'application'), 'Créer les visuels');
select results_eq(
  $$ select depends_on, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000a1' $$,
  $$ values ('{}'::uuid[], false) $$,
  'a task created the way it always was depends on nothing'
);

insert into public.tasks (id, project_id, title, assignee_ids, depends_on)
values ('20000000-0000-4000-8000-0000000000a2', (select id from public.projects where slug = 'application'), 'Rédiger le texte',
        array['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']::uuid[], array['20000000-0000-4000-8000-0000000000a1']::uuid[]);
select results_eq(
  $$ select status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000a2' $$,
  $$ values ('blocked', true) $$,
  'created depending on a task still to do: it is blocked, and waiting'
);

update public.tasks set status = 'in_progress' where id = '20000000-0000-4000-8000-0000000000a2';
select is(
  (select status::text from public.tasks where id = '20000000-0000-4000-8000-0000000000a2'), 'blocked',
  'it cannot be started while it waits'
);
update public.tasks set status = 'done' where id = '20000000-0000-4000-8000-0000000000a2';
select results_eq(
  $$ select status::text, completed_at is null from public.tasks where id = '20000000-0000-4000-8000-0000000000a2' $$,
  $$ values ('blocked', true) $$,
  '…nor finished'
);
update public.tasks set title = 'Rédiger le texte, v2', priority = 'high' where id = '20000000-0000-4000-8000-0000000000a2';
select results_eq(
  $$ select title, priority::text, status::text from public.tasks where id = '20000000-0000-4000-8000-0000000000a2' $$,
  $$ values ('Rédiger le texte, v2', 'high', 'blocked') $$,
  'everything else about it can still be changed'
);

update public.tasks set status = 'in_progress' where id = '20000000-0000-4000-8000-0000000000a1';
select is(
  (select status::text from public.tasks where id = '20000000-0000-4000-8000-0000000000a2'), 'blocked',
  'the other task being started frees nothing'
);

-- ----------------------------------------------------------------------------- freed
update public.tasks set status = 'done' where id = '20000000-0000-4000-8000-0000000000a1';
select results_eq(
  $$ select status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000a2' $$,
  $$ values ('todo', false) $$,
  'the other task is finished: it goes back to « todo » by itself'
);
update public.tasks set status = 'in_progress' where id = '20000000-0000-4000-8000-0000000000a2';
select is(
  (select status::text from public.tasks where id = '20000000-0000-4000-8000-0000000000a2'), 'in_progress',
  '…and can then be started like any other'
);

-- The other task is reopened: it waits again.
update public.tasks set status = 'todo' where id = '20000000-0000-4000-8000-0000000000a1';
select results_eq(
  $$ select status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000a2' $$,
  $$ values ('blocked', true) $$,
  'the other task is reopened: it waits again'
);

-- ----------------------------------------------------------------------------- two dependencies
insert into public.tasks (id, project_id, title)
values ('20000000-0000-4000-8000-0000000000a3', (select id from public.projects where slug = 'site-web'), 'Valider le budget');
update public.tasks
set depends_on = array['20000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-0000000000a3']::uuid[]
where id = '20000000-0000-4000-8000-0000000000a2';
update public.tasks set status = 'done' where id = '20000000-0000-4000-8000-0000000000a1';
select results_eq(
  $$ select status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000a2' $$,
  $$ values ('blocked', true) $$,
  'with two dependencies (one in another project), one finished is not enough'
);
update public.tasks set status = 'done' where id = '20000000-0000-4000-8000-0000000000a3';
select results_eq(
  $$ select status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000a2' $$,
  $$ values ('todo', false) $$,
  '…the second finished, it is free'
);

-- ----------------------------------------------------------------------------- archived, deleted
insert into public.tasks (id, project_id, title)
values ('20000000-0000-4000-8000-0000000000a4', (select id from public.projects where slug = 'application'), 'Tourner la vidéo');
insert into public.tasks (id, project_id, title, depends_on)
values ('20000000-0000-4000-8000-0000000000a5', (select id from public.projects where slug = 'application'), 'Monter la vidéo',
        array['20000000-0000-4000-8000-0000000000a4']::uuid[]);
update public.tasks set archived_at = now() where id = '20000000-0000-4000-8000-0000000000a4';
select results_eq(
  $$ select status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000a5' $$,
  $$ values ('todo', false) $$,
  'an archived task holds nobody back'
);
update public.tasks set archived_at = null where id = '20000000-0000-4000-8000-0000000000a4';
select results_eq(
  $$ select status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000a5' $$,
  $$ values ('blocked', true) $$,
  '…brought back unfinished, it holds again'
);
delete from public.tasks where id = '20000000-0000-4000-8000-0000000000a4';
select results_eq(
  $$ select depends_on, status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000a5' $$,
  $$ values ('{}'::uuid[], 'todo', false) $$,
  'a task that is deleted leaves the lists it was on, and frees who waited for it'
);

-- ----------------------------------------------------------------------------- the list is cleaned
insert into public.tasks (id, project_id, title)
values ('20000000-0000-4000-8000-0000000000a6', (select id from public.projects where slug = 'application'), 'Publier');
update public.tasks
set depends_on = array['20000000-0000-4000-8000-0000000000a6', '20000000-0000-4000-8000-0000000000a1', null,
                       '20000000-0000-4000-8000-0000000000a1', '99999999-9999-4999-8999-999999999999']::uuid[]
where id = '20000000-0000-4000-8000-0000000000a6';
select results_eq(
  $$ select depends_on, status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000a6' $$,
  $$ values (array['20000000-0000-4000-8000-0000000000a1']::uuid[], 'todo', false) $$,
  'the list is cleaned (not itself, nothing twice, no blank, nothing that does not exist), and a finished task holds nothing'
);

-- ----------------------------------------------------------------------------- no circle
-- a7 depends on a6, a8 on a7.
insert into public.tasks (id, project_id, title, depends_on)
values ('20000000-0000-4000-8000-0000000000a7', (select id from public.projects where slug = 'application'), 'Annoncer',
        array['20000000-0000-4000-8000-0000000000a6']::uuid[]);
insert into public.tasks (id, project_id, title, depends_on)
values ('20000000-0000-4000-8000-0000000000a8', (select id from public.projects where slug = 'application'), 'Mesurer',
        array['20000000-0000-4000-8000-0000000000a7']::uuid[]);
select throws_ok(
  $$ update public.tasks set depends_on = array['20000000-0000-4000-8000-0000000000a7']::uuid[] where id = '20000000-0000-4000-8000-0000000000a6' $$,
  '23514', 'Deux tâches ne peuvent pas dépendre l''une de l''autre.', 'two tasks cannot wait for each other'
);
select throws_ok(
  $$ update public.tasks set depends_on = array['20000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-0000000000a8']::uuid[] where id = '20000000-0000-4000-8000-0000000000a6' $$,
  '23514', null, '…nor through a third one'
);
select results_eq(
  $$ select id, status::text from public.tasks where id in ('20000000-0000-4000-8000-0000000000a7', '20000000-0000-4000-8000-0000000000a8') order by id $$,
  $$ values ('20000000-0000-4000-8000-0000000000a7'::uuid, 'blocked'), ('20000000-0000-4000-8000-0000000000a8'::uuid, 'blocked') $$,
  'a chain: each waits for the one before'
);
update public.tasks set status = 'done' where id = '20000000-0000-4000-8000-0000000000a6';
select results_eq(
  $$ select id, status::text, waiting from public.tasks where id in ('20000000-0000-4000-8000-0000000000a7', '20000000-0000-4000-8000-0000000000a8') order by id $$,
  $$ values ('20000000-0000-4000-8000-0000000000a7'::uuid, 'todo', false), ('20000000-0000-4000-8000-0000000000a8'::uuid, 'blocked', true) $$,
  '…the first finished frees the second only: the third still waits for the second'
);

-- ----------------------------------------------------------------------------- what is done stays done
insert into public.tasks (id, project_id, title, status)
values ('20000000-0000-4000-8000-0000000000b1', (select id from public.projects where slug = 'application'), 'Déjà faite', 'done');
insert into public.tasks (id, project_id, title)
values ('20000000-0000-4000-8000-0000000000b2', (select id from public.projects where slug = 'application'), 'Pas commencée');
update public.tasks set depends_on = array['20000000-0000-4000-8000-0000000000b2']::uuid[] where id = '20000000-0000-4000-8000-0000000000b1';
select results_eq(
  $$ select status::text, waiting, completed_at is not null from public.tasks where id = '20000000-0000-4000-8000-0000000000b1' $$,
  $$ values ('done', false, true) $$,
  'a finished task is not undone by a dependency added afterwards'
);
update public.tasks set status = 'todo' where id = '20000000-0000-4000-8000-0000000000b1';
select results_eq(
  $$ select status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000b1' $$,
  $$ values ('blocked', true) $$,
  '…reopened, it waits like any other'
);

-- ----------------------------------------------------------------------------- a blocker someone reported
insert into public.tasks (id, project_id, title)
values ('20000000-0000-4000-8000-0000000000b3', (select id from public.projects where slug = 'application'), 'En panne');
update public.tasks set status = 'blocked' where id = '20000000-0000-4000-8000-0000000000b3';
select results_eq(
  $$ select status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000b3' $$,
  $$ values ('blocked', false) $$,
  'a task blocked by hand is blocked, not waiting'
);
update public.tasks set depends_on = array['20000000-0000-4000-8000-0000000000a1']::uuid[] where id = '20000000-0000-4000-8000-0000000000b3';
select is(
  (select status::text from public.tasks where id = '20000000-0000-4000-8000-0000000000b3'), 'blocked',
  '…and a dependency already finished does not lift it'
);

-- The dependency taken off by hand: free.
insert into public.tasks (id, project_id, title, depends_on)
values ('20000000-0000-4000-8000-0000000000b4', (select id from public.projects where slug = 'application'), 'Attendait pour rien',
        array['20000000-0000-4000-8000-0000000000b2']::uuid[]);
update public.tasks set depends_on = '{}' where id = '20000000-0000-4000-8000-0000000000b4';
select results_eq(
  $$ select status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000b4' $$,
  $$ values ('todo', false) $$,
  'its dependency taken off, a task is free'
);

-- ----------------------------------------------------------------------------- too many
insert into public.tasks (project_id, title)
select (select id from public.projects where slug = 'application'), 'Étape ' || g from generate_series(1, 21) g;
select throws_ok(
  $$ update public.tasks set depends_on = (select array_agg(id) from public.tasks where title like 'Étape %') where id = '20000000-0000-4000-8000-0000000000b3' $$,
  '23514', null, 'a task does not wait for twenty-one others'
);

-- ----------------------------------------------------------------------------- the log
reset role;
select is(
  (select count(*)::int from public.task_events where task_id = '20000000-0000-4000-8000-0000000000a2' and kind = 'status' and new_value = 'blocked'),
  0,
  'the log never says a waiting task was « blocked »: nobody reported a problem'
);
select is(
  (select count(*)::int from public.task_events where task_id = '20000000-0000-4000-8000-0000000000a2' and kind = 'status' and old_value = 'in_progress' and new_value = 'waiting'),
  1,
  '…it says « waiting » when the task it depends on is reopened'
);
select is(
  (select count(*)::int from public.task_events where task_id = '20000000-0000-4000-8000-0000000000a2' and kind = 'status' and old_value = 'blocked' and new_value = 'todo'),
  2,
  '…and each time it was freed'
);
select results_eq(
  $$ select old_value, new_value from public.task_events where task_id = '20000000-0000-4000-8000-0000000000a2' and kind = 'dependency' $$,
  $$ values ('20000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-0000000000a1,20000000-0000-4000-8000-0000000000a3') $$,
  'a dependency added is logged with the list before and after'
);
select results_eq(
  $$ select kind, count(*)::int from public.task_events where task_id = '20000000-0000-4000-8000-0000000000b3' and kind in ('status', 'dependency') group by kind order by kind $$,
  $$ values ('dependency', 1), ('status', 1) $$,
  'a blocker reported by hand is a « blocked » line, as before'
);
select results_eq(
  $$ select kind, new_value from public.task_events where task_id = '20000000-0000-4000-8000-0000000000b1' and kind in ('status', 'dependency') order by kind $$,
  $$ values ('dependency', '20000000-0000-4000-8000-0000000000b2'), ('status', 'waiting') $$,
  'a task that waits because of its list has one line for the list, and none for the status until it moves'
);

-- ----------------------------------------------------------------------------- the announcements
select is(
  (select count(*)::int from public.push_outbox where kind = 'task_blocked' and task_id <> '20000000-0000-4000-8000-0000000000b3'),
  0,
  'a task that starts waiting is not announced as blocked'
);
select is(
  (select count(*)::int from public.push_outbox where kind = 'task_blocked' and task_id = '20000000-0000-4000-8000-0000000000b3'),
  1,
  '…a blocker reported by hand still is'
);
select is(
  (select count(*)::int from public.push_outbox where kind = 'task_released' and task_id = '20000000-0000-4000-8000-0000000000a2'),
  2,
  'a task that is freed is announced each time'
);
select results_eq(
  $$ select kind from public.push_outbox where task_id in ('20000000-0000-4000-8000-0000000000a6', '20000000-0000-4000-8000-0000000000a7') and kind in ('task_done', 'task_released') order by id $$,
  $$ values ('task_done'), ('task_released') $$,
  'the task finished is announced before the task it frees'
);

-- What the server does on its own is nobody's news.
delete from public.push_outbox;
set local request.jwt.claims = '{"role":"service_role"}';
update public.tasks set status = 'done' where id = '20000000-0000-4000-8000-0000000000a7';
select results_eq(
  $$ select status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000a8' $$,
  $$ values ('todo', false) $$,
  'a task finished from the server frees its dependents all the same'
);
select is((select count(*)::int from public.push_outbox), 0, '…without announcing anything');

-- ----------------------------------------------------------------------------- a project deleted with its chain
insert into public.tasks (id, project_id, title)
values ('20000000-0000-4000-8000-0000000000c1', '50000000-0000-4000-8000-000000000001', 'Un');
insert into public.tasks (id, project_id, title, depends_on)
values ('20000000-0000-4000-8000-0000000000c2', '50000000-0000-4000-8000-000000000001', 'Deux', array['20000000-0000-4000-8000-0000000000c1']::uuid[]);
-- …and a task of another project that waits for one of them.
insert into public.tasks (id, project_id, title, depends_on)
values ('20000000-0000-4000-8000-0000000000c3', (select id from public.projects where slug = 'application'), 'Ailleurs',
        array['20000000-0000-4000-8000-0000000000c2']::uuid[]);
select lives_ok(
  $$ delete from public.projects where id = '50000000-0000-4000-8000-000000000001' $$,
  'a project is deleted with the tasks that depended on each other inside it'
);
select results_eq(
  $$ select depends_on, status::text, waiting from public.tasks where id = '20000000-0000-4000-8000-0000000000c3' $$,
  $$ values ('{}'::uuid[], 'todo', false) $$,
  '…and a task elsewhere that waited for one of them is free'
);
select is(
  (select count(*)::int from public.tasks t where t.waiting is distinct from (t.status = 'blocked' and public.task_is_held(t.depends_on))),
  0,
  'everywhere, « waiting » says exactly whether something still holds the task'
);

select * from finish();
rollback;
