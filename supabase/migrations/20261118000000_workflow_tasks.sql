-- =============================================================================
-- Team Tomate HQ — a task can come from a step of a workflow
--
-- Launching a workflow creates one task per step that has a project, for the
-- person chosen on the step. Each of those tasks remembers where it comes from:
-- the workflow, and the step of its drawing (the id of the node). The canvas
-- shows on each step how its task stands; the task leads back to the workflow.
--
-- Two nullable columns on tasks. Nothing else changes: these tasks are ordinary
-- tasks, created by a member through the same policies as any other.
-- =============================================================================

alter table public.tasks
  add column workflow_id   uuid references public.workflows (id) on delete set null,
  add column workflow_step text check (workflow_step is null or char_length(workflow_step) between 1 and 120);

comment on column public.tasks.workflow_id is
  'The workflow this task was made from, if any. Kept when the workflow is edited; cleared when it is deleted.';
comment on column public.tasks.workflow_step is
  'The id of the step (node) in that workflow''s drawing. Only read together with workflow_id.';

create index tasks_workflow_idx on public.tasks (workflow_id) where workflow_id is not null;
