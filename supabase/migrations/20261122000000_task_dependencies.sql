-- =============================================================================
-- Team Tomate HQ — a task that depends on another waits for it
--
-- A task can depend on other tasks (tasks.depends_on, the list of them). While
-- one of them is still to do, the task is blocked: whatever status is asked for,
-- the database keeps it « blocked » and marks it as waiting (tasks.waiting).
-- The moment the last of them is finished, the task goes back to « todo » by
-- itself and the people it is given to are told it is their turn.
--
-- What « still to do » means: not done, and not archived. An archived task
-- holds nobody back, and neither does one that was deleted (it leaves the
-- lists it was on).
--
-- What changes
--   * tasks.depends_on  uuid[]  the tasks this one waits for.
--   * tasks.waiting     boolean true while one of them is still to do. Kept by
--                       trigger; what a client writes there is ignored.
--   * tasks_await       settles a task on every write: cleans the list, refuses
--                       a circle, blocks the task while it waits and frees it
--                       when it no longer does.
--   * tasks_release_dependents  when a task is finished, reopened, archived or
--                       deleted, the tasks that depend on it are settled.
--   * the activity log tells a wait from a blocker (« waiting », not
--     « blocked »), and records the dependencies added and removed.
--   * push notifications: a task that starts waiting is not announced as
--     blocked; a task that is freed is announced to the people it is given to.
--
-- Nothing changes for the tasks that exist: none depends on another yet.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The columns
-- -----------------------------------------------------------------------------

alter table public.tasks
  add column depends_on uuid[]  not null default '{}'::uuid[],
  add column waiting    boolean not null default false;

comment on column public.tasks.depends_on is
  'The tasks this one waits for. While one of them is neither done nor archived, the task is kept blocked.';
comment on column public.tasks.waiting is
  'True while a task it depends on is still to do (maintained by trigger). A blocked task that is not waiting is blocked by a problem someone reported.';

alter table public.tasks
  add constraint tasks_depends_on_few check (cardinality(depends_on) <= 20);

create index tasks_depends_on_idx on public.tasks using gin (depends_on);


-- -----------------------------------------------------------------------------
-- 2. What holds a task back
-- -----------------------------------------------------------------------------

create function public.task_is_held(p_depends_on uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks d
    where d.id = any (p_depends_on)
      and d.status <> 'done'
      and d.archived_at is null
  );
$$;

comment on function public.task_is_held(uuid[]) is
  'True when one of these tasks is still to do: not done, not archived.';


-- -----------------------------------------------------------------------------
-- 3. Every write settles the task
-- -----------------------------------------------------------------------------

create function public.tasks_await()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deps    uuid[];
  v_changed boolean := tg_op = 'INSERT';
  v_held    boolean;
