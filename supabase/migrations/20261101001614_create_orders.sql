-- Phase 3: orders.
-- orders 1 ──< many order_items >── 1 menu_items
-- order_items is the junction table that turns the many-to-many
-- "an order has many items, an item is in many orders" into two one-to-many links.

-- Plain status values; the site can show them as "such placed", "very cooking", "wow arrived".
create type public.order_status as enum ('placed', 'cooking', 'delivering', 'delivered', 'cancelled');

create table public.orders (
  id                bigint generated always as identity primary key,
  -- Nullable, ON DELETE SET NULL: if a customer deletes their account, their orders stay
  -- in the books as anonymous history instead of vanishing (CASCADE) or blocking the
  -- deletion (RESTRICT).
  user_id           uuid references public.profiles (id) on delete set null,
  status            public.order_status not null default 'placed',
  -- A snapshot, not a link to addresses: if the customer edits or deletes that address
  -- later, the order must still say where it actually went.
  delivery_address  text not null,
  -- Stored, not recomputed from order_items: Phase 4's place_order() calculates it once at
  -- checkout (with delivery fees etc.). Storing derived data means keeping it consistent,
  -- which is exactly why only that function will be allowed to write orders.
  total_cents       integer not null check (total_cents >= 0),
  created_at        timestamptz not null default now()
);

create index orders_user_id_idx on public.orders (user_id);

create table public.order_items (
  order_id          bigint not null references public.orders (id) on delete cascade,
  -- RESTRICT: a menu item that was ever ordered can't be deleted, only marked unavailable.
  menu_item_id      bigint not null references public.menu_items (id) on delete restrict,
  quantity          integer not null check (quantity between 1 and 99),
  -- Price snapshot: the menu price at the moment of ordering. Raising the price of the
  -- Much Wow Roll tomorrow must not change what yesterday's customer paid.
  unit_price_cents  integer not null check (unit_price_cents > 0),
  -- Composite primary key: one line per item per order (2 rolls = quantity 2, not 2 rows).
  -- Its index starts with order_id, so it also covers that foreign key.
  primary key (order_id, menu_item_id)
);

create index order_items_menu_item_id_idx on public.order_items (menu_item_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Layer 1: customers may only read. No insert/update grants: in Phase 4, orders are created
-- by a place_order() function that checks prices server-side, never by the browser directly.
revoke all on table public.orders, public.order_items from anon, authenticated;
grant select on table public.orders, public.order_items to authenticated;

-- Layer 2: your own orders only.
create policy "Customers can read their own orders"
  on public.orders for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- order_items has no user_id; ownership lives on the parent order.
-- The subquery runs with the caller's rights, so the orders policy above applies inside it too.
create policy "Customers can read items of their own orders"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.user_id = (select auth.uid())
    )
  );
