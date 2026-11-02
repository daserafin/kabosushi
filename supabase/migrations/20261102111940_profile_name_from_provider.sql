-- Phase 5: a display name for people who sign up through an identity provider.
-- On an OAuth/OIDC sign-up Supabase Auth copies the provider's claims into
-- auth.users.raw_user_meta_data, but under the provider's names, not our display_name:
--   Keycloak: full_name, name, custom_claims.preferred_username
--   Google:   full_name, name
--   GitHub:   full_name, name (both optional), user_name, preferred_username

-- Picks the first non-empty name, our own sign-up field first. Display only: users can
-- set raw_user_meta_data themselves, so it never decides permissions.
-- IMMUTABLE: the result depends only on the argument, nothing in the database.
create function private.display_name_from(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(trim(meta ->> 'display_name'), ''),
    nullif(trim(meta ->> 'full_name'), ''),
    nullif(trim(meta ->> 'name'), ''),
    nullif(trim(meta ->> 'preferred_username'), ''),
    nullif(trim(meta ->> 'user_name'), ''),
    nullif(trim(meta #>> '{custom_claims,preferred_username}'), ''), -- #>> follows a path
    'Anonymous Shibe'
  );
$$;

revoke execute on function private.display_name_from(jsonb) from public, anon, authenticated;

-- CREATE OR REPLACE keeps the function's owner, its revoked privileges and the trigger
-- that calls it; only the body changes.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, private.display_name_from(new.raw_user_meta_data));
  return new;
end;
$$;

-- Data migration: profiles created before this fix that fell back to the default.
-- Accounts without any name in their metadata just stay 'Anonymous Shibe'.
update public.profiles p
set display_name = private.display_name_from(u.raw_user_meta_data)
from auth.users u
where u.id = p.id
  and p.display_name = 'Anonymous Shibe';
