-- Phase 3: delivery addresses. A customer can save several ("Home", "Work", "Kabosu's kennel").
create table public.addresses (
  id              bigint generated always as identity primary key,
  -- default auth.uid(): the database fills in the owner from the caller's login token,
  -- so the client never sends (and can't fake) whose address this is.
  user_id         uuid not null default auth.uid()
                    references public.profiles (id) on delete cascade,
  label           text not null default 'Home',
  street          text not null,
  city            text not null,
  postal_code     text not null,
  delivery_notes  text,              -- "Beware of doge", "Ring twice"
  created_at      timestamptz not null default now()
);

-- Postgres doesn't index foreign keys, and every policy below filters on user_id.
create index addresses_user_id_idx on public.addresses (user_id);

alter table public.addresses enable row level security;

-- Layer 1: signed-in users get all four commands, but user_id is left out of the
-- INSERT and UPDATE column lists, so it can only come from the default above.
revoke all on table public.addresses from anon, authenticated;
grant select, delete on table public.addresses to authenticated;
grant insert (label, street, city, postal_code, delivery_notes) on table public.addresses to authenticated;
grant update (label, street, city, postal_code, delivery_notes) on table public.addresses to authenticated;

-- Layer 2: one policy per command, all scoped to the owner. Separate policies are more
-- verbose than one FOR ALL policy, but each command's rule is explicit and easy to change later.
create policy "Users can read their own addresses"
  on public.addresses for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- INSERT has no existing row to filter, so it only has WITH CHECK (validates the new row).
create policy "Users can add their own addresses"
  on public.addresses for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can edit their own addresses"
  on public.addresses for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own addresses"
  on public.addresses for delete
  to authenticated
  using ((select auth.uid()) = user_id);
