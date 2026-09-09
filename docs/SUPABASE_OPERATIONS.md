# Lilica Supabase Operations

Date: 9 September 2026
Scope: Phase 4 environment and security foundation

## Environment Model

| Environment | Purpose | Location | Status |
|---|---|---|---|
| Local | Disposable migration, constraint, and RLS testing with synthetic data | Docker on a developer machine | Configured in `supabase/config.toml` |
| Development | Shared non-production integration environment | `lilica-development`, Luxford Interactive, West Europe (London), `micro` compute | Created and linked; profile migration applied |
| Production | Future live user data | Separate dedicated Lilica project, region and plan to be approved | Does not exist and was not created or touched |

A staging project is not justified yet. Add one only when release rehearsal needs an environment isolated from active development. Never reuse `goalbuddy`, `tandemly`, `waddl-production`, or another Luxford application's project.

The local link is stored under ignored `supabase/.temp/` metadata. It is not a production configuration and must never be copied into application code.

## Current Schema

Phase 4 introduces only `public.profiles`:

- `id`: primary key and foreign key to `auth.users.id`; this is the durable account/profile link.
- `display_name`: required, trimmed nonblank value with a 100-character database limit.
- `avatar_path`: optional private object path placeholder for Phase 5; it is not a public URL and no storage bucket exists yet.
- `created_at` and `updated_at`: server timestamps; updates preserve creation time and refresh update time.

An Auth account and a Lilica profile remain separate concepts. There are no supported-person, care-space, membership, record, occurrence, document, invitation, or sync tables. No trigger automatically creates a profile, and no Phase 1 data is uploaded.

## Migration Workflow

Docker Desktop must be running for local database commands.

```bash
npm run db:start
npm run db:reset
npm run db:test
npm run db:lint
```

`npm run validate:backend` runs the secret scan, starts the local database, recreates it from migrations, runs pgTAP policy tests, and lints the schema. `npm run validate:all` runs both the application and backend gates.

Create every schema change as a migration:

```bash
npx supabase migration new descriptive_name
npm run validate:backend
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Review every dry run. Dashboard-only schema changes are prohibited because they create drift. `supabase db reset` without `--linked` targets local development. Never run `supabase db reset --linked`; it is destructive to the hosted project.

The migration in `supabase/migrations/` is authoritative schema history. `supabase/seed.sql` deliberately contains no shared users or profile data.

## RLS And Grants

RLS is enabled and forced on `public.profiles`. Table privileges and policies are deliberately separate:

- `anon` has no table privileges.
- `authenticated` has only `SELECT`, `INSERT`, and `UPDATE` privileges.
- An authenticated account can select, insert, and update only the row whose `id` equals `auth.uid()`.
- There is no delete grant or delete policy. Profile/account deletion belongs to the later approved account-lifecycle phase.
- Changing a profile's ownership identifier fails the update policy.

`supabase/tests/database/profiles_rls.test.sql` runs 17 positive and negative assertions transactionally. It covers anonymous denial, owner read/create/update, non-owner read/write denial, ownership mutation, delete denial, constraints, policy count, and denied-write integrity. Tests run locally in CI without cloud credentials. The same suite was also run successfully against `lilica-development`; all synthetic rows rolled back.

## Configuration And Secrets

Phase 4 does not add a Supabase runtime client. `.env.example` contains placeholders only for future public client configuration.

Safe for a future mobile bundle:

- Project URL.
- Supabase publishable key, or legacy anonymous key where required.

Never place in the app bundle, an `EXPO_PUBLIC_*` variable, Git, tests, logs, or documentation:

- Personal access tokens.
- Database passwords or connection strings containing passwords.
- Secret/service-role keys.
- JWT signing secrets.
- OAuth provider client secrets.

Personal CLI login is stored by Supabase outside the repository. Link metadata is ignored. `.env` variants are ignored except `.env.example`. `npm run secrets:check` scans tracked and unignored files for common Supabase/Postgres credential forms without printing matched values.

If a credential is exposed, revoke or rotate it immediately before continuing. Service-role credentials bypass RLS and may only be used by trusted server-side operations introduced in a separately approved phase.

## Access Boundaries

- Application user: presents a verified Supabase Auth JWT and is constrained by table grants plus RLS.
- Authenticated database request: receives only the profile row allowed by `auth.uid()`; UI filtering is not a security boundary.
- Privileged service operation: may bypass RLS and must remain in trusted server infrastructure, never React Native.
- Dashboard/operator: can inspect or alter infrastructure according to Luxford Interactive account permissions and is outside application RLS.

Keep Supabase organisation membership limited to people who need operational access. Phase 4 does not invent a larger operator process or claim that RLS constrains dashboard administrators.

## Reset, Backup, And Recovery

Local data is disposable and synthetic. Recover local schema with `npm run db:reset`; this drops the local database and replays committed migrations and seed files. Test destructive migrations locally first, then against a disposable future staging environment if production rehearsal warrants one.

The development project's actual backup retention and restore capabilities have not been verified against the organisation's Supabase plan. Do not claim point-in-time recovery or a retention period. Before any production project or user data is introduced, the product owner must confirm the selected plan, backup schedule, restore procedure, recovery objectives, data location, and a tested restore rehearsal.

Migrations recover schema, not user data. They are necessary reproducible history but are not a database backup.

## Deliberately Deferred

- Supabase Auth UI, verification, recovery, and session navigation.
- Runtime Supabase client and real environment values.
- Organiser profile screens and avatar storage.
- Supported people, care spaces, memberships, invitations, records, documents, and sync.
- Production project creation, deployment automation, backup guarantees, and disaster recovery.

The hosted project's default authentication settings were not treated as a Phase 5 decision. Auth methods, email confirmation, redirect URLs, password rules, and provider secrets must be reviewed explicitly before authentication is implemented.
