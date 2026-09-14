# Lilica Current Handoff

Date: 13 September 2026
Branch: `master`
Remote: `origin` (`https://github.com/davidmaruta2/lilica`)

Despite its legacy filename, this is the canonical current handoff for every incoming agent.

## What Lilica Is

Lilica is a calm personal and family care organiser. An organiser keeps appointments, tasks, bills, home or car matters, documents, contacts, care information and updates separately for each person they support. It is not a clinical system, surveillance product, emergency monitor or generic family calendar.

Read `docs/PROJECT_BRIEF.md`, `AGENTS.md`, `docs/SUPABASE_OPERATIONS.md` and `docs/CORE_SYSTEM_CONTRACT.md` before implementation.

**Current:** Phase 19 - Production Hardening & Release Readiness is implemented and validated (13 September 2026) - see `docs/PHASE_19_ARCHITECTURE.md`/`docs/PHASE_19_QA.md`. A real, committed, fully-cleaned-up two-account collaboration and account-deletion rehearsal against `lilica-development` closed out Phase 18B's own outstanding server-side two-account QA item; RLS/permission, dependency/security, accessibility (static) and store/release-config reviews found no release-blocking defect. Physical-hardware-only items (offline/restart, screen-reader, device matrix, reminders on a dev build, performance feel) are honestly marked NOT RUN, not fabricated. Not yet committed. **Production release remains a separate, explicit product-owner go/no-go, not implied by Phase 19's completion.** Phase 19 is NOT the final remaining work.

**Future approved roadmap (added 13 September 2026, documentation only, none started):** Phase 20 - Competitive Gap Review & Carer-Focused Enhancements; Phase 21 - Billing, Subscription & Membership/Entitlement; Phase 22 - Premium Visual Optimisation & Experience Polish. See `docs/CORE_SYSTEM_CONTRACT.md` for the canonical wording of each, including Phase 20's and Phase 22's mandatory audit/approval gates before any implementation. Do not begin any of these without their own separately approved implementation prompt.

**Phase 20 update (13 September 2026): COMPLETE, physically tested and approved by the product owner ("tested and it works"), committed and pushed (`1bcbf2a`).** Phase 20A's audit (`docs/PHASE_20_GAP_AUDIT.md`) identified several genuine gaps against Jointly/Carers UK; Phase 20B then implemented exactly the three approved candidates - Recent Activity/Care History, Unified Current-Person Search, and Care/Handover Summary - see `docs/PHASE_20_ARCHITECTURE.md`/`docs/PHASE_20_QA.md`. Every other Phase 20A candidate remains explicitly not implemented.

**Phase 21 update (14 September 2026): Phase 21A (architecture proposal) reviewed; Phase 21B (server/client billing implementation) and Phase 21C (proactive read-only UX + closure) are both complete, not yet committed. Phase 21 is now engineering-complete.** Final approved commercial model: 60 days completely free, then £8.99/year, one subscription per account covering every care space it commercially owns - unchanged by Phase 21C. See `docs/PHASE_21_ARCHITECTURE.md` (section 23 for Phase 21C specifically)/`docs/PHASE_21_QA.md`. Server enforcement is fully implemented and proven by 341 pgTAP assertions (local and on `lilica-development`, unchanged by Phase 21C - no schema change); client-side entitlement display, RevenueCat integration, and the Subscription Settings surface are implemented and unit-tested. Phase 21C closed the one gap Phase 21B's own completion report named: a user could previously begin a mutation flow while expired and discover only at Save time that it couldn't be saved - a centralised `isReadOnly`/`guardMutation` mechanism now proactively blocks exactly the entry points the server itself gates, with a genuine owner/collaborator copy distinction and no exposure of another account's billing detail. **Purchases still cannot be exercised in this environment** (Expo Go cannot run native purchases; no RevenueCat project/store products/development build exist yet) - an incoming agent should not claim physical purchase/webhook QA, or this read-only UX's own on-device QA, has happened; both checklists are prepared but NOT RUN in `docs/PHASE_21_QA.md`. Phase 22 has not started.

