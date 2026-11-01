-- Phase 4: the feedback form. Doges send feedback or ask for new foodo.
-- A write-only drop box: anyone may put a note in, nobody can read notes back through the
-- API. The shop reads them in the dashboard (which connects as an admin and skips RLS).

create type public.feedback_kind as enum ('feedback', 'food request');

create table public.feedback (
  id          bigint generated always as identity primary key,
  kind        public.feedback_kind not null default 'feedback',
  -- Optional signature. No email field on purpose: don't collect personal data you don't need.
  name        text check (char_length(name) <= 60),
  -- The API is public, so the database is the last line of defence against junk:
  -- no empty messages, no 10 MB essays. trim() so "   " doesn't count as a message.
  message     text not null check (char_length(trim(message)) between 3 and 1000),
  -- Filled in automatically for logged-in customers, empty for anonymous visitors.
  user_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Deleting a profile sets user_id to null here, which means finding that profile's rows.
create index feedback_user_id_idx on public.feedback (user_id);

alter table public.feedback enable row level security;

-- Layer 1: INSERT on three columns, and nothing else. No SELECT grant at all, so even a
-- policy mistake can't leak other people's messages. user_id isn't insertable: it can only
-- come from the default.
revoke all on table public.feedback from anon, authenticated;
grant insert (kind, name, message) on table public.feedback to anon, authenticated;

-- Layer 2: an INSERT-only policy. There are no SELECT/UPDATE/DELETE policies, so those stay
-- closed even if someone adds a grant later.
-- "is not distinct from" is equality that treats two NULLs as equal:
--   anonymous visitor: user_id null, auth.uid() null → allowed
--   logged-in customer: user_id = their id           → allowed
create policy "Anyone can send feedback"
  on public.feedback for insert
  to anon, authenticated
  with check (user_id is not distinct from (select auth.uid()));
