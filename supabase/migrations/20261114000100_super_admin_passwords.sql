-- =============================================================================
-- Team Tomate HQ — super administrator, and passwords set for the members
--
-- Roles, from now on
--   * super_admin  everything an administrator does, and: the roles, the
--                  accounts and their passwords. The first member is the super
--                  administrator; there is always at least one.
--   * admin        access of the partners (activate, deactivate) and the
--                  invitations of partners. Not the roles, and not the accounts
--                  of administrators.
--   * member       a partner.
--
-- Passwords
--   The super administrator creates an account with a temporary password, or
--   sets a new one on an existing account. That happens on the server, with the
--   service key (see src/lib/server/accounts.ts): nothing here lets an API
--   client read or write a password. What the database knows is one flag,
--   members.must_change_password. While it is true the member is not an active
--   member for the rules below: they see their own row and nothing else, until
--   they have chosen their own password.
--
--   The server never writes that flag directly. It writes it in the account's
--   app metadata, in the same call that sets the password, and section 3 copies
--   it to the member's row inside the Auth server's own transaction: a password
--   and the obligation to change it are saved together, or not at all.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The flag
-- -----------------------------------------------------------------------------

alter table public.members
  add column must_change_password boolean not null default false;

comment on column public.members.must_change_password is
  'true = the password was set by a super administrator: the member must choose their own before seeing anything. Written by trusted contexts only (service role, triggers).';

-- An invitation never makes a super administrator.
alter table public.member_invites
  add constraint member_invites_no_super_admin check (role <> 'super_admin');


-- -----------------------------------------------------------------------------
-- 2. Helpers used by the policies
-- -----------------------------------------------------------------------------

-- Active, and not waiting to choose a password.
create or replace function public.is_active_member()
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
      and not m.must_change_password
  );
$$;

comment on function public.is_active_member() is
  'True when the current JWT user is an active (approved) member who is not required to change their password.';

-- Administrators of both kinds: every existing "admin" rule holds for the super administrator.
create or replace function public.is_admin()
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
      and not m.must_change_password
      and m.role in ('admin', 'super_admin')
  );
$$;

comment on function public.is_admin() is
  'True when the current JWT user is an active administrator or super administrator.';

create function public.is_super_admin()
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
      and not m.must_change_password
      and m.role = 'super_admin'
  );
$$;

comment on function public.is_super_admin() is
  'True when the current JWT user is an active super administrator.';

revoke execute on function public.is_super_admin() from public, anon;
grant  execute on function public.is_super_admin() to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 3. New accounts
--   * first member ever        → active super administrator
--   * email found in invites   → active with the invite's role (invite consumed)
--   * otherwise                → pending, an administrator activates later
--   * created by the server with a temporary password (app metadata, which only
--     the service role can write) → must change it at the first sign-in
--
-- The Auth server inserts the user first and writes its app metadata with an
-- UPDATE that follows, in the same transaction: handle_new_user() reads the flag
-- when it is already there, handle_user_app_metadata() carries it when it comes
-- afterwards, and each time the server sets a password later on.
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  palette constant text[] := array['teal', 'amber', 'indigo', 'rose', 'sky', 'violet', 'emerald', 'orange', 'slate'];
  v_email      text := lower(btrim(new.email));
  v_name       text := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');
  v_must       boolean := coalesce(new.raw_app_meta_data ->> 'must_change_password', '') = 'true';
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

  -- Serialise concurrent sign-ups so only one user can become the first, super, administrator.
  perform pg_advisory_xact_lock(hashtext('public.handle_new_user'));

  select count(*) into v_count from public.members;

  if v_count = 0 then
    v_role   := 'super_admin';
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

  insert into public.members (id, email, full_name, color, role, active, must_change_password, created_at)
  values (
    new.id,
    v_email,
    v_name,
    palette[(v_count % array_length(palette, 1)) + 1],
    v_role,
    v_active,
    v_must,
    coalesce(new.created_at, now())
  );

  return new;
end;
$$;