**Home/Search interaction refinement (`search4.txt`), 14 September 2026: implemented, validated, committed and pushed.** A bounded UI/interaction refinement, not a redesign, matching an approved mock: Home's avatar grew to 56px with the supported person's first name shown directly beneath it, and the search affordance moved out of the header into its own real search-bar-styled element (magnifying-glass glyph immediately followed by "Everything for [Name], in one place.", no gap between them per product-owner correction) that still opens the same existing dedicated Search screen. The dashboard strip gained left/right scroll chevrons with real measured enable/disable state, without replacing swipe. `SearchScreen.tsx` needed no code change - it already met every requirement; only tests were added. No Home/Search domain logic changed. See `tests/search4-home-refinement.test.tsx`.

**Standing rule, 14 September 2026: no em-dashes or en-dashes anywhere in this repository** (UI copy, code, docs, commit messages) - use a plain hyphen instead. A full repository sweep removed every existing instance; do not reintroduce one.

**Standing requirements before the first real EAS build, 14 September 2026 (none actioned yet - no `eas.json`/EAS project exists for Lilica):** no `eas build` without the product owner's explicit, express consent for that specific build; iOS is phone-only (`app.json`'s `ios.supportsTablet` is now `false`, so TestFlight never asks for iPad screenshots); OTA (`expo-updates`) must be enabled starting with the very first build, not added later. Full detail: `docs/PHASE_19_ARCHITECTURE.md`'s matching addendum.

**Remove-supported-person, Phase 20C drawer navigation, FAQ/How to use Lilica/Contact, 14 September 2026: implemented, validated, not yet committed (as of that entry).** A genuinely missing organiser capability (`delete_care_space()`) was built; the approved Phase 20C Option 2 drawer change ("[Name]'s care" above Account) was implemented, corrected once after live testing to render Care Summary/Recent Activity IN-DRAWER rather than as a full-screen overlay; a Help group (How to use Lilica, FAQ, Contact) was added. See `docs/REVISION_LOG.md`'s matching entries for full detail.

