-- =============================================================================
-- Team Tomate HQ — chat: who can read and write what, and what the server decides.
-- Run with: npx supabase test db   (self-contained, rolled back at the end)
--
-- The assertion that matters most: a direct conversation and its messages are
-- invisible to everyone but its two members.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(50);

-- -----------------------------------------------------------------------------
-- Fixtures
--   alice  aaaaaaaa-…  first user        → active admin
--   bob    bbbbbbbb-…  invited           → active member
--   dave   dddddddd-…  invited           → active member (the outsider of the DM)
--   carl   cccccccc-…  not invited       → pending
-- -----------------------------------------------------------------------------

delete from public.members;
delete from public.member_invites;
delete from public.chat_messages;
delete from public.chat_participants;
delete from public.chat_conversations where kind = 'direct';

insert into public.member_invites (email, role) values
  ('bob@test.local',  'member'),
  ('dave@test.local', 'member');

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'authenticated', 'authenticated', 'alice@test.local', '{"full_name":"Alice Admin"}', '2026-01-01 09:00+00');
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'authenticated', 'authenticated', 'bob@test.local', '{}', '2026-01-01 09:01+00');
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values ('00000000-0000-0000-0000-000000000000', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'authenticated', 'authenticated', 'dave@test.local', '{}', '2026-01-01 09:02+00');
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at)
values ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'authenticated', 'authenticated', 'carl@test.local', '{}', '2026-01-01 09:03+00');

-- Ids looked up without RLS, readable by every simulated user.
create temporary table chat_ids (name text primary key, id uuid not null);
grant select on chat_ids to authenticated, anon;
insert into chat_ids values ('general', 'c0000000-0000-4000-8000-000000000001');


-- =============================================================================
-- 1. Structure
-- =============================================================================

select has_table('public', 'chat_conversations', 'chat_conversations table exists');
select has_table('public', 'chat_participants', 'chat_participants table exists');
select has_table('public', 'chat_messages', 'chat_messages table exists');
select is(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.chat_conversations'::regclass, 'public.chat_participants'::regclass, 'public.chat_messages'::regclass)),
  true,
  'row level security is enabled on the three chat tables'
);
select results_eq(
  $$ select kind, name from public.chat_conversations where id = 'c0000000-0000-4000-8000-000000000001' $$,
  $$ values ('channel', 'Général') $$,
  'the team channel exists, with its fixed id'
);

-- =============================================================================
-- 2. anon: nothing
-- =============================================================================

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select count(*) from public.chat_messages $$,
  '42501', null,
  'anon cannot read messages'
);
select throws_ok(
  $$ select public.chat_open_direct('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  '42501', null,
  'anon cannot open a conversation'
);
select throws_ok(
  $$ select count(*) from public.chat_recent_messages() $$,
  '42501', null,
  'nor load recent messages'
);
reset role;

-- =============================================================================
-- 3. The channel: every active member reads and posts, as themselves
-- =============================================================================

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select lives_ok(
  $$ insert into public.chat_messages (id, conversation_id, author_id, body, created_at)
     values ('99999999-0000-4000-8000-0000000000c1', 'c0000000-0000-4000-8000-000000000001',
             'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bonjour à tous', '2020-01-01') $$,
  'an active member can post in the channel'
);
select results_eq(
  $$ select author_id, created_at > '2025-01-01'::timestamptz, deleted_at is null
     from public.chat_messages where id = '99999999-0000-4000-8000-0000000000c1' $$,
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, true, true) $$,
  'the author and the time are the caller and now, whatever the client sent'
);
select throws_ok(
  $$ insert into public.chat_messages (conversation_id, body)
     values ('c0000000-0000-4000-8000-000000000001', '   ') $$,
  '23514', null,
  'a blank message is rejected'
);
select throws_ok(
  $$ insert into public.chat_messages (conversation_id, body)
     values ('c0000000-0000-4000-8000-000000000001', repeat('x', 4001)) $$,
  '23514', null,
  'a message longer than 4000 characters is rejected'
);

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
select results_eq(
  $$ select body from public.chat_messages where conversation_id = 'c0000000-0000-4000-8000-000000000001' $$,
  $$ values ('Bonjour à tous') $$,
  'another member reads the channel'
);
select lives_ok(
  $$ insert into public.chat_messages (id, conversation_id, body)
     values ('99999999-0000-4000-8000-0000000000c3', 'c0000000-0000-4000-8000-000000000001', 'Salut !') $$,
  'and answers in it'
);

