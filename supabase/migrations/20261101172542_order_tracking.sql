-- Phase 5: moving orders through the kitchen, and telling browsers about it live.
--   placed → cooking → delivering → delivered
--      ↘         ↘
--       cancelled  cancelled

-- 1. History: one row per status an order has reached, and when.
--    The tracker shows "cooking since 12:41" from this.
create table public.order_status_history (
  order_id    bigint not null references public.orders (id) on delete cascade,
  status      public.order_status not null,
  changed_at  timestamptz not null default now(),
  changed_by  uuid references public.profiles (id) on delete set null,
  -- Orders only move forward, so each status is reached at most once per order.
  -- The key also indexes the order_id foreign key.
  primary key (order_id, status)
);

create index order_status_history_changed_by_idx on public.order_status_history (changed_by);

-- Data migration: orders placed before today get their starting row too.
insert into public.order_status_history (order_id, status, changed_at)
select id, status, created_at from public.orders;

alter table public.order_status_history enable row level security;

-- Read-only for everyone: only the trigger below writes history.
revoke all on table public.order_status_history from anon, authenticated;
grant select on table public.order_status_history to authenticated;

-- "You may read the history of any order you're allowed to read." The subquery runs with
-- the caller's rights, so the orders policies (customer: own orders, staff: all) decide.
create policy "Read history of orders you can see"
  on public.order_status_history for select
  to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

-- 2. Triggers: functions Postgres runs by itself when a row changes.

-- BEFORE UPDATE: guard the flow. Raising an exception cancels the whole update, so even
-- staff with full rights can't send a delivered order back to the kitchen.
create function private.check_order_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  next_steps public.order_status[] := (case old.status
    when 'placed'     then '{cooking,cancelled}'
    when 'cooking'    then '{delivering,cancelled}'
    when 'delivering' then '{delivered}'
    else '{}' -- delivered and cancelled are the end of the road
  end)::public.order_status[];
begin
  if not (new.status = any (next_steps)) then
    raise exception 'such confuse. an order can''t go from % to %.', old.status, new.status
      using errcode = '22023';
  end if;
  return new; -- a BEFORE trigger returns the row to write (it could even change it)
end;
$$;

-- "update of status" + WHEN: only fires when status actually changes. place_order() updates
-- total_cents right after inserting, and that must not count as a status change.
create trigger check_status_change
  before update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function private.check_order_status_change();

-- AFTER INSERT/UPDATE: write the history row. SECURITY DEFINER because callers have no
-- insert rights on the history table; that's what keeps the history honest.
create function private.record_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_status_history (order_id, status, changed_by)
  values (new.id, new.status, (select auth.uid()));
  return null; -- AFTER triggers ignore the return value
end;
$$;

-- Two triggers, one function: a WHEN clause can't mention OLD on INSERT (there is no old row).
create trigger record_status_on_insert
  after insert on public.orders
  for each row
  execute function private.record_order_status();

create trigger record_status_on_update
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function private.record_order_status();

revoke execute on function private.check_order_status_change() from public, anon, authenticated;
revoke execute on function private.record_order_status() from public, anon, authenticated;

-- 3. Staff rights. Policies for the same command are OR-ed together, so customers keep
-- their own-order policies and staff get these on top.

-- Column-level grant: the only thing anyone may update directly is the status.
-- Customers have the grant too, but no UPDATE policy, so their updates match 0 rows.
grant update (status) on table public.orders to authenticated;

create policy "Staff can read all orders"
  on public.orders for select
  to authenticated
  using ((select public.is_staff()));

create policy "Staff can update order status"
  on public.orders for update
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy "Staff can read all order items"
  on public.order_items for select
  to authenticated
  using ((select public.is_staff()));

-- So the kitchen screen can say whose order it is.
create policy "Staff can read all profiles"
  on public.profiles for select
  to authenticated
  using ((select public.is_staff()));

-- 4. Realtime. Supabase's Realtime server follows the database's change log (logical
-- replication), but only for tables in the supabase_realtime publication. Before it sends
-- a change to a browser, it checks the SELECT policies as that browser's user: customers
-- only hear about their own orders, staff hear about all of them.
alter publication supabase_realtime add table public.orders;