**Phase 20D structural closure (`\downloads\20-22.txt`), 15 September 2026: implemented, validated, not yet committed.** The approved final pre-Phase-22 architecture pass: an explicit reversible ARCHIVED care-space state (server-enforced via the one shared `can_access_care_space_records()` write-gate, plus a dedicated `ArchivedGate.tsx`); permanent deletion tightened so multiple active organisers must all agree (a new request/approve/decline/cancel consent flow) while a sole organiser's existing checkbox-confirmed flow is unchanged; organiser handoff (`promote_to_organiser()`); a Documents collection (`DocumentsScreen.tsx`, a pure projection over the existing `record_attachments` table, no new schema); and a consolidated `ManageCareScreen.tsx` ("Manage [Name]'s care") with an explicit dangerous-action hierarchy. The Settings drawer's final person-scoped structure is now Care Summary/Recent Activity/Documents/Manage [Name]'s care. Full detail, exact diff classification and validation results: `docs/REVISION_LOG.md`'s matching entry. **Phase 22 has still not started** - this pass was explicitly the structural work meant to settle the surfaces Phase 22 will subsequently polish.

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
- Calendar: a month grid plus selected-day list, projecting the same records Home reads (canonical roadmap Phase 11 - see the roadmap numbering note below).
- To Do (Phase 12): open task/bill/home-or-car-matter records grouped into Overdue/Today/Upcoming, with All/Mine/Unassigned assignment filters and completion sharing the record editor's own canonical transition.
- Person (Phase 13): a durable-knowledge projection of contacts, care/health information, home information, documents and bills/renewals, with no medical/legal inference and explicit (never name-matched) self-care wording.
- Reminders (Phase 14): a local-only "Remind me" toggle on appointment/task/bill/homeMatter records, quiet hours and a master switch in Account. Notification-delivery state (scheduled, sent, dismissed, snoozed) is strictly separate from record truth. Server/push delivery is not implemented.
- Care Circle (Phase 15): real invitations to Contributor/Viewer roles with explicit per-domain (general/health/financial/home/documents) permission grants, reviewed before sending; an invitee-facing Invitations screen that auto-surfaces once per app session with Accept/Decline; a real Assigned-to selector populated from active eligible members; server-enforced assignment-visibility (a record can never be assigned to someone without read access to its domain, checked on every mutation including offline replays); immediate-effect removal/leaving reusing the existing membership_status lifecycle; sole-organiser safety. No push/email delivery of the invitation itself yet (discovery is in-app only) - see `docs/PHASE_15_ARCHITECTURE.md`'s "What Is Deliberately Not Built Yet". Its server-side enforcement (organiser-unconditional, contributor/viewer by explicit domain grant, revoked-membership-never) has since been re-verified end-to-end against the deployed database and its own pgTAP tests - see that same doc's 12 September 2026 addendum.
- Record-open architecture (11 September 2026): a genuine "flash" bug (the wrong screen briefly visible behind the record sheet) was root-caused to `openRecordFromProjection` navigating the whole app to `FirstThingScreen` just to host the editor, and fixed with `src/components/RecordQuickEditor.tsx` - the same `RecordSheet`+`RecordEditor`/`RecordDetail` pairing, mounted as an overlay over whichever screen already shows, so nothing behind the sheet ever changes. An existing record now opens a shared, read-only `RecordDetail` first (view/edit separation, gated by the real Phase 15 capability check); a brand-new draft still goes straight to the editor as before.
- People tab (Corrective Task 10, 11 September 2026): the fourth tab, renamed from Person/Care Circle to **People**, now centres on Supported people / Key contacts / the real Care circle (Phase 15 membership list) / an Ask Lilica placeholder - no longer a duplicate of Home's own bills/home/documents/care-note listing. Record types are untouched in storage.
- Visual pass (11 September 2026): Calendar/To Do/People carry a shared gradient backdrop (`tabAccent` in `src/theme.ts`, `src/components/ScreenBackdrop.tsx`) and refreshed heading/wordmark/settings-cog treatment; Home's background was subsequently reverted to its original plain state per explicit product-owner direction and no longer uses the backdrop.
- Record editor (11 September 2026): dismissing the record sheet by Done, backdrop tap, or swipe-down now saves pending valid content through the exact same validated save path the visible Save/Add button uses (`RecordEditorHandle`/`RecordSheet.onBeforeDismiss`), rather than discarding it - see the Revision Log entry for the full mechanism.
- Document Maturity (Phase 16) and Document Experience & Integration (Phase 17), 12 September 2026: real persisted typed record links and cloud-side attachment metadata/storage (Phase 16), wired into RecordEditor's "Related to"/"Does anything need doing?", RecordDetail's bidirectional presentation, "View document", upload/retry and deletion cleanup (Phase 17). Committed and pushed (`f1baa0c`), physical QA confirmed by the product owner.
- Privacy, Settings, Export & Account Lifecycle (Phase 18A), 12 September 2026: a new "Privacy & data" Settings entry - real display-name editing, a real data-export RPC written to a local file and shared via the OS share sheet (never stored server-side), "Clear data from this device" (warns of pending work, then signs out), "Leave [care space]" for non-organiser roles. Also closed a real Phase 17-acknowledged gap with a durable document-cleanup retry queue. **Committed and pushed (`e3dc819`).**
- Settings navigation correction, 12 September 2026: Settings rebuilt as a genuine right-hand sliding drawer with its own internal navigation (Account/Care Circle/Privacy & data render inside it, never as separate top-level screens) after physical QA rejected two earlier iterations. **Committed and pushed (`74b1a61`), physically confirmed working.**
- Account Deletion & Complete Data Export (Phase 18B), 12 September 2026: resolves Phase 18A's own reported account-deletion blocker. `care_space_memberships.user_id` (and a second, previously-missed `care_spaces.bootstrap_owner_id` reference) become nullable, with a `former_display_name` snapshot and a new `membership_status = 'former'` value - a membership is detached, never deleted, so shared records/occurrences/assignments/links/attachments/documents all survive unmodified, and a former membership is denied access everywhere automatically (no new RLS). `delete_my_account()` performs the real, secure, idempotent, self-only deletion (blocked while sole organiser of any care space); `resolve_membership_identities()` lets the client show truthful historical attribution. Export now includes actual authorised document files, downloaded fresh from the current cloud copy, shared as `data.json` plus individual files (no `.zip`, per product-owner decision). **Committed and pushed (`e3dc819`)**; physical QA (two-account deletion/export scenarios) remains outstanding. See `docs/PHASE_18_ARCHITECTURE.md`/`docs/PHASE_18_QA.md`.
- People screen final visual implementation, 12 September 2026: Key contacts became a bounded overview (max four, "View all (N)" for the rest); Care circle became a summary card with one "Manage" action and a bounded member preview. Presentation only, purpose unchanged from Corrective Task 10. **Committed and pushed (`1c1c682`), physically confirmed matching the approved mock.**
- To Do background QA correction, 13 September 2026: fixed a real defect (background ending above the tab bar on a short list; a too-early/abrupt gradient fade) found during physical QA of the Phase 18B build - unrelated to Phase 18B's own scope. `ScreenBackdrop.tsx` gained an opt-in `stretch` mode and `ToDoScreen.tsx` a wider `stops` distribution; Home/Calendar/People untouched. **Committed and pushed (`e3dc819`), physically inspected and approved.**
- Settings drawer visual/safe-area fix, profile pictures, Care Circle avatar details, 13 September 2026: fixed a real Modal safe-area bug (header colliding with the status bar) and raised the drawer's visual quality; added real profile pictures (new private `profile-avatars` Storage bucket, shown in Account and for the user's own "You" tile in People's Care circle preview - closing a gap reported right after shipping); added a soft Care Circle avatar detail popup showing a member's real name/role/relationship/granted domains. **Committed and pushed (`d79b62d`).**

