-- =============================================================================
-- Team Tomate HQ — initial schema
--
-- Source of truth for the TypeScript contract in src/lib/types.ts: column names,
-- nullability and enum values below must stay in sync with those interfaces
-- (rows from PostgREST / Realtime are stored client-side as-is).
--
-- Access model
--   * Anyone may sign up (Supabase Auth), but data is only visible to *active*
--     members (public.members.active = true).
--   * The very first user becomes an active admin. Later users are activated
--     automatically when their email is in public.member_invites, otherwise they
--     stay pending until an admin activates them.
--   * The `anon` role gets nothing. Every table has RLS enabled and policies
--     only target `authenticated`.
--   * public.task_events is an append-only activity log written exclusively by
--     security-definer triggers.
--
-- Conventions
--   * Every function pins `search_path = ''` and uses fully-qualified names.
--   * Policies wrap helper calls in `(select ...)` so Postgres evaluates them
--     once per statement (initPlan) instead of once per row.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------

create type public.task_status as enum ('todo', 'in_progress', 'review', 'blocked', 'done');
create type public.task_priority as enum ('high', 'normal', 'low');
create type public.member_role as enum ('admin', 'member');
create type public.meeting_status as enum ('planned', 'live', 'closed');
create type public.meeting_item_kind as enum ('decision', 'topic');


-- -----------------------------------------------------------------------------
-- 2. Tables
--
-- Colors (MemberColor) and icons (ProjectIcon) are plain text + CHECK rather
-- than enums so the palette can evolve with a simple constraint swap.
-- -----------------------------------------------------------------------------

