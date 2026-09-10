# Revision Log

## 10 September 2026 - Recovery OTP and cross-platform keyboard correction

- Added the approved password-recovery sequence: `Check your email`, six-cell code entry and new-password form.
- Added Supabase `recovery` OTP verification and retained legacy callback compatibility.
- Added and narrowly pushed the development recovery email OTP template without changing 19 undeclared hosted settings.
- Fixed the shared keyboard root cause: form content and CTA now participate in one scroll region rather than a fixed footer compressing/covering fields.
- Added focus-aware input revealing on focus and after `keyboardDidShow` for shared screens and record-sheet editors.
- Kept Android `softwareKeyboardLayoutMode: resize` without double height avoidance; retained iOS padding behavior and native safe areas.
- Forwarded text-input refs so Email Next moves directly to Password while the keyboard remains open.
- Confirmed the fix covers Login, Create account, About You, name/custom relationship, signup/recovery code, recovery request/new password, item forms and record editing.
- Validation passed: TypeScript, 8 Jest suites/98 tests, focused auth/responsive tests, Expo dependency/config checks and `git diff --check`.
- Physical Android/iOS acceptance remains the immediate next step; automated tests do not claim device proof.

## 9 September 2026 - Phase 5 authentication and organiser profile

- Replaced placeholder account entry with Supabase email/password signup, mandatory verification, login and recovery.
- Added persisted React Native sessions, foreground refresh, native auth callbacks and safe unauthenticated loading gates.
- Added a separate organiser `About you` profile backed by owner-only `public.profiles` RLS.
- Added sign-out without deleting or uploading existing device-local supported-person data.
- Deferred profile photos because private cloud storage is outside Phase 5.
- Added focused Phase 5 UI/provider tests and a physical-device QA checklist.
- Follow-up device QA moved Phase 5 forms to top-led responsive composition, added Android keyboard resize/avoidance, and replaced signup links with a six-digit verification-code screen and Lilica email template.
- Activated verified-domain Resend SMTP for development auth email and reset the product owner's test account for fresh signup QA.

## 2026-09-09: Phase 4 Supabase Environment And Security Foundation

Reason:

Create controlled, isolated backend infrastructure and prove the first private account/profile boundary before real authentication or user-data migration.

Changes:

- Confirmed the Luxford Interactive organisation contained no Lilica project and did not reuse the existing Goalbuddy, Tandemly, or Waddl infrastructure.
- Created and linked the dedicated non-production `lilica-development` project in West Europe (London) on `micro` compute; no Lilica production project was created.
- Added a pinned Supabase CLI, local Docker workflow, version-controlled migration and empty synthetic seed.
- Added `public.profiles`, keyed one-to-one to `auth.users`, with required display name, optional private avatar path, server timestamps and database constraints.
- Enabled and forced RLS; removed anonymous access; allowed authenticated owners to select, insert and update only their own profile; deliberately omitted delete access.
- Added 17 transactional pgTAP assertions covering owner success and anonymous/non-owner/ownership-change/delete denial.
- Added placeholder-only public client configuration, environment ignores, repository credential scanning and a credential-free CI database validation job.
- Added `docs/SUPABASE_OPERATIONS.md` with environment, migration, access, secrets, reset, backup and recovery boundaries.

Scope guard:

- No Supabase runtime client, real authentication UI, organiser-profile UI, supported people, care spaces, records, documents, sync or production infrastructure was added.
- Existing AsyncStorage data and attachment files remain untouched and authoritative for the running application.

Verification:

- A clean local database reset recreated the schema from migrations.
- All 17 database/RLS tests passed against both local Postgres and hosted `lilica-development`; hosted synthetic data rolled back.
- Local and hosted schema lint passed, and local/remote migration histories match.
- `npm run secrets:check` found no credential pattern in tracked or unignored repository files.

## 2026-09-09: Phase 3 Android Responsive QA Correction

Reason:

Physical Android screenshots showed excessive dead space, dense content, bottom navigation collisions and a First Thing stack centred too far below its introduction.

Changes:

- Replaced the shared legacy safe-area boundary with `react-native-safe-area-context` for Android/iOS top and bottom insets.
- Balanced Email, Relationship and Interests through elastic content regions while preserving scroll fallback.
- Let the existing Interests carousel use the full screen gutters.
- Positioned the First Thing stack below its introduction and derived trailing snap space from measured height.
- Added six responsive composition tests.