Phase 9, Calendar, Phase 12, Phase 13, Phase 14, Phase 15, Phase 18A/18B (two-account/device scenarios) physical-device QA are outstanding; Phase 16/17, the Settings drawer correction, the People screen final visual implementation, and the To Do background correction are confirmed passed.

Phase 7 record persistence, cache, sync and safe migration, Phase 8's core Record -> Occurrence engine, and Phase 9's everyday add/record management are implemented, validated and physically approved through Phase 8 (product-owner QA passed 10 September 2026 - see `docs/PHASE_8_QA.md`); Phase 9, Calendar, Phase 12, Phase 13, Phase 14 and Phase 15 physical QA are outstanding (`docs/PHASE_9_QA.md`, `docs/PHASE_10_QA.md`, `docs/PHASE_12_QA.md`, `docs/PHASE_13_QA.md`, `docs/PHASE_14_QA.md`, `docs/PHASE_15_QA.md` - Phase 14 requires a development build, not Expo Go; Phase 15 requires two genuine Supabase accounts, not one account pretending to be two). Push notification delivery, cloud attachment bytes and production infrastructure are not implemented.

**Roadmap numbering note:** the Calendar work was implemented and committed under the working label "Phase 10", but `docs/CORE_SYSTEM_CONTRACT.md`'s canonical roadmap defines it as **Phase 11 - Calendar Projection** (its Phase 10, Home Projection, was effectively already delivered by the earlier Home redesign work). Historical commits and doc entries that say "Phase 10" for Calendar are not renamed or rewritten; numbering simply resumes canonically from Phase 12 (To Do) onward.

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
- `app.json` declares `android.softwareKeyboardLayoutMode: resize`, but that native config only applies in a custom dev client or a standalone/production build - Expo Go's own host app has a fixed native manifest and never honours it, so the window never actually resizes there. `keyboardAvoidingBehavior()` in `src/keyboard.ts` detects Expo Go via `expo-constants`'s `executionEnvironment` and gives Android the same JS-driven `KeyboardAvoidingView` behaviour (`'height'`) iOS already uses, only inside Expo Go; a real dev-client/standalone build keeps Android's behaviour `undefined` so the native resize isn't double-compensated.
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

Read `docs/PHASE_7_ARCHITECTURE.md` for identity, migration, cache, retry, conflict and attachment rules. As of Phase 15, record participants also include real, invited Contributor/Viewer memberships with explicit per-domain grants (`care_space_domain_grants`) - see `docs/PHASE_15_ARCHITECTURE.md`. An organiser's access remains unconditional and unchanged.

