-- Phase 5: staff. Customers only see their own orders; the kitchen has to see everyone's.

-- Who is staff lives in the private schema: the Data API doesn't expose it, so nobody can
-- read the list through the website, let alone add themselves to it. Staff are added by
-- hand in the SQL editor (emails stay out of the repo):
--   insert into private.staff (user_id) select id from auth.users where email = '...';
create table private.staff (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

revoke all on table private.staff from public, anon, authenticated;

-- "Is the caller staff?" Policies on orders will call this.
-- SECURITY DEFINER because callers have no rights on private.staff. It's safe to expose
-- because it only ever answers about the caller (auth.uid()), never about anyone else.
-- Living in public also makes it an RPC, so the website can ask: POST /rest/v1/rpc/is_staff.
-- (The other common approach is a custom claim in the login token, set by an Auth hook.
-- It saves a lookup, but a role change only shows up when the token refreshes.)
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.staff where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;
