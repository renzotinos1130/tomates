-- =============================================================================
-- Team Tomate HQ — a member's e-mail is the address of their account
--
-- The super administrator can now correct the address a member signs in with,
-- in Paramètres → Membres. That is done on the server (setAccountEmail in
-- src/lib/server/accounts.ts): the Auth server changes the account, and the
-- trigger that already exists (handle_user_email_change) copies the address to
-- the member's row in the same transaction.
--
-- Until now an administrator could also rewrite members.email through the API.
-- That changed what the screens showed without changing the address the person
-- signs in with. From here on no API client can: the column only follows the
-- account.
-- =============================================================================

create function public.members_email_follows_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and new.email is distinct from old.email then
    raise exception 'Le courriel d''un membre est celui de son compte : il se change dans Paramètres → Membres.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.members_email_follows_account() is
  'members.email is not editable through the API: it follows auth.users.email (handle_user_email_change).';

create trigger members_email_follows_account
  before update of email on public.members
  for each row
  execute function public.members_email_follows_account();
