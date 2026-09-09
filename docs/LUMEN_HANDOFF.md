# Lilica Current Handoff

## Read This First

Work in:

`C:\Users\DavidPC\Downloads\DAVID\Lilica\lilica-app`

Read `docs/PROJECT_BRIEF.md` for the canonical product and technical state. The older handoff described the whole visual direction as rejected; that is no longer current. The product owner now considers the Welcome screens a good foundation and specifically asked that Lumen's work not be undone.

The active design and product edge begins after `What do you help [Name] with?`, at the structured-record onboarding screen.

Despite its legacy filename, this is the canonical session handoff for any incoming agent, not instructions specifically for Lumen.

## Session Summary

This session picked up after Lumen's Welcome and interest-screen work. The product owner gave three important directions:

1. The Welcome screens now look good enough and must not be undone.
2. The old `What would help today?` step should become a meaningful structured-record entry experience, not another questionnaire.
3. The organiser account/profile and future care-circle identity problem is real, but the product owner explicitly paused that work. It was discussed and documented only; no profile implementation was made.

The first record implementation used an expanding form inside each vertical card. Physical-device screenshots showed oversized fields, clipping behind the footer/keyboard and an awkward relationship between the form and stack. The editor was therefore moved into a bottom sheet. Follow-up feedback identified missing document upload/camera actions and unreliable swipe-down dismissal; both were addressed in code during this session.

The current change set is intended to be committed as one coherent checkpoint covering Lumen's interest-carousel work, structured records, Home grouping, bottom-sheet editing, document capture, dependencies and documentation.

## Current Flow

1. Three-slide Welcome / How Lilica Works introduction
2. Create-account method choice
3. Focused email screen when email is chosen
4. Relationship to supported person
5. Supported person's preferred name
6. Privacy declaration
7. Horizontal interest-selection carousel
8. `Let's get [Name] organised` vertical record stack
9. Home after one real item, or a permitted skip

Onboarding state is persisted in AsyncStorage. Completed onboarding resumes at Home. Legacy `firstItem` state is migrated into the current records array.

## Recent Product Change

The previous `What would help today?` screen was conceptually repetitive because the user had already selected their areas of help. It is now the transition from onboarding into real product value.

`FirstThingScreen` presents eight real record entry points in an interest-prioritised vertical snapping stack:

- Appointment
- Something to do
- Bill or renewal
- Home matter
- Important document
- Contact
- Care information
- Update

The categories are never hidden. The focused card is more prominent, adjacent cards remain visible, and saved cards display an Added/Edit state.

## Editor Interaction

Record forms no longer expand inside the carousel card. They open in `RecordSheet`, an animated bottom sheet with compact inputs.

Dismissal paths:

- Tap Done
- Tap the backdrop
- Use the platform back action
- Swipe downward while the form is scrolled to the top

The pan responder is attached to the whole sheet so the user is not required to catch a narrow handle. Form scrolling retains priority when content is below the top.

Draft state belongs to `FirstThingScreen`, not the sheet. Closing and reopening a category during that mounted session restores its unsaved text and attachments. Unsaved drafts do not survive an app restart.

Saving persists a `LilicaRecord`, closes the sheet, marks the category Added, and moves focus naturally toward the next category.

The onboarding stack currently edits the first saved record matching each category. It does not yet offer a multi-record list within one category, although the underlying `records` array can hold multiple records. Future work should make that product decision explicitly rather than assuming the onboarding editor is a complete record manager.

## Record And Home Logic

`src/types.ts` defines the shared record, recurrence, confirmation and attachment shapes. `src/records.ts` owns UK date parsing/display and deterministic derived state:

- Due today
- Overdue
- Upcoming
- Completed
- Unresolved
- Recently updated
- Next date after a completed recurring item

`HomeScreen` groups real records into Needs attention, Today, Coming up and Latest. Empty sections are omitted. No fake records are generated.

## Document Attachments

The Important document form now includes:

- Upload file through `expo-document-picker`
- Scan with camera through `expo-image-picker`
- Multiple attachment rows with removal actions
- Automatic title suggestion from the first filename when title is blank

On native platforms, picker/camera output is copied into `Paths.document/attachments` with `expo-file-system` before being added to the draft. The saved record stores attachment metadata and the durable local URI.

Current limits:

- Camera scan is a photograph, not an edge-detected document scan.
- No crop, PDF assembly, OCR or text extraction exists.
- No backend upload or cross-device file synchronisation exists.
- Removed attachments are removed from draft/record metadata but local orphan-file cleanup is not implemented yet.
- Physical-device camera, permission and swipe behaviour still require manual QA.

## Authentication And Care Circle Gap

The account screens are demonstrative only. Email entry by itself is not authentication. No email verification, password, one-time code, Apple OAuth or Google OAuth is implemented.

The current flow also captures only the supported person's preferred name. It does not create the organiser's own user profile. That makes a future care circle ambiguous because members would lack stable display identity and permissions.

Before collaboration work, add separate models for:

- Authenticated account
- Organiser/user profile
- Supported-person profile
- Care-circle membership, invitation, role and permissions

Recommended product sequence: authenticate and verify, collect a minimal `About you` profile, then ask who the user supports. Profile photo should be optional. Date of birth should remain optional and should only be collected for a justified product requirement.

