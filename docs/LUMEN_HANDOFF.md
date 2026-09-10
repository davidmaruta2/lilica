# Lilica Current Handoff

Date: 10 September 2026
Branch: `master`
Remote: `origin` (`https://github.com/davidmaruta2/lilica`)

Despite its legacy filename, this is the canonical current handoff for every incoming agent.

## What Lilica Is

Lilica is a calm personal and family care organiser. An organiser keeps appointments, tasks, bills, home or car matters, documents, contacts, care information and updates separately for each person they support. It is not a clinical system, surveillance product, emergency monitor or generic family calendar.

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
- Separate device-local privacy, interests, attachment bytes and setup status per care space.
- Care-space-scoped Supabase records with a durable local cache, semantic outbox, safe migration and server-enforced RLS.
- Active-person switching, add-person and resume-incomplete-setup flows.
- Eight real record categories with category lists, multiple stable record IDs and compact editors.
- Wheel-based date/time selection, local document upload/camera capture and real-record-only Home sections.

Phase 7 record persistence, cache, sync and safe migration are implemented, validated and physically approved. Assignments, invitations, collaboration, cloud attachment bytes and production infrastructure are not implemented.

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
- `KeyboardAwareScrollView` reveals a focused native input by measuring the field and the ScrollView's own current on-screen rect together, in the same window coordinate space, via chained `UIManager.measureInWindow` calls (on focus, again after `keyboardDidShow`, and once more shortly after to catch a still-animating keyboard). It also pulls the screen's footer/CTA into the same visible region alongside the focused field whenever there is room for both, without ever scrolling the field itself off-screen to do so.
- `app.json` declares `android.softwareKeyboardLayoutMode: resize`, but that native config only applies in a custom dev client or a standalone/production build — Expo Go's own host app has a fixed native manifest and never honours it, so the window never actually resizes there. `keyboardAvoidingBehavior()` in `src/keyboard.ts` detects Expo Go via `expo-constants`'s `executionEnvironment` and gives Android the same JS-driven `KeyboardAvoidingView` behaviour (`'height'`) iOS already uses, only inside Expo Go; a real dev-client/standalone build keeps Android's behaviour `undefined` so the native resize isn't double-compensated.
- iOS uses `KeyboardAvoidingView` padding. Both platforms use platform-appropriate keyboard dismissal.
- Record editors use the same focus-aware scrolling through `RecordSheet`.
- Do not replace this with hard-coded keyboard margins or device-specific offsets.

These rules cover Login, Create account, About You, names, signup/recovery code entry, recovery request/new password, item forms and record editing. Confirmed on physical Android and iOS devices in Expo Go on 10 September 2026: focused field and footer CTA both become visible without a manual scroll, and Android now visibly resizes/pads as the keyboard opens instead of staying static.

## Backend Boundary

Only `lilica-development` (`ldocquqbcabdbscghojc`) exists for Lilica. No production project exists or was touched.

Cloud-backed now:

- Supabase Auth account/session.
- `public.profiles` organiser identity.
- `care_spaces`, `supported_people` and `care_space_memberships`.
- Transactional/idempotent `bootstrap_supported_people(jsonb)` provisioning.
- `records` plus idempotent `record_mutation_receipts`, server-generated domain/sensitivity metadata and version/change sequencing.
- `apply_record_mutation(...)` for membership-checked create/import/update/tombstone operations.

Device-local now:

- Privacy acknowledgement, interests, setup progress, record cache/outbox/conflicts and attachment files/full local references.
- These are partitioned by authenticated user and care space and survive sign-out on that device.

Read `docs/PHASE_7_ARCHITECTURE.md` for identity, migration, cache, retry, conflict and attachment rules. The only current record participant is an active organiser. Phase 15 grants remain future work.

Hosted development Auth uses mandatory confirmation, minimum eight-character passwords, custom Resend SMTP from `Lilica <auth@luxfordinteractive.com>`, and six-digit confirmation and recovery templates. Credentials are secret hosted configuration and must never enter Git or the mobile bundle.

Never run a blind full `supabase config push`; the base local config intentionally differs from remote operational settings. Use `config diff` and a narrowly scoped temporary config. Never use another Luxford project and never create/touch production without explicit approval.

## Validation Baseline

The Phase 7 implementation passed:

- `npm run validate:all`: TypeScript, 11 Jest suites/123 tests, secret scanning, Expo dependency/config checks, Android `resize` config and web export.
- Clean local database rebuild, 89 pgTAP assertions and database lint with no errors.
- Linked `lilica-development` deployment of migration `20260910150000_phase7_records.sql` after an exact one-migration dry run.
- Linked database tests: all 89 pgTAP assertions pass; linked database lint reports no schema errors; local and remote migration histories match.

The product owner completed and approved the Phase 7 physical-device checklist on Android and iOS on 10 September 2026.

Automated tests prove structure and code paths, not physical rendering.

Known test-harness note: the passing responsive suite can emit a React `VirtualizedList` update-not-wrapped-in-`act(...)` warning. It is not a Phase 7 failure and was not changed in this phase.

### Keyboard-avoidance corrective task (10 September 2026)

Physical-device testing found Password/the CTA still hidden behind the keyboard on both platforms after the original Phase 5 layout correction. Root-caused and fixed in two layers — see `docs/REVISION_LOG.md` for the full writeup — and confirmed working on physical Android and iOS devices in Expo Go by the product owner. This is now part of the protected baseline, not outstanding work.

## Immediate Next Steps

On 10 September 2026, the product owner confirmed the corrected keyboard behavior and the password, verification-code, check-email and password-reset paths working on physical devices.

Phase 7 is complete. Preserve its record ownership, migration, cache, outbox, conflict and RLS contracts. Do not begin Phase 8 without its own explicit approval and bounded implementation prompt.

## Approved Future Assignment Boundary

The current `responsiblePerson?: string` field remains intentionally unchanged until the cloud record/assignment model exists. Do not replace it with a cosmetic care-circle selector.

The authoritative sequence is:

1. Phase 7 preserves legacy responsibility text and provenance exactly, creates no assignment by name/email matching, and gives cloud records stable care-space identity. This is implemented and approved.
2. Phase 8 introduces first-class assignment entities, stable membership/external-contact targets, record defaults, occurrence overrides, snapshots and immutable activity.
3. Phase 9 replaces new arbitrary responsibility text with a data-driven assignment control; keep it restrained while only Unassigned/You exist.
4. Phase 12 projects Assigned to me, Assigned to others and Unassigned using stable membership IDs.
5. Phase 15 supplies invitations, active care-circle members, role/capability/domain permissions, selector population and immediate revocation behavior.

Responsibility never grants visibility. Permission is enforced independently by server-side RLS/capability/domain checks. Pending or inactive memberships are not assignable; external contacts have zero application access. See sections 8, 11, 12, 17 and 18.6 of `docs/CORE_SYSTEM_CONTRACT.md`.

## Protected And Deferred

Preserve Welcome, privacy gating/version/timestamp, organiser/supported-person separation, local account isolation, multi-person care-space separation, category/multi-record behavior, wheel selectors, record-sheet gestures and real-record-only Home.

Deferred: Phase 8 record/occurrence semantics and assignments, collaboration/invitations, cloud document storage, orphan attachment cleanup, OCR, notifications, production Ask Lilica, production infrastructure, backup guarantees and account/care-space deletion policy.
