-- =============================================================================
-- Team Tomate HQ — TOMATO TOWER, the team's arcade game
--
-- A crate-stacking game with a weekly board and a tower the team builds together.
--
-- What the database holds
--   * tower_runs          one row per solo run. Opened by the server when a run
--                         starts (with the seed the run is played with), closed by
--                         the server once it has replayed the run and counted the
--                         score itself. A browser never writes a score.
--   * tower_team_towers   the shared tower: one stands at a time. A crate that
--                         misses makes it fall; the next one starts the day after.
--   * tower_team_crates   its crates: one a day for each member.
--
-- Who can do what
--   * Active members read everything here (finished runs, the towers, the crates).
--   * Nobody writes through the API. The rows are written by two functions kept
--     for the server (service role), called from src/lib/server/tower.ts after it
--     has checked who is asking and replayed what they played.
--
-- Time
--   The week of the boards runs from Monday 00:00 to the next, in Montréal; the
--   shared tower's « today » is Montréal's too. Nothing is ever deleted at the
--   reset: a week is a column, and the past ones are the history.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Time
-- -----------------------------------------------------------------------------

create function public.tower_week_of(p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (date_trunc('week', p_at at time zone 'America/Toronto'))::date;
$$;

comment on function public.tower_week_of(timestamptz) is
  'The Monday (Montréal) of the week an instant falls in: the name of a week on the boards.';

create function public.tower_day_of(p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (p_at at time zone 'America/Toronto')::date;
$$;


-- -----------------------------------------------------------------------------
-- 2. Solo runs
-- -----------------------------------------------------------------------------

create table public.tower_runs (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members (id) on delete cascade,
  -- An unsigned 32-bit number: it decides how the crates of this run swing.
  seed         bigint not null check (seed between 0 and 4294967295),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  score        integer check (score >= 0),
  floors       integer check (floors >= 0),
  best_combo   smallint check (best_combo between 1 and 5),
  best_streak  integer check (best_streak >= 0),
  perfects     integer check (perfects >= 0),
  -- Game time, in milliseconds: never more than the real time the run took.
  duration_ms  integer check (duration_ms >= 0),
  week_start   date,
  constraint tower_runs_finished check (
    (finished_at is null and score is null and week_start is null)
    or (finished_at is not null and score is not null and floors is not null
        and best_combo is not null and best_streak is not null and perfects is not null
        and week_start is not null)
  )
);

comment on table public.tower_runs is
  'Solo runs of Tomato Tower. Opened and closed by the server only: the score is what the server counted when it replayed the run.';

create index tower_runs_week_idx   on public.tower_runs (week_start, score desc) where finished_at is not null;
create index tower_runs_member_idx on public.tower_runs (member_id, score desc) where finished_at is not null;
create index tower_runs_open_idx   on public.tower_runs (member_id, started_at) where finished_at is null;


-- -----------------------------------------------------------------------------
-- 3. The shared tower
-- -----------------------------------------------------------------------------

create table public.tower_team_towers (
  id          uuid primary key default gen_random_uuid(),
  seed        bigint not null check (seed between 0 and 4294967295),
  started_on  date not null,
  height      integer not null default 0 check (height >= 0),
  -- The top of the tower, seen from above, in thousandths of a crate.
  x0          integer not null default -1500,
  x1          integer not null default 1500,
  z0          integer not null default -1500,
  z1          integer not null default 1500,
  fallen_on   date,
  fallen_by   uuid references public.members (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint tower_team_towers_top check (x0 < x1 and z0 < z1 and x0 >= -6000 and x1 <= 6000 and z0 >= -6000 and z1 <= 6000)
);

comment on table public.tower_team_towers is
  'The tower the team builds together, one crate a day each. One stands at a time (fallen_on is null); a missed crate makes it fall.';

-- One tower stands at a time: two members who open the game at the same second get the same one.
create unique index tower_team_towers_standing on public.tower_team_towers ((true)) where fallen_on is null;

create table public.tower_team_crates (
  tower_id   uuid not null references public.tower_team_towers (id) on delete cascade,
  floor      integer not null check (floor >= 1),
  member_id  uuid references public.members (id) on delete set null,
  day        date not null,
  kind       text not null check (kind in ('perfect', 'cut', 'miss')),
  x0         integer,
  x1         integer,
  z0         integer,
  z1         integer,
  placed_at  timestamptz not null default now(),
  primary key (tower_id, floor),
  -- One crate a day each, whatever the tower.
  constraint tower_team_crates_one_a_day unique (day, member_id),
  constraint tower_team_crates_rect check (
    (kind = 'miss' and x0 is null and x1 is null and z0 is null and z1 is null)
    or (kind <> 'miss' and x0 < x1 and z0 < z1 and x0 >= -6000 and x1 <= 6000 and z0 >= -6000 and z1 <= 6000)
  )
);

comment on table public.tower_team_crates is
  'The crates of the shared towers, bottom first. A miss is kept too: it is that member''s crate of the day, and what made the tower fall.';

create index tower_team_crates_member_idx on public.tower_team_crates (member_id);


-- -----------------------------------------------------------------------------
-- 4. Privileges and row level security: members read, only the server writes
-- -----------------------------------------------------------------------------

revoke all on public.tower_runs, public.tower_team_towers, public.tower_team_crates from anon, authenticated;
grant select on public.tower_runs, public.tower_team_towers, public.tower_team_crates to authenticated;
grant all on public.tower_runs, public.tower_team_towers, public.tower_team_crates to service_role;

alter table public.tower_runs        enable row level security;
alter table public.tower_team_towers enable row level security;
alter table public.tower_team_crates enable row level security;

-- A run shows on the boards once it is closed; one still being played is nobody's business but the server's.
create policy "tower_runs: select finished"
  on public.tower_runs for select to authenticated
  using ((select public.is_active_member()) and finished_at is not null);

create policy "tower_team_towers: select"
  on public.tower_team_towers for select to authenticated
  using ((select public.is_active_member()));

create policy "tower_team_crates: select"
  on public.tower_team_crates for select to authenticated
  using ((select public.is_active_member()));


-- -----------------------------------------------------------------------------
-- 5. The boards, computed here
-- -----------------------------------------------------------------------------

-- Each member's best run over a period, best first. p_week null: of all time.
create function public.tower_board(p_week date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with runs as (
    select r.*
    from public.tower_runs r
    where r.finished_at is not null
      and (p_week is null or r.week_start = p_week)
  ),
  best as (
    select distinct on (r.member_id)
      r.member_id, r.score, r.floors, r.best_combo, r.finished_at
    from runs r
    order by r.member_id, r.score desc, r.finished_at asc
  ),
  played as (
    select r.member_id, count(*)::int as runs from runs r group by r.member_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'member_id', b.member_id,
        'score', b.score,
        'floors', b.floors,
        'best_combo', b.best_combo,
        'runs', p.runs,
        'achieved_at', b.finished_at
      )
      order by b.score desc, b.finished_at asc
    ),
    '[]'::jsonb
  )
  from best b
  join played p using (member_id);
$$;

-- Who won each week that is over, most recent first.
create function public.tower_champions(p_before date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with winners as (
    select distinct on (r.week_start)
      r.week_start, r.member_id, r.score, r.floors
    from public.tower_runs r
    where r.finished_at is not null and r.week_start < p_before
    order by r.week_start desc, r.score desc, r.finished_at asc
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('week_start', w.week_start, 'member_id', w.member_id, 'score', w.score, 'floors', w.floors)
      order by w.week_start desc
    ),
    '[]'::jsonb
  )
  from (select * from winners order by week_start desc limit 26) w;
$$;

/*
 * Everything the game's screens show around a run, in one call: this week's
 * board, the board of all time, my own figures and the past champions. Runs
 * with the caller's rights: row level security decides what is read.
 */
create function public.tower_boards()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_me    uuid := (select auth.uid());
  v_week  date := public.tower_week_of(now());
  v_stats jsonb;
  v_won   integer;
begin
  select count(*)::int into v_won
  from jsonb_array_elements(public.tower_champions(v_week)) c
  where (c ->> 'member_id')::uuid = v_me;

  select jsonb_build_object(
    'runs', count(*)::int,
    'best_score', coalesce(max(r.score), 0),
    'best_floors', coalesce(max(r.floors), 0),
    'best_combo', coalesce(max(r.best_combo), 1),
    'best_streak', coalesce(max(r.best_streak), 0),
    'total_floors', coalesce(sum(r.floors), 0)::int,
    'perfects', coalesce(sum(r.perfects), 0)::int,
    'average_score', coalesce(round(avg(r.score)), 0)::int,
    'weeks_won', v_won
  )
  into v_stats
  from public.tower_runs r
  where r.member_id = v_me and r.finished_at is not null;

  return jsonb_build_object(
    'week_start', v_week,
    'week', public.tower_board(v_week),
    'all_time', public.tower_board(null),
    'me', v_stats,
    'champions', public.tower_champions(v_week)
  );
end;
$$;

revoke execute on function public.tower_board(date)     from public, anon;
revoke execute on function public.tower_champions(date) from public, anon;
revoke execute on function public.tower_boards()        from public, anon;
grant  execute on function public.tower_board(date)     to authenticated, service_role;
grant  execute on function public.tower_champions(date) to authenticated, service_role;
grant  execute on function public.tower_boards()        to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 6. Closing a run (server only)
--
-- The server has replayed the run and hands over what it counted. One statement
-- closes the row, if it is that member's and still open, and says where the run
-- stands: the place on the week's board and the scores it had to beat.
-- -----------------------------------------------------------------------------

create function public.tower_close_run(
  p_run         uuid,
  p_member      uuid,
  p_score       integer,
  p_floors      integer,
  p_best_combo  integer,
  p_best_streak integer,
  p_perfects    integer,
  p_duration_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week        date := public.tower_week_of(now());
  v_prev        integer;
  v_prev_week   integer;
  v_week_record integer;
  v_rank        integer;
begin
  select coalesce(max(r.score), 0) into v_prev
  from public.tower_runs r where r.member_id = p_member and r.finished_at is not null;
  select coalesce(max(r.score), 0) into v_prev_week
  from public.tower_runs r where r.member_id = p_member and r.finished_at is not null and r.week_start = v_week;
  select coalesce(max(r.score), 0) into v_week_record
  from public.tower_runs r where r.finished_at is not null and r.week_start = v_week;

  update public.tower_runs r
  set finished_at = now(),
      score = p_score,
      floors = p_floors,
      best_combo = p_best_combo,
      best_streak = p_best_streak,
      perfects = p_perfects,
      duration_ms = p_duration_ms,
      week_start = v_week
  where r.id = p_run and r.member_id = p_member and r.finished_at is null;

  if not found then
    return null;
  end if;

  -- My place this week, with this run counted: members whose best is above mine, plus one.
  select 1 + count(*)::int into v_rank
  from (
    select r.member_id, max(r.score) as best
    from public.tower_runs r
    where r.finished_at is not null and r.week_start = v_week and r.member_id <> p_member
    group by r.member_id
  ) others
  where others.best > greatest(p_score, v_prev_week);

  return jsonb_build_object(
    'rank_week', v_rank,
    'previous_best', v_prev,
    'previous_week_best', v_prev_week,
    'week_record_before', v_week_record
  );
end;
$$;

revoke execute on function public.tower_close_run(uuid, uuid, integer, integer, integer, integer, integer, integer) from public, anon, authenticated;
grant  execute on function public.tower_close_run(uuid, uuid, integer, integer, integer, integer, integer, integer) to service_role;


-- -----------------------------------------------------------------------------
-- 7. The shared tower: what it is now, and placing a crate (server only)
-- -----------------------------------------------------------------------------

create function public.tower_team_stats(p_today date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'record_height', coalesce((select max(t.height) from public.tower_team_towers t), 0),
    'record_on', (
      select coalesce(t.fallen_on, p_today)
      from public.tower_team_towers t
      order by t.height desc, t.created_at asc
      limit 1
    ),
    'best_day', (
      select c.day from public.tower_team_crates c
      where c.kind <> 'miss' group by c.day order by count(*) desc, c.day desc limit 1
    ),
    'best_day_crates', coalesce((
      select count(*)::int from public.tower_team_crates c
      where c.kind <> 'miss' group by c.day order by count(*) desc, c.day desc limit 1
    ), 0),
    'total_crates', (select count(*)::int from public.tower_team_crates c where c.kind <> 'miss'),
    'towers', (select count(*)::int from public.tower_team_towers),
    'contributors', coalesce((
      select jsonb_agg(
        jsonb_build_object('member_id', s.member_id, 'crates', s.crates, 'perfects', s.perfects)
        order by s.crates desc, s.perfects desc, s.member_id
      )
      from (
        select c.member_id,
               count(*) filter (where c.kind <> 'miss')::int as crates,
               count(*) filter (where c.kind = 'perfect')::int as perfects
        from public.tower_team_crates c
        where c.member_id is not null
        group by c.member_id
      ) s
    ), '[]'::jsonb),
    'last', (
      select jsonb_build_object('member_id', c.member_id, 'placed_at', c.placed_at, 'kind', c.kind)
      from public.tower_team_crates c
      order by c.placed_at desc
      limit 1
    )
  );
$$;

/*
 * The shared tower as it is now, for the member who asks. If no tower stands
 * and none fell today, a new one is raised (empty) on the way: that is the only
 * thing this function writes, and it is the same for whoever asks first.
 */
create function public.tower_team_view()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := (select auth.uid());
  v_today  date := public.tower_day_of(now());
  v_tower  public.tower_team_towers%rowtype;
  v_shown  uuid;
  v_fallen uuid;
begin
  if not public.is_active_member() then
    raise exception 'Réservé aux membres actifs.' using errcode = '42501';
  end if;

  select * into v_tower from public.tower_team_towers t where t.fallen_on is null;
  if not found and not exists (select 1 from public.tower_team_towers t where t.fallen_on = v_today) then
    insert into public.tower_team_towers (seed, started_on)
    values (floor(random() * 4294967296)::bigint, v_today)
    on conflict do nothing;
    select * into v_tower from public.tower_team_towers t where t.fallen_on is null;
  end if;

  if v_tower.id is not null then
    v_shown := v_tower.id;
  else
    -- Today's tower fell: it is still shown, in pieces, until tomorrow.
    select t.id, t.fallen_by into v_shown, v_fallen
    from public.tower_team_towers t
    where t.fallen_on = v_today
    order by t.created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'today', v_today,
    'tower', case when v_tower.id is null then null else jsonb_build_object(
      'id', v_tower.id,
      'seed', v_tower.seed,
      'started_on', v_tower.started_on,
      'height', v_tower.height,
      'top', jsonb_build_object('x0', v_tower.x0, 'x1', v_tower.x1, 'z0', v_tower.z0, 'z1', v_tower.z1)
    ) end,
    'crates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'floor', c.floor,
          'member_id', c.member_id,
          'day', c.day,
          'kind', c.kind,
          'rect', case when c.kind = 'miss' then null
                       else jsonb_build_object('x0', c.x0, 'x1', c.x1, 'z0', c.z0, 'z1', c.z1) end,
          'placed_at', c.placed_at
        )
        order by c.floor
      )
      from public.tower_team_crates c
      where c.tower_id = v_shown
    ), '[]'::jsonb),
    'fallen_by', v_fallen,
    'played_today', exists (
      select 1 from public.tower_team_crates c where c.day = v_today and c.member_id = v_me
    ),
    'stats', public.tower_team_stats(v_today)
  );
