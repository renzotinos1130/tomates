-- =============================================================================
-- Team Tomate HQ — push notifications
--
-- A member who has installed the app (or allowed notifications in a browser)
-- is told, on that device, when a task is created, handed to them, finished or
-- blocked, and when someone takes the lead at Tomato Tower.
--
-- What the database holds
--   * push_subscriptions  one row per device a member has turned notifications
--                         on for: the address the browser's push service gave
--                         it, and the two keys a message for it is sealed with.
--   * push_prefs          what a member wants to hear about (no row: everything).
--   * push_outbox         what happened and has not been announced yet. Written
--                         here, by triggers, in the same transaction as the
--                         thing itself: an announcement never rests on what a
--                         browser claims happened.
--
-- Who can do what
--   Nobody reads or writes these tables through the API. The server
--   (src/lib/server/push.ts and push-dispatch.ts, service role) saves the
--   devices and the choices after checking who is asking, takes the pending
--   rows of the outbox with push_claim() and sends the messages.
--
-- What is announced
--   * a task created by a signed-in member                    task_created
--   * a task handed to someone else afterwards                task_assigned
--   * a task that becomes done / blocked                      task_done / task_blocked
--   * a run that takes the week's lead at Tomato Tower from
--     someone else (or sets the week's first score), or
--     takes the record of all time from someone else          tower_record
--   Seeds and server-side writes announce nothing: a task event counts only
--   when a signed-in member is behind it.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Devices
-- -----------------------------------------------------------------------------

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members (id) on delete cascade,
  -- The push service's address for this device. A browser profile has one: when
  -- another member signs in on the same device, the row changes hands.
  endpoint    text not null unique check (char_length(endpoint) between 12 and 2000),
  p256dh      text not null check (char_length(p256dh) between 80 and 120),
  auth        text not null check (char_length(auth) between 16 and 60),
  -- « iPhone », « Mac · Safari »… what the member reads in the list of their devices.
  device      text not null default '' check (char_length(device) <= 60),
  created_at  timestamptz not null default now(),
  seen_at     timestamptz not null default now()
);

comment on table public.push_subscriptions is
  'Devices that receive push notifications, one row each. Server only: the address and the keys never travel back to a browser.';

create index push_subscriptions_member_idx on public.push_subscriptions (member_id);


-- -----------------------------------------------------------------------------
-- 2. What each member wants to hear about
-- -----------------------------------------------------------------------------

create table public.push_prefs (
  member_id     uuid primary key references public.members (id) on delete cascade,
  task_created  boolean not null default true,
  task_done     boolean not null default true,
  task_blocked  boolean not null default true,
  tower_record  boolean not null default true,
  -- 'team': every task of the team. 'mine': only the tasks I am responsible for or created.
  scope         text not null default 'team' check (scope in ('team', 'mine')),
  updated_at    timestamptz not null default now()
);

comment on table public.push_prefs is
  'Notification choices of a member. No row means the defaults: everything, for the whole team.';


-- -----------------------------------------------------------------------------
-- 3. The outbox
-- -----------------------------------------------------------------------------

create table public.push_outbox (
  id          bigint generated always as identity primary key,
  kind        text not null
                check (kind in ('task_created', 'task_assigned', 'task_done', 'task_blocked', 'tower_record')),
  -- Who did it: never told about their own doing.
  actor_id    uuid references public.members (id) on delete cascade,
  task_id     uuid references public.tasks (id) on delete cascade,
  -- task_assigned: {"assignee_id"}. tower_record: {"score", "floors", "previous_member_id", "previous_score",
  -- "all_time", "all_time_member_id", "all_time_score"}.
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  -- Set when the server takes the row to send it. A row is taken once.
  claimed_at  timestamptz
);

comment on table public.push_outbox is
  'Things to announce by push notification, written by triggers. The server takes them with push_claim().';

create index push_outbox_pending_idx on public.push_outbox (id) where claimed_at is null;


-- -----------------------------------------------------------------------------
-- 4. Privileges: the server only
-- -----------------------------------------------------------------------------

revoke all on public.push_subscriptions, public.push_prefs, public.push_outbox from anon, authenticated;
grant all on public.push_subscriptions, public.push_prefs, public.push_outbox to service_role;

-- Row level security with no policy: even a grant made by mistake would show nothing.
alter table public.push_subscriptions enable row level security;
alter table public.push_prefs         enable row level security;
alter table public.push_outbox        enable row level security;


