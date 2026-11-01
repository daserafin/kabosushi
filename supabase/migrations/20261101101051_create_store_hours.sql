-- Phase 4: where the shop is and when it's open.

-- One shop, so one row. The boolean primary key that must be true is a classic trick for a
-- single-row table: a second row would need id = true again and break the primary key.
create table public.store_info (
  id         boolean primary key default true check (id),
  name       text not null,
  address    text not null,
  -- An IANA time zone name like 'Asia/Tokyo'. Opening hours are local wall-clock times,
  -- and this is what turns "now" (stored in UTC) into "what time is it at the shop".
  timezone   text not null,
  latitude   numeric(8, 6) not null check (latitude between -90 and 90),
  longitude  numeric(9, 6) not null check (longitude between -180 and 180)
);

-- One row per weekday. 0 = Sunday … 6 = Saturday, the same numbering as extract(dow ...).
-- time (no date, no time zone): "11:30" means 11:30 at the shop, whatever day it is.
create table public.store_hours (
  day_of_week  smallint primary key check (day_of_week between 0 and 6),
  opens_at     time,
  closes_at    time,
  note         text,   -- "doge nap day"
  -- Both null = closed that day; both set = open. Never just one of them.
  check ((opens_at is null) = (closes_at is null)),
  -- One shift per day that ends before midnight. Late-night hours would need a different design.
  check (closes_at > opens_at)
);

alter table public.store_info enable row level security;
alter table public.store_hours enable row level security;

-- Public and read-only, same pattern as the menu.
revoke all on table public.store_info, public.store_hours from anon, authenticated;
grant select on table public.store_info, public.store_hours to anon, authenticated;

create policy "Store info is readable by everyone"
  on public.store_info for select
  to anon, authenticated
  using (true);

create policy "Store hours are readable by everyone"
  on public.store_hours for select
  to anon, authenticated
  using (true);

-- "Is the shop open right now?" must be answered in the shop's time zone, not the visitor's.
-- now() is a timestamptz (an absolute moment). AT TIME ZONE turns it into the shop's local
-- wall-clock time, a plain timestamp, from which we take the weekday and the time of day.
-- The browser calls this as an RPC: supabase.rpc('store_status').
create function public.store_status()
returns table (
  is_open           boolean,
  store_local_time  timestamp,
  opens_at          time,
  closes_at         time,
  note              text
)
language sql
stable             -- reads data, changes nothing: Postgres may optimise calls within a query
security invoker   -- runs with the caller's rights, so the policies above apply
set search_path = ''
as $$
  select
    coalesce(t.local_now::time >= h.opens_at and t.local_now::time < h.closes_at, false),
    date_trunc('minute', t.local_now),
    h.opens_at,
    h.closes_at,
    h.note
  from (select now() at time zone s.timezone as local_now from public.store_info s) t
  left join public.store_hours h on h.day_of_week = extract(dow from t.local_now);
$$;

-- Functions are executable by PUBLIC by default; make the intended callers explicit.
revoke execute on function public.store_status() from public;
grant execute on function public.store_status() to anon, authenticated;