end;
$$;

/*
 * Places one crate, atomically. The server computed where it lands from the
 * tower's seed, the floor and the tick it was let go at; this function makes
 * sure the tower is still the one that was aimed at (locked for the time of
 * the check), that the member has not played today, and writes the crate and
 * the new top together, or the fall.
 *
 * Returns 'ok', or why not: 'moved' (someone placed a crate in the meantime:
 * aim again, the day's crate is not spent), 'played', 'fallen'.
 */
create function public.tower_team_commit(
  p_tower  uuid,
  p_floor  integer,
  p_member uuid,
  p_kind   text,
  p_x0     integer,
  p_x1     integer,
  p_z0     integer,
  p_z1     integer,
  p_day    date default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day   date := coalesce(p_day, public.tower_day_of(now()));
  v_tower public.tower_team_towers%rowtype;
begin
  select * into v_tower from public.tower_team_towers t where t.id = p_tower for update;
  if not found or v_tower.fallen_on is not null then
    return 'fallen';
  end if;
  if v_tower.height <> p_floor - 1 then
    return 'moved';
  end if;
  if exists (select 1 from public.tower_team_crates c where c.day = v_day and c.member_id = p_member) then
    return 'played';
  end if;

  begin
    if p_kind = 'miss' then
      insert into public.tower_team_crates (tower_id, floor, member_id, day, kind)
      values (p_tower, p_floor, p_member, v_day, 'miss');
      update public.tower_team_towers t set fallen_on = v_day, fallen_by = p_member where t.id = p_tower;
    else
      insert into public.tower_team_crates (tower_id, floor, member_id, day, kind, x0, x1, z0, z1)
      values (p_tower, p_floor, p_member, v_day, p_kind, p_x0, p_x1, p_z0, p_z1);
      update public.tower_team_towers t
      set height = p_floor, x0 = p_x0, x1 = p_x1, z0 = p_z0, z1 = p_z1
      where t.id = p_tower;
    end if;
  exception
    -- The same member, twice at the same instant: the second one has played.
    when unique_violation then
      return 'played';
  end;

  return 'ok';
end;
$$;

revoke execute on function public.tower_team_stats(date) from public, anon;
grant  execute on function public.tower_team_stats(date) to authenticated, service_role;
revoke execute on function public.tower_team_view() from public, anon;
grant  execute on function public.tower_team_view() to authenticated, service_role;
revoke execute on function public.tower_team_commit(uuid, integer, uuid, text, integer, integer, integer, integer, date) from public, anon, authenticated;
grant  execute on function public.tower_team_commit(uuid, integer, uuid, text, integer, integer, integer, integer, date) to service_role;
revoke execute on function public.tower_week_of(timestamptz) from public, anon;
revoke execute on function public.tower_day_of(timestamptz)  from public, anon;
grant  execute on function public.tower_week_of(timestamptz) to authenticated, service_role;
grant  execute on function public.tower_day_of(timestamptz)  to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 8. Realtime: a teammate's score, a teammate's crate, as they happen
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['tower_runs', 'tower_team_towers', 'tower_team_crates']
  loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables pt
      where pt.pubname = 'supabase_realtime' and pt.schemaname = 'public' and pt.tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
