-- The placeholder photo is now the salmon-nigiri doge bun, a WebP. The file itself was
-- uploaded to Storage separately (files aren't migrations):
--   npx supabase storage cp web/public/doge-bun.webp \
--     ss:///menu-photos/placeholders/doge-bun.webp --content-type image/webp --experimental --linked
-- This migration only points the menu at it.

-- New items get the new placeholder...
alter table public.menu_items
  alter column photo_path set default 'placeholders/doge-bun.webp';

-- ...and existing items still on the old one switch over. Changing a column default never
-- touches existing rows: the default is only used when an insert leaves the column out.
-- Items with a real photo keep it.
update public.menu_items
set photo_path = 'placeholders/doge-bun.webp'
where photo_path = 'placeholders/doge-bun.png';