Hosted development Auth uses mandatory confirmation, minimum eight-character passwords, custom Resend SMTP from `Lilica <auth@luxfordinteractive.com>`, and six-digit confirmation and recovery templates. Credentials are secret hosted configuration and must never enter Git or the mobile bundle.

Never run a blind full `supabase config push`; the base local config intentionally differs from remote operational settings. Use `config diff` and a narrowly scoped temporary config. Never use another Luxford project and never create/touch production without explicit approval.

## Validation Baseline

The Phase 9 implementation passes `npm run validate:all`: TypeScript, 13 Jest suites/143 tests (12 suites/135 tests pre-Phase-9, plus 1 new suite/8 new tests), secret scanning, Expo dependency/config checks, web export, clean migration replay, and the same 152 pgTAP assertions and warning-level database lint as Phase 8 - Phase 9 needed no migration, since its one new field rides inside the existing generic `record_data` JSONB.

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

Physical-device testing found Password/the CTA still hidden behind the keyboard on both platforms after the original Phase 5 layout correction. Root-caused and fixed in two layers - see `docs/REVISION_LOG.md` for the full writeup - and confirmed working on physical Android and iOS devices in Expo Go by the product owner. This is now part of the protected baseline, not outstanding work.

## Immediate Next Steps

On 10 September 2026, the product owner confirmed the corrected keyboard behavior and the password, verification-code, check-email and password-reset paths working on physical devices. The same day, the product owner also confirmed the Phase 8 physical-device QA checklist (`docs/PHASE_8_QA.md`) passed on Android and iPhone. Codex is offline for approximately a week from this date; Claude is the sole active implementation agent on this repository until Codex returns, and committed/pushed Codex's completed Phase 8 work on explicit product-owner instruction before taking over Phase 9.

Phase 8 is implemented, committed and physically approved. Phase 9 (everyday add/record management, and a stable-identity Assigned to: Unassigned/You control) is implemented and validated; its physical-device checklist (`docs/PHASE_9_QA.md`) is outstanding. Preserve the Phase 7 ownership/sync contracts, the Phase 8 Record -> Occurrence/history boundaries, and the Phase 9 Assigned-to control's Unassigned/You-only scope.

