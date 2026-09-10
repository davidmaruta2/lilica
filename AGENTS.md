# Lilica Agent Instructions

This is the Lilica React Native care-organising app for Luxford Interactive. Work in this repository and read these files before changing code:

- `docs/PROJECT_BRIEF.md`
- `docs/LUMEN_HANDOFF.md` (canonical current handoff despite its legacy name)
- `docs/REVISION_LOG.md`
- `docs/SUPABASE_OPERATIONS.md` before any backend or authentication operation
- `docs/CORE_SYSTEM_CONTRACT.md` for approved architectural direction

## Current State

- Phase 5 authentication, Phase 6 multi-person ownership and Phase 7 record persistence/cache/sync are implemented, validated and physically approved. Phase 8's core Record -> Occurrence engine is implemented and awaiting product-owner physical QA.
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
- Preserve the Phase 8 occurrence/recurrence/history and assignment-identity contracts. Do not add Phase 9+ assignment UI, AI, OCR, banking, monitoring, clinical features, invitations or permission UI without explicit approval.
- All text-entry screens must use the shared keyboard-aware `Screen` or `RecordSheet` path. Do not add fixed CTAs that overlay fields or device-specific keyboard margins.
- Use `react-native-safe-area-context`; do not introduce a competing safe-area system.

## Validation And Handoff

Run `npm run validate` for app changes and `npm run validate:all` for database changes. Physical-device claims require actual device testing; automated layout tests are not physical proof.

Phase 8 is implemented but uncommitted pending product-owner review and physical QA. Do not begin Phase 9.
