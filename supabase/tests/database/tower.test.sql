-- =============================================================================
-- Team Tomate HQ — Tomato Tower: who reads, who writes, the boards, the shared tower.
-- Run with: npx supabase test db   (self-contained, rolled back at the end)
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(41);

-- Fixtures: alice (first user → active), bob (invited → active), carl (not invited → pending).
delete from public.members;
delete from public.member_invites;
-- Whatever was played on this database before does not count here.
delete from public.tower_team_crates;
delete from public.tower_team_towers;
delete from public.tower_runs;
insert into public.member_invites (email, role) values ('bob@test.local', 'member');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'authenticated', 'authenticated', 'alice@test.local', '{"full_name":"Alice Admin"}', '2026-01-01 09:00+00'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'authenticated', 'authenticated', 'bob@test.local', '{"full_name":"Bob B."}', '2026-01-01 09:01+00'),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   'authenticated', 'authenticated', 'carl@test.local', '{}', '2026-01-01 09:02+00');

-- ----------------------------------------------------------------------------- time
-- The week turns over on Monday at midnight in Montréal, summer and winter.
select is(public.tower_week_of('2026-11-16 04:59:59+00'), '2026-11-09'::date, 'Sunday 23:59 in Montréal (winter) is still the week before');
select is(public.tower_week_of('2026-11-16 05:00:00+00'), '2026-11-16'::date, 'Monday 00:00 in Montréal (winter) opens the new week');
select is(public.tower_week_of('2026-07-06 03:59:59+00'), '2026-06-29'::date, 'in summer the same turn is at 04:00 UTC');
select is(public.tower_week_of('2026-07-06 04:00:00+00'), '2026-07-06'::date, 'and not a second before');
select is(public.tower_day_of('2026-11-13 04:30:00+00'), '2026-11-12'::date, 'the shared tower''s day is Montréal''s');

-- ----------------------------------------------------------------------------- runs
select is(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.tower_runs'::regclass, 'public.tower_team_towers'::regclass, 'public.tower_team_crates'::regclass)),
  true,
  'row level security is enabled on the three tables'
);