**Phase 16 (Document Maturity - foundation) and Phase 17 (Document Experience & Integration) are both implemented and validated as of 12 September 2026** (see the Revision Log entries, `docs/PHASE_16_ARCHITECTURE.md` and `docs/PHASE_17_ARCHITECTURE.md` for full detail). Phase 16: real persisted, RLS-protected typed record links (`record_links`) and durable cloud-side attachment metadata plus a private Storage bucket (`record_attachments`), both gated by the exact same domain-grant decision every record read/write already uses; its migration is now **applied to `lilica-development`** (verified via matching migration histories, 228 passing linked pgTAP assertions and clean linked lint). A real pre-existing bug was fixed along the way: synced attachment metadata never reached a pulled record on a second device (`src/recordSync.ts`'s `localRecordFromRow()`). Phase 17 wires that foundation into the real app: RecordEditor's document-only "Related to" picker and "Does anything need doing?" task-creation flow; RecordDetail's bidirectional, context-aware related-record presentation ("Related to"/"Documents"/"Action"/"Related document") and "View document"; in-sheet link navigation; upload queuing on save plus an app-wide retry effect covering restart-resume and pre-Phase-16 legacy documents; deletion/cloud cleanup (best-effort only, not yet retried if it fails offline - a named, accepted limitation). Both phases are **committed and pushed (`f1baa0c`), physical QA confirmed by the product owner** (`docs/PHASE_16_QA.md`, the live Phase 17 checklist). Phase 18/18B, the Settings drawer correction, the People screen final visual implementation, the To Do background correction, and the Settings drawer visual/safe-area fix + profile pictures + Care Circle avatar details are all likewise implemented, validated, committed and pushed since - see the "Implemented Product State" bullets above for each. **Do not begin Phase 19 without its own separate, explicit, bounded implementation prompt.**

## Approved Future Assignment Boundary

The `responsiblePerson?: string` field is preserved exactly, unchanged, alongside the new Phase 9 control below - not replaced by it. Do not build a cosmetic care-circle selector.

The authoritative sequence is:

1. Phase 7 preserves legacy responsibility text and provenance exactly, creates no assignment by name/email matching, and gives cloud records stable care-space identity. This is implemented and approved.
2. Phase 8 introduces the stable membership/external-contact assignment entity foundation and display snapshots. It is implemented server-side; assignment controls and full activity remain deferred.
3. Phase 9 adds a data-driven `Assigned to: Unassigned/You` control (`assignedMembershipId` on the record, stored inside existing `record_data`, no migration) alongside the unchanged legacy responsibility text, kept restrained while only Unassigned/You exist. This is implemented and validated.
4. Phase 12 projects Assigned to me, Assigned to others and Unassigned using stable membership IDs.
5. Phase 15 supplies invitations, active care-circle members, role/capability/domain permissions, selector population and immediate revocation behavior. **This is now implemented and validated**: the Assigned-to control lists every active member with visibility into the record's domain (`careCircleMembers` in `App.tsx`/`src/careCircle.ts`), and `apply_record_mutation()` rejects server-side any assignment to a membership without that domain's read access - see `docs/PHASE_15_ARCHITECTURE.md`.

Responsibility never grants visibility. Permission is enforced independently by server-side RLS/capability/domain checks. Pending or inactive memberships are not assignable; external contacts have zero application access. See sections 8, 11, 12, 17 and 18.6 of `docs/CORE_SYSTEM_CONTRACT.md`.

## Self/Someone-Else Onboarding Fork (10 September 2026)

The onboarding now opens person setup with `Whose wellbeing are you looking to support with Lilica?` (`CareForkScreen`) before the first-ever relationship wheel - see `docs/REVISION_LOG.md` for the full writeup. This governs only the initial setup path, not a permanent account mode; `startAddPerson()` (adding someone later) always goes straight to the existing wheel unchanged. `Myself` is one new value in the existing `Relationship` type and the database's `care_space_memberships_relationship_type` CHECK constraint - no parallel identity system. A new partial unique index enforces at most one `Myself` membership per user at the database level. Deployed to `lilica-development`: migration `20260910160000_myself_relationship_type.sql` applied via dry-run then push; all 95 pgTAP assertions (89 prior + 6 new) pass against both local and linked databases; linked lint clean.

Interests copy now adapts for a Myself care space (`InterestsScreen`'s `isSelf` prop, driven by the existing `relationshipType === 'Myself'` semantic): `What would you like help staying on top of?` instead of `What do you help [Name] with?`. The privacy declaration's third-person wording was deliberately left unchanged - protected, versioned legal copy (`privacy-basis-v2`); still parses correctly for a Myself space, and editing it is a legal/product decision outside this task.

## Home Redesign (10 September 2026)

Home's presentation was reorganised - see `docs/REVISION_LOG.md` for the full writeup. Wordmark-led header, a persistent person-switcher card (replacing the old dismissible tip banner and small text trigger), a horizontal category snapshot row, and category-tonal icon cards. Entirely contained to `src/screens/HomeScreen.tsx`: `sectionFor()` classification, `PersonSwitcher.tsx`, `Wordmark.tsx`, `records.ts`, and the `colors.canvas` theme token are all unchanged. Snapshot counts remain computed locally from already-loaded records; Phase 8 deliberately did not replace this protected presentation with a later canonical Home projection.

## Phase 9 Everyday Add And Record Management (10 September 2026)

Full writeup in `docs/PHASE_9_ARCHITECTURE.md`. A line-by-line trace before writing any code found that the category-gateway/list/add/edit architecture Phase 9's brief describes was already fully implemented (the 10 September 2026 "Structured Category And Wheel-Picker Correction") and already reachable from Home's everyday `Add` action - Phase 9 did not need to build or redesign it. What was actually added: an `everyday` copy variant on `FirstThingScreen` (heading/footer text only, same screen/architecture either way), and a stable-identity `Assigned to: Unassigned/You` control on `RecordEditor` for appointment/task/bill/home-or-car-matter records, storing the organiser's own `care_space_membership.id` - never a name or email - alongside the unchanged legacy `responsiblePerson` free text. No migration was needed; `assignedMembershipId` rides inside the existing `record_data` JSONB. No client code calls the separate Phase 8 `assignments` table's `create_assignment(...)` RPC yet - that remains available for a later phase once real multi-member collaboration exists to exercise it.

Not changed: `bootstrap_supported_people`, `apply_record_mutation`/`apply_occurrence_mutation`, `PersonSwitcher.tsx`, `Wordmark.tsx`, `Screen.tsx`, `HomeScreen.tsx`, `records.ts`, `CareForkScreen.tsx`, any theme token, any migration, any RLS policy.

## Calendar Projection (10 September 2026, canonical roadmap Phase 11)

Full writeup in `docs/PHASE_10_ARCHITECTURE.md` (filename kept from the original working label; see the roadmap numbering note above). Calendar reads `state.records` - the same active-care-space projection Home reads - and resolves each record's calendar date via a new `calendarDateForRecord()` in `records.ts`, mirroring `domain/recordOccurrence.ts`'s existing date-field priority. Opening an item reuses the established record editor via a new one-shot `initialOpenRecordId` prop on `FirstThingScreen`. `CategoryIcon`/`categoryLabel`/`visualFor`/`StatusIcon` were exported from `HomeScreen.tsx` (previously private) so Calendar and To Do share the same icon language.

## Phase 12 To Do Projection (10 September 2026)

Full writeup in `docs/PHASE_12_ARCHITECTURE.md`. To Do projects genuinely actionable work - open task/bill/home-or-car-matter records, per `docs/CORE_SYSTEM_CONTRACT.md` section 9.3 - into Overdue/Today-Needs-doing/Upcoming (30-day horizon, matching Home's own Coming Up window). Appointments, documents, contacts, care information and updates never appear. A new `isActionableRecord()` in `records.ts` and a new `completionUpdate()` in `RecordEditor.tsx` (the exact status/completed/completedAt/confirmationHistory transition `RecordEditor.save()` already applies inline, factored out so both produce byte-identical results) are the only new domain logic. Assignment filters (All/Mine/Unassigned) use Phase 9's stable `assignedMembershipId`; legacy `responsiblePerson` text is never treated as assignment. No migration, no RLS change, no new assignment representation.

## Phase 13 Person Projection (11 September 2026)

Full writeup in `docs/PHASE_13_ARCHITECTURE.md`. New `PersonScreen.tsx` groups `state.records` into five durable-knowledge sections (contacts/care/home/documents/bills), each backed by an existing record type, omitted when empty. Appointments/tasks/updates never appear. A small structural discovery drove one necessary cross-cutting change: the tab labelled with the supported person's name previously rendered `AccountScreen` (the organiser's own account settings) under copy promising a person knowledge space it never delivered - `AccountScreen` is now reached via a new "Account" link in Person's header (its own content otherwise unchanged, minus that stale copy) so sign-out remains reachable. `FirstThingScreen` gained a sibling `initialOpenType` prop (alongside Phase 10's `initialOpenRecordId`) so Person's per-section Add links open a new draft of the right category directly, through the same established creation architecture.

## Phase 14 Reminder And Notification Engine (11 September 2026)

Full writeup in `docs/PHASE_14_ARCHITECTURE.md`. Local-only (no server/push): new `src/reminders.ts` (pure domain logic -- eligibility, default offsets, quiet-hours policy, idempotent identifiers) and `src/notifications.ts` (the thin `expo-notifications` boundary, platform-guarded for web). Two new optional fields on `LilicaRecord` -- `remindersEnabled`, `reminderScheduleVersion` -- ride inside the existing `record_data` shape exactly like Phase 9's `assignedMembershipId`; no migration needed. `RecordEditor` gained a "Remind me" toggle (appointment/task/bill/homeMatter only) gated behind an explicit permission request; `AccountScreen` gained a minimal Reminders section (master switch, quiet hours). `App.tsx`'s `saveRecord`/`removeRecord` call the one reconciliation entry point after every mutation. New `expo-notifications` dependency; `app.json` gained its config plugin. Server/push delivery, device registration and Phase 15 collaboration notifications are explicitly deferred and documented, not faked.

## Phase 15 Care-Circle Invitations And Collaboration (11 September 2026)

Full writeup in `docs/PHASE_15_ARCHITECTURE.md`. Extends, rather than duplicates, the Phase 6/7 membership/RLS skeleton: `care_space_memberships.role` gains `contributor`/`viewer` alongside `organiser`; new `care_space_domain_grants` (one row per membership per domain, explicit `can_read`/`can_write`, default-deny for anything not granted); new `care_space_invitations` (pending/accepted/declined/expired/revoked lifecycle, organiser-only to send/revoke, invitee-scoped-by-email to accept/decline via `list_my_invitations()`/`accept_invitation()`). `can_access_care_space_records()` (the Phase 7-anticipated extension point) and a new `membership_has_domain_access()` now decide access by role-or-grant rather than hardcoded organiser-only. `apply_record_mutation()` is redefined (same signature) to check write access against a record's real domain (was hardcoded to `'general'`) and to reject any `assignedMembershipId` whose membership lacks active status or domain read-access - closing the gap where assignment could previously grant de facto visibility, and ensuring a replayed offline mutation can never recreate access for a removed member. `remove_member()`/`leave_care_space()`/`change_member_role()` all carry sole-organiser safety. Client: `src/careCircle.ts` (typed RPC wrapper), `src/screens/CareCircleScreen.tsx` (reachable from Person's header), and `RecordEditor`'s Assigned-to control now offers every domain-eligible active member (`recordDomainForType()` in `src/records.ts` mirrors the server's domain mapping exactly) rather than only Unassigned/You. 31 new pgTAP assertions (`supabase/tests/database/phase15_care_circle.test.sql`, 183 total with zero regressions). A same-day follow-up added `src/screens/InvitationsScreen.tsx` (the invitee-facing "you've been invited" screen: lists this account's own pending invitations by authenticated email, Accept/Decline, auto-surfaces once per app session ahead of the normal onboarding/Home flow, reachable again afterward via an "Invitations (N)" link on Person's header; Accept reuses the existing, unmodified `reconnectCareSpaces()` flow to surface the new membership with no further plumbing, since `list_my_supported_people()` was never role-filtered). 16 new Jest tests in total (263 total). Not yet built, documented rather than faked: push/email delivery of the invitation itself, an "assignee no longer has access" UI treatment, and a role-change/organiser-handoff UI (their underlying functions exist and are tested).

