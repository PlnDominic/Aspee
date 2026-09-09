# Legacy migrations — archived, do not run

Everything in this folder is **historical**: ad-hoc `.sql` scripts and their
`apply_*.js`/`run_*.js` Node runners that were used to change the live
database directly (via `DATABASE_URL` or the service-role key), outside of
Supabase's own migration tracking. They predate — and duplicated — the real
migration system this project now uses exclusively: **`supabase/migrations/`**.

## Why this folder exists

Before this cleanup, the repo had two parallel ways to change the schema:

1. `supabase/migrations/*.sql` — the real Supabase CLI migration history,
   timestamped and tracked by Supabase itself.
2. Root-level `*.sql` files paired with `apply_*.js`/`run_*.js` scripts that
   connected to the database directly and ran arbitrary SQL, with no
   tracking at all. Some of these (`DATABASE_FIX.sql`,
   `CONSOLIDATED_DATABASE_FIX.sql`, `complete_financial_setup.sql`,
   `fix_production_policies.sql`, `fix_production_schema.sql`,
   `migration_fix_all_rls_policies.sql` — kept here with a `.DEPRECATED`
   suffix and a warning header) granted every authenticated user full
   CRUD on ~45 core tables, which is what `supabase/migrations/
   20260909000000_role_based_rls_policies.sql` and its follow-ups exist to
   fix. Having a second, untracked system made it possible for that kind
   of change to slip in and made it easy to accidentally re-run something
   that had already shipped.

## Rules for this folder

- **Never run anything in here again.** Everything in this folder has
  already been applied to the live database. Several of these scripts are
  not idempotent (seed scripts like `seed_raw_materials.sql` /
  `seed_finished_goods.js` would insert duplicate rows; some `ALTER TABLE`
  statements aren't guarded with `IF NOT EXISTS`), and the six
  `.DEPRECATED` ones are actively dangerous — they reopen tables that are
  now correctly locked down.
- **Never add a new file here.** This folder is closed — it's a historical
  record, not an active migration path.
- **All schema changes from now on go in `supabase/migrations/`** as a new
  timestamped `*.sql` file (`YYYYMMDDHHMMSS_description.sql`), applied via
  the Supabase CLI (`supabase db push`) or pasted into the Supabase
  dashboard's SQL editor. That folder is the single source of truth for
  what the schema looks like and how it got there.
- These files were **not** renumbered into `supabase/migrations/` and
  replayed there. Without direct access to the live database to confirm
  exactly what's already applied and which scripts are safe to run twice,
  doing that mechanically would risk re-running non-idempotent seed/ALTER
  statements against a database that already has their effects — a real
  risk of duplicate data or a failed migration, not a hypothetical one.
  They're kept here, out of the way, for audit/history only.

## What's here

- `*.sql` — the historical ad-hoc migration scripts.
- `*.sql.DEPRECATED` — the six scripts that granted blanket table access;
  kept only as a record of what the vulnerability looked like.
- `apply_*.js`, `run_*.js`, `seed_finished_goods.js` — the Node runners that
  executed the `.sql` files (or, in a few cases, inline SQL) directly
  against the database using `DATABASE_URL`/the service-role key from
  `.env.local`.

Pure read-only debugging/inspection scripts (`check_*.js`, `inspect_*.js`,
`test_*.js`, `fetch_locations.js`, `screenshot_grn.js`) were left at the
repo root — they don't change the schema, so they're a separate cleanup
from this one if you want it done too.