-- =============================================================================
-- 4. Direct conversations: one per pair, opened through the function only
-- =============================================================================

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select throws_ok(
  $$ insert into public.chat_conversations (kind, member_a, member_b)
     values ('direct', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') $$,
  '42501', null,
  'a client cannot create a conversation directly (let alone between two other people)'
);
select results_eq(
  $$ select kind, member_a, member_b, created_by
     from public.chat_open_direct('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') $$,
  $$ values ('direct', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
             'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid) $$,
  'opening a direct conversation creates it between the caller and the other member'
);

reset role;
insert into chat_ids select 'dm', id from public.chat_conversations where kind = 'direct';
set local role authenticated;

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
select is(
  (select id from public.chat_open_direct('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')),
  (select id from chat_ids where name = 'dm'),
  'opening it again returns the same conversation'
);
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
select is(
  (select id from public.chat_open_direct('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),
  (select id from chat_ids where name = 'dm'),
  'and so does the other member opening it from their side'
);
select throws_ok(
  $$ select public.chat_open_direct('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') $$,
  '22023', null,
  'nobody opens a conversation with themselves'
);
select throws_ok(
  $$ select public.chat_open_direct('cccccccc-cccc-4ccc-8ccc-cccccccccccc') $$,
  '22023', null,
  'nor with someone who is not an active member'
);

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
select lives_ok(
  $$ insert into public.chat_messages (id, conversation_id, body)
     select '99999999-0000-4000-8000-0000000000c2', id, 'Salut Bob, juste entre nous' from chat_ids where name = 'dm' $$,
  'a member posts in their direct conversation'
);

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
select results_eq(
  $$ select body from public.chat_messages where conversation_id = (select id from chat_ids where name = 'dm') $$,
  $$ values ('Salut Bob, juste entre nous') $$,
  'the other member reads it'
);
select is(
  (select count(*)::int from public.chat_conversations),
  2,
  'each of the two sees the channel and their conversation'
);

-- =============================================================================
-- 5. Privacy: a third member sees nothing of it
-- =============================================================================

set local request.jwt.claims = '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.chat_conversations where kind = 'direct' $$,
  'a third member does not see the direct conversation'
);
select is_empty(
  $$ select 1 from public.chat_messages where id = '99999999-0000-4000-8000-0000000000c2' $$,
  'nor its messages, even by id'
);
select is(
  (select count(*)::int from public.chat_messages),
  2,
  'they only read the channel'
);
select throws_ok(
  $$ insert into public.chat_messages (conversation_id, body)
     select id, 'Je m''invite' from chat_ids where name = 'dm' $$,
  '42501', null,
  'they cannot post in it'
);
select throws_ok(
  $$ insert into public.chat_participants (conversation_id, member_id)
     select id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' from chat_ids where name = 'dm' $$,
  '42501', null,
  'they cannot register as a reader of it'
);
select throws_ok(
  $$ select public.chat_open_direct('dddddddd-dddd-4ddd-8ddd-dddddddddddd') $$,
  '22023', null,
  'and opening a conversation never gives access to somebody else''s'
);
select results_eq(
  $$ select id from public.chat_recent_messages(100) order by id $$,
  $$ values ('99999999-0000-4000-8000-0000000000c1'::uuid), ('99999999-0000-4000-8000-0000000000c3'::uuid) $$,
  'loading recent messages follows the same rule: the channel only'
);

-- Loading takes the latest messages of EACH conversation. (Everything in this
-- test is written in one transaction, hence at the same instant: the id decides.)
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
select results_eq(
  $$ select id from public.chat_recent_messages(1) order by id $$,
  $$ values ('99999999-0000-4000-8000-0000000000c2'::uuid), ('99999999-0000-4000-8000-0000000000c3'::uuid) $$,
  'a member loads the latest message of each of their conversations, not only of the busiest one'
);

-- =============================================================================
-- 6. Read positions: personal, stamped by the server, impossible to move
-- =============================================================================

set local request.jwt.claims = '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}';

select lives_ok(
  $$ insert into public.chat_participants (conversation_id, member_id, last_read_at)
     values ('c0000000-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '2020-01-01') $$,
  'a member records how far they have read the channel'
);
select is(
  (select last_read_at > '2025-01-01'::timestamptz from public.chat_participants
   where member_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  true,
  '"read" always means "read up to now", on the server''s clock'
);
select lives_ok(
  $$ insert into public.chat_participants (conversation_id, member_id)
     values ('c0000000-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')
     on conflict (conversation_id, member_id) do update set last_read_at = excluded.last_read_at $$,
  'recording it again simply moves the position'
);

update public.chat_participants
set conversation_id = (select id from chat_ids where name = 'dm')
where member_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
reset role;
select results_eq(
  $$ select conversation_id from public.chat_participants where member_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' $$,
  $$ values ('c0000000-0000-4000-8000-000000000001'::uuid) $$,
  'a read position cannot be moved to another conversation'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.chat_messages where id = '99999999-0000-4000-8000-0000000000c2' $$,
  'and trying to does not open the direct conversation'
);

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.chat_participants where member_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' $$,
  'nobody sees how far somebody else has read'
);

-- =============================================================================
-- 7. Pending member: nothing
-- =============================================================================

set local request.jwt.claims = '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';
select is_empty(
  $$ select 1 from public.chat_conversations $$,
  'a pending member sees no conversation, not even the channel'
);
select is_empty(
  $$ select 1 from public.chat_messages $$,
  'and no message'
);
select is_empty(
  $$ select 1 from public.chat_recent_messages() $$,
  'not through the loading function either'
);
select throws_ok(
  $$ insert into public.chat_messages (conversation_id, body)
     values ('c0000000-0000-4000-8000-000000000001', 'Intrus') $$,
  '42501', null,
  'a pending member cannot post'
);
select throws_ok(
  $$ select public.chat_open_direct('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') $$,
  '42501', null,
  'nor open a conversation'
);

-- =============================================================================
-- 8. Deleting: the author only, once, and the text is erased
-- =============================================================================

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';
update public.chat_messages set deleted_at = now(), body = ''
where id = '99999999-0000-4000-8000-0000000000c1';
reset role;
select results_eq(
  $$ select body, deleted_at is null from public.chat_messages where id = '99999999-0000-4000-8000-0000000000c1' $$,
  $$ values ('Bonjour à tous', true) $$,
  'a member cannot delete somebody else''s message'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';
update public.chat_messages
set body = 'Réécrit', author_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', created_at = '2020-01-01'
where id = '99999999-0000-4000-8000-0000000000c1';
select results_eq(
  $$ select body, author_id, created_at > '2025-01-01'::timestamptz
     from public.chat_messages where id = '99999999-0000-4000-8000-0000000000c1' $$,
  $$ values ('Bonjour à tous', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, true) $$,
  'a message is never edited, not even by its author'
);

update public.chat_messages set deleted_at = '2020-01-01'
where id = '99999999-0000-4000-8000-0000000000c1';
select results_eq(
  $$ select body, deleted_at > '2025-01-01'::timestamptz
     from public.chat_messages where id = '99999999-0000-4000-8000-0000000000c1' $$,
  $$ values ('', true) $$,
  'its author can delete it: the row stays, the text is erased, the time is the server''s'
);

update public.chat_messages set deleted_at = null, body = 'Revenu'
where id = '99999999-0000-4000-8000-0000000000c1';
select results_eq(
  $$ select body, deleted_at is not null from public.chat_messages where id = '99999999-0000-4000-8000-0000000000c1' $$,
  $$ values ('', true) $$,
  'a deleted message cannot be brought back'
);

-- =============================================================================
-- 9. Removing a member
-- =============================================================================

reset role;
select lives_ok(
  $$ delete from auth.users where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  'a member who talked can be removed'
);
select is_empty(
  $$ select 1 from public.chat_conversations where kind = 'direct' $$,
  'their direct conversations go with them'
);
select results_eq(
  $$ select author_id, body from public.chat_messages where id = '99999999-0000-4000-8000-0000000000c3' $$,
  $$ values (null::uuid, 'Salut !') $$,
  'what they wrote in the channel stays, without an author'
);

-- =============================================================================
-- 10. Realtime
-- =============================================================================

select is(
  (select count(*)::int from pg_catalog.pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public'
     and tablename in ('chat_conversations', 'chat_participants', 'chat_messages')),
  3,
  'the three chat tables are published to Realtime'
);

select * from finish();
rollback;
