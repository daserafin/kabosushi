-- Phase 3 · Testing RLS by pretending to be a user
-- The SQL Editor and the CLI connect as postgres, which skips RLS, so by default you never see
-- what a real user would. Supabase's API does two things on every request; we do the same:
--   1. puts the caller's JWT claims in the setting request.jwt.claims (auth.uid() reads 'sub' from it)
--   2. switches to the role named in the token: anon or authenticated
-- Run each block as a whole (select all of it, then Run): both settings last only for one connection.
--
-- Test users, in sign-up order: 1st = doge, 2nd = cheems.


-- 1. As doge, read all profiles. No WHERE clause, yet only one row comes back:
--    RLS acts like an invisible WHERE (select auth.uid()) = id.
select set_config('request.jwt.claims',
  json_build_object('sub', id, 'role', 'authenticated')::text, false)
from auth.users order by created_at limit 1;          -- doge
set role authenticated;
select auth.uid() = id as is_me, display_name from public.profiles;


-- 2. As cheems, try to rename doge. No error, just "0 rows updated":
--    doge's row is invisible to cheems, so the UPDATE never finds it.
--    Replace <doge-id> with doge's id (as postgres: select id from auth.users order by created_at).
select set_config('request.jwt.claims',
  json_build_object('sub', id, 'role', 'authenticated')::text, false)
from auth.users order by created_at offset 1 limit 1; -- cheems
set role authenticated;
update public.profiles set display_name = 'Doge is a cat' where id = '<doge-id>' returning *;


-- 3. As cheems, try to change a column that isn't granted. This one IS an error:
--    grants are checked before RLS, so it fails at layer 1 with "permission denied".
select set_config('request.jwt.claims',
  json_build_object('sub', id, 'role', 'authenticated')::text, false)
from auth.users order by created_at offset 1 limit 1; -- cheems
set role authenticated;
update public.profiles set id = gen_random_uuid();


-- 4. As a logged-out visitor: anon has no grant on profiles at all.
set role anon;
select * from public.profiles;                        -- permission denied
