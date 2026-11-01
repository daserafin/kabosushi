-- Phase 3: the menu is public and read-only.
-- Access in Supabase has two layers, and a request must pass both:
--   1. GRANTs: may this role touch the table at all, and with which commands?
--   2. RLS policies: which rows may it see or change?

-- Layer 1. Supabase's default grants give anon and authenticated every command on public
-- tables, so RLS was the only thing blocking writes. Nobody edits the menu from the browser,
-- so cut the grants down to SELECT. Even a bad policy can't allow a write now.
revoke all on table public.categories, public.menu_items, public.menu_view from anon, authenticated;
grant select on table public.categories, public.menu_items, public.menu_view to anon, authenticated;

-- Layer 2. Everyone may read every menu row, sold-out items included (the site badges them).
-- USING (true) means "no row filter": the policy exists only to open the door RLS closed.
create policy "Menu categories are readable by everyone"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "Menu items are readable by everyone"
  on public.menu_items for select
  to anon, authenticated
  using (true);
