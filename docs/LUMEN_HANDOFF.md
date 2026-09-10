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
- Canonical care-space-owned occurrences, versioned recurrence rules/history and a server-side assignment/contact identity foundation.
- Active-person switching, add-person and resume-incomplete-setup flows.
- Eight real record categories with category lists, multiple stable record IDs and compact editors.
- Wheel-based date/time selection, local document upload/camera capture and real-record-only Home sections.
- Everyday record management from Home (the same category-gateway screen as onboarding) with a stable-identity `Assigned to: Unassigned/You` control alongside the unchanged legacy responsibility text.
- Calendar: a month grid plus selected-day list, projecting the same records Home reads (canonical roadmap Phase 11 — see the roadmap numbering note below).
- To Do (Phase 12): open task/bill/home-or-car-matter records grouped into Overdue/Today/Upcoming, with All/Mine/Unassigned assignment filters and completion sharing the record editor's own canonical transition.
- Person (Phase 13): a durable-knowledge projection of contacts, care/health information, home information, documents and bills/renewals, with no medical/legal inference and explicit (never name-matched) self-care wording.

Phase 7 record persistence, cache, sync and safe migration, Phase 8's core Record -> Occurrence engine, and Phase 9's everyday add/record management are implemented, validated and physically approved through Phase 8 (product-owner QA passed 10 September 2026 — see `docs/PHASE_8_QA.md`); Phase 9, Calendar, Phase 12 and Phase 13 physical QA are outstanding (`docs/PHASE_9_QA.md`, `docs/PHASE_10_QA.md`, `docs/PHASE_12_QA.md`, `docs/PHASE_13_QA.md`). Assignment invitations/real collaboration, cloud attachment bytes and production infrastructure are not implemented.

**Roadmap numbering note:** the Calendar work was implemented and committed under the working label "Phase 10", but `docs/CORE_SYSTEM_CONTRACT.md`'s canonical roadmap defines it as **Phase 11 — Calendar Projection** (its Phase 10, Home Projection, was effectively already delivered by the earlier Home redesign work). Historical commits and doc entries that say "Phase 10" for Calendar are not renamed or rewritten; numbering simply resumes canonically from Phase 12 (To Do) onward.

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
- `occurrences`, immutable `occurrence_versions`, recurrence series/rules and idempotent occurrence mutation receipts.
- `assignments` and `care_space_contacts` as server-only stable-identity foundations; neither grants access.

Device-local now:

- Privacy acknowledgement, interests, setup progress, record cache/outbox/conflicts and attachment files/full local references.
- These are partitioned by authenticated user and care space and survive sign-out on that device.

Read `docs/PHASE_7_ARCHITECTURE.md` for identity, migration, cache, retry, conflict and attachment rules. The only current record participant is an active organiser. Phase 15 grants remain future work.

Hosted development Auth uses mandatory confirmation, minimum eight-character passwords, custom Resend SMTP from `Lilica <auth@luxfordinteractive.com>`, and six-digit confirmation and recovery templates. Credentials are secret hosted configuration and must never enter Git or the mobile bundle.

Never run a blind full `supabase config push`; the base local config intentionally differs from remote operational settings. Use `config diff` and a narrowly scoped temporary config. Never use another Luxford project and never create/touch production without explicit approval.

## Validation Baseline

The Phase 9 implementation passes `npm run validate:all`: TypeScript, 13 Jest suites/143 tests (12 suites/135 tests pre-Phase-9, plus 1 new suite/8 new tests), secret scanning, Expo dependency/config checks, web export, clean migration replay, and the same 152 pgTAP assertions and warning-level database lint as Phase 8 — Phase 9 needed no migration, since its one new field rides inside the existing generic `record_data` JSONB.

The Phase 8 implementation passes `npm run validate:all`: TypeScript, 12 Jest suites/135 tests, secret scanning, Expo dependency/config checks, web export, clean migration replay, 152 pgTAP assertions and warning-level database lint. The linked Phase 8 dry run listed exactly `20260910170000_phase8_occurrence_engine.sql`; it was applied only to `lilica-development`, where the same 152 assertions and clean lint pass. Local and linked histories match through `20260910170000`.

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

