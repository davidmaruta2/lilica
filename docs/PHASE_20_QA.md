# Phase 20B — Physical Device QA Checklist

Prepared per the brief's own instruction (section 49) — automated validation (below) is complete; nothing in this document has been physically verified yet, and nothing here should be read as a claim that it has. Android + iPhone where available.

## Recent Activity

- [ ] Opens from People's Care Circle card via the "Recent activity" link and looks calm/premium, not social-media-like (no avatars-in-a-row feed, no like/reaction affordances).
- [ ] Wording reads naturally for a real family member (not clinical/technical) — spot-check a creation, a completion, a bill marked paid, a reassignment, a date change, a document upload, and a member joining/leaving.
- [ ] Tapping a record-related event opens the correct real record, through the same sheet every other tap-to-open already uses (no flash/flicker regression).
- [ ] A member-lifecycle event (joined/left/removed) is not tappable and does not attempt to open anything.
- [ ] With two or more real Care Circle members active, attribution is correct for each ("Marion added…", "David marked…") — never wrongly attributed to the wrong person.
- [ ] "View more" loads an older batch without duplicating anything already shown, and disappears once there is genuinely nothing further.
- [ ] A brand-new care space with no activity yet shows a calm empty state, not an error.

## Search

- [ ] The search icon in Home's header is easy to find and does not crowd/collide with Add or Settings at any device width.
- [ ] Typing is responsive with a realistic number of records (no visible lag).
- [ ] Results are genuinely useful — an appointment, a task, a bill, a document, a contact, a care note, and an update can each be found by a natural partial query.
- [ ] Opening a result opens the correct real record, through the same sheet every other tap-to-open already uses.
- [ ] Switching from Beauty to Jackie (or any two real supported people) while Search is closed, then reopening it, never shows the previous person's results; switching WHILE Search is open closes it outright rather than showing stale results.
- [ ] Works with the device offline (airplane mode) exactly as it does online, since it never makes a network call itself.

## Care Summary

- [ ] Genuinely reads as useful for a handover scenario, not merely "another Home screen" — check with a real supported person who has appointments, tasks, contacts, care notes and documents already entered.
- [ ] Not overwhelming — every section stays short; nothing scrolls forever.
- [ ] Data shown is correct and current (no stale section after a recent edit — verify a change made just before opening Care Summary shows up).
- [ ] Permissions are respected: sign in as (or simulate) a Contributor with only `general`-domain access and confirm the Bills & renewals section never appears, with no "N hidden" message of any kind.
- [ ] Naming reads calmly, not as an emergency/clinical concept, to someone seeing it for the first time.

## Automated validation completed (this phase)

- `npm run typecheck`: clean.
- `npm test`: 56 suites/541 tests passing (up from 48/482 pre-phase; zero regressions in the full pre-existing suite — Welcome, auth, onboarding, Home, Calendar, To Do, People, Settings drawer, Care Circle, assignment, documents, offline sync, account deletion, export, profile avatar all re-ran unchanged and green).
- `npm run secrets:check`: clean (249 files).
- `npx expo install --check`: 7 pre-existing patch-level outdated Expo packages, unchanged from before this phase, not introduced by it.
- `npx expo config --type public` / `npx expo export --platform web`: both clean.
- Local `db:reset` → `db:test` → `db:lint`: clean (305 pgTAP assertions/11 files, up from 279/10 — the new `phase20b_activity.test.sql` file added 26).
- `npx supabase db push --linked --dry-run`: confirmed exactly one pending migration (`20260913120000_phase20b_activity_search_summary.sql`), no unrelated diff, before applying.
- Applied to `lilica-development`; `npx supabase migration list --linked`: local and remote histories match exactly through `20260913120000`.
- `npx supabase test db --linked`: 305/11 pass on the hosted database too.
- `npx supabase db lint --linked --level warning`: clean.
- `git diff --check`: clean (only benign LF/CRLF advisories).

## Performance (brief section 40 — code-level proxy only, not a device measurement)

`tests/phase20b-performance.test.ts` exercises `searchRecords`/`buildCareSummary` against 500 synthetic records, 20 contacts, and 150 activity events, asserting both complete in well under 200ms and that every Care Summary section stays bounded (≤5 items) regardless of input size. This proves there is no gross algorithmic blow-up at the data volumes the brief names, but it is not a substitute for a real on-device scroll/render feel check, which requires physical hardware not available in this environment — that row above remains genuinely outstanding.

## Accessibility (brief section 41 — static review, not a device screen-reader pass)

- Search input carries `accessibilityLabel="Search"` and an `accessibilityHint` naming the person being searched.
- Every search/activity/summary result row carries a real `accessibilityLabel` (the record's title, or the activity's own description) and `accessibilityRole="button"` where it is genuinely pressable; non-pressable rows (a member-lifecycle activity event, a Care Circle chip) deliberately carry no button role.
- Care Summary section headings use the same `section` text variant every other screen's real headings use — nothing is rendered as plain unstyled text where a heading is intended.
- No fixed-height container clips result text — every list uses the shared `Screen` component's own scrollable content area, exactly like every other screen in the app.
- A genuine screen-reader (VoiceOver/TalkBack) walkthrough and large-text-scaling check both require physical hardware and remain outstanding, consistent with every other screen in this app's own QA history.

## Regression protection re-confirmed (brief section 45)

Re-ran the complete pre-existing Jest suite (Welcome, auth, onboarding, Home, Calendar, To Do, People, Settings drawer, Care Circle, assignment, documents, offline sync, account deletion, export, profile avatar) — all pass unchanged. No existing test was weakened, skipped, or deleted to make this phase's new tests pass. `apply_record_mutation()`'s own pre-existing pgTAP coverage (domain write checks, assignee-visibility checks, conflict/merge behaviour) was re-run and passes unchanged against the redefined function.
