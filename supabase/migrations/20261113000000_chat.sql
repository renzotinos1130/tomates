-- =============================================================================
-- Team Tomate HQ — chat
--
-- One team-wide channel (« Général ») and direct conversations between two
-- members. Mirrors ChatConversation / ChatParticipant / ChatMessage in
-- src/lib/types.ts.
--
-- Access model
--   * A channel is open to every active member.
--   * A direct conversation is visible ONLY to its two members: the row itself,
--     its messages and, through Realtime (which applies the same SELECT policy),
--     every live update.
--   * Who may read a conversation is decided by the conversation row alone
--     (kind, member_a, member_b). chat_participants only stores how far each
--     member has read, so tampering with it can never open a conversation.
--   * Direct conversations are created by public.chat_open_direct(): clients
--     have no INSERT privilege on chat_conversations, so they cannot invent a
--     conversation between two other people.
--   * A message is never edited. Its author can delete it: the row stays (the
--     thread shows a placeholder) but its text is erased.
--   * The app loads the latest messages of each conversation through
--     public.chat_recent_messages() — plain SQL under the caller's rights, so
--     the policies below apply to it like to any other query.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

create table public.chat_conversations (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('channel', 'direct')),
  -- Channels have a name; a direct conversation is named after the other person.
  name        text,
  -- Direct conversations: the two members, smallest id first, so a pair has
  -- exactly one row whoever opens it.
  member_a    uuid references public.members (id) on delete cascade,
  member_b    uuid references public.members (id) on delete cascade,
  created_by  uuid default auth.uid() references public.members (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint chat_conversations_shape check (
    (kind = 'channel'
       and member_a is null and member_b is null
       and name is not null and char_length(name) between 1 and 80 and btrim(name) <> '')
    or
    (kind = 'direct'
       and name is null
       and member_a is not null and member_b is not null and member_a < member_b)
  ),
  constraint chat_conversations_direct_pair unique (member_a, member_b)
);

comment on table public.chat_conversations is
  'A channel (everyone) or a direct conversation (member_a, member_b). Access is decided by this row alone.';

create unique index chat_conversations_channel_name_idx
  on public.chat_conversations (lower(name)) where kind = 'channel';
create index chat_conversations_member_b_idx   on public.chat_conversations (member_b) where member_b is not null;
create index chat_conversations_created_by_idx on public.chat_conversations (created_by);

create table public.chat_participants (
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  member_id       uuid not null default auth.uid() references public.members (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, member_id)
);

comment on table public.chat_participants is
  'How far a member has read a conversation (unread counts). Grants no access by itself.';

create index chat_participants_member_idx on public.chat_participants (member_id);

create table public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  author_id       uuid default auth.uid() references public.members (id) on delete set null,
  body            text not null,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  -- A deleted message keeps its place in the thread but not its text.
  constraint chat_messages_body check (
    (deleted_at is not null and body = '')
    or (deleted_at is null and char_length(body) between 1 and 4000 and btrim(body) <> '')
  )
);

-- Every read is "the latest messages of one conversation" (see chat_recent_messages).
create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at desc, id desc);
create index chat_messages_author_idx       on public.chat_messages (author_id);


-- -----------------------------------------------------------------------------
-- 2. Triggers — what the server decides, whatever the client sends
--
-- They run with the caller's privileges. public.current_member_id() is null for
-- service_role (local seed, SQL editor): provided values are then kept, so a
-- seed can backdate messages and read positions.
-- -----------------------------------------------------------------------------

-- 2.1 A member posts as themselves, now. Afterwards the only possible change is
--     to delete the message (once): its text is erased, everything else is kept.
create function public.chat_messages_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_member uuid := public.current_member_id();
begin
  if tg_op = 'INSERT' then
    if v_member is not null then
      new.author_id  := v_member;
      new.created_at := now();
      new.deleted_at := null;
    end if;
    return new;
  end if;

  -- When a member is removed, the foreign key clears author_id from inside its
  -- own trigger: that is not an edit, leave the row as the foreign key wrote it.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if v_member is not null then
    new.conversation_id := old.conversation_id;
    new.author_id       := old.author_id;
    new.created_at      := old.created_at;
    if old.deleted_at is not null then
      new.deleted_at := old.deleted_at;
      new.body       := '';
    elsif new.deleted_at is not null then
      new.deleted_at := now();
      new.body       := '';
    else
      new.body := old.body;
    end if;
  end if;
  return new;
end;
$$;

create trigger chat_messages_stamp
  before insert or update on public.chat_messages
  for each row execute function public.chat_messages_stamp();

-- 2.2 "I have read up to here" always means "up to now", on the server's clock:
--     unread counts compare it with created_at, which the server stamps too.
--     A row can never be moved to another conversation or another member.
create function public.chat_participants_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.current_member_id() is not null then
    if tg_op = 'UPDATE' then
      new.conversation_id := old.conversation_id;
      new.member_id       := old.member_id;
    end if;
    new.last_read_at := now();
  end if;
  return new;
end;
$$;

create trigger chat_participants_stamp
  before insert or update on public.chat_participants
  for each row execute function public.chat_participants_stamp();


-- -----------------------------------------------------------------------------
-- 3. Opening a direct conversation
--
-- security definer: clients cannot insert into chat_conversations. The function
-- only ever creates the conversation between the caller and one other active
-- member, and returns the existing one when the pair already talks — so two
-- people opening it at the same moment end up in the same conversation.
-- -----------------------------------------------------------------------------

create function public.chat_open_direct(p_other uuid)
returns public.chat_conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := (select auth.uid());
  v_a   uuid;
  v_b   uuid;
  v_row public.chat_conversations;
