-- =============================================================================
-- Team Tomate HQ — Tomato Tower: the week turns over on Wednesday
--
-- The boards of the week used to start afresh on Monday. The team's own week
-- runs from Wednesday to Tuesday (the weekly meeting is on Wednesday): the game
-- now follows it. A week is still named by the day it opens, in Montréal.
--
-- Nothing is deleted. The runs already played are filed again under the week
-- they belong to by the new rule, so the past boards and their champions are
-- those of Wednesday-to-Tuesday weeks from the first run on. The board of all
-- time does not depend on weeks and does not change.
-- =============================================================================

create or replace function public.tower_week_of(p_at timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  -- isodow: Monday 1 … Sunday 7. Days since the last Wednesday: 0 on a Wednesday, 6 on a Tuesday.
  select d - ((extract(isodow from d)::int + 4) % 7)
  from (select (p_at at time zone 'America/Toronto')::date as d) day;
$$;

comment on function public.tower_week_of(timestamptz) is
  'The Wednesday (Montréal) that opens the week an instant falls in: the name of a week on the boards.';

update public.tower_runs r
set week_start = public.tower_week_of(r.finished_at)
where r.finished_at is not null
  and r.week_start is distinct from public.tower_week_of(r.finished_at);
