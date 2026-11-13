-- =============================================================================
-- Team Tomate HQ — files attached to tasks
--
-- A task can carry files: photos, videos, anything, up to 100 MB each.
--
--   * The bytes live in Supabase Storage, in the private bucket `task-files`, at
--     <task id>/<attachment id>/<file>. Nothing in it has a public address: a
--     member reads a file through a signed URL that expires.
--   * One row per file in public.task_attachments: its task, who added it, its
--     name as the member knows it, its type and size, where it is stored, and
--     where its thumbnail is when the browser could make one.
--
-- Who can do what: the same people as for the tasks themselves. Any active
-- member sees, adds and removes files; nobody else reaches the rows or the
-- bucket. A file is added in one's own name, and is never edited afterwards.
--
-- The size limit is written three times on purpose: in the browser (so that a
-- member is told before uploading), on the bucket (so that the storage server
-- refuses the bytes) and on the row. On Supabase's free plan the project-wide
-- limit is 50 MB whatever the bucket says: larger files need a paid plan, then
-- Storage → Settings → « Global file size limit ».
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The rows
-- -----------------------------------------------------------------------------

create table public.task_attachments (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks (id) on delete cascade,
  uploader_id   uuid default auth.uid() references public.members (id) on delete set null,
  name          text not null
                  check (char_length(name) between 1 and 255 and btrim(name) <> ''),
  mime_type     text not null default 'application/octet-stream'
                  check (char_length(mime_type) between 1 and 255),
  size          bigint not null
                  check (size between 0 and 104857600),
  storage_path  text not null unique,
  thumb_path    text unique,
  created_at    timestamptz not null default now(),
  -- A file belongs to its task: its place in the bucket says so.
  constraint task_attachments_storage_path check (
    char_length(storage_path) <= 600
    and storage_path like task_id::text || '/' || id::text || '/%'
  ),
  constraint task_attachments_thumb_path check (
    thumb_path is null
    or (
      char_length(thumb_path) <= 600
      and thumb_path <> storage_path
      and thumb_path like task_id::text || '/' || id::text || '/%'
    )
  )
);

comment on table public.task_attachments is
  'Files attached to tasks. The bytes are in Storage (bucket task-files); a row is written once the file is stored, and never updated.';
comment on column public.task_attachments.name is
  'The file name as the member knows it. The object in Storage has a plain ASCII name.';
comment on column public.task_attachments.thumb_path is
  'A small picture of the file (images, videos), made in the browser at upload time. Null when it could not be made.';

create index task_attachments_task_id_idx     on public.task_attachments (task_id, created_at);
create index task_attachments_uploader_id_idx on public.task_attachments (uploader_id);


-- -----------------------------------------------------------------------------
-- 2. History: « a joint un fichier »
-- -----------------------------------------------------------------------------

alter table public.task_events drop constraint task_events_kind_check;
alter table public.task_events add constraint task_events_kind_check
  check (kind in ('created', 'status', 'priority', 'assignee', 'due_date',
                  'title', 'project', 'archived', 'unarchived', 'commented', 'attached'));

comment on column public.task_events.new_value is
  'New value as text (status, priority, member id, YYYY-MM-DD, title, project id, ISO timestamp…). For commented: the comment id. For attached: the name of the file.';

-- The time is the server's, whatever the client sent.
create function public.task_attachments_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger task_attachments_before_insert
  before insert on public.task_attachments
  for each row execute function public.task_attachments_before_insert();

create function public.task_attachments_log_insert()
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
    coalesce(public.current_member_id(), new.uploader_id),
    'attached',
    null,
    new.name,
    new.created_at
  from public.tasks t
  where t.id = new.task_id;

  return null;
end;
$$;

create trigger task_attachments_log_insert
  after insert on public.task_attachments
  for each row execute function public.task_attachments_log_insert();

revoke execute on function public.task_attachments_before_insert() from public, anon, authenticated;
revoke execute on function public.task_attachments_log_insert()    from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 3. Privileges and row level security
-- -----------------------------------------------------------------------------

revoke all on public.task_attachments from anon, authenticated;
-- No UPDATE: a file is added or removed, never edited.
grant select, insert, delete on public.task_attachments to authenticated;
grant all on public.task_attachments to service_role;

alter table public.task_attachments enable row level security;

create policy "task_attachments: select"
  on public.task_attachments for select to authenticated
  using ((select public.is_active_member()));

create policy "task_attachments: insert own"
  on public.task_attachments for insert to authenticated
  with check ((select public.is_active_member()) and uploader_id = (select auth.uid()));

create policy "task_attachments: delete"
  on public.task_attachments for delete to authenticated
  using ((select public.is_active_member()));


-- -----------------------------------------------------------------------------
-- 4. Realtime: a file added by a teammate appears at once
-- -----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename = 'task_attachments'
  ) then
    alter publication supabase_realtime add table public.task_attachments;
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. The bucket, and who reaches it
--
-- Private. 100 MB per file. Any type: the team decides what is useful.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('task-files', 'task-files', false, 104857600)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

create policy "task files: read"
  on storage.objects for select to authenticated
  using (bucket_id = 'task-files' and (select public.is_active_member()));

-- A file is stored under a task that exists: <task id>/<attachment id>/<file>.
create policy "task files: add"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'task-files'
    and (select public.is_active_member())
    and array_length(storage.foldername(name), 1) = 2
    and exists (
      select 1
      from public.tasks t
      where t.id::text = (storage.foldername(name))[1]
    )
  );

create policy "task files: remove"
  on storage.objects for delete to authenticated
  using (bucket_id = 'task-files' and (select public.is_active_member()));