## Protected And Deferred

Preserve Welcome, privacy gating/version/timestamp, organiser/supported-person separation, local account isolation, multi-person care-space separation, category/multi-record behavior, wheel selectors, record-sheet gestures, real-record-only Home, the current Home presentation, Calendar, To Do, People (renamed from Person by Corrective Task 10), the view/edit separation (`RecordDetail`/`RecordQuickEditor`), the Done/backdrop/swipe-saves-pending-content behaviour, the Calendar/To Do/People visual pass (Home deliberately excluded, reverted to plain), the Phase 16/17 document link/attachment/task architecture described above, and the Phase 9/Phase 12/Phase 13/Phase 14/Phase 15 everyday-copy/Assigned-to/To-Do/Person/reminder/care-circle scope described above.

**Care Circle invitation & joining flow completion (14 September 2026)**: real email delivery (Resend), native Share, a human-friendly invitation CODE (a pure locator for the same invitation, resolved via `resolve_invitation_by_code()`, never a second security model), and a "Join a Care Circle" manual-code route (reachable from both a new user's onboarding fork and an existing user's Care Circle screen) are all now implemented, converging on the SAME unmodified `accept_invitation()` authority every other route already used. Also fixed a real physically-found UX bug (a just-created invitation used to show twice at once) with genuinely distinct CREATED/DELIVERED states. See `docs/PHASE_15_ARCHITECTURE.md`'s matching addenda.

Deferred: push notification delivery of invitations (email/Share/code now cover delivery - only OS-level push remains undone), an "assignee no longer has access" UI treatment, in-app role-change/organiser-handoff controls, server/push notification delivery and device registration, search/history, production Ask Lilica, production infrastructure, backup guarantees, account/care-space deletion policy, a durable retried cleanup queue for offline document/attachment deletes (best-effort only today), and lightweight "Expiring soon"/"Recently added" document-gateway groupings (a threshold is a product decision, not yet made).
