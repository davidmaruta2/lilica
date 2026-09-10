# Phase 6 Handoff For GPT And Claude

Date: 10 September 2026
Status: Phase 6A and Phase 6 implemented; physical-device QA remains separate

## Phase 6A And Phase 6 Result

- Relationship selection creates stable supported-person drafts, supports several initial selections and later duplicate relationships, and collapses into a compact summary.
- Names and required `Other relative`/`Someone else` labels are collected per draft, followed by review/edit/remove/add and explicit first-person selection.
- Every reviewed person is provisioned as a separate care space, supported person and organiser membership. Relationship is stored on membership, not the supported person.
- Local privacy, interests, records, setup status and Home projection are partitioned by `activeCareSpaceId`.
- Home has the authorised minimal person switcher. Incomplete people remain available and resume their own setup. Add-person reuses this flow without account creation or About You.
- Legacy single-person state migrates deterministically into one care-space namespace, retaining record IDs and attachment references, and bootstraps once through its stable UUID.
- Established cloud people are not removable in Phase 6; lifecycle/deletion policy remains deferred.

## Latest Product-Owner QA Corrections

The product owner tested Phase 5 on Android and required two immediate corrections before handoff:

- Phase 5 fields/CTAs were obscured by the Android keyboard. The corrected shared `Screen` puts content and CTA in one focus-aware scroll region; `KeyboardAwareScrollView` reveals the focused native input on focus and after keyboard opening. Android uses native `softwareKeyboardLayoutMode: resize` without a second height reduction; iOS uses keyboard padding. `RecordSheet` uses the same focus-aware strategy.
- Signup verification was changed from an email link to a six-digit code entered on a dedicated `Enter your code` screen. `Verify email` calls Supabase `verifyOtp` and cannot continue on an unverified code; resend remains available.
- Password recovery now follows the approved `Check your email` -> six-digit `Enter your code` -> `Choose a new password` journey and verifies a Supabase `recovery` OTP before updating the password.

The hosted `lilica-development` confirmation template now sends the six-digit code. Resend custom SMTP is active from `Lilica <auth@luxfordinteractive.com>` using a verified `luxfordinteractive.com` domain in `eu-west-1`. The credential is stored only in Supabase Auth. The local source credential file supplied by the product owner is explicitly ignored as `lilica-development.txt`; Claude must never read it into output, stage it, copy it, or commit it.

The product owner's development test Auth account was hard-deleted after these corrections and its absence was verified, so the same address can perform a clean signup test. No personal email address is recorded in repository documentation.

## Historical Implementation Authority

The product owner originally planned to transfer Phase 6 to Claude because of Codex session capacity. The later Phase 6A and revised Phase 6 prompts explicitly authorised Codex to complete both phases. This paragraph records that history only; the implemented repository and current status at the top of this document now govern.

## Repository State

- Branch: `master`; remote: `origin`.
- Phase 5, corrective, Phase 6A and Phase 6 work is committed and pushed as the checkpoint containing this handoff.
- Incoming agents must begin with `git status --short` and `git log -1 --oneline`, preserve user changes, and never reset or duplicate completed phases.
- Ignored `.env.local` contains only the development Supabase project URL and public publishable key. It must remain untracked.
- Ignored `lilica-development.txt` contains a local Resend credential supplied by the product owner. It must remain untracked and must not be exposed.
- Ignored `supabase/.temp/` contains local CLI link/state metadata and must remain untracked.

## Phase 5 Delivered Behaviour

- Email/password is the only app-visible authentication method. Apple, Google, Facebook, SMS and phone auth were not added.
- Signup uses Supabase Auth and does not treat a successful signup response as verified when no session is returned.
- New users receive a six-digit email code on a dedicated screen, enter it in Lilica, and cannot continue until Supabase verifies it; resend is supported.
- Returning users log in with email/password and receive friendly invalid-credential/network states rather than raw Supabase messages.
- Recovery sends a six-digit email code, verifies it in the app and then accepts a matching new password. Legacy native recovery callbacks remain compatible but are not the primary flow.
- Supabase is the sole session authority. Sessions persist in AsyncStorage, refresh through the supported client lifecycle, restore before private UI is shown, and clear on sign-out.
- An authenticated account without a `public.profiles` row must complete `About you`. The required display name is the organiser's identity, not the supported person's name.
- Existing organiser profiles are loaded rather than duplicated. Profile errors have retry/sign-out routes.
- The existing supported-person journey follows profile creation unchanged: relationship, supported-person name, privacy, interests, first record, Home.
- The Person tab retains its supported-person context and also exposes the organiser account/sign-out controls.

## Backend And Configuration

