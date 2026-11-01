-- Phase 3: customer profiles.
-- Supabase Auth keeps accounts in auth.users (email, password hash, sessions). That schema
-- belongs to Supabase: don't add columns to it or expose it. Your own per-user data goes in a
-- public table whose primary key is also a foreign key to auth.users: one profile per user.
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null,
  phone         text,
  created_at    timestamptz not null default now()
);
-- The primary key already indexes id, so the policies below get an index lookup for free.

alter table public.profiles enable row level security;

-- Layer 1 (grants): signed-in users only. Column-level UPDATE grant: they may change
-- display_name and phone, while id and created_at stay read-only even for the owner.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, phone) on table public.profiles to authenticated;

-- Layer 2 (RLS): and only their own row.
-- (select auth.uid()) is evaluated once per query instead of once per row.
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- USING picks which rows may be updated; WITH CHECK validates the row after the change.
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert or delete policies: the trigger below creates profiles,
-- and the ON DELETE CASCADE removes them together with the auth user.

-- A schema the Data API doesn't expose, for internal helper functions.
create schema if not exists private;

-- Fires whenever Supabase Auth creates a user.
-- SECURITY DEFINER: runs as its owner (postgres). Sign-up runs as Supabase's auth service role,
-- which has no rights on public.profiles, so the insert would fail otherwise.
-- search_path = '': forces fully qualified names (public.profiles), so a lookalike table in
-- another schema can't hijack a function that runs with elevated rights.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- raw_user_meta_data is whatever the user sent at sign-up: fine as a display name,
    -- never to be trusted for permissions.
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Anonymous Shibe')
  );
  return new;
end;
$$;

-- New functions are executable by PUBLIC by default. This one is only for the trigger.
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