begin
  if v_me is null or not public.is_active_member() then
    raise exception 'chat_open_direct: active members only' using errcode = '42501';
  end if;
  if p_other is null or p_other = v_me then
    raise exception 'chat_open_direct: another member is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.members m where m.id = p_other and m.active) then
    raise exception 'chat_open_direct: unknown or inactive member' using errcode = '22023';
  end if;

  v_a := least(v_me, p_other);
  v_b := greatest(v_me, p_other);

  insert into public.chat_conversations (kind, member_a, member_b, created_by)
  values ('direct', v_a, v_b, v_me)
  on conflict on constraint chat_conversations_direct_pair do nothing;

  select c.* into v_row
  from public.chat_conversations c
  where c.member_a = v_a and c.member_b = v_b;

  return v_row;
end;
$$;

comment on function public.chat_open_direct(uuid) is
  'Returns the direct conversation between the caller and p_other, creating it if needed.';


-- -----------------------------------------------------------------------------
-- 4. Loading the workspace: the latest messages of EACH conversation
--
-- A plain "latest N messages" would be eaten by the busiest conversation, and a
-- direct conversation from last month would come back empty. security invoker:
-- Row Level Security applies as in any query, the function only shapes it.
-- Older messages of a thread are read from the table (conversation_id,
-- created_at < …), page by page.
-- -----------------------------------------------------------------------------

create function public.chat_recent_messages(p_per_conversation integer default 100)
returns setof public.chat_messages
language sql
stable
security invoker
set search_path = ''
as $$
  select m.*
  from public.chat_conversations c
  cross join lateral (
    select x.*
    from public.chat_messages x
    where x.conversation_id = c.id
    order by x.created_at desc, x.id desc
    limit least(greatest(coalesce(p_per_conversation, 100), 1), 500)
  ) m;
$$;

comment on function public.chat_recent_messages(integer) is
  'The latest messages of each conversation the caller can read (at most 500 per conversation).';


-- -----------------------------------------------------------------------------
-- 5. Privileges
-- -----------------------------------------------------------------------------

revoke all on public.chat_conversations from anon, authenticated;
revoke all on public.chat_participants  from anon, authenticated;
revoke all on public.chat_messages      from anon, authenticated;

grant select                 on public.chat_conversations to authenticated;
grant select, insert, update on public.chat_participants  to authenticated;
grant select, insert, update on public.chat_messages      to authenticated;

grant all on public.chat_conversations to service_role;
grant all on public.chat_participants  to service_role;
grant all on public.chat_messages      to service_role;

revoke execute on function public.chat_messages_stamp()     from public, anon, authenticated;
revoke execute on function public.chat_participants_stamp() from public, anon, authenticated;
revoke execute on function public.chat_open_direct(uuid)    from public, anon;
grant  execute on function public.chat_open_direct(uuid)    to authenticated, service_role;
revoke execute on function public.chat_recent_messages(integer) from public, anon;
grant  execute on function public.chat_recent_messages(integer) to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 6. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.chat_conversations enable row level security;
alter table public.chat_participants  enable row level security;
alter table public.chat_messages      enable row level security;

-- 6.1 Conversations: a channel for every active member, a direct conversation
--     for its two members only. No write policy: see chat_open_direct().
create policy "chat_conversations: select"
  on public.chat_conversations for select to authenticated
  using (
    (select public.is_active_member())
    and (kind = 'channel' or (select auth.uid()) in (member_a, member_b))
  );

-- 6.2 Read positions: strictly personal. The sub-select on chat_conversations
--     goes through the policy above, so "the conversation exists" means "I may
--     read it".
create policy "chat_participants: select own"
  on public.chat_participants for select to authenticated
  using ((select public.is_active_member()) and member_id = (select auth.uid()));

create policy "chat_participants: insert own"
  on public.chat_participants for insert to authenticated
  with check (
    (select public.is_active_member())
    and member_id = (select auth.uid())
    and exists (select 1 from public.chat_conversations c where c.id = conversation_id)
  );

create policy "chat_participants: update own"
  on public.chat_participants for update to authenticated
  using ((select public.is_active_member()) and member_id = (select auth.uid()))
  with check ((select public.is_active_member()) and member_id = (select auth.uid()));

-- 6.3 Messages: read and post where you may read the conversation; only the
--     author can delete (see chat_messages_stamp for what an update may change).
create policy "chat_messages: select"
  on public.chat_messages for select to authenticated
  using (
    (select public.is_active_member())
    and exists (select 1 from public.chat_conversations c where c.id = conversation_id)
  );

create policy "chat_messages: insert own"
  on public.chat_messages for insert to authenticated
  with check (
    (select public.is_active_member())
    and author_id = (select auth.uid())
    and exists (select 1 from public.chat_conversations c where c.id = conversation_id)
  );

create policy "chat_messages: update own"
  on public.chat_messages for update to authenticated
  using ((select public.is_active_member()) and author_id = (select auth.uid()))
  with check ((select public.is_active_member()) and author_id = (select auth.uid()));


-- -----------------------------------------------------------------------------
-- 7. Realtime (re-runnable). Realtime checks the SELECT policy for each
--    subscriber: a direct message is only delivered to its two members.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['chat_conversations', 'chat_participants', 'chat_messages']
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
-- 8. Reference data — the team channel (fixed id, idempotent).
-- -----------------------------------------------------------------------------

insert into public.chat_conversations (id, kind, name)
values ('c0000000-0000-4000-8000-000000000001', 'channel', 'Général')
on conflict (id) do nothing;
