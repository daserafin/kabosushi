-- Phase 2 · Window functions
-- An aggregate collapses rows: GROUP BY turns 7 rolls into 1 row.
-- A window function computes across related rows but KEEPS every row: each roll stays,
-- and gets an extra column calculated from its "window" of neighbours.
--
--   function() OVER (PARTITION BY <which rows belong together>
--                    ORDER BY     <their order inside the window>)


-- 1. Compare each item with its category without collapsing.
-- Same question as the first CTE query (vs category average), answered in one pass, no join.
select
  i.name                                                              as item,
  round(i.price_cents / 100.0, 2)                                     as price,
  round(avg(i.price_cents) over (partition by i.category_id) / 100.0, 2) as category_avg,
  round(i.price_cents * 100.0 / sum(i.price_cents) over (partition by i.category_id), 1)
                                                                      as pct_of_category_total
from public.menu_items i
join public.categories c on c.id = i.category_id
where c.slug = 'much-rolls'
order by i.price_cents desc;


-- 2. Three ways to number rows: row_number, rank, dense_rank.
-- They only differ on ties. Drinks come in pairs per wow level, so the ties show:
--   row_number  always 1,2,3,…      (ties broken arbitrarily, unless ORDER BY breaks them)
--   rank        1,1,3,3,5,5         (ties share a number, then it skips)
--   dense_rank  1,1,2,2,3,3         (ties share a number, no gaps)
select
  i.name,
  i.wow_level,
  row_number() over w   as row_number,
  rank()       over w   as rank,
  dense_rank() over w   as dense_rank
from public.menu_items i
join public.categories c on c.id = i.category_id
where c.slug = 'wow-drinks'
window w as (order by i.wow_level desc)   -- a named window, reused by all three columns
order by i.wow_level desc;


-- 3. Top 2 per category: the classic window function job.
-- Window functions run after WHERE, so you can't filter on them directly.
-- Compute the rank in a CTE first, then filter in the outer query.
with ranked as (
  select
    c.name        as category,
    c.sort_order,
    i.name        as item,
    i.wow_level,
    i.price_cents,
    row_number() over (
      partition by i.category_id                 -- restart numbering in every category
      order by i.wow_level desc, i.price_cents   -- most wow first; cheaper wins a tie
    ) as pos
  from public.menu_items i
  join public.categories c on c.id = i.category_id
  where i.is_available
)
select category, pos, item, wow_level, round(price_cents / 100.0, 2) as price
from ranked
where pos <= 2
order by sort_order, pos;


-- 4. Running totals and neighbours: sum() over an ORDER BY, plus lag().
-- "Doge has 30 dogecoin and buys sides cheapest-first. How far does it get?"
-- With ORDER BY inside OVER, sum() becomes cumulative: each row adds up everything before it.
-- lag() peeks at the previous row: here, how big each price jump is.
select
  i.name                                                          as side,
  round(i.price_cents / 100.0, 2)                                 as price,
  round((i.price_cents - lag(i.price_cents) over w) / 100.0, 2)   as jump_from_previous,
  round(sum(i.price_cents) over w / 100.0, 2)                     as running_total,
  sum(i.price_cents) over w <= 3000                               as doge_can_afford
from public.menu_items i
join public.categories c on c.id = i.category_id
where c.slug = 'such-sides'
window w as (order by i.price_cents, i.name)   -- name breaks the 4.50 tie, so the order is fixed
order by i.price_cents, i.name;