begin
  if tg_op = 'UPDATE' then
    v_changed := new.depends_on is distinct from old.depends_on;
  end if;

  if v_changed then
    -- The list: tasks that exist, each once, never the task itself, in the order given.
    select coalesce(array_agg(u.id order by u.ord), '{}'::uuid[]) into v_deps
    from (
      select distinct on (x.id) x.id, x.ord
      from unnest(new.depends_on) with ordinality as x (id, ord)
      where x.id is not null
        and x.id <> new.id
        and exists (select 1 from public.tasks d where d.id = x.id)
      order by x.id, x.ord
    ) u;
    new.depends_on := v_deps;

    -- No circle: a task cannot wait for one that waits for it, however far down the line.
    -- (A task being created is on nobody's list yet.)
    if tg_op = 'UPDATE' and cardinality(v_deps) > 0 and exists (
      with recursive upstream (id) as (
        select unnest(v_deps)
        union
        select d.dep
        from upstream u
        join public.tasks t on t.id = u.id
        cross join lateral unnest(t.depends_on) as d (dep)
      )
      select 1 from upstream where id = new.id
    ) then
      raise exception 'Deux tâches ne peuvent pas dépendre l''une de l''autre.'
        using errcode = '23514';
    end if;
  end if;

  -- Held back while something it depends on is still to do.
  v_held := public.task_is_held(new.depends_on);

  if tg_op = 'UPDATE' then
    -- A task that was already finished stays finished: what is done is not undone by a list.
    if old.status = 'done' and new.status = 'done' then
      v_held := false;
    end if;
    -- What it waited for is finished, or out of the way: it is free to be taken up.
    if not v_held and old.waiting and old.status = 'blocked' and new.status = 'blocked' then
      new.status := 'todo';
    end if;
  end if;

  if v_held then
    new.status := 'blocked';
  end if;
  new.waiting := v_held;
  return new;
end;
$$;

-- Its name sorts before tasks_before_insert / tasks_before_update: the status is
-- settled first, the dates that follow it (status_changed_at, completed_at) after.
create trigger tasks_await
  before insert or update on public.tasks
  for each row execute function public.tasks_await();


-- -----------------------------------------------------------------------------
-- 4. A task moves: the tasks that depend on it follow
--
-- After the write, so that the rows of one statement are all in place (a project
-- deleted with its tasks, for instance). The update below changes nothing by
-- itself: it is tasks_await that blocks or frees each task it touches.
-- -----------------------------------------------------------------------------

create function public.tasks_release_dependents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- A list has no foreign key: the task that goes is taken off the lists it was on.
    update public.tasks t
    set depends_on = array_remove(t.depends_on, old.id)
    where t.depends_on @> array[old.id];
    return null;
  end if;

  -- Finished or put away: whoever waited for it may be free. Reopened or brought back: they wait again.
  if (old.status = 'done' or old.archived_at is not null)
     is distinct from (new.status = 'done' or new.archived_at is not null) then
    update public.tasks t
    set status = t.status
    where t.depends_on @> array[new.id]
      and t.status <> 'done'
      and t.waiting is distinct from public.task_is_held(t.depends_on);
  end if;
  return null;
end;
$$;

-- Its name sorts after tasks_log_update: the task's own line is in the log
-- before the lines of the tasks it frees.
create trigger tasks_release_dependents
  after update or delete on public.tasks
  for each row execute function public.tasks_release_dependents();

revoke execute on function public.task_is_held(uuid[])           from public, anon, authenticated;
revoke execute on function public.tasks_await()                  from public, anon, authenticated;
revoke execute on function public.tasks_release_dependents()     from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. The activity log
--
-- A « status » line of a task that starts waiting says « waiting », not
-- « blocked »: nobody reported a problem. When the wait comes from its list
-- being changed, the « dependency » line says it all and there is no status
-- line. A « dependency » line carries the lists before and after, ids
-- separated by commas (null when empty).
-- -----------------------------------------------------------------------------

alter table public.task_events drop constraint task_events_kind_check;
alter table public.task_events add constraint task_events_kind_check
  check (kind in ('created', 'status', 'priority', 'assignee', 'due_date',
                  'title', 'project', 'archived', 'unarchived', 'commented', 'attached', 'dependency'));

create or replace function public.tasks_log_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_events (task_id, project_id, actor_id, kind, old_value, new_value)
  select new.id, new.project_id, public.current_member_id(), e.kind, e.old_value, e.new_value
  from (
    values
      ('status',
       old.status::text, case when new.waiting then 'waiting' else new.status::text end,
       old.status is distinct from new.status
         and not (new.waiting and old.depends_on is distinct from new.depends_on)),
      ('priority',
       old.priority::text, new.priority::text,
       old.priority is distinct from new.priority),
      ('assignee',
       nullif(array_to_string(old.assignee_ids, ','), ''), nullif(array_to_string(new.assignee_ids, ','), ''),
       old.assignee_ids is distinct from new.assignee_ids),
      ('dependency',
       nullif(array_to_string(old.depends_on, ','), ''), nullif(array_to_string(new.depends_on, ','), ''),
       old.depends_on is distinct from new.depends_on),
      ('due_date',
       to_char(old.due_date, 'YYYY-MM-DD'), to_char(new.due_date, 'YYYY-MM-DD'),
       old.due_date is distinct from new.due_date),
      ('title',
       old.title, new.title,
       old.title is distinct from new.title),
      ('project',
       old.project_id::text, new.project_id::text,
       old.project_id is distinct from new.project_id),
      ('archived',
       null, to_json(new.archived_at) #>> '{}',
       old.archived_at is null and new.archived_at is not null),
      ('unarchived',
       to_json(old.archived_at) #>> '{}', null,
       old.archived_at is not null and new.archived_at is null)
  ) as e (kind, old_value, new_value, changed)
  where e.changed;

  return null;
end;
$$;


-- -----------------------------------------------------------------------------
-- 6. Push notifications: a task that is freed is announced to its people
-- -----------------------------------------------------------------------------

alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('task_created', 'task_assigned', 'task_done', 'task_blocked', 'task_released', 'tower_record'));

create or replace function public.push_enqueue_task_event()
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

  if new.kind = 'assignee' then
    -- One row per person added; who was already there, or was taken off, is not told.
    insert into public.push_outbox (kind, actor_id, task_id, detail)
    select 'task_assigned', new.actor_id, new.task_id, jsonb_build_object('assignee_id', added.id)
    from unnest(string_to_array(coalesce(new.new_value, ''), ',')) as added (id)
    where added.id <> ''
      and added.id <> all (string_to_array(coalesce(new.old_value, ''), ','));
    return null;
  end if;

  -- A task that starts waiting for another is logged as « waiting »: it matches nothing here.
  v_kind := case
    when new.kind = 'created' then 'task_created'
    when new.kind = 'status' and new.new_value = 'done' then 'task_done'
    when new.kind = 'status' and new.new_value = 'blocked' then 'task_blocked'
    when new.kind = 'status' and new.old_value = 'blocked' and new.new_value = 'todo' then 'task_released'
  end;
  if v_kind is null then
    return null;
  end if;

  insert into public.push_outbox (kind, actor_id, task_id)
  values (v_kind, new.actor_id, new.task_id);
  return null;
end;
$$;
