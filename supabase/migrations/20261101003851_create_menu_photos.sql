-- Phase 3: food photos in Supabase Storage.
-- Storage keeps files in buckets. The files themselves live outside Postgres, but every bucket
-- is a row in storage.buckets and every file a row in storage.objects, so access to files is
-- controlled with the same tools as tables: grants and RLS policies on storage.objects.

-- A public bucket: anyone can download a file if they know its URL
--   https://<project>.supabase.co/storage/v1/object/public/menu-photos/<path>
-- That fits a menu. Public only covers downloads: listing, uploading, replacing and deleting
-- still go through RLS on storage.objects, and we add no policies for anon or authenticated,
-- so only the dashboard and the CLI (which use admin access) can manage photos.
-- The bucket also rejects anything that isn't a small image, before it's stored.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-photos',
  'menu-photos',
  true,
  2 * 1024 * 1024,                                  -- 2 MB per file
  array['image/png', 'image/jpeg', 'image/webp']
);

-- Each item stores the file's path inside the bucket, not a full URL, so the project URL
-- or a CDN can change without rewriting data. supabase-js turns a path into a URL with
-- storage.from('menu-photos').getPublicUrl(path).
-- Until real photos exist, every item shows the doge bread bun. Adding a column with a
-- default fills it in for all existing rows at once, without rewriting the table.
alter table public.menu_items
  add column photo_path text not null default 'placeholders/doge-bun.png';

-- Expose the new column through the view. CREATE OR REPLACE VIEW can only add columns at
-- the end, and it replaces the view's options too, so security_invoker must be repeated.
create or replace view public.menu_view
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
  row_number() over (
    partition by i.category_id
    order by i.is_available desc, i.wow_level desc, i.price_cents
  ) = 1         as is_top_pick,
  i.photo_path
from public.menu_items i
join public.categories c on c.id = i.category_id;
