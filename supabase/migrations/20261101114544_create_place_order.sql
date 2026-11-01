-- Phase 4: checkout. place_order() turns a cart into an order and its lines in one transaction.
--
-- Why a function instead of letting the browser insert into orders and order_items?
-- The browser can't be trusted with prices: anyone can edit the request and order a
-- Much Wow Roll for 1 cent. So customers have no INSERT rights at all (Phase 3), and this
-- function does the writing. It takes only item ids and quantities, and reads every price
-- from menu_items itself.

-- Helper: turn the cart JSON, [{"menu_item_id": 1, "quantity": 2}, ...], into rows,
-- merging duplicate items. Private schema: not exposed through the API.
create function private.cart_lines(items jsonb)
returns table (menu_item_id bigint, quantity integer)
language sql
immutable          -- same input, same output, no table reads
set search_path = ''
as $$
  select (line ->> 'menu_item_id')::bigint, sum((line ->> 'quantity')::integer)::integer
  from jsonb_array_elements(items) as line
  group by 1;
$$;

revoke execute on function private.cart_lines(jsonb) from public, anon, authenticated;

-- A plpgsql function body runs inside the caller's transaction, so everything below
-- happens completely or not at all: if any step raises an error, the order, its lines
-- and the total are all rolled back together.
create function public.place_order(items jsonb, delivery_address text)
returns public.orders     -- the new order row, as an object
language plpgsql
-- SECURITY DEFINER: runs as the owner (postgres), the only way to insert into orders now
-- that customers have no INSERT grant. That makes this function a privileged door, so it:
--   * takes the customer from auth.uid(), never from a parameter
--   * reads prices from the database, never from the caller
--   * sets search_path = '' so every table name must be fully qualified
--   * is executable by authenticated users only (see the grants at the bottom)
security definer
set search_path = ''
as $$
declare
  caller     uuid := (select auth.uid());
  line_count integer;
  ok_count   integer;
  new_order  public.orders;
begin
  if caller is null then
    raise exception 'such anonymous. log in to order.' using errcode = '42501';
  end if;

  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) = 0 then
    raise exception 'much empty. cart has no items.' using errcode = '22023';
  end if;

  if char_length(trim(coalesce(delivery_address, ''))) < 5 then
    raise exception 'where doge deliver? address is too short.' using errcode = '22023';
  end if;

  -- Every line must be a real, available menu item with a sane quantity.
  select count(*),
         count(*) filter (where m.is_available and c.quantity between 1 and 99)
    into line_count, ok_count
  from private.cart_lines(items) c
  left join public.menu_items m on m.id = c.menu_item_id;

  if ok_count < line_count then
    raise exception 'very sold out. some items are unknown, unavailable, or have a bad quantity.'
      using errcode = '22023';
  end if;

  -- 1. The order, with a placeholder total.
  insert into public.orders (user_id, delivery_address, total_cents)
  values (caller, trim(delivery_address), 0)
  returning * into new_order;

  -- 2. The lines, each with a snapshot of today's menu price.
  insert into public.order_items (order_id, menu_item_id, quantity, unit_price_cents)
  select new_order.id, c.menu_item_id, c.quantity, m.price_cents
  from private.cart_lines(items) c
  join public.menu_items m on m.id = c.menu_item_id;

  -- 3. The total, summed from the lines just written. Computing it last (instead of from
  --    the menu in step 1) guarantees total = sum of lines, even if a price changed mid-way.
  update public.orders o
  set total_cents = (
    select sum(oi.quantity * oi.unit_price_cents) from public.order_items oi where oi.order_id = o.id
  )
  where o.id = new_order.id
  returning * into new_order;

  return new_order;
end;
$$;

-- New functions are executable by PUBLIC (so also anon) by default. Only logged-in doges order.
revoke execute on function public.place_order(jsonb, text) from public, anon;
grant execute on function public.place_order(jsonb, text) to authenticated;
