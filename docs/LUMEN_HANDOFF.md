# Lilica Current Handoff

Date: 10 September 2026
Branch: `master`
Remote: `origin` (`https://github.com/davidmaruta2/lilica`)

Despite its legacy filename, this is the canonical current handoff for every incoming agent.

## What Lilica Is

Lilica is a calm personal and family care organiser. An organiser keeps appointments, tasks, bills, home matters, documents, contacts, care information and updates separately for each person they support. It is not a clinical system, surveillance product, emergency monitor or generic family calendar.

Read `docs/PROJECT_BRIEF.md`, `AGENTS.md`, `docs/SUPABASE_OPERATIONS.md` and `docs/CORE_SYSTEM_CONTRACT.md` before implementation.

## Implemented Product State

The working app now includes:

- Protected three-slide Welcome / How Lilica Works introduction.
- Supabase email/password account creation and login.
- Six-digit signup verification with resend.
- Password recovery through Check your email, six-digit code entry and new-password screens.
- Required organiser `About you` profile, separate from supported people.
- Multi-person relationship selection, naming, review and first-person choice.
- One cloud care space, supported person and organiser membership per reviewed person.
- Separate device-local privacy, interests, records, attachments and setup status per care space.
- Active-person switching, add-person and resume-incomplete-setup flows.
- Eight real record categories with category lists, multiple stable record IDs and compact editors.
- Wheel-based date/time selection, local document upload/camera capture and real-record-only Home sections.

Phase 7 cloud records/sync, invitations, collaboration, cloud attachments and production infrastructure are not implemented.

## Current Flow

1. Welcome introduction.
2. Create account or Log in.
3. New account: enter email/password, then the six-digit email code.
4. New profile: enter organiser display name.
5. Select one or more people/relationships, name each person, review, then choose whom to set up first.
6. Complete that person's privacy declaration, interests and optional initial records.
7. Enter Home, switch people, resume another person's setup or add a person.
8. Recovery: request code, see Check your email, enter six-digit code, then choose a new password.

A logged-out fresh Expo Go session must land on Welcome. Authenticated storage is namespaced by Supabase user ID so one account cannot inherit another account's local care data. A restored token is checked against Supabase; a server-rejected deleted identity is cleared, while an ordinary network failure does not erase a cached session.

## Critical Layout Rules

- `react-native-safe-area-context` owns top/bottom insets. Welcome header content must remain below Android/iOS system status areas.
- Text-entry screens use `Screen`, whose content and footer share one scroll region. The CTA is never a fixed overlay over required fields.
- `KeyboardAwareScrollView` reveals a focused native input on focus and again after `keyboardDidShow`.
- Android keeps `softwareKeyboardLayoutMode: resize` and does not add a second `KeyboardAvoidingView` height reduction.
- iOS uses `KeyboardAvoidingView` padding. Both platforms use platform-appropriate keyboard dismissal.
- Record editors use the same focus-aware scrolling through `RecordSheet`.
- Do not replace this with hard-coded keyboard margins or device-specific offsets.

These rules cover Login, Create account, About You, names, signup/recovery code entry, recovery request/new password, item forms and record editing.

## Backend Boundary

Only `lilica-development` (`ldocquqbcabdbscghojc`) exists for Lilica. No production project exists or was touched.

Cloud-backed now:

- Supabase Auth account/session.
- `public.profiles` organiser identity.
- `care_spaces`, `supported_people` and `care_space_memberships`.
- Transactional/idempotent `bootstrap_supported_people(jsonb)` provisioning.

Device-local now:

- Privacy acknowledgement, interests, setup progress, records and attachment files/metadata.
- These are partitioned by authenticated user and care space and survive sign-out on that device.

Hosted development Auth uses mandatory confirmation, minimum eight-character passwords, custom Resend SMTP from `Lilica <auth@luxfordinteractive.com>`, and six-digit confirmation and recovery templates. Credentials are secret hosted configuration and must never enter Git or the mobile bundle.

Never run a blind full `supabase config push`; the base local config intentionally differs from remote operational settings. Use `config diff` and a narrowly scoped temporary config. Never use another Luxford project and never create/touch production without explicit approval.

## Validation Baseline

At this handoff:

- `npm run typecheck`: pass.
- Jest: 8 suites, 98 tests, all pass.
- Focused auth/responsive tests: 19 tests, all pass.
- `npx expo install --check`: dependencies up to date.
- `npx expo config --type public`: pass; Android keyboard mode is `resize`.
- `git diff --check`: clean apart from Windows line-ending notices.
- Phase 6 database baseline: local rebuild/lint and 49 profile/care-space pgTAP assertions passed when the migration was introduced.
- Expo Metro was listening on port `8081` at handoff; verify rather than assuming that process survives a later session.

Automated tests prove structure and code paths, not physical rendering. Device acceptance remains outstanding.

## Immediate Next Steps

1. Reload Expo Go and perform the exact short-height Android Login sequence in `docs/PHASE_5_QA.md`: Email -> Password with keyboard held open -> type -> reach Login -> dismiss keyboard.
2. Repeat keyboard checks on iPhone across Login, Create account, About You, code entry and password reset; verify no blank gap or double offset after dismissal.
3. Run a clean account walkthrough from Welcome using the reset development test address: signup, code, About You, multi-person setup and Home.
4. Run password recovery end to end and confirm the hosted email contains a six-digit code, not a link.
5. Complete `docs/PHASE_6_QA.md` for multi-person isolation and relaunch behavior.
6. Record device/build/results. Fix only observed regressions, then obtain product-owner approval before starting Phase 7.

## Protected And Deferred

Preserve Welcome, privacy gating/version/timestamp, organiser/supported-person separation, local account isolation, multi-person care-space separation, category/multi-record behavior, wheel selectors, record-sheet gestures and real-record-only Home.

Deferred: cloud records/sync, collaboration/invitations, cloud document storage, orphan attachment cleanup, OCR, notifications, production Ask Lilica, production infrastructure, backup guarantees and account/care-space deletion policy.