-- -----------------------------------------------------------------------------
-- 5. Tasks: the activity log is the source
--
-- task_events already says, in the transaction of the change, who created a
-- task, who changed its status or its person. The outbox keeps the events worth
-- a notification.
-- -----------------------------------------------------------------------------

create function public.push_enqueue_task_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  -- Only what a signed-in member has just done. A seed, an import or a
  -- server-side fix writes events too: they are nobody's news.
  if new.actor_id is null or public.current_member_id() is null then
    return null;
  end if;

  v_kind := case
    when new.kind = 'created' then 'task_created'
    when new.kind = 'status' and new.new_value = 'done' then 'task_done'
    when new.kind = 'status' and new.new_value = 'blocked' then 'task_blocked'
    when new.kind = 'assignee' and new.new_value is not null then 'task_assigned'
  end;
  if v_kind is null then
    return null;
  end if;

  insert into public.push_outbox (kind, actor_id, task_id, detail)
  values (
    v_kind,
    new.actor_id,
    new.task_id,
    case when v_kind = 'task_assigned' then jsonb_build_object('assignee_id', new.new_value) else '{}'::jsonb end
  );
  return null;
end;
$$;

create trigger task_events_push
  after insert on public.task_events
  for each row execute function public.push_enqueue_task_event();


-- -----------------------------------------------------------------------------
-- 6. Tomato Tower: a new lead, a new record
--
-- A run is closed by the server (tower_close_run). Two things are news:
--   * the week's lead changes hands (or the week has its first score);
--   * the record of all time changes hands.
-- Someone beating their own best is not: nothing has changed hands, and the
-- best player of the team would otherwise ring everyone's phone at every run.
-- One row says both, so one message does.
-- -----------------------------------------------------------------------------

create function public.push_enqueue_tower_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_holder     uuid;
  v_best       integer;
  v_all_holder uuid;
  v_all_best   integer;
  v_leads      boolean;
  v_record     boolean;
begin
  if old.finished_at is not null or new.finished_at is null or coalesce(new.score, 0) <= 0 then
    return null;
  end if;

  -- The best run of the week before this one.
  select r.member_id, r.score into v_holder, v_best
  from public.tower_runs r
  where r.finished_at is not null and r.week_start = new.week_start and r.id <> new.id
  order by r.score desc, r.finished_at asc
  limit 1;
  v_leads := v_best is null or (new.score > v_best and v_holder <> new.member_id);

  -- The best run ever before this one. The very first run of all is a first score, not a record.
  select r.member_id, r.score into v_all_holder, v_all_best
  from public.tower_runs r
  where r.finished_at is not null and r.id <> new.id
  order by r.score desc, r.finished_at asc
  limit 1;
  v_record := v_all_best is not null and new.score > v_all_best and v_all_holder <> new.member_id;

  if not (v_leads or v_record) then
    return null;
  end if;

  insert into public.push_outbox (kind, actor_id, detail)
  values (
    'tower_record',
    new.member_id,
    jsonb_build_object(
      'score', new.score,
      'floors', new.floors,
      'previous_member_id', v_holder,
      'previous_score', v_best,
      'all_time', v_record,
      'all_time_member_id', v_all_holder,
      'all_time_score', v_all_best
    )
  );
  return null;
end;
$$;

create trigger tower_runs_push
  after update of finished_at on public.tower_runs
  for each row execute function public.push_enqueue_tower_record();


-- -----------------------------------------------------------------------------
-- 7. Taking what is pending (server only)
--
-- One statement marks the rows and returns them: two servers asking at the same
-- instant never announce the same thing twice. What was handed over more than a
-- week ago is forgotten on the way.
-- -----------------------------------------------------------------------------

create function public.push_claim(p_limit integer default 200)
returns setof public.push_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.push_outbox o where o.claimed_at < now() - interval '7 days';

  return query
    with picked as (
      select o.id
      from public.push_outbox o
      where o.claimed_at is null
      order by o.id
      limit greatest(1, least(coalesce(p_limit, 200), 500))
      for update skip locked
    )
    update public.push_outbox o
    set claimed_at = now()
    from picked
    where o.id = picked.id
    returning o.*;
end;
$$;

revoke execute on function public.push_claim(integer)            from public, anon, authenticated;
revoke execute on function public.push_enqueue_task_event()      from public, anon, authenticated;
revoke execute on function public.push_enqueue_tower_record()    from public, anon, authenticated;
grant  execute on function public.push_claim(integer)            to service_role;