Verification:

- The product owner checked the live Expo Go correction with Android and iPhone connected and confirmed it was much better.
- `npm run validate` passed TypeScript, 62 Jest tests, Expo dependency/configuration checks and web export.

## 2026-09-09: Phase 3 Safety Harness And Executable Domain Contract

Reason:

Protect the completed Phase 1 experience and make approved future record rules executable before authentication, backend, persistence or record-architecture work begins.

Changes:

- Added Expo-compatible Jest/`jest-expo`, Jest types and React Native Testing Library as development-only tooling.
- Added characterization tests for current date logic, AsyncStorage migration, protected onboarding surfaces, structured record entry, retained drafts, document entry points and real-record-only Home.
- Added six historical JSON migration fixtures covering `records[]`, legacy `firstItem`, completion, recurrence, local attachments, missing optional fields and partially malformed legacy state.
- Added an unwired, framework-independent `src/domain` module and executable examples for approved lifecycle, occurrence, recurrence, link, responsibility, confirmation, activity, projection, timezone and semantic-conflict rules.
- Added `npm test`, `npm run test:watch` and the complete `npm run validate` gate.
- Added a minimal GitHub Actions validation workflow without deployment automation or credentials.
- Added `docs/PHASE_3_QA_BASELINE.md` with the protected baseline, known limitations and repeatable physical-device checklist.

Scope guard:

- No business/domain behaviour, navigation sequence, `src/records.ts`, `src/storage.ts`, authentication or backend was changed by the original safety-harness work.
- Known Home/date and recurrence limitations are characterized, not fixed.
- The new future domain module has no runtime imports and does not migrate data.

Verification:

- `npm run validate` passed after physical-device correction: TypeScript, 62 Jest tests, Expo dependency compatibility, public Expo configuration and web export.
- Jest reports the existing React Native `SafeAreaView` deprecation warning from the protected Welcome screen; Phase 3 does not refactor it.
- Android baseline screenshots and product-owner Android/iPhone recheck are recorded in `docs/PHASE_3_QA_BASELINE.md`; the remainder of the physical checklist stays manual.

## 2026-09-09: Structured Record Onboarding And Document Capture

Reason:

The post-interest `What would help today?` screen repeated a question the user had already answered and did not collect enough structured information to power Lilica's Home experience. Its initial inline forms were also disproportionately large and clipped awkwardly around the keyboard.

Changes:

- Replaced the old category-choice screen with `Let's get [Name] organised`.
- Added an interest-prioritised vertical snapping stack for Appointment, Something to do, Bill or renewal, Home matter, Important document, Contact, Care information and Update.
- Added reusable structured records with event dates, due dates, expiry dates, status, responsibility, recurrence, completion, confirmations and audit timestamps.
- Added deterministic date parsing and derived due-today, overdue, upcoming, unresolved, completed, recently-updated and next-recurring-date state.
- Migrated legacy `firstItem` storage into a records array without creating fake content.
- Updated Home to group real records into populated Needs attention, Today, Coming up and Latest sections.
- Moved record forms from inline expanded cards into a compact animated bottom sheet.
- Added dismissal through Done, backdrop, system back and downward swipe from anywhere on the sheet while content is at the top.
- Kept unsaved draft values in the parent screen when the sheet is temporarily dismissed.
- Added file upload and rear-camera capture to Important document.
- Added local durable attachment copies and attachment metadata using Expo Document Picker, Image Picker and File System.
- Added native permission configuration for document and camera access.

Known limits:

- Unsaved drafts are retained only while the record-onboarding screen remains mounted.
- Camera capture does not provide document edge detection, PDF assembly or OCR.
- Attachments are local and do not synchronise without future backend storage.
- Authentication remains a local placeholder and no organiser profile/care-circle membership model exists yet.
- Physical-device gesture, keyboard and camera QA remains manual because browser automation was unavailable.

Verification:

- `npm run typecheck` passed.
- `npx expo config --type public` passed.
- `npx expo export --platform web` passed.
- The local preview returned HTTP 200 at `http://localhost:8084`.

