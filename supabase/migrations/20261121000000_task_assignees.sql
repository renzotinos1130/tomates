-- =============================================================================
-- Team Tomate HQ — several people on one task
--
-- A task could be given to one person (tasks.assignee_id). It can now be given
-- to several: tasks.assignee_ids, the list of them in the order they were
-- added.
--
-- The old column stays and always holds the first of the list. That keeps every
-- page still open with the previous version of the app working through the
-- change: it reads one person per task and writes one, and the database turns
-- that into a list of one.
--
-- What changes
--   * tasks.assignee_ids   uuid[], filled from assignee_id for existing tasks
--                          (nothing else of them is touched: no trigger runs
--                          during the copy, so no date moves and no activity is
--                          logged).
--   * tasks_sync_assignees keeps the two columns in agreement on every write,
--                          cleans the list (no blank, nobody twice) and refuses
--                          anyone who is not a member.
--   * a member who is deleted is taken off the tasks they shared.
--   * the activity log and the push outbox speak of lists: « assignee » events
--     carry the people before and after, and a task announces itself to each
--     person it is newly given to.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The column
-- -----------------------------------------------------------------------------

alter table public.tasks
  add column assignee_ids uuid[] not null default '{}'::uuid[];

comment on column public.tasks.assignee_ids is
  'Everyone the task is given to, in the order they were added. assignee_id is always the first of them (kept for the pages that know one person per task).';

-- The copy is a change of shape, not something anybody did: no trigger sees it.
alter table public.tasks disable trigger user;
update public.tasks set assignee_ids = array[assignee_id] where assignee_id is not null;
alter table public.tasks enable trigger user;

alter table public.tasks
  add constraint tasks_assignee_ids_few check (cardinality(assignee_ids) <= 12);

create index tasks_assignee_ids_idx on public.tasks using gin (assignee_ids);


-- -----------------------------------------------------------------------------
-- 2. The two columns agree, whoever writes
-- -----------------------------------------------------------------------------

create function public.tasks_sync_assignees()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_people uuid[];
begin
  if tg_op = 'INSERT' then
    -- A page that knows one person per task creates it with that person alone.
    if cardinality(new.assignee_ids) = 0 and new.assignee_id is not null then
      new.assignee_ids := array[new.assignee_id];
    end if;
  elsif new.assignee_ids is not distinct from old.assignee_ids
        and new.assignee_id is distinct from old.assignee_id then
    -- …and when it changes that person, the task is that person's alone (or nobody's).
    new.assignee_ids := case when new.assignee_id is null then '{}'::uuid[] else array[new.assignee_id] end;
  end if;

  -- No blank, nobody twice, in the order given.
  select coalesce(array_agg(u.id order by u.ord), '{}'::uuid[]) into v_people
  from (
    select distinct on (x.id) x.id, x.ord
    from unnest(new.assignee_ids) with ordinality as x (id, ord)
    where x.id is not null
    order by x.id, x.ord
  ) u;

  if exists (
    select 1 from unnest(v_people) as a (id)
    where not exists (select 1 from public.members m where m.id = a.id)
  ) then
    raise exception 'Une tâche ne peut être confiée qu''à des membres de l''équipe.'
      using errcode = '23503';
  end if;

  new.assignee_ids := v_people;
  new.assignee_id  := v_people[1];
  return new;
end;
$$;

-- Its name sorts before tasks_before_insert / tasks_before_update: the people are settled first.
create trigger tasks_assignees_sync
  before insert or update on public.tasks
  for each row execute function public.tasks_sync_assignees();


-- -----------------------------------------------------------------------------
-- 3. A member who leaves is taken off the tasks they shared
--
-- The foreign key of assignee_id clears that column by itself; a list has no
-- foreign key, so the list is emptied of them here, before they go. The first
-- of those who remain becomes assignee_id.
-- -----------------------------------------------------------------------------

create function public.members_leave_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tasks t
  set assignee_ids = array_remove(t.assignee_ids, old.id)
  where t.assignee_ids @> array[old.id];
  return old;
end;
$$;

create trigger members_leave_tasks
  before delete on public.members
  for each row execute function public.members_leave_tasks();

revoke execute on function public.members_leave_tasks()  from public, anon, authenticated;
revoke execute on function public.tasks_sync_assignees() from public, anon;


-- -----------------------------------------------------------------------------
-- 4. The activity log: the people of a task, before and after
--
-- An « assignee » event used to carry one member id on each side. It now
-- carries the list, ids separated by commas (null when nobody): the events
-- already written read as lists of one.
-- -----------------------------------------------------------------------------

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
       old.status::text, new.status::text,
       old.status is distinct from new.status),
      ('priority',
       old.priority::text, new.priority::text,
       old.priority is distinct from new.priority),
      ('assignee',
       nullif(array_to_string(old.assignee_ids, ','), ''), nullif(array_to_string(new.assignee_ids, ','), ''),
       old.assignee_ids is distinct from new.assignee_ids),
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
-- 5. Push notifications: a task announces itself to each person it is newly given to
-- -----------------------------------------------------------------------------

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

  v_kind := case
    when new.kind = 'created' then 'task_created'
    when new.kind = 'status' and new.new_value = 'done' then 'task_done'
    when new.kind = 'status' and new.new_value = 'blocked' then 'task_blocked'
  end;
  if v_kind is null then
    return null;
  end if;

  insert into public.push_outbox (kind, actor_id, task_id)
  values (v_kind, new.actor_id, new.task_id);
  return null;
end;
$$;
