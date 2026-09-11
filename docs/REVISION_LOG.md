# Revision Log

## 12 September 2026 - Phase 16 candidate: Documents architecture investigation, and Phase 15 RLS gap verified not real

Two investigation-only tasks, no code changed in either:

1. **Documents architecture investigation** (`docs/PHASE_16_DOCUMENTS_INVESTIGATION.md`), tracing the current repository line by line to establish what already supports the emerging Phase 16 product direction (a document may be stored for reference, LINKED to another record, and/or lead to a real TASK — never becoming a pseudo-task or pseudo-appointment itself). Key findings, condensed in that doc: the task-creation pipeline is fully reusable as-is; a typed `RecordLink` concept (`src/domain/types.ts`) was designed once and unit-tested in isolation but never persisted, never wired to the real record model, and has no table/RLS/UI; a real, previously-unknown gap was found (not caused by this investigation) — synced attachment metadata (`attachment_manifest`) is never read back into a pulled record's `attachments` field (`localRecordFromRow()` in `src/recordSync.ts` keeps only what the same device already has locally), so a document's attachments are invisible on any second device or reinstall even though the metadata is in Supabase; no document viewer exists anywhere (`RecordDetail.tsx` shows only the attachment's filename as text); `expiryDate` is architecturally isolated from a task's `dueDate`/an appointment's `eventDate` (good) but is otherwise inert (never drives Home's Today/Upcoming, never reminder-eligible).
2. **Phase 15 server-side permission verification**, triggered by a gap the investigation above flagged from reading `supabase/migrations/20260910150000_phase7_records.sql` in isolation (its `can_access_care_space_records()` hard-codes `role = 'organiser'`). Established this is **not a real gap**: `supabase/migrations/20260911120000_phase15_care_circle.sql` redefines the identical function name/signature (`create or replace function`) to properly honour Contributor/Viewer domain grants via the new `membership_has_domain_access()`, every existing caller (the `records` RLS policy, `apply_record_mutation()`, Phase 8 occurrence policies) automatically runs the new body, this is confirmed deployed to `lilica-development` (not just written locally, per `docs/SUPABASE_OPERATIONS.md`), and is directly exercised by 31 passing pgTAP assertions covering contributor-granted/ungranted domains, viewer read-without-write, and immediate revocation. Documented as an addendum to `docs/PHASE_15_ARCHITECTURE.md`.

Neither investigation authorises Phase 16 to begin — per the standing rule, it needs its own separate, explicit, bounded implementation prompt.

## 12 September 2026 - People tab: Care circle heading/Manage link colour

Product-owner observation: the "Care circle" section's position on the People tab's shared gradient backdrop (`ScreenBackdrop`) is content-dependent — it sits after the Key contacts list, so with enough contacts added it scrolls down out of the deep teal zone and into the lighter tint zone, where the white text the other (fixed-position) headings use becomes unreadable. `src/screens/PersonScreen.tsx`: "Care circle" and "Manage" now use `tone="primary"` (`colors.primary`, `#63364D`) — the same colour as the Ask Lilica question-mark circle's fill — instead of white. This colour reads clearly on the light tint (dark-on-light) and stays visible, if less crisp, on the deep teal, unlike the alternative of white (invisible on light) or leaving it white-only (invisible once scrolled into the tint zone). `npm run typecheck` and `npm test` pass (one pre-existing, unrelated UTC/local-date flake in `tests/home-strip-navigation.test.tsx`'s "Today / Needs doing" test, confirmed via `git stash` to already fail on the prior commit before this change — not caused by it, not yet fixed).

## 11 September 2026 - Record editor: Done/backdrop/swipe now save pending valid content

Product-owner report, tested and confirmed on-device: "tapping done before tapping add doesn't save the content... tapping done whether add was tapped or not should actually save and add the item and save." Previously, dismissing the record sheet via Done, a backdrop tap, or a swipe-down discarded any typed content unless the visible Save/Add button was pressed first.

