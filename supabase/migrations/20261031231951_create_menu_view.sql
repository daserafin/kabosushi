-- Phase 2: the menu as the website will read it.
-- A view is a saved query that behaves like a read-only table: one place to define
-- "what the menu looks like", instead of repeating this join in every frontend call.

-- security_invoker: the view runs with the permissions of whoever queries it, so the RLS
-- policies on categories and menu_items still apply. Without it, a view runs as its owner
-- (postgres, which skips RLS), and anyone allowed to read the view would see every row.
create view public.menu_view
with (security_invoker = true)
as
select
  i.id,
  i.name,
  i.description,
  i.price_cents,
  i.spice_level,
  i.wow_level,
  i.is_available,
  c.slug        as category_slug,
  c.name        as category_name,
  c.sort_order  as category_sort_order,
  -- One "top pick" badge per category: available first, then most wow, then cheapest.
  row_number() over (
    partition by i.category_id
    order by i.is_available desc, i.wow_level desc, i.price_cents
  ) = 1         as is_top_pick
from public.menu_items i
join public.categories c on c.id = i.category_id;
-- No ORDER BY: a view doesn't guarantee row order. Callers sort by category_sort_order etc.
