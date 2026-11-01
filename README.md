# 🍣 kabosushi

> such sushi. very delivery. wow.

A goofy, Comic Sans–powered sushi delivery site, built in honour of Kabosu, the original doge.
The website is just an excuse. The real goal is to **learn PostgreSQL and Supabase**.

## Stack

- **Database:** Supabase (hosted Postgres), with the schema managed as migration files in `supabase/migrations/`
- **Frontend:** Vite + plain JavaScript (no framework) and supabase-js, in `web/`
- **CLI:** Supabase CLI, installed as a dev dependency (run it with `npx supabase …`)

## Workflow

```bash
npm install                      # installs the Supabase CLI
npx supabase login               # one-time, opens the browser
npx supabase link --project-ref <ref>
npm run db:new -- <name>         # creates supabase/migrations/<timestamp>_<name>.sql
npm run db:push                  # applies new migrations to the cloud DB
npm run db:list                  # local vs remote migration status
npx supabase db push --linked --include-seed   # also load supabase/seed.sql (safe to re-run)
npx supabase db query --linked "select ..."    # run SQL against the cloud DB from the terminal
```

Website:

```bash
npm --prefix web install         # first time only
cp web/.env.example web/.env.local   # then fill in the project URL and publishable key
npm run web                      # dev server at http://localhost:5173
```

**Rule of wow:** every schema change goes through a migration file. Use the dashboard SQL editor to explore, not to change the schema.

## Learning roadmap

- [x] **Phase 0: Setup.** Supabase project, CLI linked, first migration pushed
- [x] **Phase 1: Data model.** Tables, data types, constraints, foreign keys, enums (the menu, so far; orders come later)
- [x] **Phase 2: Querying.** Seed data, joins, aggregates, views, CTEs, window functions (study notes in `queries/`)
- [x] **Phase 3: Supabase layer.** Auth, Row Level Security, auto-generated API, Storage (RLS tested by impersonating roles in SQL; real API calls come with the frontend)
- [ ] **Phase 4: Frontend.** Vite + plain JS, one HTML page per route
  - [x] Comic Sans menu, read from `menu_view` through the auto-generated API
  - [ ] Opening hours and location (Sakura, Chiba): time zones, an `is_open_now`-style RPC
  - [ ] Feedback form: anyone can send, nobody can read back (insert-only RLS)
  - [ ] Login for the test accounts, no sign-up yet, with a "good doggos only" banner
  - [ ] Cart (in the browser) and checkout through a transactional `place_order()` RPC
  - [ ] `/author`: a hidden easter-egg page (spinning 3D bun doge, synced to a song). Details to come
- [ ] **Phase 5: Advanced.** Triggers, Realtime order tracking, indexes and `EXPLAIN ANALYZE`, Edge Functions
  - [ ] **Redo auth properly.** Phase 3 uses fake-email test users created in the dashboard. Replace that with real sign-up/sign-in flows, then tinker with external identity providers: OAuth (e.g. GitHub, Google) and SAML SSO
  - [ ] **Explore platform features, including paid (Pro plan) ones.** Starting points (check the current pricing page to see which are paid):
    - Auth hardening: leaked password protection (flagged by `npx supabase db advisors`), MFA, password strength rules
    - Branching: a preview database for each PR
    - Backups and point-in-time recovery
    - Storage image transformations: resize menu photos when requested (e.g. `?width=300` thumbnails), so only full-size originals get uploaded
    - Custom domains, log drains, compute add-ons
