-- Phase 2 · CTEs (Common Table Expressions)
-- WITH name AS (select ...) gives a sub-query a name, so a big query reads as small steps,
-- like assigning intermediate results to variables. Each CTE exists only for this one query.


-- 1. Items pricier than their category's average.
-- Step 1 computes one average per category; the main query compares each item against it.
with category_avg as (
  select category_id, avg(price_cents) as avg_cents
  from public.menu_items
  group by category_id
)
select
  c.name                           as category,
  i.name                           as item,
  round(i.price_cents / 100.0, 2)  as price,
  round(a.avg_cents / 100.0, 2)    as category_avg
from public.menu_items i
join category_avg a      on a.category_id = i.category_id   -- a CTE joins like any table
join public.categories c on c.id = i.category_id
where i.price_cents > a.avg_cents
order by c.sort_order, i.price_cents desc;


-- 2. Chained CTEs: build a "Much Wow Bento", the cheapest available 'much wow'
--    roll + side + drink, and its total price. Each step reads from the one before.
with wow_items as (
  -- step 1: only available items at the top wow level, tagged with their category slug
  select c.slug, i.name, i.price_cents
  from public.menu_items i
  join public.categories c on c.id = i.category_id
  where i.wow_level = 'much wow'
    and i.is_available
),
bento as (
  -- step 2: DISTINCT ON (Postgres-only) keeps the first row per slug,
  -- and ORDER BY decides which row is "first": here, the cheapest one
  select distinct on (slug) slug, name, price_cents
  from wow_items
  where slug in ('much-rolls', 'such-sides', 'wow-drinks')
  order by slug, price_cents
)
-- step 3: squash the three picks into one row
select
  string_agg(name, ' + ' order by slug)   as much_wow_bento,
  round(sum(price_cents) / 100.0, 2)      as total
from bento;