On 10 September 2026, the product owner confirmed the corrected keyboard behavior and the password, verification-code, check-email and password-reset paths working on physical devices. The same day, the product owner also confirmed the Phase 8 physical-device QA checklist (`docs/PHASE_8_QA.md`) passed on Android and iPhone. Codex is offline for approximately a week from this date; Claude is the sole active implementation agent on this repository until Codex returns, and committed/pushed Codex's completed Phase 8 work on explicit product-owner instruction before taking over Phase 9.

Phase 8 is implemented, committed and physically approved. Phase 9 (everyday add/record management, and a stable-identity Assigned to: Unassigned/You control) is implemented and validated; its physical-device checklist (`docs/PHASE_9_QA.md`) is outstanding. Preserve the Phase 7 ownership/sync contracts, the Phase 8 Record -> Occurrence/history boundaries, and the Phase 9 Assigned-to control's Unassigned/You-only scope. Do not begin Phase 10 without its own separate, explicit, bounded implementation prompt.

## Approved Future Assignment Boundary

The `responsiblePerson?: string` field is preserved exactly, unchanged, alongside the new Phase 9 control below — not replaced by it. Do not build a cosmetic care-circle selector.

The authoritative sequence is:

1. Phase 7 preserves legacy responsibility text and provenance exactly, creates no assignment by name/email matching, and gives cloud records stable care-space identity. This is implemented and approved.
2. Phase 8 introduces the stable membership/external-contact assignment entity foundation and display snapshots. It is implemented server-side; assignment controls and full activity remain deferred.
3. Phase 9 adds a data-driven `Assigned to: Unassigned/You` control (`assignedMembershipId` on the record, stored inside existing `record_data`, no migration) alongside the unchanged legacy responsibility text, kept restrained while only Unassigned/You exist. This is implemented and validated.
4. Phase 12 projects Assigned to me, Assigned to others and Unassigned using stable membership IDs.
5. Phase 15 supplies invitations, active care-circle members, role/capability/domain permissions, selector population and immediate revocation behavior — at which point the Phase 9 control extends to list other active memberships.

Responsibility never grants visibility. Permission is enforced independently by server-side RLS/capability/domain checks. Pending or inactive memberships are not assignable; external contacts have zero application access. See sections 8, 11, 12, 17 and 18.6 of `docs/CORE_SYSTEM_CONTRACT.md`.

## Self/Someone-Else Onboarding Fork (10 September 2026)

The onboarding now opens person setup with `Whose wellbeing are you looking to support with Lilica?` (`CareForkScreen`) before the first-ever relationship wheel — see `docs/REVISION_LOG.md` for the full writeup. This governs only the initial setup path, not a permanent account mode; `startAddPerson()` (adding someone later) always goes straight to the existing wheel unchanged. `Myself` is one new value in the existing `Relationship` type and the database's `care_space_memberships_relationship_type` CHECK constraint — no parallel identity system. A new partial unique index enforces at most one `Myself` membership per user at the database level. Deployed to `lilica-development`: migration `20260910160000_myself_relationship_type.sql` applied via dry-run then push; all 95 pgTAP assertions (89 prior + 6 new) pass against both local and linked databases; linked lint clean.