## 2026-09-09: Interest Selection Carousel

Changes:

- Replaced the tall interest option list with a compact horizontal chip carousel.
- Added touch scrolling and accessible previous/next arrow controls.
- Added clear selected styling and a live selected-count message.
- Preserved multi-selection, skipping and later interest-based record ordering.

## 2026-09-09: Premium Onboarding Redesign

Reason:

The previous onboarding was visually crowded and presented too much copy at once. The new direction uses Yuka as a benchmark for calm pacing, strong colour, restrained typography and one clear idea at a time.

Changes:

- Replaced the separate Welcome and How Lilica Works presentation with one three-page horizontal swipe journey.
- Added a small three-position indicator used only within the intro and a tappable swipe cue for people who do not swipe.
- Reduced intro copy to short, natural sentences and moved Get started to the final page.
- Refocused the final intro slide from the repetitive `Know what needs doing` message to controlled collaboration: bringing in family or helpers, sharing updates and responsibilities, clear ownership, optional later invitations and explicit solo-user value.
- Replaced the final slide's generic progress-path visual with two helpers connected through a shared, confirmed responsibility.
- Refined the Lilica wordmark and created a distinct visual composition for each intro page.
- Reduced heading and body sizes across the shared type system.
- Restyled buttons, option rows, headers and screen spacing for a quieter, more consistent flow.
- Simplified the account, email, relationship, name, interests and first-item screens.
- Removed `Save your place and come back anytime.` from Create your account and grouped the heading with its three authentication buttons and Log in action using responsive in-content spacing rather than a detached fixed footer.
- Reworked privacy information into three numbered, plain-English points covering permission, involvement and UK GDPR-aligned privacy; simplified the declaration and advanced its stored version to `privacy-basis-v2` while preserving the active checkbox gate and acceptance time.
- Removed technical and development wording from user-facing first-item and foundation screens.
- Removed the development reset action from Home.
- Preserved onboarding resume, back navigation, skip paths, saved selections and the first real item on Home.

Verification:

- `npm run typecheck` passed.
- `npx expo install --check` reported that dependencies are up to date.
- `npx expo export --platform web` passed and exported `dist`.
- Static flow checks confirmed the three-page deck, paging, tap fallback, old `how` stage recovery, privacy gate/version/time, onboarding resume and first-item preservation.
- Metro started successfully at `http://localhost:8083`.

Rendered QA limitation:

The managed browser was available, but its navigation policy blocked both `localhost` and `127.0.0.1`, so an automated rendered screenshot could not be captured. The app remains runnable for manual mobile-size and Expo Go inspection.

## 2026-09-08: Controlled Phase 1 Visual And Flow Pass

Reason:

The previous rendered app did not meet the requested Yuka-level visual benchmark. The Welcome headline was too large, How Lilica Works read like a text page, the email auth flow lacked a focused CTA step, and Home used too much paragraph copy.

Changes:

- Added a recoverable `emailAuth` onboarding stage.
- Added `src/screens/EmailAuthScreen.tsx`.
- Changed `AuthScreen` so it is only the account-method choice screen.
- Changed Continue with email to lead to `What's your email?`.
- Reduced the Welcome hero image and headline scale.
- Kept the approved Welcome headline and supporting copy intact.
- Changed How Lilica Works into a numbered explanation screen.
- Adjusted progress dots from 8 to 9 onboarding moments.
- Centred and simplified the main onboarding question screens.
- Revised Home so it leads with a compact supported-person header and visible real item content rather than large product paragraphs.
- Preserved the first item when users return to add something and then skip.

Verification:

- `npm run typecheck` passed.
- `npx expo export --platform web` passed.
- Expo web server was started on `http://localhost:8082`.
- Expo Go URL shown by Metro: `exp://192.168.1.178:8082`.

Known limitation:

Browser automation was unavailable, so no automated rendered screenshot could be captured from this environment. The user should inspect the revised screens manually in browser or Expo Go.

Outcome:

The user manually inspected the revised app and rejected the visual result. The UI is still too cluttered, still does not follow the Yuka benchmark closely enough, and still does not present text with a professional premium feel.

Additional feedback:

