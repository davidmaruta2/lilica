# Lilica Agent Instructions

This is the Lilica React Native care-organising app for Luxford Interactive. Work in this repository and read these files before changing code:

- `docs/PROJECT_BRIEF.md`
- `docs/LUMEN_HANDOFF.md` (canonical current handoff despite its legacy name)
- `docs/REVISION_LOG.md`
- `docs/SUPABASE_OPERATIONS.md` before any backend or authentication operation
- `docs/CORE_SYSTEM_CONTRACT.md` for approved architectural direction

## Current State

- Phase 5 authentication, Phase 6 multi-person ownership, Phase 7 record persistence/cache/sync and Phase 8's core Record -> Occurrence engine are implemented, validated and physically approved (product-owner QA passed 10 September 2026).
- Phase 9 (everyday add/record management: a stable-identity Assigned-to control, and everyday-vs-onboarding copy for the already-existing category-gateway screen) is implemented and validated; physical-device QA is outstanding — see `docs/PHASE_9_QA.md`.
- Calendar (a month grid and day list projecting existing records, opening into the same established record editor) is implemented and validated; physical-device QA is outstanding — see `docs/PHASE_10_QA.md`. **Roadmap numbering note:** this work was implemented and committed under the working label "Phase 10", but the canonical roadmap in `docs/CORE_SYSTEM_CONTRACT.md` defines it as **Phase 11 — Calendar Projection** (Phase 10 there is Home Projection, effectively already delivered by the earlier Home redesign work). Historical commits and doc entries using "Phase 10" for Calendar are not rewritten; numbering resumes canonically from here.
- To Do (Phase 12 — actionable-work projection: open task/bill/home-or-car-matter records grouped into Overdue/Today/Upcoming, with Mine/Unassigned/All assignment filters on Phase 9's stable membership identity) is implemented and validated; physical-device QA is outstanding — see `docs/PHASE_12_QA.md`.
- Person (Phase 13 — durable-knowledge projection: contacts, care/health information, home information, documents and bills/renewals grouped from existing records, with no medical/legal inference) is implemented and validated; physical-device QA is outstanding — see `docs/PHASE_13_QA.md`. The tab previously showed `AccountScreen` under stale "person" copy it never delivered; `AccountScreen` is now reached from Person's own "Account" link. Do not begin Phase 14+ without its own separate, explicit, bounded implementation prompt.
- The self/someone-else onboarding fork (`Whose wellbeing are you looking to support with Lilica?`) is implemented and validated; physical-device QA is outstanding — see `docs/CARE_FORK_QA.md`.
- Supabase provides email/password Auth, organiser profiles, supported people, care spaces and organiser memberships.
- Signup and password recovery use six-digit email OTPs. Recovery proceeds through Check your email, Enter your code and Choose a new password.
- Privacy, interests, attachment bytes and setup progress remain device-local. Records now use a care-space cache/outbox and durable Supabase rows; attachment metadata only is cloud persisted.
- Stable assignment/contact entities exist as a server-side Phase 8 foundation only. Assignment UI, invitations, collaboration, granular permission management and production infrastructure have not started.
- The approved Welcome experience, safe-area correction and shared keyboard-aware form layout are protected behavior.

## Working Rules

- Keep Expo SDK 57 unless explicitly instructed otherwise.
- Preserve user changes and inspect `git status --short` before editing. Never reset cumulative work casually.
- Never expose or commit `.env.local`, `lilica-development.txt`, Supabase personal tokens, database passwords, service-role keys or SMTP credentials.
- Use only `lilica-development` (`ldocquqbcabdbscghojc`) for current hosted work. No Lilica production project exists.
- Never run a blind full `supabase config push`. Preview with `supabase config diff`, then apply only declared, reviewed properties from a narrowly scoped config.
- Preview database migrations with `npx supabase db push --linked --dry-run`; never run `supabase db reset --linked`.
- Keep organiser identity separate from supported-person identity and membership-relative relationships.
- Persist only real user-created records. Derived due/overdue state must remain deterministic.
- Preserve the Phase 8 occurrence/recurrence/history and assignment-identity contracts, and the Phase 9 Assigned-to control's Unassigned/You-only scope. Do not add Phase 11+ To Do projections, AI, OCR, banking, monitoring, clinical features, invitations or permission UI without explicit approval.
- All text-entry screens must use the shared keyboard-aware `Screen` or `RecordSheet` path. Do not add fixed CTAs that overlay fields or device-specific keyboard margins.
- Use `react-native-safe-area-context`; do not introduce a competing safe-area system.

## Validation And Handoff

Run `npm run validate` for app changes and `npm run validate:all` for database changes. Physical-device claims require actual device testing; automated layout tests are not physical proof.

Phase 8 is implemented, committed and physically approved. Phase 9, Calendar (canonical Phase 11, committed under the working label "Phase 10" — see the roadmap numbering note above) and Phase 12 (To Do) are implemented, validated and committed, awaiting physical QA. Phase 13 (Person) is implemented and validated, awaiting physical QA (`docs/PHASE_13_QA.md`) and product-owner commit approval. Do not begin Phase 14+ without its own separate, explicit, bounded implementation prompt.
