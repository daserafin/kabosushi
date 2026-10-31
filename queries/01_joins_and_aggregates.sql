-- Phase 2 · Joins and aggregates
-- Study notes, not migrations: nothing here changes the database.
-- Run one query at a time in the dashboard SQL Editor (select it, then Run).


-- 1. Menu stats per category.
-- JOIN glues each item to its category; GROUP BY collapses the rows into one per category,
-- and the aggregate functions (count, avg, min, max) summarise each group.
select
  c.name                                     as category,
  count(*)                                   as items,
  count(*) filter (where i.is_available)     as available,     -- FILTER: aggregate only some rows
  round(avg(i.price_cents) / 100.0, 2)       as avg_price,
  round(min(i.price_cents) / 100.0, 2)       as cheapest,      -- without round(), numeric division
  round(max(i.price_cents) / 100.0, 2)       as priciest       -- shows 10.9000000000000000
from public.categories c
join public.menu_items i on i.category_id = c.id
group by c.id   -- c.id is the primary key, so Postgres knows c.name and c.sort_order are fixed per group
order by c.sort_order;


-- 2. HAVING: filter groups after aggregating.
-- WHERE runs before grouping (filters rows); HAVING runs after (filters groups).
-- "Which categories are spicy on average?"
select
  c.name                            as category,
  round(avg(i.spice_level), 2)      as avg_spice
from public.categories c
join public.menu_items i on i.category_id = c.id
group by c.id
having avg(i.spice_level) >= 1
order by avg_spice desc;


-- 3. LEFT JOIN, and why the condition's position matters.
-- "How many hot items (spice 3+) does each category have?" We want categories with zero too.
-- A plain JOIN drops categories with no match. LEFT JOIN keeps them, filling item columns with NULL.
-- The spice condition goes in ON, not WHERE: in WHERE, those NULL rows would be filtered out
-- and the zero-count categories would vanish again.
select
  c.name           as category,
  count(i.id)      as hot_items       -- count(i.id) skips NULLs; count(*) would count them as 1
from public.categories c
left join public.menu_items i
  on i.category_id = c.id
 and i.spice_level >= 3
group by c.id
order by c.sort_order;
