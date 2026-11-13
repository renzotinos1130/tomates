-- =============================================================================
-- Team Tomate HQ — push notifications: nobody reaches the tables through the API,
-- the database writes what is to be announced, and a row is handed over once.
-- Run with: npx supabase test db   (self-contained, rolled back at the end)
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(50);

-- Fixtures: alice (first user → active), bob (invited → active), carl (not invited → pending).
delete from public.members;
delete from public.member_invites;
delete from public.tower_team_crates;
delete from public.tower_team_towers;
delete from public.tower_runs;
delete from public.push_outbox;
insert into public.member_invites (email, role) values ('bob@test.local', 'member');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'authenticated', 'authenticated', 'alice@test.local', '{"full_name":"Alice Admin"}', '2026-01-01 09:00+00'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'authenticated', 'authenticated', 'bob@test.local', '{"full_name":"Bob B."}', '2026-01-01 09:01+00'),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'authenticated', 'authenticated', 'carl@test.local', '{}', '2026-01-01 09:02+00');

-- ----------------------------------------------------------------------------- nobody through the API
select is(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.push_subscriptions'::regclass, 'public.push_prefs'::regclass, 'public.push_outbox'::regclass)),
  true,
  'row level security is enabled on the three tables'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('push_subscriptions', 'push_prefs', 'push_outbox')),
  0,
  'and no policy opens them: the server is the only way in'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select count(*) from public.push_subscriptions $$, '42501', null, 'anon cannot read the devices');
select throws_ok($$ select count(*) from public.push_outbox $$, '42501', null, 'nor the outbox');
select throws_ok($$ select * from public.push_claim() $$, '42501', null, 'nor take what is pending');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
select throws_ok($$ select count(*) from public.push_subscriptions $$, '42501', null, 'a member cannot read the devices, not even their own');
select throws_ok(
  $$ insert into public.push_subscriptions (member_id, endpoint, p256dh, auth)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'https://push.example/abc', repeat('k', 87), repeat('a', 22)) $$,
  '42501', null, 'nor register one without the server'
);
select throws_ok($$ select count(*) from public.push_prefs $$, '42501', null, 'nor read the choices');
select throws_ok($$ insert into public.push_outbox (kind) values ('task_done') $$, '42501', null, 'nor write an announcement');
select throws_ok($$ select * from public.push_claim() $$, '42501', null, 'nor take what is pending');

