# Lilica Supabase Operations

Date: 10 September 2026
Scope: Phase 4 foundation through Phase 7 record persistence

## Environment Model

| Environment | Purpose | Location | Status |
|---|---|---|---|
| Local | Disposable migration, constraint, and RLS testing with synthetic data | Docker on a developer machine | Configured in `supabase/config.toml` |
| Development | Shared non-production integration environment | `lilica-development`, Luxford Interactive, West Europe (London), `micro` compute | Created and linked; profile/Phase 6 migrations applied; Phase 7 deployment recorded below |
| Production | Future live user data | Separate dedicated Lilica project, region and plan to be approved | Does not exist and was not created or touched |

A staging project is not justified yet. Add one only when release rehearsal needs an environment isolated from active development. Never reuse `goalbuddy`, `tandemly`, `waddl-production`, or another Luxford application's project.

The local link is stored under ignored `supabase/.temp/` metadata. It is not a production configuration and must never be copied into application code.

## Current Schema

The current schema contains `public.profiles`:

- `id`: primary key and foreign key to `auth.users.id`; this is the durable account/profile link.
- `display_name`: required, trimmed nonblank value with a 100-character database limit.
- `avatar_path`: optional private object path placeholder for Phase 5; it is not a public URL and no storage bucket exists yet.
- `created_at` and `updated_at`: server timestamps; updates preserve creation time and refresh update time.

Phase 6 adds:

- `care_spaces`: one security/ownership boundary for one supported person; bootstrap owner/id columns provide idempotency metadata and do not grant access.
- `supported_people`: one required, nonblank display-name identity per care space.
- `care_space_memberships`: joins an Auth user to a care space with the current `organiser` role and a membership-relative relationship type/optional custom label.

`bootstrap_supported_people(jsonb)` creates a reviewed roster transactionally. Stable draft UUIDs make retries return the same space/person/membership triplets. Direct membership writes are not granted to the client. `list_my_supported_people()` resolves the caller's existing cloud links. No trigger automatically creates a profile.

Phase 7 adds `records` and `record_mutation_receipts`. Record writes use the idempotent `apply_record_mutation(...)` RPC; direct application writes are not granted. Record domain/sensitivity, audit membership, source, version and change sequence are server-managed. `list_my_supported_people()` now returns the active member's supported-person display/relationship data so a new device can rediscover spaces without inventing local privacy consent.

Phase 8 adds cloud `occurrences`, immutable occurrence snapshots, recurrence series/rules, mutation receipts, assignments and external contacts. Assignment/contact tables are foundations only and grant no account access. Invitations, documents and attachment bytes are not cloud tables; records include attachment metadata without local device URI.

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

### Hosted Phase 7 deployment - 10 September 2026

- `npx supabase db push --linked --dry-run` listed only `20260910150000_phase7_records.sql`.
- `npx supabase db push --linked` applied that migration to `lilica-development`; no production project, Auth setting, Storage resource, seed or role configuration was touched.
- Local and linked database suites each passed all 89 pgTAP assertions across three files.
- Linked database lint reported no schema errors, and migration history lists `20260910150000` on both local and remote.
- Existing profile/care-space tests scope row counts to their transactional synthetic fixture IDs so hosted development rows do not affect assertions. Test transactions roll back their synthetic data.

### Hosted Phase 8 deployment - 10 September 2026

- `npx supabase db push --linked --dry-run` listed only `20260910170000_phase8_occurrence_engine.sql`, with no seeds or roles.
- `npx supabase db push --linked` applied that migration only to `lilica-development`.
- Local and linked suites each passed 152 pgTAP assertions across five files; warning-level database lint returned no issues in either environment.
- Local and linked migration histories match through `20260910170000`. No Auth configuration, Storage resource, seed, role or production project was changed.

## RLS And Grants

RLS is enabled and forced on `public.profiles`. Table privileges and policies are deliberately separate:

- `anon` has no table privileges.
- `authenticated` has only `SELECT`, `INSERT`, and `UPDATE` privileges.
- An authenticated account can select, insert, and update only the row whose `id` equals `auth.uid()`.
- There is no delete grant or delete policy. Profile/account deletion belongs to the later approved account-lifecycle phase.
- Changing a profile's ownership identifier fails the update policy.

`supabase/tests/database/profiles_rls.test.sql` retains 17 profile assertions. `care_spaces_rls.test.sql` adds 32 transactional assertions for multi-space access, cross-user and anonymous denial, duplicate relationships, membership-write denial, immutable identity and retry idempotency. Application users receive read access only through membership policies; initial writes occur only through the authenticated bootstrap RPC.

`records_rls.test.sql` adds 40 assertions for anonymous/cross-user denial, active-organiser access, server classification, protected ownership/audit fields, stable mutation receipts, compatible stale-field merge, incompatible conflict preservation, tombstones and immediate revoked-membership denial. Authenticated clients receive record `SELECT` only; all mutations go through the RPC.

## Authentication Runtime

Phase 5 uses Supabase email/password authentication with mandatory email confirmation. Signup email uses a six-digit OTP rendered by `supabase/templates/confirmation.html`; password recovery uses a six-digit OTP rendered by `supabase/templates/recovery.html`. The app verifies the applicable `signup` or `recovery` OTP with Supabase before continuing. Hosted development auth accepts `lilica://auth/callback` and `lilica://auth/recovery` for compatibility and requires passwords of at least eight characters. The React Native client persists and refreshes the session through AsyncStorage and loads the authenticated account's own `public.profiles` row.

Development authentication email is delivered through Resend custom SMTP from `Lilica <auth@luxfordinteractive.com>`. The `luxfordinteractive.com` Resend domain was verified in `eu-west-1` before activation. The SMTP credential is held only in Supabase Auth secret configuration; it is not in Git or the mobile bundle.

The current OTP signup/recovery flows can be exercised in Expo Go. The `lilica` scheme still requires a development or standalone build if legacy callback compatibility is tested.

Hosted configuration warning: the base `supabase/config.toml` contains local/default values that differ from intentional hosted SMTP, MFA, pooler and storage settings. Never run a blind full `supabase config push`. Run `npx supabase config diff --project-ref ldocquqbcabdbscghojc`, inspect every declared change, and apply only approved properties through a narrowly scoped temporary config. On 10 September 2026 the recovery subject/body alone were pushed this way; 19 remote-only properties were left unchanged.

Profile photos remain deferred: `avatar_path` is reserved, but no storage bucket or upload policy is introduced. Supported-person identity and records are cloud-backed; privacy, interests, setup progress and attachment bytes remain local per care space.

## Configuration And Secrets

`.env.example` documents the public runtime values. Developers place the development project URL and publishable key in ignored `.env.local`.

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

- Organiser avatar storage.
- Assignment UI/lifecycle workflows, invitations, collaboration/member management, documents/cloud attachment bytes, Calendar and To Do projections.
- Production project creation, deployment automation, backup guarantees, and disaster recovery.

Email/password Auth, mandatory confirmation, OTP templates, redirect URLs, the eight-character minimum and development SMTP are implemented decisions. Any provider expansion or production Auth configuration still requires explicit review and approval.