- Development project only: `lilica-development` (`ldocquqbcabdbscghojc`). No production project exists or was touched.
- The existing Phase 4 `public.profiles` table and three owner-only RLS policies remain unchanged.
- User A can read/create/update only User A's profile. User B and anonymous users cannot access it; IDs cannot be transferred; deletes remain unavailable.
- Hosted email confirmation was confirmed enabled.
- Hosted auth uses six-digit signup and recovery templates, allows the two Lilica callback URLs, uses the Lilica callback as site URL, and requires an eight-character minimum password.
- Custom Resend SMTP is active for development email from `Lilica <auth@luxfordinteractive.com>`. The sending domain is verified in Resend and the credential is held only in Supabase Auth secret configuration.
- Do not run a blind full `supabase config push`: the local template declares unrelated values that differ from hosted configuration. Preview every change and use a narrowly scoped config or dashboard/API operation approved for the phase.
- The runtime bundle uses only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never add service-role keys, database passwords, PATs or privileged credentials.

## Current Data Boundary

- Organiser account/profile is cloud-backed.
- Supported-person identity, care spaces and organiser memberships are cloud-backed in `lilica-development`.
- Privacy state, interests, records, attachments and setup progress remain device-local and are scoped by care-space ID.
- Authenticated device-local onboarding and record state is namespaced by the Supabase user ID. A newly created or different account must start its own supported-person onboarding and must never inherit another account's local supported-person data.
- The original unscoped Phase 1 storage value is retained for safety but is not adopted automatically by a newly authenticated account; any future migration requires an explicit product-owner decision.
- Sign-out deliberately preserves local supported-person data and attachments.
- Phase 5 did not upload local records or claim they belong to the authenticated account.
- No invitation, record, occurrence, document, attachment or sync table was created.
- Phase 7 has not started.

## Files Claude Should Read First

- `docs/CORE_SYSTEM_CONTRACT.md`: authoritative architecture and roadmap.
- `docs/SYSTEM_CONTRACT.md`: condensed system rules.
- `docs/SUPABASE_OPERATIONS.md`: environment, RLS, auth config and secrets rules.
- `docs/PHASE_5_QA.md`: outstanding device verification.
- `App.tsx`: auth gates and existing onboarding continuation.
- `src/auth/AuthProvider.tsx`: session, links, auth operations and profile access.
- `src/auth/client.ts`: public React Native Supabase client configuration.
- `src/auth/errors.ts`: consumer-safe error mapping.
- `src/storage.ts`: device-local onboarding and records; do not delete or reassign casually.
- `supabase/migrations/20260909191802_profiles_foundation.sql`: current cloud schema boundary.
- `supabase/tests/database/profiles_rls.test.sql`: 17 security assertions.
- `tests/auth-flow.test.tsx` and `tests/auth-provider.test.tsx`: executable Phase 5 contract.

## Protected Behaviour

- Preserve the approved Welcome experience and visual language.
- Preserve the distinct organiser and supported-person identities.
- Preserve privacy declaration gating/version/timestamp.
- Preserve relationship/name/interests/first-record onboarding, record-stack and bottom-sheet behaviour.
- Preserve real-record-only Home behaviour and all Phase 3 characterization/domain tests.
- Preserve Android responsive corrections and safe-area handling.
- Do not weaken profile RLS or add broad grants for anticipated collaboration.
- Do not delete device-local data on sign-out.

## Validation Baseline

Historical Phase 5/6 backend validation passed. The current final application validation on 10 September 2026 is:

- TypeScript: pass.
- Jest: 8 suites, 98 tests, all pass.
- Focused auth/responsive tests: 19 tests, all pass.
- Expo dependencies and public config: pass; Android keyboard mode is `resize`.
- Secret scan: pass across 91 repository files.
- Local database reset: pass.
- pgTAP profile RLS: 17 tests, all pass.
- Database lint: no schema errors.

After physical-device feedback, `npm run validate` passed again following the shared keyboard/layout correction: all 72 tests, TypeScript, dependency/config checks, secret scan and web export passed. After the subsequent six-digit-code change, TypeScript and 16 focused auth/provider/responsive tests passed. The final secret scan passed across 93 repository files, and `git diff --check` was clean. Database schema/RLS did not change during these QA corrections, so the already-passing 17-test database result remains applicable.

The final Android composition pass standardised every active non-Welcome onboarding/auth screen on a top-led responsive content region instead of vertically centring short forms in the available height. The app shell now applies top and bottom safe-area insets, shared full-width command buttons keep labels on one line, and intentional compact actions retain intrinsic width. Welcome is protected and now uses the same safe-area library. The grey cog visible over the top-right of Android screenshots is Expo Go/device development UI, not a Lilica component; do not move Lilica controls around it. A standalone build remains the definitive native check.

