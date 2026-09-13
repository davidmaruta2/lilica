# Phase 20B — Approved Carer-Focused Enhancements: Architecture

Implemented from the approved implementation brief (`phase20.txt`, "LILICA — PHASE 20B"). Phase 20A's audit (`docs/PHASE_20_GAP_AUDIT.md`) identified many candidate enhancements; **only three were approved for this implementation**: Recent Activity / Care History, Unified Current-Person Search, and Care/Handover Summary. Every other Phase 20A candidate (contact import, medication structure, collaboration push notifications, contextual record comments, calendar export, profile-field expansion, former-member management refinements, human-readable export, general chat, generic Notes) remains explicitly NOT implemented — see the Phase 20 backlog section below and `docs/PHASE_20_GAP_AUDIT.md`, which is preserved unchanged as the permanent record of the full audit, not rewritten to imply everything in it was approved.

`PRE_PHASE_20B_BASELINE`: HEAD `33b4b3e` (in sync with `origin/master`); tracked working tree carried one legitimate uncommitted change (`docs/REVISION_LOG.md`, the Phase 20A audit note, itself explicitly left uncommitted per that task's own instruction — not application code); TypeScript clean; Jest 48 suites/482 tests; `npm run secrets:check` clean (233 files); local `db:reset`/pgTAP/lint clean (305 assertions/11 files — the profile_avatars migration had already raised this from 279); linked (`lilica-development`) migration history matched local exactly through `20260912180000`.

## Architectural principle: one source of truth, multiple projections

None of the three features create a parallel store of tasks, appointments, contacts, documents, bills or care information. Search reads the same already-authorised, already-loaded active-care-space record array every other screen (Home/Calendar/To Do/People) already holds. Care Summary projects that same array plus the same Care Circle member list and the same Recent Activity feed. Only Recent Activity needed genuinely new server state, because it must truthfully reflect *other* Care Circle members' actions, not only this device's own local mutations — see below.

## Existing architecture traced before implementation (brief section 2)

- **Records/mutations**: `apply_record_mutation()` (redefined once already by Phase 15 to add domain-based write checks and assignee-visibility validation) is the single funnel for every create/import/update/delete. `record_mutation_receipts` is an idempotency ledger keyed by `operation_id` — it already carries `actor_membership_id` per mutation, but is not itself a queryable, human-readable activity feed.
- **confirmationHistory**: exists per-record (a record's own completion/confirmation timestamps), visible only on that record's own detail view — genuine, truthful data, but not a cross-record feed and not who-changed-what for anything other than completion.
- **No true immutable cross-record activity/event store existed** before this migration (confirmed by direct inspection, not assumed) — this is the finding that determined the data-model decision below.
- **Care-space memberships/lifecycle**: `accept_invitation()`, `remove_member()`, `leave_care_space()` are the only RPCs that create/end a membership; each already fails outright on a retry (invitation no longer pending; membership no longer active) before any of this phase's new code runs — the natural idempotency guarantee this phase's activity logging relies on.
- **Documents**: `upsert_record_attachment()`/`mark_attachment_upload_status()` are the only path from "attachment metadata exists" to "file bytes genuinely uploaded" — `upload_status` only ever becomes `'uploaded'` once the transfer has actually completed (an existing Phase 16 invariant, unchanged).
- **Domain/permission model**: `can_access_care_space_records(care_space_id, domain, action)` and `membership_has_domain_access(membership_id, domain, action)` (Phase 15) are the one shared decision every record read/write already goes through. Reused verbatim for activity's own RLS — no second authorisation system.
- **Home/Calendar/To Do/People**: each already holds `state.records` (or the active care space's own slice of it) in memory, already scoped to what this device is authorised to have synced. This is what Search and Care Summary read directly, with zero additional fetching.

## Feature A — Recent Activity / Care History

### Data model decision

No proper immutable activity/event system already existed (confirmed above), so this phase implements the smallest correct append-only foundation for events **from this point forward only** — no historical backfill was attempted, per the brief's explicit anti-fabrication instruction. A clear absence of pre-13-September-2026 activity is the honest state, not a gap to paper over.

New migration `supabase/migrations/20260913120000_phase20b_activity_search_summary.sql`:

- `care_space_activity` (`id`, `care_space_id`, `actor_membership_id`, `event_type`, `record_id` nullable, `record_domain`, `metadata jsonb`, `created_at`). Immutable by convention (no update/delete grant ever exists) and by an explicit `before update/delete` trigger that always raises — proven directly by pgTAP, not merely assumed from the missing grant.
- `event_type` is a closed, checked set: `record_created`, `record_completed`, `record_reopened`, `assignment_changed`, `date_changed`, `document_uploaded`, `member_joined`, `member_left`, `member_removed`.
- `actor_membership_id` is the membership an event is **attributed to** — the actor for record/document events, but the **subject** membership (the one joining/leaving/being removed) for member-lifecycle events, not whoever performed a removal. This reading was chosen because it matches the brief's own passive-voice examples ("a member left/was removed") and avoids needing a second membership-id column just to record who acted; it is stated here explicitly so a future agent does not assume the wrong meaning.
- `record_domain` is copied at insert time (never a live join), so an activity row's own permission decision never depends on the referenced record still existing in a particular state — `'general'` for member-lifecycle events, matching a plain active membership's baseline visibility.
- RLS: `select` only, to `authenticated`, via `can_access_care_space_records(care_space_id, record_domain, 'read')` — the identical decision every record read already uses. A member with only `'financial'` domain access sees only financial-domain activity; an organiser sees everything; a revoked/former member (no active membership row) sees nothing, regardless of whose actions the rows describe.
- `log_care_space_activity(...)`: an internal helper (no `authenticated` execute grant — only callable from inside another `security definer` function running as the same owner) that does the actual insert, so every call site only has to say *what* happened.
- `list_recent_activity(care_space_id, before_created_at, page_size)`: bounded (`limit greatest(1, least(page_size, 100))`), cursor-paginated (strictly-less-than on `created_at`, so concurrent inserts can never cause a re-seen or skipped row across pages), resolves the actor's display name the same way `resolve_membership_identities()` already does (live name, or a truthful `former_display_name` snapshot with `actor_is_former = true`) — historical attribution survives a membership becoming former/revoked; the *viewer's own* access does not.

### Where events are generated, and why each is truthful

`apply_record_mutation()` (redefined a second time, same signature, based on the CURRENT Phase-15-redefined body — not the original Phase 7 body, which would have silently regressed Phase 15's domain-based write-access fix; this was caught and corrected during implementation, not by chance) logs:

- **`record_created`**: on every genuine `create`/`import` insert. Idempotency is free — a replayed `operation_id` short-circuits to the existing `'duplicate'` branch before any of this phase's code runs.
- **`record_completed`/`record_reopened`/`assignment_changed`/`date_changed`**: derived from a truthful before/after comparison of `current_record.record_data` (the row as it stood before this update) against the newly merged `record_data` — never fabricated, never inferring intent beyond what the stored data itself proves changed. Checked in a fixed priority order (completion, then reopening, then assignment, then date) so a record completed and reassigned in the same save surfaces as the more significant change (completion) rather than both. A plain edit that touches none of these fields (notes, title, amount, etc.) intentionally produces **no** activity row — proven directly by a pgTAP assertion, not merely assumed.
- Deletion is **deliberately not logged** this phase — not in the brief's own list of meaningful examples, and a deleted record's own permission treatment for a historical activity entry would need its own careful design; named here as a scope reduction, not silently absent.

`mark_attachment_upload_status()` logs `document_uploaded` only on a genuine transition **into** `'uploaded'` (never on a retry that was already uploaded, never merely on an attempt) — proven by a pgTAP idempotent-retry assertion.

`accept_invitation()`/`remove_member()`/`leave_care_space()` each log their own lifecycle event (`member_joined`/`member_removed`/`member_left`) right after their existing, unmodified success path, immediately before returning — and each of these RPCs already refuses a retry outright (the invitation is no longer pending; the membership is no longer active) before this new code can ever run twice for the same event.

### Client

`src/activity.ts`: a thin RPC wrapper (`listRecentActivity`) following `src/careCircle.ts`'s exact `{ ok, data | message }` pattern, plus a pure `describeActivityEvent()` formatter — calm, truthful, one-line wording built only from the event's own metadata (e.g. "David marked 'Water bill' paid" for a bill's `record_completed`, distinct from "David completed 'Collect prescription'" for a task's). Never invents a detail the metadata doesn't contain; a former member's event reads "David (former member) was removed from the Care Circle" rather than silently rendering nothing.

`src/screens/RecentActivityScreen.tsx`: fetches its own bounded first page on mount, groups by day (Today/Yesterday/a date), shows real member attribution, and pages further only on an explicit "View more" tap — never loads hundreds of events into the underlying People overview. Tapping a record-related event opens the exact same shared record-detail path (`onOpenRecord`) every other list in the app already uses; a member-lifecycle event (no `recordId`) is not pressable at all.

**UI location** (brief section 9): a "Recent activity" link inside People's own Care Circle card, below the member preview — not a Home preview (explicitly not approved this phase) and not a new top-level tab.

## Feature B — Unified Current-Person Search

Purely client-side: `src/search.ts`'s `searchRecords(records, query)` operates on the exact array already loaded for the active care space — no schema, no new RPC, no vector database, no embeddings, no AI, no external search service, per the brief's own explicit prohibition. Since that array is already scoped by the server's own domain-grant RLS (a record this device was never authorised to sync never appears in it at all), search never needs a second permission-filtering pass — there is nothing inaccessible in the data it searches.

Matching is deliberately simple (brief section 16: prefer the simplest architecture that works at this codebase's own record volume): case-insensitive, punctuation-insensitive, partial substring matching against only the fields already visible to the user (title, notes, and category-specific fields such as location/provider/reference/role/phone/email/amount/responsiblePerson) — never an id, a storage path, a signed URL, or any other internal/technical field (proven directly by a unit test). Results group into the eight canonical record categories (Appointments/To Do/Bills & renewals/Home & Car/Documents/Contacts/Care information/Updates) — "To Do" here means `task` records specifically, matching the brief's own section 17 grouping, distinct from Bills & renewals (`bill`) and Home & Car (`homeMatter`). Only groups with an actual match render.

`src/screens/SearchScreen.tsx`: one text input, live-filtered as the user types, an explicit empty-query helper state, an explicit no-results state, and results that open the exact same shared record-detail sheet every other list already uses — never a search-owned copy or a search-only detail screen, and never the old record-open "flash" regression, since it reuses the identical `onOpenRecord` path already proven not to cause it.

**Search scope** (brief section 14/35): the CURRENT selected care space only, never account-wide/aggregate. Enforced structurally, not by an extra check: `App.tsx` always passes `state.records` (the active care space's own already-loaded slice), and the screen is `key`ed by the active care space id, so a person switch (which also force-closes Search outright — see below) can never leave a stale query or result set mounted for the wrong person.

**UI location** (brief section 17): one `SearchButton` (new, `src/components/SearchButton.tsx`, matching `SettingsCogButton`'s own plain-View icon technique) in Home's header, next to the existing Settings cog — the least invasive placement inspected against Home/People/header architecture, and Home's own protected projection logic (`sections`, status-chip derivation) is untouched; only a header affordance was added, per the brief's own explicit allowance ("any search affordance added to a shared header must not alter Home projection logic").

**Offline**: works identically online or offline, since it never fetches anything itself — it only ever reads records already in memory from the existing local cache.

## Feature C — Care / Handover Summary

### Naming (brief section 22)

"Emergency Medical Record"/"Emergency Mode" were explicitly forbidden — Lilica is not a clinical or emergency system. Between "Care summary" and "Handover summary" (both considered, as instructed), **"Care summary" was chosen** — it reads calmer and fits the existing Lilica voice (short, plain, non-transactional) better than "Handover", which reads more like a workplace shift-change term than something a family carer would naturally reach for. Documented here as the explicit decision the brief asked for.

### Architecture

`src/careSummary.ts`'s `buildCareSummary(records, careCircleMembers, recentActivity, describeActivity)` is a pure projection — no new schema, no new record type, no duplicate data store. Every section is built by filtering/sorting/bounding (max 4–5 items) the exact same arrays already loaded for Recent Activity and People's own Care Circle preview. A section is included only when it has real supporting data; there is never a placeholder, a fake zero, or an "N hidden items" count for a section a viewer cannot see into (proven directly by a unit test asserting the word "hidden" never appears in the output) — permission filtering happens upstream, in the arrays this module is *given*, not inside it.

Sections, only when non-empty: Needs attention (overdue/due-today actionable records), Coming up (any upcoming-dated record), Key contacts (bounded to 4, matching People's own preview limit), Care Circle (the same member list), Important care information (`careNote` records), Important documents (`document` records), Bills & renewals (open `bill` records), Home & Car (open `homeMatter` records), Recent activity (the 5 most recent events, reusing `describeActivityEvent`).

`src/screens/CareSummaryScreen.tsx`: renders those sections; tapping a record item opens the same shared record-detail path every other list uses; the Care Circle section renders member chips, not pressable record rows.

### Distinct from Home (brief section 27)

Home answers "what needs my attention right now" (Overdue/Today/Upcoming/Latest, an actionable worklist). Care Summary answers "if I needed to understand this person's care situation quickly, what would I need to know" — it favours context, continuity, people and important information over an actionable worklist, and every section is capped, never a full record dump. It does not reproduce Home's own status-chip strip or section classification.

### Distinct from export (brief section 28)

`export_my_data()` is unchanged. Care Summary's own section-building logic was deliberately kept as a separate, reusable pure function (`buildCareSummary`) specifically so a future, separately-approved human-readable export could reuse the same projection later — this phase does not implement PDF/export itself.

### No new profile fields (brief section 29)

No DOB/diagnosis/allergies/likes-dislikes/medication schema/dietary-requirements/emergency-contact schema/assistance-needs fields were added anywhere. Care Summary works entirely from existing Lilica data — where a section like "Important care information" is thin, it is thin honestly, never padded with invented fields.

### UI location (brief section 26)

A restrained "Care summary" link beneath the "Person being supported" card in People — not a new card competing with the existing bounded Key Contacts preview, Care Circle summary, or Ask Lilica placement, and People's own approved architecture (bounded previews, one Manage action) is otherwise untouched.

## Feature interaction, kept separate (brief section 30)

Care Summary's own Recent Activity section, tapped, opens the underlying record — same path as Feature A's own screen. Search results open the underlying record — same path again. All three remain visually and architecturally distinct screens; none was merged into one giant screen.

## Multi-person isolation (brief section 35)

Enforced two ways: (1) server-side, `list_recent_activity()`'s own `can_access_care_space_records()` filter means a request for care space A can structurally never return a row belonging to care space B — proven directly by a pgTAP cross-space-isolation assertion using two genuinely separate care spaces; (2) client-side, `App.tsx`'s `renderShell()` always passes the currently active care space's own `state.records`/`careSpaceId`, and a dedicated effect (keyed on a `previousCareSpaceId` ref, so it fires only on a genuine switch, never on an unrelated re-render) force-closes Search/Recent Activity/Care Summary outright the moment the active care space id changes — proven directly by a component test reproducing that exact state machine.

## Former/revoked member behaviour (brief section 36)

A former or revoked member's own `list_recent_activity()` call for a care space they no longer belong to returns nothing (no active membership row matches `can_access_care_space_records`) — proven by pgTAP. Their historical activity — events truthfully attributed to them before removal — remains visible to the *remaining* members, correctly resolved to their real display name (or the Phase 18B `former_display_name` snapshot if the account itself was later deleted) via the same identity-resolution logic `resolve_membership_identities()` already established. Historical attribution survives; security access does not — no access was ever restored to anyone.

## Diff classification (brief section 50)

- **A (Activity implementation)**: `src/activity.ts`, `src/screens/RecentActivityScreen.tsx`, the migration's `care_space_activity`/`log_care_space_activity`/`list_recent_activity`/`apply_record_mutation`/`mark_attachment_upload_status`/`accept_invitation`/`remove_member`/`leave_care_space` portions.
- **B (Search implementation)**: `src/search.ts`, `src/screens/SearchScreen.tsx`, `src/components/SearchButton.tsx`, `src/screens/HomeScreen.tsx`'s header addition.
- **C (Care Summary implementation)**: `src/careSummary.ts`, `src/screens/CareSummaryScreen.tsx`.
- **D (minimal shared infrastructure)**: `App.tsx` (state/effects/render-branch wiring for all three), `src/screens/PersonScreen.tsx` (the two small entry-point links).
- **E (migration/RLS)**: `supabase/migrations/20260913120000_phase20b_activity_search_summary.sql` (new table, RLS policy, three new/redefined functions plus the necessary redefinitions of four existing RPCs to add logging calls at their already-correct success points).
- **F (tests)**: `supabase/tests/database/phase20b_activity.test.sql` (new, 26 assertions); `tests/phase20b-activity.test.ts`, `tests/phase20b-search.test.ts`, `tests/phase20b-care-summary.test.ts`, `tests/phase20b-search-screen.test.tsx`, `tests/phase20b-recent-activity-screen.test.tsx`, `tests/phase20b-care-summary-screen.test.tsx`, `tests/phase20b-person-switch-isolation.test.tsx`, `tests/phase20b-performance.test.ts` (all new); `tests/phase13-person.test.tsx`/`tests/settings-cog.test.tsx` (extended for the two new entry points and the search button).
- **G (documentation)**: this file, `docs/PHASE_20_QA.md` (new); `docs/REVISION_LOG.md`, `AGENTS.md`, `CLAUDE.md`, `docs/LUMEN_HANDOFF.md` (updated with a pointer). `docs/PHASE_20_GAP_AUDIT.md` is unchanged — preserved as the permanent audit record.
- **H (unexpected)**: empty.

## Explicitly NOT implemented (Phase 20 backlog, preserved per brief section 47)

Contact import, medication structure, collaboration push notifications, contextual record comments, calendar export, supported-person profile-field expansion, former-member management UI refinements, a human-readable export/handover document, general chat, and a generic Notes feature all remain exactly as recorded in `docs/PHASE_20_GAP_AUDIT.md` — genuine candidates for a future, separately-approved implementation prompt, not begun here. Phase 21 (billing/subscription) and Phase 22 (visual-polish audit) were not started.