- Welcome should follow the Yuka structure more exactly.
- The supporting paragraph beginning "Keep appointments, care..." should not live on Welcome.
- The progress dots/slider at the bottom of onboarding screens should be removed.
- Home should not show paragraph-led explanation.
- A more capable visual design pass is required.

## 2026-09-08: Documentation Handoff Update

Reason:

The user asked for all project docs to be updated with a full debrief, project context, failure analysis, reference material and a prompt for Lumen, the incoming AI OpenClaw agent.

Changes:

- Updated `README.md` to state that the current visual design is rejected.
- Updated `docs/PROJECT_BRIEF.md` with a current design status section.
- Updated `docs/LUMEN_HANDOFF.md` with the latest rejection, failure analysis and stronger Lumen instructions.
- Updated this revision log with the outcome of the failed visual pass.

Status:

No further visual implementation should be attempted from the existing composition without first rethinking the screen structure against the Yuka references.

## 2026-09-09: Android Layout Consistency Pass

Reason:

Physical-device QA found several remaining composition inconsistencies: active onboarding content sat too low on tall Android screens, `Skip for now` wrapped near the system-navigation area, and development overlay chrome appeared over Home's compact `Add` action.

Changes:

- Standardised active non-Welcome authentication and onboarding content on a top-led responsive layout.
- Applied top and bottom safe-area handling at the shared app shell.
- Kept shared full-width command labels to one line with bounded font fitting for larger system text.
- Preserved intrinsic width for intentional compact Home and record-editor actions.
- Added responsive regression coverage for the top-led screens and footer command labels.
- Documented that the grey Android cog is Expo Go/device development UI, not part of Lilica.

Scope:

No wording, onboarding order, state, domain behaviour, carousel behaviour, record behaviour, or approved Welcome design was changed. Phase 6 was not started.

## 2026-09-09: Authenticated Local-State Isolation

Physical QA found that a newly created account inherited the device-wide completed onboarding state and opened directly onto Maggie. The cause was the Phase 5 auth gate continuing to use Phase 1's single unscoped AsyncStorage key.

Authenticated onboarding and record state is now stored under a Supabase-user-specific local key. Session transitions block rendering and saving until the correct account namespace has loaded. Existing legacy device data is retained without being assigned silently to a new account. Regression coverage proves that a new user does not adopt Maggie from the legacy key. No cloud record sync or Phase 6 work was introduced.

After the development test user was deleted, Expo Go retained its cached token and reopened at `About you`. Startup now verifies restored identities with Supabase and clears a locally cached session only when the server rejects that identity as unauthorised or deleted. This restores Welcome for a clean signup retry without treating an ordinary network outage as account deletion.

## 2026-09-10: Structured Category And Wheel-Picker Correction

The structured category UI implicitly selected the first record of a type, despite `records[]` supporting several stable IDs. Categories are now clean gateways. Populated categories open a reusable compact record list; empty categories retain the fast direct-editor path. Add, edit and confirmed remove operations append, update or delete only the intended record ID, then return to the category list. Top-level cards contain no counts or `Add another` management controls.

Free-text structured date/time fields were replaced with reusable Lilica wheel selectors. Dedicated bottom sheets dim the unchanged form and keep coherent Cancel, title and Done controls with centred Day/Month/Year or Hour/Minute wheels. Date logic handles month lengths and leap years, displays UK format, and writes only on confirmation. Time supports every minute from `00:00` through `23:59`. Existing records and IDs require no migration. Phase 6 was not started.

## 2026-09-10: Phase 6A And Phase 6 Multi-Person Kernel

The supported-person journey now creates a reviewed roster rather than one global relationship/name. Every draft has a stable UUID; duplicate relationships remain distinct. Identity is collected for everyone first, then one person is chosen for full setup. Other people remain visible with independent incomplete setup state.

Supabase now contains one care space and one supported person per roster entry, plus a membership that stores the organiser-relative relationship. The authenticated bootstrap RPC creates the roster transactionally and reuses stable draft IDs on retry. RLS grants reads only through membership and denies anonymous, cross-user and direct membership writes.

AsyncStorage migration version 2 partitions privacy, interests, records, attachments and setup state by care space. Existing single-person data migrates deterministically without changing record or attachment IDs. Home projects only the active space and exposes a minimal switcher/add-person route. Records remain local; Phase 7 sync was not started.