-- App metadata → the member's row. Runs for every write of the app metadata, so
-- the row follows it even if the two had drifted apart.
create function public.handle_user_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_must boolean := coalesce(new.raw_app_meta_data ->> 'must_change_password', '') = 'true';
begin
  update public.members m
  set must_change_password = v_must
  where m.id = new.id
    and m.must_change_password is distinct from v_must;

  return new;
end;
$$;

comment on function public.handle_user_app_metadata() is
  'Copies app_metadata.must_change_password (written by the server with the service key) to members.must_change_password.';

revoke execute on function public.handle_user_app_metadata() from public, anon, authenticated;

create trigger on_auth_user_app_metadata
  after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_user_app_metadata();


-- -----------------------------------------------------------------------------
-- 4. Members guard
--
-- Runs with the caller's privileges (NOT security definer) so `current_user`
-- tells an API client (anon / authenticated) from a trusted context (service
-- role, migrations, SQL editor, security-definer functions).
-- -----------------------------------------------------------------------------

create or replace function public.members_guard_update()
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

    -- Whether a password must be changed is decided on the server, never by an API client.
    if new.must_change_password is distinct from old.must_change_password then
      raise exception 'Ce réglage ne se modifie pas ici.'
        using errcode = '42501';
    end if;

    if not public.is_admin() then
      -- Partners may only edit their own profile (full_name, color, avatar_url).
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

    elsif not public.is_super_admin() then
      -- Administrators manage the access of partners. Roles, and the accounts of
      -- other administrators, are the super administrator's.
      if new.role is distinct from old.role then
        raise exception 'Seul un super administrateur peut modifier les rôles.'
          using errcode = '42501';
      end if;

      if old.id is distinct from auth.uid() and old.role <> 'member' then
        raise exception 'Seul un super administrateur peut modifier le compte d''un administrateur.'
          using errcode = '42501';
      end if;

      if old.id = auth.uid()
         and (new.active is distinct from old.active or new.email is distinct from old.email) then
        raise exception 'Seul un super administrateur peut modifier votre accès ou votre courriel.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  -- Invariant (all contexts): keep at least one active super administrator.
  if old.role = 'super_admin' and old.active
     and (new.role <> 'super_admin' or not new.active)
     and not exists (
       select 1
       from public.members m
       where m.id <> old.id
         and m.role = 'super_admin'
         and m.active
     ) then
    raise exception 'Impossible de retirer le dernier super administrateur actif.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- Removing a member row from the API: partners by any administrator, administrators
-- by the super administrator only. (Nobody removes their own row: the policy
-- refuses it, so the super administrator who removes another one remains.)
create function public.members_guard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and old.role <> 'member'
     and not public.is_super_admin() then
    raise exception 'Seul un super administrateur peut retirer un administrateur.'
      using errcode = '42501';
  end if;

  return old;
end;
$$;

create trigger members_guard_delete
  before delete on public.members
  for each row execute function public.members_guard_delete();

revoke execute on function public.members_guard_delete() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. Invitations: an administrator invites partners; inviting an administrator
--    is naming one, which is the super administrator's.
-- -----------------------------------------------------------------------------

drop policy "member_invites: admin insert" on public.member_invites;
create policy "member_invites: admin insert"
  on public.member_invites for insert to authenticated
  with check ((select public.is_admin()) and (role = 'member' or (select public.is_super_admin())));

drop policy "member_invites: admin update" on public.member_invites;
create policy "member_invites: admin update"
  on public.member_invites for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()) and (role = 'member' or (select public.is_super_admin())));


-- -----------------------------------------------------------------------------
-- 6. A team that already exists: its first administrator becomes the super
--    administrator (the first member was the administrator until now).
-- -----------------------------------------------------------------------------

update public.members m
set role = 'super_admin'
where m.id = (
    select f.id
    from public.members f
    where f.role = 'admin' and f.active
    order by f.created_at, f.id
    limit 1
  )
  and not exists (select 1 from public.members s where s.role = 'super_admin');