Account configuration is loaded from ignored `.env.local`; a stale Expo bundle that started before this file existed produced a false `account services are not configured` message. Metro was restarted with a clear cache, public env loading was verified, and it was listening on port `8081` at handoff. Claude must inspect current runtime state rather than assume that process remains alive in a later session.

## Physical QA Still Required

Codex cannot operate the product owner's devices. The product owner must complete `docs/PHASE_5_QA.md`, including signup/recovery OTPs, About you, onboarding continuation, relaunch/session restoration, sign-out/sign-in and Android/iOS keyboard/safe-area layout.

Signup/recovery code entry and the JavaScript keyboard correction can be tested in Expo Go. A development/standalone build remains the definitive Android native keyboard-mode and custom-scheme check. Phase 7 approval must be conditional on completing `docs/PHASE_5_QA.md` and `docs/PHASE_6_QA.md` on Android and iOS.

Final device QA exposed and corrected an account-boundary defect: the initial Phase 5 integration loaded the single legacy device-wide onboarding key after any login, allowing a newly created account to see Maggie and skip `Who are you helping?`. Storage is now scoped by authenticated user ID, with load/save guarded during session changes so one account's state cannot flash or be written into another account's namespace. The product owner's second test account was deleted from development Auth after this correction so signup can be exercised again from a clean cloud identity.

Deleting that test account also exposed persisted-client session behaviour: Expo Go retained the deleted user's JWT and initially reopened at `About you`. Auth startup now validates a restored session against Supabase. A server-rejected/deleted identity clears only the stale local auth session and returns to Welcome; an ordinary temporary network failure does not erase the cached session.

## Structured Record Corrective Contract

Physical QA after Phase 5 exposed an accidental one-record-per-category interaction. The existing `records[]` model always supported multiple IDs, but the UI selected the first matching type. This is corrected without changing storage architecture:

- The top-level `Let's get [Name] organised` cards remain calm, whole-card category gateways. They show only the existing category copy and a restrained `Added` state, never counts, record names, or `Add another` controls.
- An empty category opens a fresh editor directly. A populated category opens a scrollable category detail containing compact rows for every matching record and a category-specific Add action.
- Each row opens exactly its record ID. New saves append, edits replace only the matching ID, and confirmed removal deletes only the selected ID. Saving returns to the category list.
- Existing lifecycle behavior remains unchanged: tasks, bills and home or car matters retain their explicit completion control; no unapproved appointment outcome semantics were invented.
- Structured date, due-date, expiry-date and time fields are selectors rather than text inputs. They open dedicated dimmed Lilica bottom sheets without reflowing the form. Dates use independent Day/Month/Year wheels with leap-year/day clamping and UK display; times use unrestricted 24-hour Hour/Minute wheels. Cancel does not write; Done confirms.

This corrective task preceded Phase 6 and remains protected by the completed Phase 6 implementation.

## Instructions For The Next Approved Phase

GPT should tell the next implementation agent to:

1. Confirm the current commit, clean/dirty state and validation baseline before editing.
2. Read the authoritative contracts and this handoff fully.
3. Preserve every protected Phase 1-5 behaviour and test.
4. Implement only the newly approved phase objective and named transitions.
5. Add migrations and RLS tests before/alongside any new shared-data boundary.
6. Keep development and production environments separate; do not create or touch production without explicit approval.
7. Report any architectural conflict before changing direction.
8. Run the required full validation, inspect the final diff for secrets/metadata/unrelated work, document actual behaviour, then stop.

## Phase 6 Validation And Remaining QA

- The Phase 6 implementation gate passed TypeScript, 8 Jest suites/92 tests, secret scanning, Expo dependency/config checks, web export, local database reset/tests and database lint. Subsequent auth/layout regressions increased the current Jest baseline to 98 passing tests.
- A clean local database rebuild applies both migrations.
- Both pgTAP suites pass: 49 total profile/care-space assertions.
- The migration was previewed and applied only to linked `lilica-development`; no production project exists or was touched.
- Device checks remain for the product owner and are listed in `docs/PHASE_6_QA.md`.

Phase 7 was not started. Do not add cloud records, sync, invitations or collaboration until separately approved.

Post-Phase-6 product decision, 10 September 2026: the current free-text responsibility field is a temporary legacy/display field, not a member identity. Phase 7 must preserve its exact value and provenance without generating an assignment or matching any name/email. First-class assignments begin in Phase 8, the editor control in Phase 9, To Do projections in Phase 12, and real member population/permissions in Phase 15. Assignment never grants visibility. The detailed approved boundary and regression matrix are authoritative in `docs/CORE_SYSTEM_CONTRACT.md`.
