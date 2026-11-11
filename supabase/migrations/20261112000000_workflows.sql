-- =============================================================================
-- Team Tomate HQ — workflows
--
-- A workflow is a small visual canvas (steps + links) the team uses to map a
-- process. The whole drawing is one JSON document: it is always read and
-- saved as a unit by the editor. Mirrors `Workflow` in src/lib/types.ts.
-- =============================================================================

create table public.workflows (
  id          uuid primary key default gen_random_uuid(),
  name        text not null
                check (char_length(name) between 1 and 120 and btrim(name) <> ''),
  project_id  uuid references public.projects (id) on delete set null,
  graph       jsonb not null default '{"nodes": [], "edges": []}'::jsonb
                check (
                  jsonb_typeof(graph) = 'object'
                  and jsonb_typeof(graph -> 'nodes') = 'array'
                  and jsonb_typeof(graph -> 'edges') = 'array'
                  and jsonb_array_length(graph -> 'nodes') <= 50
                  and octet_length(graph::text) < 200000
                ),
  created_by  uuid default auth.uid() references public.members (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.members (id) on delete set null
);

comment on table public.workflows is
  'Visual process canvases. graph = { nodes: [{id, position, data}], edges: [{id, source, target}] }.';
comment on column public.workflows.updated_by is
  'Last member who saved the canvas (maintained by trigger).';

create index workflows_project_id_idx on public.workflows (project_id) where project_id is not null;
create index workflows_created_by_idx on public.workflows (created_by);
create index workflows_updated_by_idx on public.workflows (updated_by);

-- Who created / last saved a canvas is decided by the server, never by the client.
-- Provided timestamps are kept on insert so local seeds can backdate.
--
-- When a member or a project is deleted, its foreign key clears the reference by
-- updating the row from inside its own trigger (pg_trigger_depth() > 1). That is
-- not an edit: the row is left exactly as the foreign key wrote it. Forcing
-- created_by back there would make the deletion itself fail.
create function public.workflows_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_member uuid := public.current_member_id();
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(v_member, new.created_by);
    new.updated_by := coalesce(v_member, new.updated_by, new.created_by);
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, new.created_at);
  elsif pg_trigger_depth() > 1 then
    return new;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
    new.updated_by := coalesce(v_member, new.updated_by);
  end if;
  return new;
end;
$$;

create trigger workflows_stamp
  before insert or update on public.workflows
  for each row execute function public.workflows_stamp();

revoke execute on function public.workflows_stamp() from public, anon, authenticated;

-- Privileges + RLS: same rule as the other collaborative tables.
revoke all on public.workflows from anon, authenticated;
grant select, insert, update, delete on public.workflows to authenticated;
grant all on public.workflows to service_role;

alter table public.workflows enable row level security;

create policy "workflows: select"
  on public.workflows for select to authenticated
  using ((select public.is_active_member()));
create policy "workflows: insert"
  on public.workflows for insert to authenticated
  with check ((select public.is_active_member()));
create policy "workflows: update"
  on public.workflows for update to authenticated
  using ((select public.is_active_member()))
  with check ((select public.is_active_member()));
create policy "workflows: delete"
  on public.workflows for delete to authenticated
  using ((select public.is_active_member()));

-- Realtime (re-runnable).
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables pt
    where pt.pubname = 'supabase_realtime'
      and pt.schemaname = 'public'
      and pt.tablename = 'workflows'
  ) then
    alter publication supabase_realtime add table public.workflows;
  end if;
end;
$$;
