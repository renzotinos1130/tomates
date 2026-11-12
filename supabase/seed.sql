-- =============================================================================
-- Team Tomate HQ — LOCAL DEVELOPMENT SEED ONLY
--
-- Applied by `supabase db reset` (see [db.seed] in config.toml). Never run this
-- against a hosted project: it creates demo accounts with a shared password.
--
-- Creates the 6 partners as Auth users (password: tomate-demo). The addresses
-- are placeholders on a reserved test domain, not anybody's real mailbox:
--   Dominic Renzetti   dominic@prospero.test     first user → admin (handle_new_user)
--   Alexandre Halle    alexandre@prospero.test   invited    → active member
--   Maya Martel        maya@prospero.test        invited    → active member
--   Marco Drouin       marco@prospero.test       invited    → active member
--   Antoine Favreau    antoine@prospero.test     invited    → active member
--   Jimmy Perreault    jimmy@prospero.test       invited    → active member
--
-- No tasks here: demo tasks are inserted by a separate script.
-- =============================================================================

-- 1. Allowlist the 5 non-admin partners. Each invite is consumed (deleted) by
--    public.handle_new_user() when the matching auth user is created below.
insert into public.member_invites (email, role, invited_by)
values
  ('alexandre@prospero.test', 'member', null),
  ('maya@prospero.test',      'member', null),
  ('marco@prospero.test',     'member', null),
  ('antoine@prospero.test',   'member', null),
  ('jimmy@prospero.test',     'member', null)
on conflict (email) do nothing;

-- 2. Auth users + email identities so email/password sign-in works with GoTrue.
--    Token columns must be '' (not NULL) or GoTrue fails to scan the row.
--    Users are created one by one in `ord` order (Dominic first → admin), with
--    staggered created_at so members sort in that order too.
create temporary table seed_people (
  ord        integer primary key,
  id         uuid not null,
  email      text not null,
  full_name  text not null,
  color      text not null
);

insert into seed_people (ord, id, email, full_name, color)
values
  (1, '11111111-1111-4111-8111-111111111111', 'dominic@prospero.test',   'Dominic Renzetti', 'teal'),
  (2, '22222222-2222-4222-8222-222222222222', 'alexandre@prospero.test', 'Alexandre Halle',  'amber'),
  (3, '33333333-3333-4333-8333-333333333333', 'maya@prospero.test',      'Maya Martel',      'indigo'),
  (4, '44444444-4444-4444-8444-444444444444', 'marco@prospero.test',     'Marco Drouin',     'rose'),
  (5, '55555555-5555-4555-8555-555555555555', 'antoine@prospero.test',   'Antoine Favreau',  'violet'),
  (6, '66666666-6666-4666-8666-666666666666', 'jimmy@prospero.test',     'Jimmy Perreault',  'sky');

do $$
declare
  p record;
begin
  for p in select * from seed_people order by ord loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token,
      is_sso_user, is_anonymous
    )
    values (
      '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', p.email,
      extensions.crypt('tomate-demo', extensions.gen_salt('bf')),
      now(), null,
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('full_name', p.full_name),
      now() - make_interval(mins => 10 - p.ord), now() - make_interval(mins => 10 - p.ord),
      '', '',
      '', '', '',
      '', '', '',
      false, false
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    )
    values (
      p.id, p.id, p.id::text, 'email',
      jsonb_build_object(
        'sub', p.id::text,
        'email', p.email,
        'email_verified', true,
        'phone_verified', false
      ),
      null, now(), now()
    )
    on conflict (provider_id, provider) do nothing;
  end loop;
end;
$$;

-- 3. Personal colors (handle_new_user cycles through the palette by default).
update public.members m
set color = p.color
from seed_people p
where m.id = p.id
  and m.color is distinct from p.color;

drop table seed_people;