Interests copy now adapts for a Myself care space (`InterestsScreen`'s `isSelf` prop, driven by the existing `relationshipType === 'Myself'` semantic): `What would you like help staying on top of?` instead of `What do you help [Name] with?`. The privacy declaration's third-person wording was deliberately left unchanged — protected, versioned legal copy (`privacy-basis-v2`); still parses correctly for a Myself space, and editing it is a legal/product decision outside this task.

## Home Redesign (10 September 2026)

Home's presentation was reorganised — see `docs/REVISION_LOG.md` for the full writeup. Wordmark-led header, a persistent person-switcher card (replacing the old dismissible tip banner and small text trigger), a horizontal category snapshot row, and category-tonal icon cards. Entirely contained to `src/screens/HomeScreen.tsx`: `sectionFor()` classification, `PersonSwitcher.tsx`, `Wordmark.tsx`, `records.ts`, and the `colors.canvas` theme token are all unchanged. Snapshot counts remain computed locally from already-loaded records; Phase 8 deliberately did not replace this protected presentation with a later canonical Home projection.

## Phase 9 Everyday Add And Record Management (10 September 2026)

Full writeup in `docs/PHASE_9_ARCHITECTURE.md`. A line-by-line trace before writing any code found that the category-gateway/list/add/edit architecture Phase 9's brief describes was already fully implemented (the 10 September 2026 "Structured Category And Wheel-Picker Correction") and already reachable from Home's everyday `Add` action — Phase 9 did not need to build or redesign it. What was actually added: an `everyday` copy variant on `FirstThingScreen` (heading/footer text only, same screen/architecture either way), and a stable-identity `Assigned to: Unassigned/You` control on `RecordEditor` for appointment/task/bill/home-or-car-matter records, storing the organiser's own `care_space_membership.id` — never a name or email — alongside the unchanged legacy `responsiblePerson` free text. No migration was needed; `assignedMembershipId` rides inside the existing `record_data` JSONB. No client code calls the separate Phase 8 `assignments` table's `create_assignment(...)` RPC yet — that remains available for a later phase once real multi-member collaboration exists to exercise it.

Not changed: `bootstrap_supported_people`, `apply_record_mutation`/`apply_occurrence_mutation`, `PersonSwitcher.tsx`, `Wordmark.tsx`, `Screen.tsx`, `HomeScreen.tsx`, `records.ts`, `CareForkScreen.tsx`, any theme token, any migration, any RLS policy.

## Calendar Projection (10 September 2026, canonical roadmap Phase 11)

Full writeup in `docs/PHASE_10_ARCHITECTURE.md` (filename kept from the original working label; see the roadmap numbering note above). Calendar reads `state.records` — the same active-care-space projection Home reads — and resolves each record's calendar date via a new `calendarDateForRecord()` in `records.ts`, mirroring `domain/recordOccurrence.ts`'s existing date-field priority. Opening an item reuses the established record editor via a new one-shot `initialOpenRecordId` prop on `FirstThingScreen`. `CategoryIcon`/`categoryLabel`/`visualFor`/`StatusIcon` were exported from `HomeScreen.tsx` (previously private) so Calendar and To Do share the same icon language.

## Phase 12 To Do Projection (10 September 2026)

Full writeup in `docs/PHASE_12_ARCHITECTURE.md`. To Do projects genuinely actionable work — open task/bill/home-or-car-matter records, per `docs/CORE_SYSTEM_CONTRACT.md` section 9.3 — into Overdue/Today-Needs-doing/Upcoming (30-day horizon, matching Home's own Coming Up window). Appointments, documents, contacts, care information and updates never appear. A new `isActionableRecord()` in `records.ts` and a new `completionUpdate()` in `RecordEditor.tsx` (the exact status/completed/completedAt/confirmationHistory transition `RecordEditor.save()` already applies inline, factored out so both produce byte-identical results) are the only new domain logic. Assignment filters (All/Mine/Unassigned) use Phase 9's stable `assignedMembershipId`; legacy `responsiblePerson` text is never treated as assignment. No migration, no RLS change, no new assignment representation.

## Phase 13 Person Projection (11 September 2026)

Full writeup in `docs/PHASE_13_ARCHITECTURE.md`. New `PersonScreen.tsx` groups `state.records` into five durable-knowledge sections (contacts/care/home/documents/bills), each backed by an existing record type, omitted when empty. Appointments/tasks/updates never appear. A small structural discovery drove one necessary cross-cutting change: the tab labelled with the supported person's name previously rendered `AccountScreen` (the organiser's own account settings) under copy promising a person knowledge space it never delivered — `AccountScreen` is now reached via a new "Account" link in Person's header (its own content otherwise unchanged, minus that stale copy) so sign-out remains reachable. `FirstThingScreen` gained a sibling `initialOpenType` prop (alongside Phase 10's `initialOpenRecordId`) so Person's per-section Add links open a new draft of the right category directly, through the same established creation architecture.

## Protected And Deferred

Preserve Welcome, privacy gating/version/timestamp, organiser/supported-person separation, local account isolation, multi-person care-space separation, category/multi-record behavior, wheel selectors, record-sheet gestures, real-record-only Home, the current Home presentation, Calendar, To Do, and the Phase 9/Phase 12/Phase 13 everyday-copy/Assigned-to/To-Do/Person scope described above.

Deferred: linked-action UI, collaboration/invitations, real multi-member assignment (the `assignments` table itself), reminders/notifications, cloud document storage/OCR, search/history, production Ask Lilica, production infrastructure, backup guarantees and account/care-space deletion policy.