This is deliberately documented and deferred. Do not quietly bolt care-circle fields onto the supported-person model.

No password, date-of-birth, organiser name or profile-photo fields were added. The advice was to collect the organiser's name, make their photo optional, avoid DOB unless justified, and use either verified password authentication or passwordless email verification for email accounts.

## Files Central To Current Work

- `App.tsx`: onboarding state transitions and record persistence wiring
- `src/screens/InterestsScreen.tsx`: horizontal selectable carousel
- `src/screens/FirstThingScreen.tsx`: vertical snapping record stack and draft ownership
- `src/components/RecordSheet.tsx`: modal animation and dismissal gestures
- `src/components/RecordEditor.tsx`: per-category compact fields, save mapping and attachments
- `src/components/TextField.tsx`: standard and compact input sizing
- `src/screens/HomeScreen.tsx`: real-record grouping
- `src/records.ts`: deterministic record calculations
- `src/storage.ts`: persistence and legacy migration
- `src/types.ts`: current data contracts
- `app.json`: document-picker and camera permission configuration
- `supabase/migrations`: authoritative backend schema history
- `supabase/tests/database`: transactional database and RLS policy tests
- `docs/SUPABASE_OPERATIONS.md`: environment, secrets, migration and recovery runbook

## Phase 4 Backend Foundation

The repository is linked locally to the dedicated non-production `lilica-development` Supabase project under Luxford Interactive. Link metadata and personal CLI authentication remain outside Git. No production Lilica project exists.

Phase 4 adds only the auth-linked `public.profiles` table. It has a required display name, optional private avatar path, server timestamps, explicit grants and owner-only RLS. There is no runtime Supabase client and the app still uses its unchanged local placeholder account flow and AsyncStorage data. Run `npm run validate:backend` with Docker Desktop running and read `docs/SUPABASE_OPERATIONS.md` before backend work.

## Preserve

- Lumen's Welcome and account-choice presentation
- Privacy declaration gate, version and timestamp
- Skip paths
- Supported-person name personalisation
- Interest-based ordering without category removal
- Real-record-only Home behaviour
- Expo SDK 57 compatibility

## Deliberately Deferred

- Production authentication and account recovery
- Organiser profile and care-circle membership
- Runtime backend integration, cloud records and multi-device sync
- Cloud document storage
- OCR and advanced scanning
- Notifications and reminders
- Production Ask Lilica/AI
- Full Calendar, To Do and Person tabs
- Complex permissions, payments and provider integrations

## Verification Status

At this handoff:

- `npm run typecheck` passes.
- `npx expo config --type public` resolves the native picker configuration.
- `npx expo export --platform web` passes.
- The local preview responds at `http://localhost:8084`.
- A Phase 3 Jest/`jest-expo` and React Native Testing Library safety harness now exists; run `npm run validate`.
- Historical migration fixtures live in `tests/fixtures/migration`.
- The approved future rules are executable in the unwired `src/domain` module; do not import it into production before the relevant approved phase.
- Final physical-device gesture, keyboard, picker and camera QA remains manual; follow `docs/PHASE_3_QA_BASELINE.md`.
- The Phase 4 profile migration rebuilds locally and all 17 RLS tests pass locally and against hosted `lilica-development`.
- `npm run secrets:check` enforces the repository credential baseline.

Native camera permission changes in `app.json` require the Expo app to be reloaded and require a fresh native build when testing a standalone development/production binary. Expo Go can exercise the supported Expo modules, but it is not a substitute for final standalone permission testing.

## Incoming Agent Checklist

1. Confirm `git status --short` before editing and preserve any uncommitted Phase 2/3 documentation.
2. Read `docs/PROJECT_BRIEF.md` and this file before changing onboarding.
3. Run the app and inspect the current screen before interpreting older screenshots or prompts.
4. Preserve Welcome and the horizontal interest carousel unless the user explicitly targets them.
5. Start new product work from the structured record screen or the explicitly deferred identity architecture, depending on the user's next instruction.
6. Run `npm run validate`, then use `docs/PHASE_3_QA_BASELINE.md` on a physical device for sheet opening, drag-down dismissal, backdrop/system-back dismissal, keyboard avoidance, draft restoration, file selection, camera permission/capture, save/edit and Home visibility.
7. Do not describe local placeholder auth, local attachments or empty shell tabs as production-ready features.

## Repository State At Handoff

- Branch: `master`
- Remote: `origin` (`https://github.com/davidmaruta2/lilica`)
- Expected state after the session commit and push: clean working tree, local `master` aligned with `origin/master`
- Generated `dist` and local Expo state are ignored and should not be committed

## Phase 3 Architecture Boundary

Phase 3 adds only protection and executable examples. The existing app continues to use `src/types.ts`, `src/records.ts`, `src/storage.ts`, and the current screens exactly as before. `src/domain` describes approved future behaviour but is intentionally disconnected from `App.tsx` and must remain so until a later phase explicitly authorises integration and migration.

The characterization suite deliberately records current limitations, including passed appointments deriving as overdue, due-today appointments entering Needs attention, JavaScript month-end recurrence rollover, and malformed JSON rejecting load. A future test should change only alongside the approved implementation phase for that rule.
