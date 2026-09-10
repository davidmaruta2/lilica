# Lilica Agent Instructions

This is the Lilica React Native care-organising app for Luxford Interactive. Work in this repository and read these files before changing code:

- `docs/PROJECT_BRIEF.md`
- `docs/LUMEN_HANDOFF.md` (canonical current handoff despite its legacy name)
- `docs/REVISION_LOG.md`
- `docs/SUPABASE_OPERATIONS.md` before any backend or authentication operation
- `docs/CORE_SYSTEM_CONTRACT.md` for approved architectural direction

## Current State

- Phase 5 authentication and Phase 6 multi-person ownership are implemented.
- Supabase provides email/password Auth, organiser profiles, supported people, care spaces and organiser memberships.
- Signup and password recovery use six-digit email OTPs. Recovery proceeds through Check your email, Enter your code and Choose a new password.
- Privacy, interests, records, attachments and setup progress remain device-local, partitioned by authenticated user and care space.
- Cloud record sync, invitations, collaboration and production infrastructure have not started.
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
- Do not add cloud records, AI, OCR, banking, monitoring, clinical features, invitations or permissions without explicit approval.
- All text-entry screens must use the shared keyboard-aware `Screen` or `RecordSheet` path. Do not add fixed CTAs that overlay fields or device-specific keyboard margins.
- Use `react-native-safe-area-context`; do not introduce a competing safe-area system.

## Validation And Handoff

Run `npm run validate` for app changes and `npm run validate:all` for database changes. Physical-device claims require actual device testing; automated layout tests are not physical proof.

The immediate next step is product-owner acceptance on Android and iOS for clean signup, recovery OTP/password reset, Welcome startup, safe areas and keyboard-open form behavior. Phase 7 must not begin until separately approved.