-- Runs as the server writes them: two weeks, three players (carl's would count if he became a member).
insert into public.tower_runs (id, member_id, seed, started_at, finished_at, score, floors, best_combo, best_streak, perfects, duration_ms, week_start)
values
  ('80000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1, now() - interval '2 hours', now() - interval '110 minutes', 4200, 14, 3, 3, 6, 40000, public.tower_week_of(now())),
  ('80000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2, now() - interval '1 hour',  now() - interval '50 minutes',  9100, 22, 5, 7, 12, 61000, public.tower_week_of(now())),
  ('80000000-0000-4000-8000-000000000003', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 3, now() - interval '30 minutes', now() - interval '25 minutes', 9100, 20, 4, 4, 9, 55000, public.tower_week_of(now())),
  ('80000000-0000-4000-8000-000000000004', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 4, now() - interval '8 days', now() - interval '8 days' + interval '2 minutes', 15000, 31, 5, 9, 20, 90000, public.tower_week_of(now() - interval '8 days')),
  ('80000000-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 5, now() - interval '8 days', now() - interval '8 days' + interval '1 minute', 700, 5, 1, 1, 1, 12000, public.tower_week_of(now() - interval '8 days'));
-- One still being played.
insert into public.tower_runs (id, member_id, seed) values ('80000000-0000-4000-8000-000000000006', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 6);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select count(*) from public.tower_runs $$, '42501', null, 'anon cannot read runs');
select throws_ok($$ select public.tower_boards() $$, '42501', null, 'nor the boards');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select is((select count(*)::int from public.tower_runs), 5, 'a member reads the finished runs, not the one being played');
select throws_ok(
  $$ insert into public.tower_runs (member_id, seed, finished_at, score, floors, best_combo, best_streak, perfects, week_start)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 9, now(), 999999, 500, 5, 400, 400, public.tower_week_of(now())) $$,
  '42501', null,
  'a member cannot write a score'
);
select throws_ok(
  $$ update public.tower_runs set score = 999999 where id = '80000000-0000-4000-8000-000000000001' $$,
  '42501', null,
  'nor change one'
);
select throws_ok(
  $$ select public.tower_close_run('80000000-0000-4000-8000-000000000006', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 999999, 500, 5, 400, 400, 1000) $$,
  '42501', null,
  'nor close a run: that is the server''s'
);

-- The boards: each member's best of the period, best first; a tie goes to whoever got there first.
select is(
  (select jsonb_agg(r -> 'member_id' order by ord)
   from jsonb_array_elements(public.tower_boards() -> 'week') with ordinality as t(r, ord)),
  '["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]'::jsonb,
  'this week: alice and bob tie at 9100, alice got there first'
);
select is(
  (public.tower_boards() -> 'week' -> 0) - 'achieved_at',
  '{"member_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "score": 9100, "floors": 22, "best_combo": 5, "runs": 2}'::jsonb,
  'a line is the member''s best run of the week, with how many they played'
);
select is(
  (public.tower_boards() -> 'all_time' -> 0 ->> 'score')::int,
  15000,
  'of all time, last week''s 15000 leads'
);
select is(
  public.tower_boards() -> 'champions' -> 0,
  jsonb_build_object('week_start', public.tower_week_of(now() - interval '8 days'), 'member_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'score', 15000, 'floors', 31),
  'last week''s winner is kept: nothing is erased at the reset'
);
select is(
  public.tower_boards() -> 'me',
  '{"runs": 3, "best_score": 9100, "best_floors": 22, "best_combo": 5, "best_streak": 7, "total_floors": 41, "perfects": 19, "average_score": 4667, "weeks_won": 0}'::jsonb,
  'my own figures'
);
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
select is((public.tower_boards() -> 'me' ->> 'weeks_won')::int, 1, 'bob has one week to his name');

-- A pending account sees none of it.
set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';
select is_empty($$ select 1 from public.tower_runs $$, 'a pending account reads no run');
select is(public.tower_boards() -> 'week', '[]'::jsonb, 'and an empty board');
select throws_ok($$ select public.tower_team_view() $$, '42501', null, 'the shared tower is not for a pending account');
reset role;

-- ----------------------------------------------------------------------------- closing a run
select is(
  public.tower_close_run('80000000-0000-4000-8000-000000000006', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 12000, 26, 5, 8, 15, 70000),
  '{"rank_week": 1, "previous_best": 15000, "previous_week_best": 9100, "week_record_before": 9100}'::jsonb,
  'the server closes a run and learns where it stands'
);
select results_eq(
  $$ select score, floors, week_start, finished_at is not null from public.tower_runs where id = '80000000-0000-4000-8000-000000000006' $$,
  $$ select 12000, 26, public.tower_week_of(now()), true $$,
  'the row is closed with the week it belongs to'
);
select is(
  public.tower_close_run('80000000-0000-4000-8000-000000000006', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 99999, 99, 5, 8, 15, 70000),
  null,
  'a run is closed once'
);
insert into public.tower_runs (id, member_id, seed) values ('80000000-0000-4000-8000-000000000007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 7);
select is(
  public.tower_close_run('80000000-0000-4000-8000-000000000007', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 500, 3, 1, 0, 0, 9000),
  null,
  'and only for the member who played it'
);
select is(
  (public.tower_close_run('80000000-0000-4000-8000-000000000007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 500, 3, 1, 0, 0, 9000) ->> 'rank_week')::int,
  2,
  'a modest run leaves alice second: her best of the week still counts, bob''s is above'
);

-- ----------------------------------------------------------------------------- the shared tower
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
select is((public.tower_team_view() -> 'tower' ->> 'height')::int, 0, 'the first member to look raises an empty tower');
select is((select count(*)::int from public.tower_team_towers), 1, 'one tower');
select is((public.tower_team_view() -> 'tower' ->> 'id'), (select id::text from public.tower_team_towers), 'looking again raises no other');
select throws_ok(
  $$ insert into public.tower_team_crates (tower_id, floor, member_id, day, kind, x0, x1, z0, z1)
     select id, 1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_date, 'perfect', -1500, 1500, -1500, 1500 from public.tower_team_towers $$,
  '42501', null,
  'a member cannot write a crate'
);
select throws_ok(
  $$ select public.tower_team_commit((select id from public.tower_team_towers), 1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'perfect', -1500, 1500, -1500, 1500) $$,
  '42501', null,
  'nor place one without the server'
);
reset role;

-- Placed by the server: alice, then bob on top; the top follows.
select is(
  public.tower_team_commit((select id from public.tower_team_towers), 1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cut', -1500, 900, -1500, 1500, '2026-11-10'),
  'ok', 'alice places the first crate'
);
select is(
  public.tower_team_commit((select id from public.tower_team_towers), 2, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'perfect', -1500, 900, -1500, 1500, '2026-11-10'),
  'played', 'one crate a day each'
);
select is(
  public.tower_team_commit((select id from public.tower_team_towers), 1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'perfect', -1500, 1500, -1500, 1500, '2026-11-10'),
  'moved', 'bob aimed at a tower that has since grown: nothing is written, his crate is not spent'
);
select is(
  public.tower_team_commit((select id from public.tower_team_towers), 2, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cut', -1500, 900, -1200, 1500, '2026-11-10'),
  'ok', 'aimed at the tower as it is, his crate lands'
);
select results_eq(
  $$ select height, x0, x1, z0, z1 from public.tower_team_towers $$,
  $$ values (2, -1500, 900, -1200, 1500) $$,
  'the tower is two crates high, and its top is bob''s crate'
);
-- The next day alice misses: the tower falls, and nothing more is placed on it.
select is(
  public.tower_team_commit((select id from public.tower_team_towers), 3, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'miss', null, null, null, null, '2026-11-11'),
  'ok', 'a miss is that member''s crate of the day'
);
select results_eq(
  $$ select height, fallen_on, fallen_by from public.tower_team_towers $$,
  $$ values (2, '2026-11-11'::date, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid) $$,
  'and the tower has fallen, at the height it had'
);
select is(
  public.tower_team_commit((select id from public.tower_team_towers), 3, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'perfect', -1500, 900, -1200, 1500, '2026-11-11'),
  'fallen', 'nobody builds on a fallen tower'
);
select is(
  public.tower_team_stats('2026-11-12') - 'last',
  '{"record_height": 2, "record_on": "2026-11-11", "best_day": "2026-11-10", "best_day_crates": 2, "total_crates": 2, "towers": 1,
    "contributors": [{"member_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "crates": 1, "perfects": 0}, {"member_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "crates": 1, "perfects": 0}]}'::jsonb,
  'the team''s figures: the record, the best day, who contributed'
);

-- The tower fell on another day than today: the next member to look gets a new one.
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
select is(
  (select (v -> 'tower' ->> 'height')::int = 0 and jsonb_array_length(v -> 'crates') = 0 and (v ->> 'played_today')::boolean = false
   from (select public.tower_team_view() as v) s),
  true,
  'the day after a fall, a new tower stands, empty'
);
reset role;

select * from finish();
rollback;