-- 2.1 members — one row per auth user, created by public.handle_new_user().
create table public.members (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique
                check (email = lower(email)),
  full_name   text not null default '',
  color       text not null default 'teal'
                check (color in ('teal', 'amber', 'indigo', 'rose', 'sky', 'violet', 'emerald', 'orange', 'slate')),
  avatar_url  text,
  role        public.member_role not null default 'member',
  active      boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.members is
  'Team members (1:1 with auth.users). Only active members can read app data.';
comment on column public.members.active is
  'false = pending: signed up but not (yet) approved by an admin.';

-- 2.2 member_invites — email allowlist consumed by handle_new_user().
create table public.member_invites (
  email       text primary key
                check (email = lower(btrim(email)) and position('@' in email) > 1),
  role        public.member_role not null default 'member',
  invited_by  uuid default auth.uid() references public.members (id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.member_invites is
  'Allowlist: a user signing up with one of these (lowercase) emails is activated with the given role; the invite is then deleted.';

-- 2.3 projects
create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique
                 check (char_length(slug) between 1 and 100),
  name         text not null
                 check (char_length(name) between 1 and 200),
  description  text not null default '',
  color        text not null default 'teal'
                 check (color in ('teal', 'amber', 'indigo', 'rose', 'sky', 'violet', 'emerald', 'orange', 'slate')),
  icon         text not null default 'folder'
                 check (icon in ('smartphone', 'globe', 'megaphone', 'folder', 'palette', 'rocket', 'chart', 'users', 'book')),
  position     double precision not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references public.members (id) on delete set null
);

-- 2.4 meetings — one weekly meeting per Wed → Tue week.
create table public.meetings (
  id          uuid primary key default gen_random_uuid(),
  week_start  date not null unique,
  status      public.meeting_status not null default 'planned',
  started_at  timestamptz,
  ended_at    timestamptz,
  started_by  uuid references public.members (id) on delete set null,
  attendees   uuid[] not null default '{}',
  notes       text not null default '',
  summary     jsonb,
  created_at  timestamptz not null default now()
);

comment on column public.meetings.week_start is
  'Wednesday that starts the Wed → Tue week this meeting belongs to.';
comment on column public.meetings.summary is
  'Frozen recap (MeetingSummary, version 1) written when the meeting is closed.';

-- 2.5 tasks
create table public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects (id) on delete cascade,
  title              text not null
                       check (char_length(title) between 1 and 500 and btrim(title) <> ''),
  description        text not null default '',
  status             public.task_status not null default 'todo',
  priority           public.task_priority not null default 'normal',
  assignee_id        uuid references public.members (id) on delete set null,
  due_date           date,
  position           double precision not null default 0,
  meeting_id         uuid references public.meetings (id) on delete set null,
  created_by         uuid default auth.uid() references public.members (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  status_changed_at  timestamptz not null default now(),
  completed_at       timestamptz,
  archived_at        timestamptz
);

comment on column public.tasks.position is
  'Manual ordering inside a status column (fractional index).';
comment on column public.tasks.meeting_id is
  'Meeting during which the task was created, if any.';
comment on column public.tasks.status_changed_at is
  'Last time status changed (maintained by trigger) — used to detect tasks that did not move.';
comment on column public.tasks.completed_at is
  'Set by trigger when status becomes done, cleared when it leaves done.';

-- 2.6 subtasks
create table public.subtasks (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  title       text not null
                check (char_length(title) between 1 and 500 and btrim(title) <> ''),
  done        boolean not null default false,
  position    double precision not null default 0,
  created_at  timestamptz not null default now()
);

-- 2.7 comments
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  author_id   uuid default auth.uid() references public.members (id) on delete set null,
  body        text not null
                check (char_length(body) between 1 and 5000 and btrim(body) <> ''),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2.8 task_events — append-only activity log (written by triggers only).
create table public.task_events (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  actor_id    uuid references public.members (id) on delete set null,
  kind        text not null
                check (kind in ('created', 'status', 'priority', 'assignee', 'due_date',
                                'title', 'project', 'archived', 'unarchived', 'commented')),
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);

comment on table public.task_events is
  'Task activity log. Written only by security-definer triggers; read-only for clients.';
comment on column public.task_events.new_value is
  'New value as text (status, priority, member id, YYYY-MM-DD, title, project id, ISO timestamp…). For commented: the comment id.';

-- 2.9 meeting_items — decisions and topics captured during a meeting.
create table public.meeting_items (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references public.meetings (id) on delete cascade,
  kind        public.meeting_item_kind not null,
  body        text not null
                check (char_length(body) between 1 and 2000 and btrim(body) <> ''),
  project_id  uuid references public.projects (id) on delete set null,
  author_id   uuid default auth.uid() references public.members (id) on delete set null,
  done        boolean not null default false,
  position    double precision not null default 0,
  created_at  timestamptz not null default now()
);

-- 2.10 meeting_priorities — tasks pinned as priorities for a meeting.
create table public.meeting_priorities (
  meeting_id  uuid not null references public.meetings (id) on delete cascade,
  task_id     uuid not null references public.tasks (id) on delete cascade,
  position    double precision not null default 0,
  created_by  uuid default auth.uid() references public.members (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (meeting_id, task_id)
);


-- -----------------------------------------------------------------------------
-- 3. Indexes (FK lookups + the app's main access paths)
-- -----------------------------------------------------------------------------

create index tasks_project_id_idx        on public.tasks (project_id, status, position);
create index tasks_assignee_id_idx       on public.tasks (assignee_id) where assignee_id is not null;
create index tasks_meeting_id_idx        on public.tasks (meeting_id) where meeting_id is not null;
create index tasks_created_by_idx        on public.tasks (created_by);
create index subtasks_task_id_idx        on public.subtasks (task_id, position);
create index comments_task_id_idx        on public.comments (task_id, created_at);
create index comments_author_id_idx      on public.comments (author_id);
create index task_events_task_id_idx     on public.task_events (task_id, created_at desc);
create index task_events_project_id_idx  on public.task_events (project_id, created_at desc);
create index task_events_actor_id_idx    on public.task_events (actor_id);
create index meeting_items_meeting_idx   on public.meeting_items (meeting_id, position);
create index meeting_items_project_idx   on public.meeting_items (project_id) where project_id is not null;
create index meeting_items_author_idx    on public.meeting_items (author_id);
create index meeting_priorities_task_idx on public.meeting_priorities (task_id);
create index meeting_priorities_created_by_idx on public.meeting_priorities (created_by);
create index meetings_started_by_idx     on public.meetings (started_by);
create index member_invites_invited_by_idx on public.member_invites (invited_by);
create index projects_created_by_idx     on public.projects (created_by);


-- -----------------------------------------------------------------------------
-- 4. Helper functions used by RLS policies
--
-- security definer: they read public.members without going through its own RLS
-- (avoids policy recursion) and are cheap single-row lookups.
-- -----------------------------------------------------------------------------

create function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.id = (select auth.uid())
      and m.active
  );
$$;

comment on function public.is_active_member() is
  'True when the current JWT user is an active (approved) member.';

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.id = (select auth.uid())
      and m.active
      and m.role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'True when the current JWT user is an active admin.';

-- Current user as a member id, or null when the caller is not a member
-- (service_role, SQL editor, auth triggers…). Used to stamp task_events.actor_id
-- without ever violating its foreign key.
create function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.members m
  where m.id = (select auth.uid());
$$;


-- -----------------------------------------------------------------------------
-- 5. Triggers — auth.users → members
-- -----------------------------------------------------------------------------

-- 5.1 Create the members row for every new auth user.
--   * first member ever           → active admin
--   * email found in invites      → active with the invite's role (invite consumed)
--   * otherwise                   → pending (active = false), an admin activates later
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  palette constant text[] := array['teal', 'amber', 'indigo', 'rose', 'sky', 'violet', 'emerald', 'orange', 'slate'];
  v_email      text := lower(btrim(new.email));
  v_name       text := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  v_count      integer;
  v_role       public.member_role := 'member';
  v_active     boolean := false;
  v_invite     public.member_invites%rowtype;
begin
  -- Email-less users (phone / anonymous sign-ins, disabled for this project)
  -- never get a members row, hence never get access.
  if v_email is null or v_email = '' then
    return new;
  end if;

  -- Serialise concurrent sign-ups so only one user can become the first admin.
  perform pg_advisory_xact_lock(hashtext('public.handle_new_user'));

  select count(*) into v_count from public.members;

  if v_count = 0 then
    v_role   := 'admin';
    v_active := true;
  else
    delete from public.member_invites i
    where i.email = v_email
    returning i.* into v_invite;

    if found then
      v_role   := v_invite.role;
      v_active := true;
    end if;
  end if;

  -- Default display name: "jean.dupont@x" → "Jean Dupont".
  if v_name is null then
    v_name := initcap(translate(split_part(v_email, '@', 1), '._', '  '));
  end if;

  insert into public.members (id, email, full_name, color, role, active, created_at)
  values (
    new.id,
    v_email,
    v_name,
    palette[(v_count % array_length(palette, 1)) + 1],
    v_role,
    v_active,
    coalesce(new.created_at, now())
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5.2 Keep members.email in sync when a user changes their email in Auth.
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and btrim(new.email) <> '' then
    update public.members m
    set email = lower(btrim(new.email))
    where m.id = new.id
      and m.email is distinct from lower(btrim(new.email));
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();


-- -----------------------------------------------------------------------------
-- 6. Triggers — members guard
--
-- Runs with the caller's privileges (NOT security definer) so `current_user`
-- tells us whether the update comes from an API client (anon / authenticated)
-- or from a trusted context (service_role, migrations, SQL editor, other
-- security-definer functions).
-- -----------------------------------------------------------------------------

create function public.members_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    -- Identity columns are immutable from the API.
    if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
      raise exception 'members.id et members.created_at ne sont pas modifiables.'
        using errcode = '42501';
    end if;

    if not public.is_admin() then
      -- Non-admins may only edit their own profile (full_name, color, avatar_url).
      if old.id is distinct from auth.uid() then
        raise exception 'Vous ne pouvez modifier que votre propre profil.'
          using errcode = '42501';
      end if;

      if new.email  is distinct from old.email
         or new.role   is distinct from old.role
         or new.active is distinct from old.active then
        raise exception 'Seul un administrateur peut modifier le rôle, le statut ou le courriel d''un membre.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  -- Invariant (all contexts): keep at least one active admin.
  if old.role = 'admin' and old.active
     and (new.role <> 'admin' or not new.active)
     and not exists (
       select 1
       from public.members m
       where m.id <> old.id
         and m.role = 'admin'
         and m.active
     ) then
    raise exception 'Impossible de retirer le dernier administrateur actif.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger members_guard_update
  before update on public.members
  for each row execute function public.members_guard_update();


-- -----------------------------------------------------------------------------
-- 7. Triggers — tasks timestamps
-- -----------------------------------------------------------------------------

-- 7.1 BEFORE INSERT: derive completed_at from status. Provided timestamps are
-- respected so seed scripts can backdate (explicit nulls fall back to now()).
create function public.tasks_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at        := coalesce(new.created_at, now());
  new.updated_at        := coalesce(new.updated_at, new.created_at);
  new.status_changed_at := coalesce(new.status_changed_at, new.created_at);

  if new.status = 'done' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger tasks_before_insert
  before insert on public.tasks
  for each row execute function public.tasks_before_insert();

-- 7.2 BEFORE UPDATE: bump updated_at, track status changes and completion.
create function public.tasks_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;

  if new.status = 'done' then
    if old.status <> 'done' then
      new.completed_at := now();
    else
      -- Still done: keep (or allow correcting) the completion date, never null.
      new.completed_at := coalesce(new.completed_at, old.completed_at, now());
    end if;
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger tasks_before_update
  before update on public.tasks
  for each row execute function public.tasks_before_update();


-- -----------------------------------------------------------------------------
-- 8. Triggers — task_events (activity log)
--
-- security definer: clients have no privilege on task_events beyond SELECT.
-- Values are stored as text: enums by label, ids as uuid text, dates as
-- YYYY-MM-DD, timestamps as ISO-8601 (JSON format).
-- -----------------------------------------------------------------------------

-- 8.1 Task created.
create function public.tasks_log_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_events (task_id, project_id, actor_id, kind, old_value, new_value, created_at)
  values (
    new.id,
    new.project_id,
    coalesce(public.current_member_id(), new.created_by),
    'created',
    null,
    new.title,
    new.created_at
  );
  return null;
end;
$$;

create trigger tasks_log_insert
  after insert on public.tasks
  for each row execute function public.tasks_log_insert();

-- 8.2 Task updated: one event per tracked field that changed.
create function public.tasks_log_update()
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
       old.assignee_id::text, new.assignee_id::text,
       old.assignee_id is distinct from new.assignee_id),
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

create trigger tasks_log_update
  after update on public.tasks
  for each row execute function public.tasks_log_update();


-- -----------------------------------------------------------------------------
-- 9. Triggers — comments
-- -----------------------------------------------------------------------------

-- 9.1 New comment → 'commented' event (new_value = comment id).
create function public.comments_log_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_events (task_id, project_id, actor_id, kind, old_value, new_value, created_at)
  select
    t.id,
    t.project_id,
    coalesce(public.current_member_id(), new.author_id),
    'commented',
    null,
    new.id::text,
    new.created_at
  from public.tasks t
  where t.id = new.task_id;

  return null;
end;
$$;

create trigger comments_log_insert
  after insert on public.comments
  for each row execute function public.comments_log_insert();

-- 9.2 Edited comment → bump updated_at.
create function public.comments_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger comments_before_update
  before update on public.comments
  for each row execute function public.comments_before_update();


-- -----------------------------------------------------------------------------
-- 10. Privileges
--
-- Least privilege at the GRANT level, RLS on top. `anon` gets nothing, also on
-- tables created later in public by `postgres` (default privileges).
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;

grant select, update, delete         on public.members            to authenticated;
grant select, insert, update, delete on public.member_invites     to authenticated;
grant select, insert, update, delete on public.projects           to authenticated;
grant select, insert, update, delete on public.tasks              to authenticated;
grant select, insert, update, delete on public.subtasks           to authenticated;
grant select, insert, update, delete on public.comments           to authenticated;
grant select                         on public.task_events        to authenticated;
grant select, insert, update, delete on public.meetings           to authenticated;
grant select, insert, update, delete on public.meeting_items      to authenticated;
grant select, insert, update, delete on public.meeting_priorities to authenticated;

grant all on all tables in schema public to service_role;

-- Functions: helpers are callable by signed-in users (needed inside policies,
-- also handy as RPC); trigger functions are not callable by API roles at all.
revoke execute on function public.is_active_member()  from public, anon;
revoke execute on function public.is_admin()          from public, anon;
revoke execute on function public.current_member_id() from public, anon;
grant  execute on function public.is_active_member()  to authenticated, service_role;
grant  execute on function public.is_admin()          to authenticated, service_role;
grant  execute on function public.current_member_id() to authenticated, service_role;

revoke execute on function public.handle_new_user()          from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.members_guard_update()     from public, anon, authenticated;
revoke execute on function public.tasks_before_insert()      from public, anon, authenticated;
revoke execute on function public.tasks_before_update()      from public, anon, authenticated;
revoke execute on function public.tasks_log_insert()         from public, anon, authenticated;
revoke execute on function public.tasks_log_update()         from public, anon, authenticated;
revoke execute on function public.comments_log_insert()      from public, anon, authenticated;
revoke execute on function public.comments_before_update()   from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 11. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.members            enable row level security;
alter table public.member_invites     enable row level security;
alter table public.projects           enable row level security;
alter table public.meetings           enable row level security;
alter table public.tasks              enable row level security;
alter table public.subtasks           enable row level security;
alter table public.comments           enable row level security;
alter table public.task_events        enable row level security;
alter table public.meeting_items      enable row level security;
alter table public.meeting_priorities enable row level security;

-- 11.1 members: pending users can only see (and edit) themselves.
-- Column-level restrictions are enforced by the members_guard_update trigger.
-- No INSERT policy: rows are created by handle_new_user().
create policy "members: select"
  on public.members for select to authenticated
  using ((select public.is_active_member()) or id = (select auth.uid()));

create policy "members: update own or admin"
  on public.members for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- Admins can remove other members (prefer deactivating: active = false).
create policy "members: admin delete"
  on public.members for delete to authenticated
  using ((select public.is_admin()) and id <> (select auth.uid()));

-- 11.2 member_invites: admins only.
create policy "member_invites: admin select"
  on public.member_invites for select to authenticated
  using ((select public.is_admin()));

create policy "member_invites: admin insert"
  on public.member_invites for insert to authenticated
  with check ((select public.is_admin()));

-- Lets an admin change the role of a pending invite (or upsert one).
create policy "member_invites: admin update"
  on public.member_invites for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "member_invites: admin delete"
  on public.member_invites for delete to authenticated
  using ((select public.is_admin()));

-- 11.3 projects: members read/write, only admins delete (prefer archived_at).
create policy "projects: select"
  on public.projects for select to authenticated
  using ((select public.is_active_member()));

create policy "projects: insert"
  on public.projects for insert to authenticated
  with check ((select public.is_active_member()));

create policy "projects: update"
  on public.projects for update to authenticated
  using ((select public.is_active_member()))
  with check ((select public.is_active_member()));

create policy "projects: admin delete"
  on public.projects for delete to authenticated
  using ((select public.is_admin()));

-- 11.4 Collaborative tables: full CRUD for active members.
create policy "tasks: select"
  on public.tasks for select to authenticated
  using ((select public.is_active_member()));
create policy "tasks: insert"
  on public.tasks for insert to authenticated
  with check ((select public.is_active_member()));
create policy "tasks: update"
  on public.tasks for update to authenticated
  using ((select public.is_active_member()))
  with check ((select public.is_active_member()));
create policy "tasks: delete"
  on public.tasks for delete to authenticated
  using ((select public.is_active_member()));

create policy "subtasks: select"
  on public.subtasks for select to authenticated
  using ((select public.is_active_member()));
create policy "subtasks: insert"
  on public.subtasks for insert to authenticated
  with check ((select public.is_active_member()));
create policy "subtasks: update"
  on public.subtasks for update to authenticated
  using ((select public.is_active_member()))
  with check ((select public.is_active_member()));
create policy "subtasks: delete"
  on public.subtasks for delete to authenticated
  using ((select public.is_active_member()));

create policy "meetings: select"
  on public.meetings for select to authenticated
  using ((select public.is_active_member()));
create policy "meetings: insert"
  on public.meetings for insert to authenticated
  with check ((select public.is_active_member()));
create policy "meetings: update"
  on public.meetings for update to authenticated
  using ((select public.is_active_member()))
  with check ((select public.is_active_member()));
create policy "meetings: delete"
  on public.meetings for delete to authenticated
  using ((select public.is_active_member()));

create policy "meeting_items: select"
  on public.meeting_items for select to authenticated
  using ((select public.is_active_member()));
create policy "meeting_items: insert"
  on public.meeting_items for insert to authenticated
  with check ((select public.is_active_member()));
create policy "meeting_items: update"
  on public.meeting_items for update to authenticated
  using ((select public.is_active_member()))
  with check ((select public.is_active_member()));
create policy "meeting_items: delete"
  on public.meeting_items for delete to authenticated
  using ((select public.is_active_member()));

create policy "meeting_priorities: select"
  on public.meeting_priorities for select to authenticated
  using ((select public.is_active_member()));
create policy "meeting_priorities: insert"
  on public.meeting_priorities for insert to authenticated
  with check ((select public.is_active_member()));
create policy "meeting_priorities: update"
  on public.meeting_priorities for update to authenticated
  using ((select public.is_active_member()))
  with check ((select public.is_active_member()));
create policy "meeting_priorities: delete"
  on public.meeting_priorities for delete to authenticated
  using ((select public.is_active_member()));

-- 11.5 comments: everyone reads, authors write their own.
create policy "comments: select"
  on public.comments for select to authenticated
  using ((select public.is_active_member()));

create policy "comments: insert own"
  on public.comments for insert to authenticated
  with check ((select public.is_active_member()) and author_id = (select auth.uid()));

create policy "comments: update own"
  on public.comments for update to authenticated
  using ((select public.is_active_member()) and author_id = (select auth.uid()))
  with check ((select public.is_active_member()) and author_id = (select auth.uid()));

create policy "comments: delete own"
  on public.comments for delete to authenticated
  using ((select public.is_active_member()) and author_id = (select auth.uid()));

-- 11.6 task_events: read-only for clients (no insert/update/delete policy).
create policy "task_events: select"
  on public.task_events for select to authenticated
  using ((select public.is_active_member()));


-- -----------------------------------------------------------------------------
-- 12. Realtime
--
-- Default replica identity (primary key): UPDATE/DELETE payloads carry the
-- primary key in `old` (`id`, `email` for member_invites, `meeting_id` +
-- `task_id` for meeting_priorities).
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array[
    'members', 'member_invites', 'projects', 'tasks', 'subtasks', 'comments',
    'task_events', 'meetings', 'meeting_items', 'meeting_priorities'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables pt
      where pt.pubname = 'supabase_realtime'
        and pt.schemaname = 'public'
        and pt.tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;


-- -----------------------------------------------------------------------------
-- 13. Reference data — the team's three real projects (idempotent).
-- -----------------------------------------------------------------------------

insert into public.projects (slug, name, description, icon, color, position)
values
  ('application',    'Application',     'Application mobile Prospero — produit, design et mise en marché.',           'smartphone', 'teal',   1),
  ('site-web',       'Site Web',        'Site web de Prospero — contenu, design et référencement.',                    'globe',      'indigo', 2),
  ('medias-sociaux', 'Médias sociaux',  'Présence de Prospero sur les médias sociaux — calendrier éditorial et communauté.', 'megaphone', 'amber', 3)
on conflict (slug) do nothing;