-- ----------------------------------------------------------------------------- tasks
-- Alice creates a task for Bob: one announcement, hers.
insert into public.tasks (id, project_id, title, assignee_id)
values ('10000000-0000-4000-8000-0000000000a1', (select id from public.projects where slug = 'application'), 'Préparer la démo',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
reset role;
select results_eq(
  $$ select kind, actor_id, task_id, detail from public.push_outbox order by id $$,
  $$ values ('task_created', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, '10000000-0000-4000-8000-0000000000a1'::uuid, '{}'::jsonb) $$,
  'a task created by a member is to be announced, in her name'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
update public.tasks set status = 'in_progress' where id = '10000000-0000-4000-8000-0000000000a1';
update public.tasks set title = 'Préparer la démo du jeudi', priority = 'high' where id = '10000000-0000-4000-8000-0000000000a1';
reset role;
select is((select count(*)::int from public.push_outbox), 1, 'starting a task, renaming it, changing its priority: nothing to announce');

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
update public.tasks set status = 'blocked' where id = '10000000-0000-4000-8000-0000000000a1';
reset role;
select results_eq(
  $$ select kind, actor_id from public.push_outbox order by id desc limit 1 $$,
  $$ values ('task_blocked', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid) $$,
  'a task that becomes blocked is announced, in the name of who said so'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
update public.tasks set status = 'done' where id = '10000000-0000-4000-8000-0000000000a1';
update public.tasks set status = 'done', description = 'Fait.' where id = '10000000-0000-4000-8000-0000000000a1';
reset role;
select results_eq(
  $$ select kind from public.push_outbox order by id $$,
  $$ values ('task_created'), ('task_blocked'), ('task_done') $$,
  'a task that becomes done is announced once: saving it again as done adds nothing'
);

-- Handing a task to someone afterwards; taking it away from them is not news.
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
update public.tasks set assignee_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where id = '10000000-0000-4000-8000-0000000000a1';
reset role;
select results_eq(
  $$ select kind, actor_id, detail ->> 'assignee_id' from public.push_outbox order by id desc limit 1 $$,
  $$ values ('task_assigned', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  'a task handed to someone is announced, with the person it goes to'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
update public.tasks set assignee_id = null where id = '10000000-0000-4000-8000-0000000000a1';
reset role;
select is((select count(*)::int from public.push_outbox), 4, 'a task left without a person is not announced');

-- A pending account cannot create a task, so it announces nothing either.
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';
select throws_ok(
  $$ insert into public.tasks (project_id, title) values ((select id from public.projects limit 1), 'Pending') $$,
  '42501', null, 'a pending account still cannot create a task'
);
reset role;

-- A seed, an import, a fix made by the server: events are logged, nobody is told.
set local request.jwt.claims = '{"role":"service_role"}';
insert into public.tasks (id, project_id, title, status, created_by)
values ('10000000-0000-4000-8000-0000000000a2', (select id from public.projects where slug = 'site-web'), 'Importée', 'todo',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
update public.tasks set status = 'done', assignee_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id = '10000000-0000-4000-8000-0000000000a2';
select is(
  (select count(*)::int from public.task_events where task_id = '10000000-0000-4000-8000-0000000000a2'),
  3,
  'a task written without a signed-in member keeps its activity (created, status, assignee)'
);
select is(
  (select count(*)::int from public.push_outbox where task_id = '10000000-0000-4000-8000-0000000000a2'),
  0,
  'but announces nothing'
);

-- A task that is deleted takes its announcements with it.
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
insert into public.tasks (id, project_id, title)
values ('10000000-0000-4000-8000-0000000000a3', (select id from public.projects where slug = 'site-web'), 'Éphémère');
reset role;
select is((select count(*)::int from public.push_outbox where task_id = '10000000-0000-4000-8000-0000000000a3'), 1, 'a new task waits to be announced');
delete from public.tasks where id = '10000000-0000-4000-8000-0000000000a3';
select is((select count(*)::int from public.push_outbox where task_id = '10000000-0000-4000-8000-0000000000a3'), 0, 'deleted before that, it is not announced');

-- ----------------------------------------------------------------------------- Tomato Tower
insert into public.tower_runs (id, member_id, seed) values
  ('80000000-0000-4000-8000-0000000000b1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1),
  ('80000000-0000-4000-8000-0000000000b2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 2),
  ('80000000-0000-4000-8000-0000000000b3', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 3),
  ('80000000-0000-4000-8000-0000000000b4', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 4),
  ('80000000-0000-4000-8000-0000000000b5', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 5),
  ('80000000-0000-4000-8000-0000000000b6', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 6),
  ('80000000-0000-4000-8000-0000000000b7', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 7),
  ('80000000-0000-4000-8000-0000000000b8', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 8);
-- A run of last week, already closed, far above everything below: another week is another board.
insert into public.tower_runs (id, member_id, seed, started_at, finished_at, score, floors, best_combo, best_streak, perfects, duration_ms, week_start)
values ('80000000-0000-4000-8000-0000000000b0', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 9, now() - interval '8 days', now() - interval '8 days' + interval '2 minutes',
        90000, 60, 5, 9, 20, 90000, public.tower_week_of(now() - interval '8 days'));
select is((select count(*)::int from public.push_outbox where kind = 'tower_record'), 0, 'a run still open, or written already closed, announces nothing');

set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
select isnt(public.tower_close_run('80000000-0000-4000-8000-0000000000b1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 5000, 15, 3, 3, 6, 40000), null, 'alice closes the first run of the week');
reset role;
select results_eq(
  $$ select actor_id, (detail ->> 'score')::int, detail ->> 'previous_member_id', detail ->> 'previous_score', (detail ->> 'all_time')::boolean
     from public.push_outbox where kind = 'tower_record' order by id $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 5000, null::text, null::text, false) $$,
  'the week''s first score is announced: nobody held the lead (and it is far from the record of all time)'
);

set local role service_role;
select isnt(public.tower_close_run('80000000-0000-4000-8000-0000000000b2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 4000, 12, 2, 2, 4, 30000), null, 'bob plays below it');
select isnt(public.tower_close_run('80000000-0000-4000-8000-0000000000b3', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 5000, 15, 3, 3, 6, 40000), null, 'then exactly as high');
reset role;
select is((select count(*)::int from public.push_outbox where kind = 'tower_record'), 1, 'a score below the lead, or level with it, is not announced');

set local role service_role;
select isnt(public.tower_close_run('80000000-0000-4000-8000-0000000000b4', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 6000, 17, 3, 4, 7, 45000), null, 'bob goes past alice');
reset role;
select results_eq(
  $$ select actor_id, (detail ->> 'score')::int, detail ->> 'previous_member_id', (detail ->> 'previous_score')::int
     from public.push_outbox where kind = 'tower_record' order by id desc limit 1 $$,
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 6000, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 5000) $$,
  'taking the lead from someone is announced, with whose score it was'
);

set local role service_role;
select isnt(public.tower_close_run('80000000-0000-4000-8000-0000000000b5', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 7000, 19, 4, 5, 8, 50000), null, 'bob beats his own score');
reset role;
select is((select count(*)::int from public.push_outbox where kind = 'tower_record'), 2, 'the leader beating their own score is not announced: the crown has not moved');

set local role service_role;
select isnt(public.tower_close_run('80000000-0000-4000-8000-0000000000b6', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 8000, 21, 5, 6, 9, 55000), null, 'alice takes it back');
select is(public.tower_close_run('80000000-0000-4000-8000-0000000000b6', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 99000, 21, 5, 6, 9, 55000), null, 'a run cannot be closed twice');
reset role;
select results_eq(
  $$ select actor_id, (detail ->> 'score')::int, detail ->> 'previous_member_id', (detail ->> 'previous_score')::int
     from public.push_outbox where kind = 'tower_record' order by id desc limit 1 $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 8000, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 7000) $$,
  'and that is announced once, with the score the server counted'
);

-- The record of all time (bob's 90 000, last week) falls to the week's leader: news, though the crown has not moved.
set local role service_role;
select isnt(public.tower_close_run('80000000-0000-4000-8000-0000000000b7', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 95000, 62, 5, 30, 40, 200000), null, 'alice, who leads the week, goes past the best score ever');
reset role;
select results_eq(
  $$ select actor_id, (detail ->> 'score')::int, (detail ->> 'all_time')::boolean, detail ->> 'all_time_member_id', (detail ->> 'all_time_score')::int
     from public.push_outbox where kind = 'tower_record' order by id desc limit 1 $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 95000, true, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 90000) $$,
  'the record of all time falling is announced, with whose it was'
);
set local role service_role;
select isnt(public.tower_close_run('80000000-0000-4000-8000-0000000000b8', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 99000, 64, 5, 31, 41, 210000), null, 'then past her own record');
reset role;
select is((select count(*)::int from public.push_outbox where kind = 'tower_record'), 4, 'someone beating their own record of all time is not announced: it has not changed hands');

-- ----------------------------------------------------------------------------- handing over
select is((select count(*)::int from public.push_outbox where claimed_at is null), 8, 'eight announcements wait (four about tasks, four about the game)');

set local role service_role;
select is((select count(*)::int from public.push_claim(3)), 3, 'the server takes three');
select is((select array_agg(id order by id) from public.push_claim()), (select array_agg(id order by id) from (select id from public.push_outbox order by id offset 3) rest), 'then the others, oldest first, none of them twice');
select is((select count(*)::int from public.push_claim()), 0, 'and nothing is left to take');
reset role;
select is((select count(*)::int from public.push_outbox where claimed_at is null), 0, 'every row says it was handed over');

-- What was handed over more than a week ago is forgotten at the next call.
update public.push_outbox set claimed_at = now() - interval '8 days' where kind = 'task_created';
set local role service_role;
select is((select count(*)::int from public.push_claim()), 0, 'a call with nothing pending');
reset role;
select is((select count(*)::int from public.push_outbox where kind = 'task_created'), 0, 'clears what is older than a week');

-- ----------------------------------------------------------------------------- devices and choices (as the server writes them)
set local role service_role;
insert into public.push_subscriptions (member_id, endpoint, p256dh, auth, device)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'https://push.example/device-1', repeat('k', 87), repeat('a', 22), 'iPhone');
-- The same device, another member signs in on it: the row changes hands.
insert into public.push_subscriptions (member_id, endpoint, p256dh, auth, device)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'https://push.example/device-1', repeat('n', 87), repeat('b', 22), 'iPhone')
on conflict (endpoint) do update set member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth, seen_at = now();
select results_eq(
  $$ select member_id, left(p256dh, 1) from public.push_subscriptions where endpoint = 'https://push.example/device-1' $$,
  $$ values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 'n') $$,
  'a device belongs to one member at a time: the last one to turn notifications on'
);
select throws_ok(
  $$ insert into public.push_subscriptions (member_id, endpoint, p256dh, auth) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'https://push.example/device-2', 'short', repeat('a', 22)) $$,
  '23514', null, 'a key that is not a key is refused'
);
select throws_ok(
  $$ insert into public.push_prefs (member_id, scope) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'everything') $$,
  '23514', null, 'the scope is the team or mine, nothing else'
);
insert into public.push_prefs (member_id, task_done) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
select results_eq(
  $$ select task_created, task_done, task_blocked, tower_record, scope from public.push_prefs where member_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  $$ values (true, false, true, true, 'team') $$,
  'what is not chosen stays on, for the whole team'
);
reset role;

-- A member who leaves takes their devices and their choices with them.
delete from auth.users where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select is((select count(*)::int from public.push_subscriptions), 0, 'a deleted account leaves no device behind');

select * from finish();
rollback;
