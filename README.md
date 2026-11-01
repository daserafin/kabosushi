# 🍣 kabosushi

> such sushi. very delivery. wow.

A goofy, Comic Sans–powered sushi delivery site, built in honour of Kabosu, the original doge.
The website is just an excuse. The real goal is to **learn PostgreSQL and Supabase**.

## Stack

- **Database:** Supabase (hosted Postgres), with the schema managed as migration files in `supabase/migrations/`
- **Frontend:** Vite + React (later, in `web/`)
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

**Rule of wow:** every schema change goes through a migration file. Use the dashboard SQL editor to explore, not to change the schema.

## Learning roadmap

- [x] **Phase 0: Setup.** Supabase project, CLI linked, first migration pushed
- [x] **Phase 1: Data model.** Tables, data types, constraints, foreign keys, enums (the menu, so far; orders come later)
- [x] **Phase 2: Querying.** Seed data, joins, aggregates, views, CTEs, window functions (study notes in `queries/`)
- [ ] **Phase 3: Supabase layer.** Auth, Row Level Security, auto-generated API, Storage
- [ ] **Phase 4: Frontend.** Comic Sans menu, cart, checkout through a transactional RPC
- [ ] **Phase 5: Advanced.** Triggers, Realtime order tracking, indexes and `EXPLAIN ANALYZE`, Edge Functions
  - [ ] **Redo auth properly.** Phase 3 uses fake-email test users created in the dashboard. Replace that with real sign-up/sign-in flows, then tinker with external identity providers: OAuth (e.g. GitHub, Google) and SAML SSO