- `src/components/RecordEditor.tsx`: converted to `forwardRef`, exposing `RecordEditorHandle = { save: () => boolean }` via `useImperativeHandle` — wraps the existing internal `save()`/`canSave` validation unchanged, never a second save path.
- `src/components/RecordSheet.tsx`: gained `onBeforeDismiss?: () => void`, called once as the first line of its single internal `dismiss()` — the one function shared by Done, backdrop tap and swipe-release alike.
- `src/components/RecordQuickEditor.tsx` and `src/screens/FirstThingScreen.tsx` (the two `RecordSheet` hosts) wire `onBeforeDismiss` to the mounted editor's `save()`, only while an editor is actually open (never from the read-only detail view). `RecordQuickEditor` needed a `closingViaSheet` ref flag to stop a brand-new record's `onSave` handler from calling `onDismiss()` a second time mid-close-animation (its pre-existing behaviour on an explicit button press) when triggered via the sheet's own closing animation instead.
- Tests: replaced the now-obsolete `tests/phase1-ui.characterization.test.tsx` test asserting "Done discards" with two reflecting the new behaviour; added direct `tests/record-quick-editor.test.tsx` coverage for edit-then-Done, new-draft-then-Done, and invalid-draft-then-Done (an invalid draft, e.g. a required date left blank, still correctly does not get force-saved). `npm run typecheck` clean; full suite 34/34 suites, 348/348 tests. Verified on-device after a full Expo Go restart (the `forwardRef` conversion did not survive an ordinary Fast Refresh reload, which briefly looked like the fix hadn't landed — a full app close/reopen resolved it).
- Also folded into this same commit (`ac53407`): two explicit heading-colour overrides from direct product-owner instruction — To Do's "Today / Needs doing" heading stays white regardless of render order (`src/screens/ToDoScreen.tsx`); Calendar's "Today" agenda heading reverted to default/black (`src/screens/CalendarScreen.tsx`).

## 11 September 2026 - Onboarding category alignment, Calendar layout, view/edit separation, and a full visual pass (Home/Calendar/To Do/People)

Committed as `258ee41`, bundling several product-owner-directed passes from the same working session:

- **View/edit separation** (new architecture, later reused throughout): an EXISTING record now opens a read-only `RecordDetail` view first (new `src/components/RecordDetail.tsx`, one shared category-aware presentation used by every host), never the editor directly. Edit — gated by the real Phase 15 `canEditRecord()` capability check (a viewer never sees it; a contributor only for a domain they were actually granted) — reaches the exact same, unchanged `RecordEditor`. Save returns to the (now updated) detail, staying open. A brand-new draft (Add) is unaffected — it still opens straight into the editor and still closes on save, exactly as before.
- **Visual pass** across Home, Calendar, To Do and People (Home was later reverted to its original plain background — see below): new `src/theme.ts` export `tabAccent` (per-tab `{deep, tint}` colour pairs reusing Welcome's own slide colours) and new `src/components/ScreenBackdrop.tsx` (a shared gradient backdrop, `expo-linear-gradient`). Iterated through several rounds of direct visual feedback on an HTML mock artifact before implementation. One genuine architectural bug found and fixed during this work, prompted by the product owner asking "can the headings colour adapt based on the background?": `ScreenBackdrop` originally sat OUTSIDE each screen's `ScrollView` (fixed to the viewport, so a heading's colour-vs-background relationship changed continuously with scroll position) — fixed by moving it INSIDE the `ScrollView` (content-relative, scrolls away with everything else), after which static per-heading colour decisions became valid. Per explicit instruction, Home's background was subsequently reverted in full (`git checkout -- src/screens/HomeScreen.tsx`) back to its plain original state; Calendar/To Do/People keep the visual pass.
- **Onboarding category alignment / Calendar layout**: presentation-only adjustments bundled into the same commit (see commit `258ee41` diff for the exact scope; no domain/schema change).
- Validated at 32+/32+ suites passing before commit; see the visual-pass follow-up entries below for the Wordmark and Settings-cog fixes that landed immediately after.

## 11 September 2026 - Wordmark-on-dark and Settings-cog follow-ups (same visual pass)

Two direct product-owner reports against the freshly-landed visual pass, fixed the same day:

- **Wordmark invisible on dark backgrounds**: `src/components/Wordmark.tsx`'s tone resolution checked `isCompact` before `isLight` (`tone={isCompact ? 'muted' : isLight ? 'white' : 'default'}`), so `tone="light"` was silently ignored whenever `size="compact"` was also set — which every one of the 4 tabs' headers does. Reordered to `tone={isLight ? 'white' : isCompact ? 'muted' : 'default'}`, plus a new `wrapCompactLight` style (opacity 0.85, up from the light-watermark default of 0.6, which was still too faint on a deep background).
- **Settings cog restyled bright blue with a white gear**: `src/components/SettingsCogButton.tsx` gained a local `BRIGHT_BLUE = '#2E7DF5'` constant (deliberately not added to the shared `colors` theme, as a one-off accent) plus a glow (`shadowOpacity: 0.65`, `shadowRadius: 8`); gear teeth/ring changed from `colors.blue` to `colors.white`.
- Separately investigated and resolved as a non-issue: a reported "duplicate/oversized Settings cog" turned out to be Expo Go's own development-mode chrome (tapping it opened Expo Go's own settings, not Lilica's), not Lilica code — documented as a standing "known false alarm" in `CLAUDE.md` so it is not re-investigated.

## 11 September 2026 - Fix record-open "flash" architecturally; Corrective Task 10: People tab IA

Committed as `3272a64`:

- **Flash bug**, root-caused via a product-owner-led walkthrough rather than assumption: tapping a record briefly showed the wrong screen behind the sheet on every tab. The actual cause was `openRecordFromProjection` navigating the whole app to `FirstThingScreen` just to host the editor — swapping that whole screen in/out on open/close is what read as a flash, not an animation-timing issue (an earlier `instant` prop on the sheet, since removed, could never have fixed it). Fixed architecturally with a new `src/components/RecordQuickEditor.tsx`: the exact same `RecordSheet`+`RecordEditor`/`RecordDetail` pairing `FirstThingScreen` already used, but mounted directly as an overlay over whichever screen is already showing — Home/Calendar/To Do/People never unmount, so there is nothing behind the sheet to flash to.
- **Corrective Task 10** (`docs/CORRECTIVE_TASK_10_PEOPLE_IA.md`): renamed the fourth tab from Person/Care Circle to **People**, centred on Supported people / Key contacts (external, no Lilica account) / the real Care circle (authenticated members, from Phase 15's own membership list) / an Ask Lilica placeholder (moved from Home, still not implemented) — no longer a second Home dashboard duplicating bills/home/documents/care-note sections, which had given the tab no distinct purpose from Home's own "Recently added". Those record types are untouched in storage and still appear correctly in Home/Calendar/To Do; see `docs/CORRECTIVE_TASK_10_QA.md`.
- Copy tweaks in the same pass: removed a redundant subtitle line above "Person being supported" (which repeated the heading immediately below it) and amended "People you support" to "Person being supported"; removed the two remaining user-facing em-dashes in `PersonScreen.tsx` per the standing no-AI-dashes rule (code-comment em-dashes elsewhere were flagged, not swept, as out of scope).
- Validated at 32/32 suites before commit.

## 11 September 2026 - Phase 15 follow-up: invitee-facing Invitations screen

Requested directly ("build the invitee-facing invitation screen next") as the first of Phase 15's documented follow-up items. New `src/screens/InvitationsScreen.tsx`: lists the signed-in account's own pending invitations (by authenticated email, via the existing `list_my_invitations()`), with Accept/Decline per invitation and a "Not now" that leaves every invitation untouched.

`App.tsx` fetches invitations in the same effect that already runs `reconnectCareSpaces()` once per signed-in owner. The screen auto-opens the first time that fetch finds any pending invitation — ahead of the normal onboarding/Home flow, so a brand-new invitee who signed up specifically to accept sees it immediately — and does not reopen itself again this session once dismissed. Person's header gained an "Invitations (N)" link (shown only when N > 0) as the way back in after "Not now". Accepting needed no new client-side plumbing to surface the resulting membership: the existing, unmodified `reconnectCareSpaces()`/`integrateReconnectedCareSpaces()` flow already picks it up, since `list_my_supported_people()` was never role-filtered. A failed accept/decline shows the server's own error inline against that invitation and leaves it in the list, never guessing success. `src/careCircle.ts` gained an exported `DOMAIN_LABELS` map (factored out of `CareCircleScreen`'s local one) so both screens describe domains identically.

New `tests/phase15-invitations-screen.test.tsx` (5 tests: content shown, accept/decline call the right id, a failure surfaces inline without removing the invitation, "Not now" touches nothing). `npm run typecheck`, `npm test` (23 suites/263 tests, up from 258) and secret scan/web export all pass; no database change.

Diff audit: `App.tsx`, `src/careCircle.ts`, `src/screens/PersonScreen.tsx`, `src/screens/CareCircleScreen.tsx` (only its `DOMAIN_OPTIONS` now derives from the shared `DOMAIN_LABELS`, no behaviour change), one new screen, one new test file, plus `docs/PHASE_15_ARCHITECTURE.md`/`docs/PHASE_15_QA.md`/`AGENTS.md`/`CLAUDE.md`/`docs/LUMEN_HANDOFF.md` updated to remove the now-resolved "no invitee screen yet" caveat.

## 11 September 2026 - Phase 15 care-circle invitations and collaboration

Implemented from a written, bounded product-owner brief whose own Hard Start Gate (product-owner confirmation of Phase 14 physical QA) was explicitly waived by the product owner before this phase began — Phase 14 is implemented/validated but not yet physically tested on a development build. `PRE_PHASE_15_BASELINE`: HEAD `52d28c0` (in sync with `origin/master`), clean working tree, TypeScript clean, 20 Jest suites/247 tests, secret scan clean, 183 pgTAP assertions across 5 files (152 Phase 6/7/8/9-era plus 31 already-counted-elsewhere — see note below), clean DB lint, clean web export. (Baseline pgTAP count before this phase's own new test file was 152 across 5 files; this phase adds a 6th file.)

Core invariant: sharing must be real, explicit, permissioned and revocable — never inferred from a name, email, relationship label, contact, or the legacy `responsiblePerson` free-text field. Assignment ("who's expected to deal with this") and permission ("who's allowed to see this") stay strictly separate; assigning a record to someone without visibility into its domain is rejected server-side, not merely hidden client-side.

Traced the existing Phase 6/7 skeleton before writing anything new, per the brief's own instruction: `care_space_memberships.membership_status` (active/revoked) already existed and needed no new column for removal/leaving; `can_access_care_space_records()` was already code-commented since Phase 7 as the intended Phase 15 extension point; the domain taxonomy (general/health/financial/home/documents) already existed via `record_domain_for_type()`.

- New migration `supabase/migrations/20260911120000_phase15_care_circle.sql`: extends `care_space_memberships.role` to `organiser`/`contributor`/`viewer` (was hardcoded organiser-only); new `care_space_domain_grants` (explicit per-membership per-domain read/write, default-deny); new `care_space_invitations` (pending/accepted/declined/expired/revoked lifecycle); new `membership_has_domain_access()` and a redefined `can_access_care_space_records()` deciding access by role-or-grant; a redefined `apply_record_mutation()` (same signature) checking write access against a record's real domain (was hardcoded to `'general'`) and rejecting any `assignedMembershipId` lacking active status or domain read access — closing the gap where an unvalidated assignment could grant de facto visibility, and where a replayed offline mutation could recreate access for a removed member; new RPCs `invite_member`, `list_my_invitations`, `accept_invitation`, `decline_invitation`, `revoke_invitation`, `change_member_role`, `remove_member`, `leave_care_space`, `list_care_space_members`, `list_care_space_invitations`, all authenticated/authorised/transactional/idempotent with sole-organiser safety on removal/role-change/leaving.
- `protect_membership_identity()` redefined to drop `role` from its immutability check (role is now a legitimate, authorised transition gated by `change_member_role()`'s own checks, not by trigger immutability) while keeping `care_space_id`/`user_id`/`bootstrap_id` immutable.
- New `src/careCircle.ts`: a thin, typed RPC wrapper following `src/careSpaces.ts`'s exact pattern (`{ ok, data | message }`, never throws, all authority server-side).
- New `src/screens/CareCircleScreen.tsx`, reachable from Person's header via a "Care Circle" link next to "Account" (shown only for a real, non-local, synced care space).
- `src/records.ts` gained `recordDomainForType()`, an exact client-side mirror of the server's `record_domain_for_type()`.
- `src/components/RecordEditor.tsx`'s Assigned-to control gained an optional `careCircleMembers` prop: when present, offers every active member with visibility into the record's domain instead of only Unassigned/You; falls back to exactly the pre-Phase-15 behaviour when absent, so all existing Phase 9/12/14 tests pass unchanged.
- `App.tsx` fetches the active care space's members/invitations via `listCareSpaceMembers`/`listCareSpaceInvitations` whenever the active space changes or Care Circle is opened, and threads `careCircleMembers` down through `FirstThingScreen` to `RecordEditor`.

New test files: `supabase/tests/database/phase15_care_circle.test.sql` (31 pgTAP assertions — invite→pending→zero-access, accept→exactly-granted-domains, default-deny, forbidden/permitted assignment, viewer read-without-write, immediate zero-access on removal with attribution retained, stale/replayed mutation cannot restore removed-member access, sole-organiser removal/leave protection, invitation terminal states, cross-space/non-organiser denial — 183 total across 6 files, zero regressions), `tests/phase15-care-circle.test.ts` (8 tests — RPC wrapper mapping, `recordDomainForType()` parity), `tests/phase15-record-editor.test.tsx` (4 tests — domain-eligible filtering, membership-ID-not-name storage, pre-Phase-15 fallback). `npm run typecheck`, `npm test` (22 suites/258 tests, up from 247) and `npm run validate:all` all pass. Migration dry-run listed exactly `20260911120000_phase15_care_circle.sql`; applied to `lilica-development` only; linked pgTAP (183 assertions) and lint both clean afterward — see `docs/SUPABASE_OPERATIONS.md`'s "Hosted Phase 15 deployment" entry.

Deliberately not built this phase, documented rather than faked (see `docs/PHASE_15_ARCHITECTURE.md`'s "What Is Deliberately Not Built Yet"): an invitee-facing "you've been invited" screen (the RPCs exist; no screen calls them for someone not yet a member), push/email delivery of the invitation itself, an "assignee no longer has access" UI treatment, and an in-app role-change/organiser-handoff control (their server functions exist and are tested independently). None of these are represented as complete anywhere in the docs.

Diff audit: one new migration, `supabase/tests/database/phase15_care_circle.test.sql`, `src/careCircle.ts`, `src/screens/CareCircleScreen.tsx`, `src/records.ts`, `src/components/RecordEditor.tsx`, `src/screens/FirstThingScreen.tsx`, `App.tsx`, `src/screens/PersonScreen.tsx`, two new test files, plus this documentation pass (`AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/PROJECT_BRIEF.md`, `docs/LUMEN_HANDOFF.md`, `docs/SUPABASE_OPERATIONS.md`, this file, `docs/PHASE_15_ARCHITECTURE.md`, `docs/PHASE_15_QA.md`) — every changed file has a clear Phase 15 reason. No Welcome/auth/onboarding/Home/Calendar/To-Do/Person-design/theme-token file was redesigned; Person gained only the same kind of small header link Phase 13 already established for Account. Phase 7 sync internals and Phase 14's reminder engine internals were not modified (only reused, unchanged, as data sources). No secrets, push credentials or generated exports included.

## 11 September 2026 - Phase 14 reminder and notification engine

Implemented from a written, bounded product-owner brief. `PRE_PHASE_14_BASELINE`: HEAD `ee4df9a` (in sync with `origin/master`), clean working tree, TypeScript clean, 17 Jest suites/208 tests, secret scan clean, 152 pgTAP assertions across 5 files, clean DB lint, clean web export.

Scoped to **local device notifications only**, per explicit product-owner decision after flagging a real constraint up front: Expo Go has not reliably supported local notifications since SDK 53, so testing this phase for real needs a development build rather than the usual Expo Go workflow. Server/push delivery, device-token registration and Phase 15 collaboration notifications are deliberately deferred and documented, not faked, per the brief's own instruction to implement only the safe foundation and stop.

The core invariant — record/occurrence state, in-app attention state, and notification-delivery state are three separate things, and dismissing/snoozing a notification never completes/pays/attends anything — was already anticipated in `src/domain/core.ts`'s unused `acknowledgeReminder()` helper from Phase 8; Phase 14's local implementation follows the same separation for the client-side model.

- New `src/reminders.ts`: pure domain logic (eligibility, default offsets — 1 day/2 hours before a timed appointment, 3 days before/on the day for a date-only item — quiet-hours policy, deterministic idempotent identifiers, conservative lock-screen-safe wording). No native dependency; fully unit-tested.
- New `src/notifications.ts`: the thin `expo-notifications` boundary, guarded for web throughout. One reconciliation entry point (`reconcileRecordReminders`) called from `App.tsx`'s `saveRecord`/`removeRecord` after every mutation — covers creation, date edits, completion and cancellation through the single existing save path.
- `src/types.ts` gained two optional fields — `remindersEnabled`, `reminderScheduleVersion` — riding inside the existing record shape exactly like Phase 9's `assignedMembershipId`. No migration.
- `RecordEditor.tsx` gained a "Remind me" toggle (appointment/task/bill/homeMatter only), gated behind an explicit permission request that only fires when the user turns it on — never at launch or during onboarding. The schedule version bumps only when the record's own relevant date/time actually changes.
- `AccountScreen.tsx` gained a minimal Reminders section (master switch, quiet hours on/off) — reached via Person's existing "Account" link.
- New `expo-notifications` dependency (`app.json` gained its config plugin, a `color` tint and an Android "Reminders" channel); `npx expo install --check` and the web export both remain clean with it installed.

New test files: `tests/phase14-reminders.test.ts` (21 tests — eligibility, the fixed appointment/bill scenarios, too-late-lead-time omission, quiet hours including an overnight window, BST/GMT/month-end/leap-day handling, idempotent identifiers, conservative content), `tests/phase14-notifications.test.ts` (12 tests, `expo-notifications` mocked — idempotent scheduling, version-change cancellation, completion/cancellation suppression, snooze namespacing and its natural ceiling, permission mapping), `tests/phase14-record-editor.test.tsx` (6 tests — toggle visibility per type, permission gating, schedule-version bump behaviour). `npm run typecheck`, `npm test` (20 suites/247 tests, up from 208) and `npm run validate:all` (152 pgTAP assertions unchanged, no migration, clean lint, clean web export) all pass.

Diff audit: `App.tsx`, `app.json`, `package.json`/`package-lock.json`, `src/components/RecordEditor.tsx`, `src/screens/AccountScreen.tsx`, `src/screens/FirstThingScreen.tsx`, `src/types.ts`, `tests/auth-flow.test.tsx` (updated for `AccountScreen`'s new required props) plus two new source files and three new test files — every changed file has a clear Phase 14 reason. No welcome/auth/onboarding/fork/Home/Calendar/To-Do/Person/theme-token file appears in the diff beyond the necessary `AccountScreen` addition. `git diff --check` clean; no secrets, push credentials or generated exports included.

## 11 September 2026 - Phase 13 Person projection

Implemented from a written, bounded product-owner brief. `PRE_PHASE_13_BASELINE`: HEAD `b76446f` (in sync with `origin/master`), clean working tree, TypeScript clean, 16 Jest suites/192 tests, secret scan clean, 152 pgTAP assertions across 5 files, clean DB lint, clean web export.

Tracing the current repository (per the brief's own instruction not to assume an old prototype structure survives) found a real structural mismatch worth reporting before building anything: the tab labelled with the supported person's name rendered `AccountScreen` — the organiser's own account settings — under copy that promised a person knowledge space it never delivered ("Keep their appointments, home details, documents and contacts together here."). Phase 13's whole purpose is to make that tab the real thing, so this was fixed as the necessary minimum: `AccountScreen` is now reached via a small "Account" link in the new Person screen's header (its own content unchanged, minus the stale copy), preserving sign-out access without adding a new tab.

- New `src/screens/PersonScreen.tsx`: groups `state.records` — the same projection Home/Calendar/To Do already read — into five durable-knowledge sections (Important contacts / Care & health information / Home / Documents & paperwork / Bills & renewals), each backed by one existing record type (`contact`/`careNote`/`homeMatter`/`document`/`bill`), omitted entirely when empty. Appointments, tasks and updates never appear — they belong to Calendar, To Do and Home's Latest respectively. A static "Care circle" section always shows the organiser as "You", the only member today, with no fake invite affordance. Self-care wording ("You") is driven by the explicit `relationshipType === 'Myself'` check already used elsewhere, never by matching a display name.
- `FirstThingScreen.tsx` gained a sibling `initialOpenType` prop (alongside Phase 10's `initialOpenRecordId`, same one-shot consume/clear contract) so Person's per-section "Add" links open a *new* draft of the right category directly, through the exact same category/record creation architecture.
- `AccountScreen.tsx`: removed the stale person-framing copy and its now-orphaned `supportedPersonName` prop; added an optional `onBack` (rendered as the existing shared `Header` component) so it can be reached and left from Person.
- `App.tsx`: the Person tab now renders `PersonScreen`, with a `showAccount` toggle (cleared when leaving the tab) swapping in `AccountScreen` when its "Account" link is tapped. Opening/adding records reuse the exact same `initialOpenRecordId`/`initialOpenType`/`onSaveRecord` paths Calendar and To Do already use.
- No database migration, no RLS change, no medical/legal inference anywhere in the new screen — verified by tests.

New `tests/phase13-person.test.tsx` (16 tests) covers the brief's fixed test scenario verbatim, no-inference guarantees (a medication note never implies a diagnosis, a power-of-attorney document is never shown as confirmed legal authority, no generated summaries), empty/sparse states, identity (opening the real record ID, no duplication), explicit (never name-matched) self-care wording, and care-space isolation. `npm run typecheck`, `npm test` (17 suites/208 tests, up from 192) and `npm run validate:all` (152 pgTAP assertions unchanged, clean lint, clean web export) all pass.

Diff audit: 4 files touched (`App.tsx`, `src/screens/AccountScreen.tsx`, `src/screens/FirstThingScreen.tsx`, `tests/auth-flow.test.tsx` — updated for `AccountScreen`'s prop change) plus one new screen and one new test file — all with a clear Phase 13 reason. No welcome/auth/onboarding/fork/Home/Calendar/To-Do/theme-token file appears in the diff beyond the necessary `AccountScreen` routing change. `git diff --check` clean; no secrets, env files or generated exports included.

Not committed or pushed pending product-owner review and physical-device QA, per the implementation brief. Phase 14+ was not started.

## 10 September 2026 - Phase 12 To Do projection

Roadmap numbering note first: the product owner clarified that the work committed as "Phase 10" (immediately below) implements the canonical roadmap's **Phase 11 — Calendar Projection** (`docs/CORE_SYSTEM_CONTRACT.md` numbers its own Phase 10 as Home Projection, effectively already delivered by the earlier Home redesign). Historical commits/entries saying "Phase 10" for Calendar are not renamed or rewritten; numbering resumes canonically from **Phase 12 — To Do Projection** onward, per this entry.

Implemented from a written, bounded product-owner brief. `PRE_PHASE_12_BASELINE`: HEAD `c85a58d` (in sync with `origin/master`), clean working tree, TypeScript clean, 15 Jest suites/176 tests, secret scan clean (135 files), 152 pgTAP assertions across 5 files, clean DB lint, clean web export.

To Do is a projection, not a second task store: it reads `state.records` (the same Home/Calendar already read) and a new `isActionableRecord()` in `src/records.ts` decides eligibility per `docs/CORE_SYSTEM_CONTRACT.md` section 9.3 — open task/bill/home-or-car-matter records, never appointments/documents/contacts/care-information/updates even though some are dated.

- New `src/screens/ToDoScreen.tsx`: Overdue / Today-Needs-doing / Upcoming groups (30-day horizon, matching Home's own Coming Up window), an All/Mine/Unassigned assignment-filter row, and per-row "Mark complete"/"Mark paid"/"Reopen" actions. A "Show completed" toggle (off by default) keeps completed items reachable for reopening without a second screen.
- New `completionUpdate()` in `src/components/RecordEditor.tsx`: the exact status/completed/completedAt/confirmationHistory transition `RecordEditor.save()` already applies inline for its "Already sorted" checkbox, factored out (save() itself untouched) so To Do's quick actions produce a byte-identical mutation to the established editor — never a second interpretation of "complete".
- Assignment filtering and the row's You/Unassigned badge use Phase 9's stable `assignedMembershipId` exclusively — never a display name or the legacy `responsiblePerson` text, and no third assignment representation was created.
- `App.tsx`: the To Do tab now renders `ToDoScreen` (previously a placeholder) once the active care space's setup is `ready`, mounted with `key={careSpaceId}` for the same clean-switch guarantee Calendar already has. Tapping a row or completing an item reuses the exact same `initialOpenRecordId`/`onSaveRecord` paths Calendar and Home already use.
- No database migration, no RLS change, no new assignment architecture.

New `tests/phase12-todo.test.tsx` (16 tests) covers the brief's fixed test scenario verbatim, eligibility, identity (no duplication), the shared completion transition, assignment filtering (including that `responsiblePerson` and a changed display name never affect it), care-space isolation, and that Add reuses the established creation flow. `npm run typecheck`, `npm test` (16 suites/192 tests, up from 176) and `npm run validate:all` (152 pgTAP assertions unchanged, clean lint, clean web export) all pass.

Diff audit: 3 files touched (`App.tsx`, `src/records.ts`, `src/components/RecordEditor.tsx`) plus one new screen and one new test file — all with a clear Phase 12 reason. No welcome/auth/onboarding/fork/PersonSwitcher/Home/Calendar/theme-token file appears in the diff. `git diff --check` clean; no secrets, env files or generated exports included.

Not committed or pushed pending product-owner review and physical-device QA, per the implementation brief. Phase 13+ was not started.

## 10 September 2026 - Phase 10 Calendar projection

Implemented from a written, bounded product-owner brief. `PRE_PHASE_10_BASELINE`: HEAD `62368db` (in sync with `origin/master`), clean working tree, TypeScript clean, 14 Jest suites/157 tests, clean web export -- the same numbers already recorded as passing immediately before this brief was issued, in this same session. No migration exists on either side of this phase, so the last recorded pgTAP baseline (152 assertions, Phase 8/9) is unchanged.

Calendar is a projection, not a second record system: it reads `state.records` -- the exact same active-care-space projection Home already reads via `projectActiveCareSpace()` -- and resolves each record's calendar date with a new `calendarDateForRecord()` in `src/records.ts`, mirroring `domain/recordOccurrence.ts`'s existing field-priority (appointment -> `eventDate`; task/bill/homeMatter -> `dueDate`; document -> `expiryDate`) without requiring a synced cloud record ID, for the same offline-first reason Home already bypasses the Phase 8 domain layer. Status (Overdue, etc.) reuses the existing `deriveRecordState()` exactly -- no second lifecycle interpretation.

- New `src/screens/CalendarScreen.tsx`: a month grid (Monday-first, today and selected-day marked, a small dot on dates with occurrences) and a selected-day agenda list below it, in the app's existing tokens/type/icon language. Categories reuse `CategoryIcon`/`categoryLabel`/`visualFor`, exported from `HomeScreen.tsx` (previously private, now shared -- zero behaviour change to Home).
- `App.tsx`: the Calendar tab now renders `CalendarScreen` (previously a placeholder `FoundationScreen`) once the active care space's setup is `ready`, mounted with `key={careSpaceId}` so switching person always starts fresh -- no stale state, no cross-space leak. Tapping an agenda item sets a new one-shot `calendarOpenRecordId` and navigates to the existing `firstThing` stage, the same screen Home's own Add action already uses.
- `src/screens/FirstThingScreen.tsx`: gained an optional `initialOpenRecordId`/`onInitialOpenHandled` prop pair. On mount, if set, it opens that exact existing record's editor via the screen's own existing `openEditor()` -- not a new editor, not a duplicate draft -- then reports back so the request is consumed exactly once; a later, unrelated visit (e.g. Home's plain Add button) never reopens a stale record.
- No database migration, no RLS change, no assignment-architecture change: Assigned-to display in Calendar (where used) is presentational only, reusing Phase 9's existing Unassigned/You scope. Legacy `responsiblePerson` is never surfaced as an assignment claim.

New `tests/phase10-calendar.test.tsx` (17 tests) covers month/date rendering, multi-occurrence days, category projection, undated-record exclusion, past-appointment/Overdue agreement with the existing engine, opening the correct underlying record ID, no cross-care-space leak on person switch, no mutation during month navigation, the empty-day state, and that `initialOpenRecordId` opens the same record rather than a new draft. `npm run typecheck`, `npm test` (15 suites/174 tests, up from 157 -- old tests unchanged, new tests additive) and `npm run validate` (web export included) all pass.

Diff audit: 4 files touched (`App.tsx`, `src/records.ts`, `src/screens/FirstThingScreen.tsx`, `src/screens/HomeScreen.tsx` -- the last for `export` keywords only) plus one new screen and one new test file. No welcome/auth/onboarding/fork/PersonSwitcher/privacy/interests/category-gateway/wheel-picker/keyboard/theme-token file appears in the diff. `git diff --check` clean; no secrets, env files or generated exports included.

Not committed or pushed pending product-owner review and physical-device QA, per the implementation brief. Phase 11+ was not started.

## 10 September 2026 - Calendar redesign: icon-chip day cells and an icon legend

Product owner asked for the Calendar's month grid to draw from Monzo's spending calendar (`222.jpeg`), sense-checked a first pass from ChatGPT (`111.png`), then asked for a mock in Lilica's own design system rather than adopting that pass wholesale. Mocked in a design canvas, revised once (the icon legend was present in markup but silently clipped by an `overflow:hidden` scroll container that had run out of vertical room -- fixed by trimming cell/spacing sizes and switching that container to scroll), approved, then implemented into `CalendarScreen.tsx`:

- Each day cell with occurrences now shows a small tinted icon-chip badge -- the same `CategoryIcon`/`visualFor` colours already used everywhere else -- for the highest-priority category that day (priority: appointment, task, bill, home/car matter, document), with a `+N` count beneath it when more than one item falls on that date.
- A day with any overdue item gets a small red corner dot on its badge (reusing `colors.danger`, no new interpretation of overdue -- still `deriveRecordState().overdue`).
- A new icon legend row beneath the grid explains every glyph that can appear, reusing the same icon/tint/label for each category plus a "Needs attention" key (`StatusIcon`'s existing alert icon, now exported from `HomeScreen.tsx` alongside `CategoryIcon`).

No architecture change: still the same `state.records` projection, the same `calendarDateForRecord()`/`deriveRecordState()` resolution, the same record editor on tap. New tests in `tests/phase10-calendar.test.tsx` cover the legend and the `+N` overflow badge (19 tests in that file now, up from 17). `npm run typecheck`, `npm test` (15 suites/176 tests) and `npm run validate` all pass. Not committed or pushed, per the standing Phase 10 instruction.

## 10 September 2026 - Home's horizontal strip repurposed into an "at a glance" status summary

Product owner (relaying a ChatGPT-drafted proposal, then a reference image) judged the horizontal category-snapshot row a duplicate of the record boxes — "wasting prime space, making Home feel like a catalogue" — and asked for it to summarise **state**, not **category**, with an explicit caution: only surface a chip backed by real current projection logic, never a fake count.

`src/screens/HomeScreen.tsx`: the row now shows up to five chips — Overdue, Due today, Coming up, Assigned to you, Updates this week — each counted straight from data the rest of Home already derives, nothing new:

- Overdue / Due today / Coming up: `deriveRecordState(record).overdue` / `.dueToday` / `.upcoming`, the same fields the section grouping above already uses.
- Updates this week: `deriveRecordState(record).recentlyUpdated` (already existed, unused until now).
- Assigned to you: `record.assignedMembershipId === currentSpace.membershipId` (Phase 9's stable-identity field). This chip is **omitted entirely**, not shown as a fake zero, whenever `activeCareSpace(state)?.membershipId` is unavailable — matching the caution exactly.

Two new soft-tint theme tokens (`dangerSoft`, `warningSoft`) added to `theme.ts`, extending the existing hue+soft-pair pattern every other color already has, for the Overdue/Due-today chips; Coming up reuses `olive`/`oliveSoft`, Assigned to you reuses `primary`/`primarySoft`, Updates this week reuses `blue`/`blueSoft` — no arbitrary new colors. New `StatusIcon` (alert, calendar, people, clock) built from plain Views, reusing the calendar/person shapes already drawn for `CategoryIcon` in this same file. The old `SNAPSHOT_TYPES`/8-category row (and its now-unused styles) is gone; `CategoryIcon`/`categoryLabel` remain, still used by the sections list below.

Two new tests in `tests/phase1-ui.characterization.test.tsx` cover the four always-present chips and the Assigned-to-you omission/inclusion behaviour. `npm run typecheck`, `npm test` (157 tests, up from 155) and `npm run validate` all pass.

## 10 September 2026 - Welcome carousel redesign, mocked and approved first

Product owner supplied a reference image (`Lilica Care Onboarding Screens.png`) and asked for a mockup before any code changed. Drafted a 3-artboard Claude Design canvas matching it against the app's real tokens (Fraunces headings, existing per-page colors, spacing/radius scale), iterated through two rounds of feedback (raise/lower text position; smaller hero circles with a bigger gap to the heading), then implemented the approved result into `src/screens/WelcomeScreen.tsx` and `src/components/BrandVisual.tsx`:

- Page 1 copy simplified to the reference's heading + single paragraph (dropped the old bullet pair and closing line); pages 2 and 3's body copy and bullet wording/order updated to match the reference exactly (e.g. "Household tasks" replacing "Home and car tasks").
- Plain bullet-dot rows on pages 2 and 3 replaced with icon-badge rows: a translucent circular badge holding a small drawn icon (calendar, document, house, check, people, chat, list, paper-plane), built from plain Views only, matching the app's existing icon technique (`Wordmark`'s leaf, `HomeScreen`'s `CategoryIcon`) — no icon library added.
- All three hero visuals (the real illustrated `BrandVisual` image, and the drawn `TogetherVisual`/`AheadVisual`) shrunk by about 17%, with more vertical space opened up between the hero and the heading below it.
- The final "Get started" button gained a trailing arrow (previously text-only), built as a small chevron View rather than the shared `Button` component's `icon` slot, since that slot renders before the label and the approved mock wants the arrow after it.
- One deliberate deviation from the reference, flagged and accepted: "Get started" stays on the last page only (page 3), not page 1 as the reference literally showed — matching the app's correct onboarding order.

Not changed: the paging/scroll mechanics, the compact-height fallback, `Screen`/keyboard architecture, auth, or any other screen. `npm run typecheck`, `npm test` (155 tests — one characterization test's copy assertion updated to match) and `npm run validate` (web export included) all pass.

## 10 September 2026 - Count-saved badge moved to the category-mark corner

Product-owner follow-up: the count badge (added earlier the same day) should sit like an unread-message badge — pinned to the corner of the category's icon mark — rather than in the row next to "Add". Moved `countBadge` into `categoryMark` as an absolutely-positioned corner badge (with a border matching the row's own background, so it reads as sitting on top of the icon), and "Add" now always renders plainly in its own slot regardless of whether the category has records. `npm run typecheck` and `npm test` (155 tests) both pass.

## 10 September 2026 - An appointment happening today shows under Today, not Needs attention

Product-owner question: why did an appointment scheduled for today appear under "Needs attention" on Home instead of "Today"?

`HomeScreen.tsx`'s `sectionFor()` checked the generic `derived.overdue || derived.dueToday` (true for any record type due exactly today) before its appointment-specific "Today" check, so a today's appointment always matched the first, generic branch and the appointment branch was never reached. Reordered so an overdue (missed) appointment still lands in "Needs attention", a today appointment now lands in "Today", and a bill/task/home-or-car-matter due today is unaffected — it still lands in "Needs attention", which is the existing, correct behaviour for those types.

Updated the characterization test that had documented the old behaviour (now split into two tests: today-vs-past appointment, and a bill still landing in Needs attention when due today). `npm run typecheck` and `npm test` (155 tests, up from 154) both pass.

## 10 September 2026 - Count badge coexists with Add; Home snapshot row matches the record boxes

Two corrections from the same product-owner check:

1. The saved-count badge just added to `FirstThingScreen`'s category boxes had replaced the "Add" label entirely once a category held records. The box is still there to add more, so "Add" now sits alongside the count badge rather than being replaced by it (`addAffordance` changed from a single fixed-width slot to a row holding both).
2. Home's horizontal category snapshot row (`HomeScreen.tsx`) only ever showed four categories (To do, Bill, Home or car matter, Appointment) — the original approved mockup's subset — which no longer matched the eight category boxes on the person's own records screen. `SNAPSHOT_TYPES` now lists all eight, in the same order as `firstItemOptions` (Appointment, Task, Bill, Home or car matter, Document, Contact, Care information, Update). The visual treatment (icon, tint, accent) for all eight already existed in `CATEGORY_VISUALS`/`CategoryIcon` from the original build — only four were ever wired into the row.

New test in `tests/phase9-record-management.test.tsx` covers Add and the count badge both being present together. `npm run typecheck` and `npm test` (154 tests, up from 153) both pass.

## 10 September 2026 - Category gateway: saved-count badge, not "Added"

Product-owner observation: on a supported person's records screen (`FirstThingScreen`, both first-time and everyday modes), each category box (Appointment, Bill, Home or car matter, etc.) showed "Added" once it held any records. Since the box is revisited repeatedly to add more, "Added" wrongly implied the category was now complete/done rather than just non-empty.

`src/screens/FirstThingScreen.tsx`: replaced the "Added"/"Add" text with a small numeric badge showing `savedRecords.length` once a category has any records; an empty category still shows "Add" as before. New `countBadge`/`countBadgeLabel` styles alongside the existing `addAffordance` styling — no other layout change.

Two new tests in `tests/phase9-record-management.test.tsx` cover the badge showing the correct count with no "Added" text present, and the empty-category "Add" affordance still rendering. `npm run typecheck` and `npm test` (153 tests, up from 151) both pass.

## 10 September 2026 - Repeats: horizontal Weekly/Bi-weekly/Monthly/6-monthly/Annually pills

Product-owner request, revised twice in the same sitting: first to a Weekly/Monthly/Yearly toggle with no explicit "Never" (deselecting clears recurrence), then to a horizontal scrolling row of five pills — Weekly, Bi-weekly, Monthly, 6-monthly, Annually — confirmed via `AskUserQuestion` as a scrollable row of pill buttons rather than a draggable-thumb slider, matching the existing horizontal interest-selection carousel's interaction style.

`src/components/RecordEditor.tsx`: the "Repeats" field (bill/home-or-car-matter records only, unchanged) is now a horizontally scrolling `ScrollView` of five pill buttons. Bi-weekly is `{ interval: 2, unit: 'week' }` and 6-monthly is `{ interval: 6, unit: 'month' }` — both already expressible by the existing `RecordRecurrence` type, no type or migration change needed. Selection compares both `interval` and `unit` (previously `unit` alone, which would have conflated Weekly/Bi-weekly and Monthly/6-monthly). Tapping the already-selected pill clears recurrence to `undefined`, so there's no separate "Never" option. `docs/PHASE_9_ARCHITECTURE.md`'s reference to the old toggle wording updated to match.

New `tests/record-recurrence.test.tsx` (4 tests) covers all five options rendering, Bi-weekly/6-monthly storing the correct distinct interval, and deselecting clearing recurrence. `npm run typecheck` and `npm test` (151 tests, up from 147) both pass.

## 10 September 2026 - Remove a duplicated person from the relationship summary

Reported directly by the product owner: after accidentally adding "Dad" twice on the "Who are you helping?" flow (duplicates are allowed by design, e.g. two grandparents), there was no way to remove the extra entry from the collapsed relationship summary screen reached via "+ Add another person" — the only existing remove control lived on the later `PeopleReviewScreen`, which isn't reached until every person already has a name.

Added a `Remove` control per row in `RelationshipScreen`'s collapsed summary, gated behind a new optional `onRemovePerson` prop (no control renders when it isn't supplied, so the `PeopleReviewScreen`'s own fallback usage of this component is unaffected). `App.tsx` wires it to a new `removeDraftPerson(draftId)` handler, mirroring the existing `PeopleReviewScreen` remove logic exactly: filters the person out of the draft, reindexes remaining order, clears `currentDraftId` if it pointed at the removed person, and drops back to the `relationship` wheel stage if the list becomes empty.

Two new tests in `tests/multi-person.test.tsx` cover the control appearing and firing, and staying absent when no handler is supplied. `npm run typecheck` and `npm test` (147 tests, up from 145) both pass.

## 10 September 2026 - Corrective fix: self/someone-else fork not reachable on resume

Physical-device testing reported that onboarding still went straight to the old "Who are you helping?" relationship screen, bypassing the approved "Whose wellbeing are you looking to support with Lilica?" fork, despite the fork's code being present and correct.

Traced the live routing rather than assuming stale build/cache. `App.tsx`'s own render-time normalization (`renderAuthenticatedOnboarding`) and `completeProfile` both correctly route a genuinely fresh pass through onboarding to `careFork` via `initialPersonStage()`. The actual bypass was in `src/storage.ts`'s `prepareOnboardingStateForStartup`, called on every authenticated app startup/resume: it trusted a previously persisted `stage: 'relationship'` verbatim and returned it unchanged, because `'relationship'` was never in the small list of stages that function re-normalizes. Any account whose local storage had already reached the relationship screen — including from testing before the fork stage existed — would resume directly there on the next app open, permanently skipping the fork, even with zero care spaces or draft people.

Fix (smallest possible integration point, one file): `prepareOnboardingStateForStartup` now re-routes a resumed `stage: 'relationship'` back to `'careFork'` whenever no care space or in-progress draft actually exists yet — the same "has onboarding actually started" test `initialPersonStage()` already uses in `App.tsx`, duplicated inline with a comment to keep both in sync. A resume mid-relationship-selection (care space or draft already present) is left untouched, so an in-progress "Someone else" pass or an existing user is never forced back through the fork.

No other file changed. Nothing in Phase 7/8/9 persistence, occurrence, assignment or sync logic, Home, auth, or the database schema was touched. Two new regression tests added to `tests/storage.characterization.test.ts` covering both directions (fresh resume routes to the fork; a resume with an existing care space or draft does not). `npm run typecheck`, `npm test` (13 suites/145 tests, up from 143) and `npm run validate` (web export included) all pass.

The self/someone-else fork and the existing multi-person relationship carousel remain two independent, coexisting entry points into the same onboarding stage machine, as required — this fix only corrects which one a resumed session lands on.

## 10 September 2026 - Phase 9 everyday add and record management

Implemented by Claude per a written product-owner brief (`fork.txt`), the first phase-implementation task done directly by this session rather than committed on Codex's behalf. Codex is offline for approximately a week from this date.

Before writing any code, traced the current repository line by line (not assumption, not prior session memory) and established a `PRE_PHASE_9_BASELINE`: clean working tree at `46c1125` (already in sync with `origin/master`), TypeScript clean, 12 Jest suites/135 tests, 152 pgTAP assertions across 5 files, clean database lint, clean secret scan, clean web export.

The trace found that the brief's central deliverable — a category-gateway → list → add → edit → save workflow, with wheel date/time pickers and keyboard-safe compact editors — was **already fully implemented**, as part of the 10 September 2026 "Structured Category And Wheel-Picker Correction", and was already reachable from Home's everyday `Add` action (`onAddSomething` in `App.tsx` already routed to the `firstThing` stage regardless of setup status). It also found that a Phase 8 "occurrence" is a derived projection computed automatically from existing `LilicaRecord` fields, both locally and via a server-side trigger — there is no separate occurrence-mutation API for the UI to call, so editing through the existing save path was already canonical.

Given that, the actual Phase 9 work was narrower than the brief's full scope, and scoped down deliberately rather than reorganising what already worked:

- `src/screens/FirstThingScreen.tsx` gained an `everyday` prop (`App.tsx` passes `currentSpace?.setupStatus === 'ready'`), changing only the heading (`"[Name]'s records"` instead of `"Let's get [Name] organised."`), supporting text, and empty-category footer button (`"Back to Home"` instead of `"I'll add things later"`). The category-gateway/list/add/edit architecture itself is identical in both modes.
- `src/types.ts` gained one new optional field, `assignedMembershipId?: string`, on `FirstItem`/`LilicaRecord`.
- `src/components/RecordEditor.tsx` gained an `Assigned to: Unassigned / You` segmented control for appointment/task/bill/home-or-car-matter records, rendered only when an `activeMembershipId` prop is supplied (so nothing fabricates a populated care circle where none exists). `You` stores the organiser's own `care_space_membership.id` (threaded from `currentSpace.membershipId`, already loaded locally) — never a display name or email. The existing free-text `responsiblePerson` field ("Who's taking them"/"Who's dealing with it") is completely unchanged and independent of this control; both are saved together.
- No migration was created: `assignedMembershipId` rides inside the existing generic `record_data` JSONB already written by `apply_record_mutation(...)`, so no new schema, RPC, sync surface or RLS test was needed. The separate Phase 8 `assignments` table remains uncalled by any client code — deliberately deferred rather than speculatively wired up with only one possible assignee to exercise it against today.
- New tests: `tests/phase9-record-management.test.tsx` (8 tests) covering the everyday-copy variant, the Unassigned/You control storing a stable ID rather than a name, the legacy text field's independence, and that no Assigned-to control renders for record types that don't support it or when no membership is available.

Not changed: `bootstrap_supported_people`, `apply_record_mutation`, `apply_occurrence_mutation`, `PersonSwitcher.tsx`, `Wordmark.tsx`, `Screen.tsx`, `HomeScreen.tsx`, `records.ts`, `CareForkScreen.tsx`, any theme token, any migration, any RLS policy. `git diff --stat` after implementation: 4 files changed, 63 insertions, 4 deletions, plus 1 new test file — no unexpected files.

`PRE_PHASE_9_BASELINE` vs `POST_PHASE_9`: TypeScript clean both; Jest 12 suites/135 tests -> 13 suites/143 tests (net +1 suite/+8 tests, nothing disappeared); pgTAP 152 assertions unchanged (no migration); database lint clean both; secret scan clean both (127 -> 128 files); web export clean both.

Database contract preservation, individually verified: Phase 7 record IDs unchanged; `care_space_id` immutability untouched; Phase 8 occurrence IDs/derivation unchanged; recurrence history untouched; past-appointment `past_awaiting_outcome` semantics untouched (no code path touches appointment-passed logic); legacy responsibility text still never identity-linked; assignment still never grants visibility (no RLS policy was touched, and `assignedMembershipId` carries no access grant); no new cross-space access path exists (the field is scoped exactly like every other record field, per-care-space, via the same RLS `apply_record_mutation` boundary); no existing RLS test was weakened or removed (152 assertions, same 5 files); no already-deployed migration was rewritten.

Physical-device QA required before approval: see `docs/PHASE_9_QA.md`. Not committed or pushed pending that review, per the implementation brief.

## 10 September 2026 - Phase 8 physical-device QA passed

The product owner completed and confirmed the `docs/PHASE_8_QA.md` checklist on physical Android and iPhone devices. Phase 8 (committed as `019b88b`) is now physically approved, alongside Phases 5-7. Codex is offline for approximately one week; this session committed and pushed Codex's completed Phase 8 work on explicit product-owner instruction, and is now the sole active agent on this repository until Codex returns. Phase 9 still requires its own separate, explicit, bounded implementation prompt before any work begins — the passed QA checklist is not that authorisation.

## 10 September 2026 - Phase 8 core Record and Occurrence engine

- Added stable, care-space-owned canonical occurrences beneath existing Phase 7 records, with explicit date-only, local date/time and instant shapes.
- Added immutable occurrence snapshots, stable recurrence series, versioned recurrence rules and idempotent server mutation receipts. Explicit recurring completion creates exactly one deterministic next occurrence.
- Mapped the existing record editor model behind the current UI. Missing or malformed dates remain unknown; no historical occurrence is fabricated.
- Extended the existing account/care-space record cache and sync pass with occurrence projections and pull cursors. No second outbox or sync engine was introduced.
- Added server-only stable assignment and external-contact foundations. Membership UUID is identity; display name is a snapshot; legacy responsibility text never auto-links; assignments never participate in access policies.
- Preserved Claude's approved Home redesign and self/someone-else fork without UI changes. Calendar, To Do, assignment controls, collaboration, invitations and notifications remain deferred.
- Added focused domain/cache tests and 57 Phase 8 pgTAP assertions. `npm run validate:all` passes 12 Jest suites/135 tests and 152 database assertions with clean lint. A one-migration linked preview was applied to `lilica-development`; linked tests/lint pass and migration histories match. Phase 8 physical-device QA remains outstanding; work is intentionally uncommitted pending review.

## 10 September 2026 - Self/someone-else onboarding fork

Bounded implementation authorised via a written product-owner brief (`fork.txt`) after a full line-by-line trace of Codex's Phase 6/7 implementation confirmed no self-care semantic existed anywhere in the app: the `Relationship` type, the relationship-wheel copy, and the `care_space_memberships_relationship_type` database CHECK constraint were all a closed set of third-person relationships only (`Mum, Dad, Partner, Child, Grandparent, Other relative, Someone else`) with no way to represent the organiser's own care space. Confirmed as the situation the brief calls "D" (a genuine architectural gap, not a hidden or unexposed existing semantic) before writing any code.

The smallest addition that integrates with the existing architecture rather than replacing it:

- Added `'Myself'` as a new value to the existing `Relationship` type (`src/types.ts`) and the `relationships` option list (`src/data/options.ts`) — not a new type, not a parallel identity system.
- New screen `src/screens/CareForkScreen.tsx`: `Whose wellbeing are you looking to support with Lilica?`, two `ChoiceTile`s (an existing, previously-unused component matching the app's visual language exactly), Myself / Someone else.
- New onboarding stage `'careFork'`, inserted into `App.tsx`'s `stageOrder` between `aboutYou` and `relationship`. It only ever governs the very first pass through person setup (`initialPersonStage()` checks whether any care space or in-progress draft already exists); `startAddPerson()`, the existing "add another person" path, is untouched and always goes straight to the relationship wheel.
- Choosing **Myself** creates a person draft with `relationshipType: 'Myself'` and `displayName` prefilled from the organiser's own `About you` profile name (never re-asked), then feeds it into the exact same `relationshipSummary` → identity-pass → `peopleReview` → `bootstrap_supported_people` pipeline any other relationship choice already uses — so back navigation, edit, add-another and provisioning retry/idempotency are all the existing, already-tested behaviour, not new code paths.
- Choosing **Someone else** continues into the existing relationship wheel unchanged. `Myself` also appears there as a normal option (for adding yourself after starting with someone else), but is hidden once it is already represented — in the current draft or an already-provisioned care space (`RelationshipScreen`'s new optional `selfAlreadyUsed` prop) — so it can never be picked twice.
- `NameScreen.tsx`: fixed the title shown when editing/confirming a Myself draft (`Just to confirm, what should we call you?`) — the existing generic title would otherwise have read "What's your myself's name?".
- New migration `supabase/migrations/20260910160000_myself_relationship_type.sql`: extends the existing `care_space_memberships_relationship_type` CHECK constraint to accept `'Myself'`, and adds a partial unique index (`care_space_memberships_one_self_per_user`) so at most one `Myself` membership can exist per user — enforced at the database, not only client UI. No new table, no change to `bootstrap_supported_people`'s logic (it already accepted any string satisfying the constraint). Applied to `lilica-development` via `supabase db push --linked --dry-run` then `--linked` push; the dry-run listed exactly this one migration.
- New pgTAP file `supabase/tests/database/myself_relationship.test.sql` (6 assertions): Myself provisions through the existing RPC, the stored value is exactly `'Myself'`, a second Myself for the same user is rejected (`23505`) with no partial care space left behind, and the one-per-user rule is per-user rather than global.
- New Jest file `tests/care-fork.test.tsx` (6 tests) covering `CareForkScreen`'s two routes, `validatePersonDraft` accepting a Myself draft without a custom label, the wheel offering and then hiding Myself, and `NameScreen`'s corrected copy.

Not changed: `bootstrap_supported_people`'s PL/pgSQL body, `PersonSwitcher.tsx`, `careSpaceState.ts`'s provisioning/reconciliation functions, Phase 7 record/cache/sync/RLS, and Home (verified Home's existing copy — `Everything for [Name], in one place.` — already reads naturally for a Myself care space using the organiser's own name; no correction was needed there).

Verification: `npm run validate` (TypeScript, 12 Jest suites/129 tests, secret scan, dependency/config checks, web export) and `npm run validate:backend` (local database rebuild, 95 pgTAP assertions, schema lint) both pass; the same 95 assertions and a clean lint were re-run against the linked `lilica-development` database after the migration was applied.

Follow-up, same day, product-owner approved: `InterestsScreen` gained an optional `isSelf` prop (`App.tsx` passes `currentSpace?.relationshipType === 'Myself'`, the same existing semantic, no new concept) so `What do you help [Name] with?` becomes `What would you like help staying on top of?` for a Myself care space. `FirstThingScreen`'s `Let's get [Name] organised.`/`Go to [Name]'s Home` were checked and left as-is — they already read naturally using the organiser's own name. The privacy declaration's wording was deliberately left unchanged: it is protected, versioned legal copy (`privacy-basis-v2`), its existing generic phrasing ("the person you support") already parses correctly for a Myself space, and editing it would need a version bump and legal/product sign-off outside this task. Added `tests/care-fork.test.tsx` coverage for both the self and non-self interests copy. Full `npm run validate` re-run: 12 suites/130 tests, all pass.

## 10 September 2026 - Home presentation redesign

A browser mockup was reviewed and approved by the product owner, then authorised by GPT (development oversight) with an explicit architectural boundary: no new domain/aggregation semantics in `src/records.ts`, no permanent "To Do" record-category rule, and everything contained to `src/screens/HomeScreen.tsx`.

Changes, all inside `HomeScreen.tsx`:

- Header now leads with the `Wordmark` component (reused, not recreated) as the dominant element.
- The old dismissible "Everything for [Name], in one place" banner and the small "[Name]'s week ⌄" switcher trigger are both replaced by one persistent, tappable card (no Dismiss action) that opens the existing `PersonSwitcher` unchanged. It's shown regardless of setup status, preserving the same always-reachable switcher access the old header trigger had.
- New horizontal-scroll snapshot row beneath it: To do / Bills / Home matters / Appointments, each a truthful count of not-completed records of that type, computed locally with the existing `deriveRecordState()` — no new selector was added to `records.ts`. Hidden entirely when there are no records, per the existing documented rule to omit empty sections rather than show zero counts. The caption is the single word "open" everywhere, since that is the only word truthful for every category under the current record model; "To do" is a display label for today's `task` type only, not a claim about the future Phase 8 actionable-occurrence projection.
- Section item cards (Needs attention/Today/Coming up/Latest — `sectionFor()`'s own four-way classification is unchanged) moved from a single-column list with one uniform accent bar to a two-column grid, each card carrying a small category-tonal icon and an explicit "Overdue" label shown only when the existing `deriveRecordState(item).overdue` is true.
- Category icons for all eight record types are drawn from plain `View`/border shapes (the same technique already used by `Wordmark`'s leaf mark and `PersonSwitcher`'s tick) — no icon-library dependency was added.
- Category eyebrow/snapshot labels are looked up from the existing `firstItemOptions` list in `src/data/options.ts`, not a separate invented label set.

Not changed: `sectionFor()` classification, `PersonSwitcher.tsx`, `Wordmark.tsx`, `records.ts`, `Screen.tsx`, `TabBar.tsx`, `colors.canvas` or any other theme token, dependencies, and no Phase 7/8 code.

Verification: `npm run validate` — TypeScript, 11 Jest suites/123 tests (including the existing characterization tests asserting Home's empty-state and Needs-attention classification, unmodified and passing), secret scan, dependency/config checks and web export all pass.

Physical-device QA still required: long person names and long record titles in the new cards, and the horizontal snapshot row on a narrow phone.

## 10 September 2026 - Phase 7 record persistence, cache, sync and migration

- Added care-space-owned Supabase records, generated domain/sensitivity classification, active-membership RLS, protected audit/version fields, tombstone deletion and idempotent mutation receipts.
- Added an account/care-space-scoped AsyncStorage record cache with stable identity mappings, migration checkpoints, semantic outbox, capped retry, durable conflict/rejection state and change cursors.
- Preserved valid UUIDs and deterministically mapped historical non-UUID IDs; migrated responsibility as descriptive text/provenance only with no identity inference.
- Added explicit-base reconciliation: non-overlapping stale fields merge, overlapping edits conflict, and stale deletes cannot erase newer work.
- Kept attachment bytes and URIs local while persisting non-URI metadata; no Storage bucket, OCR or sharing was added.
- Added fresh-device care-space discovery without inferring local privacy/setup completion, plus focused application and pgTAP coverage.
- Added `docs/PHASE_7_ARCHITECTURE.md` and `docs/PHASE_7_QA.md`. The product owner subsequently completed and approved the Phase 7 physical-device checklist on Android and iOS. Phase 8 was not started.
- `npm run validate:all` passed TypeScript, 11 Jest suites/123 tests, secret scanning, Expo dependency/config checks, web export, a clean local database rebuild, 89 pgTAP assertions and database lint.
- Sync ordering now prevents later operations from overtaking an unresolved mutation for the same record; unrelated remote records continue reconciling past a conflict without advancing the durable cursor beyond that conflict.
- A linked dry run listed only `20260910150000_phase7_records.sql`; that migration was applied to `lilica-development`. All 89 linked pgTAP assertions and linked database lint then passed, and local/remote migration histories matched.
- No production project, Auth configuration, Storage resource, seed or role configuration was changed. Phase 7 is approved for its completed repository checkpoint.
- The passing responsive Jest suite emitted an asynchronous React `VirtualizedList`/`act(...)` warning. It is recorded as an out-of-scope test-harness issue and was not altered in Phase 7.

## 10 September 2026 - Assignment and collaboration roadmap locked

- Made stable assignment identity and independently server-enforced visibility an authoritative product invariant.
- Assigned legacy responsibility migration to Phase 7, assignment entities/defaults/occurrence overrides to Phase 8, editor controls to Phase 9, To Do projections to Phase 12, and real member population/permissions/revocation to Phase 15.
- Locked no name/email auto-matching, no implicit permission from assignment, active-membership-only assignment, separate zero-access external contacts, non-mandatory acceptance at initial launch, and historical attribution after revocation.
- Added role/capability/domain boundaries and a roadmap-level acceptance matrix covering identity changes, cross-space isolation, legacy text, permissions, pending invitations, helper restrictions, revocation and stale offline replay.
- No application code, schema or Supabase resource was changed for this architecture decision. The present free-text field remains until its approved replacement phase.
- Product-owner physical-device testing also confirmed the corrected keyboard behavior and password, verification-code, check-email and password-reset paths before the Phase 6 checkpoint.
- The checkpoint passed `npm run validate:all`: 10 Jest suites/110 tests, secret scanning, Expo dependency/config checks, web export, local database reset, 49 pgTAP assertions and database lint.

## 10 September 2026 - Home and car category expansion

- Expanded the user-facing `Home matter` category to `Home or car matter` across Welcome, interests, structured record entry and record-management actions.
- Renamed the interest to `Home, car & bills` and clarified that it includes repairs, servicing and renewals.
- Added MOT, vehicle service and maintenance examples while retaining the distinction between matters and bills/renewals.
- Preserved the internal `homeMatter` identifier so existing stored records and migrations remain compatible.
- Updated exact-copy regression coverage and current product/handoff documentation.

## 10 September 2026 - Keyboard-avoidance corrective task: Password and CTA trapped behind the keyboard

Physical-device testing after the prior keyboard correction still showed the Password field (and, once that was fixed, the Create Account/Log in CTA) clipped or hidden behind the open keyboard on Android, and initially on iOS too. Root-caused and fixed in three passes rather than patched with fixed offsets:

- **Reveal math replaced.** `KeyboardAwareScrollView`'s legacy `scrollResponderScrollNativeHandleToKeyboard` compared a field's position (relative to the ScrollView) against the keyboard's reported screen position (relative to the original, pre-resize window) — two different coordinate spaces that disagree once Android's `softwareKeyboardLayoutMode: resize` shrinks the window, so the computed offset collapsed to zero and nothing scrolled. Replaced with two chained `UIManager.measureInWindow` calls (container, then field) in the same coordinate space. The actual overflow arithmetic was extracted into a pure, directly-testable function, `src/keyboardReveal.ts`.
- **Async race fixed.** The first replacement still failed identically on iOS and Android: the container measurement was written by its own independently-timed native call, and `reveal()` only waited one `requestAnimationFrame` before reading it — not the same as waiting for that native round-trip to land — so it kept reading a stale, pre-keyboard (full-height) container size. Fixed by chaining the native callbacks together instead of guessing timing, plus a corrective re-measure shortly after focus for a still-animating keyboard.
- **Footer/CTA co-visibility added.** The product owner clarified the requirement: field and CTA should both remain visible together as the keyboard opens, standard mobile behaviour, not merely reachable by a further manual scroll. `KeyboardAwareScrollView` now accepts an optional ref to trailing content (the screen's footer), and `Screen` wires its own footer through automatically. The reveal target now spans from the focused field down through the footer's bottom, with the field's own top as a hard ceiling so it is never scrolled off-screen chasing a CTA that cannot fit alongside it on an extremely short viewport.
- **Android's real root cause found.** After the above, iOS worked correctly but Android's screen stayed completely static as the keyboard opened — no resize at all, confirmed by direct visual observation on-device. `app.json`'s `android.softwareKeyboardLayoutMode: resize` is native `AndroidManifest.xml` configuration; Expo Go is a pre-built generic host app with its own fixed manifest and never applies a loaded project's native Android config — only a custom dev client or a standalone/production build does. `src/keyboard.ts` now detects Expo Go at runtime via `expo-constants`'s `executionEnvironment` and gives Android the same JS-driven `KeyboardAvoidingView` behaviour (`'height'`) iOS already had, only inside Expo Go; a real dev-client/standalone build keeps Android's behaviour `undefined` so the native `resize` config is not double-compensated once it actually applies.

Files changed: `src/keyboard.ts`, `src/components/KeyboardAwareScrollView.tsx`, `src/components/Screen.tsx`, `src/keyboardReveal.ts` (new), `package.json`/`package-lock.json` (added `expo-constants` as a direct dependency), `tests/keyboard-reveal.test.ts` (new), `tests/keyboard.test.ts` (new). No other screen, dependency, backend/Supabase resource or Phase 7 work was touched.

Verification: `npm run validate` passed — TypeScript, 10 Jest suites/110 tests (108 prior plus 6 new keyboard-reveal cases and 3 new Expo-Go-detection cases), secret scan, `npx expo install --check`, `npx expo config --type public` and web export. Confirmed by the product owner on physical Android and iOS devices in fresh Expo Go sessions: Password (and any other field) and the footer CTA both become visible together as the keyboard opens, and Android now visibly resizes/pads instead of staying static.

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
