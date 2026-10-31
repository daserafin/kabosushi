-- Phase 1: the menu.
-- categories 1 ──< many menu_items

-- An enum is a custom type with a fixed list of values.
-- Values sort in the order they're declared, so 'much wow' > 'very ok' and ORDER BY works.
create type public.wow_level as enum ('very ok', 'such delish', 'much wow');

create table public.categories (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  name        text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.menu_items (
  id            bigint generated always as identity primary key,
  category_id   bigint not null references public.categories (id) on delete restrict,
  name          text not null,
  description   text,
  price_cents   integer not null check (price_cents > 0),
  spice_level   smallint not null default 0 check (spice_level between 0 and 5),
  wow_level     public.wow_level not null default 'very ok',
  is_available  boolean not null default true,
  created_at    timestamptz not null default now(),

  -- No duplicate names within a category. The index behind this constraint starts with
  -- category_id, so it also covers lookups by category (Postgres doesn't index FK columns for you).
  unique (category_id, name)
);

-- Supabase exposes public tables through its API. RLS on + no policies = nobody gets in yet.
-- Phase 3 adds the "anyone can read the menu" policy.
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
