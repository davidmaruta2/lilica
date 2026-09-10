# Phase 10 Calendar Projection Architecture

Status: Implemented and automatically validated; physical-device QA pending (see `docs/PHASE_10_QA.md`)
Date: 10 September 2026

## Boundary

Phase 10 adds a Calendar tab that projects the existing records already established by Phases 1-9. It introduces no new record type, no calendar-event table, no Calendar-specific ownership, and no Calendar-specific editor. It does not implement To Do, invitations, collaboration, or any global/multi-person calendar.

## Source Of Truth

Calendar renders from exactly the same data Home already reads: `state.records`, the active care space's records as projected by `projectActiveCareSpace()` (Phase 6/7). There is no second query, no second cache, and no duplication. One underlying record, many views of it — Home's sections, the category-gateway/list, and Calendar's month grid and day list all read the same array.

A record's calendar date is resolved by `calendarDateForRecord()` in `src/records.ts`, which mirrors the exact field priority already established in `src/domain/recordOccurrence.ts`'s `canonicalOccurrenceForRecord()` (appointment -> `eventDate`; task/bill/homeMatter -> `dueDate`; document -> `expiryDate`; everything else has no calendar meaning). It intentionally does not call the Phase 8 domain/occurrence layer directly, because that layer requires a synced cloud record ID that an offline-queued record may not have yet — exactly the same reason Home and the category-gateway/list/edit screen already work directly off `LilicaRecord` fields via `deriveRecordState()` rather than the domain layer. Calendar follows that same, already-established precedent rather than introducing a second way of deriving dates.

Status shown in Calendar (Overdue, whether an item is "today") comes from the same `deriveRecordState()` Home already uses — not a second interpretation. A past, unconfirmed appointment is not silently treated as completed; it shows as Overdue, exactly as Home already shows it.

## Care-Space Isolation

Calendar takes no `careSpaceId` of its own. It is mounted with `key={currentSpace.careSpaceId}` and receives `state.records`, which is already scoped to `activeCareSpaceId` by the existing `projectActiveCareSpace()` mechanism. Switching the active person naturally remounts Calendar (via the `key`) and re-renders with the newly active person's records — no occurrence from another care space can appear, and no new isolation logic was written.

## Navigation And Editing

Tapping an item in Calendar's day list calls back into `App.tsx`, which sets a one-shot `initialOpenRecordId` and navigates to the existing `firstThing` stage — the same category-gateway/list/edit screen Home's own "Add" action already uses. `FirstThingScreen` gained an optional `initialOpenRecordId`/`onInitialOpenHandled` prop pair: on mount, if a matching record exists, it opens that record's editor directly (reusing `openEditor()`, the same function the screen's own list rows already call) and immediately reports back so the one-shot request is cleared — a later, unrelated visit to the screen (e.g. Home's plain Add button) never reopens a stale record. Saving goes through the existing `onSaveRecord`/`saveRecord` path unchanged, so Calendar, Home and the category list all reflect the same edited record immediately.

## Offline Behaviour

Calendar makes no network or storage call of its own. It is a pure function of whatever `records` prop it is given, which at the app level already comes from the Phase 7 account/care-space cache regardless of connectivity. Cached data populates Calendar exactly as it populates Home.

## Icon And Category Language

`categoryLabel`, `visualFor` and `CategoryIcon` (previously private to `HomeScreen.tsx`) are now exported and reused as-is by Calendar's day-list rows, so both screens draw the same icon shapes, tints and category names — no new icon vocabulary was introduced.

## Not Implemented (Deferred)

Later-phase functionality was not started: To Do projection, document handling beyond what already exists, care-circle invitations, member/role/permission management, realtime collaboration, assignment acceptance workflows, and any global calendar mixing more than one supported person. Assignment display in Calendar (where shown) is presentational only, using the existing Phase 9 Unassigned/You scope; the assignment architecture itself was not changed.

## Current Limitations

- Only appointments, dated tasks, bills, home/car matters and documents with an expiry date project into Calendar; contacts, care information and updates correctly have no calendar meaning and never appear.
- No Calendar-specific "add" flow exists beyond the category/record creation already reachable from Home.
- Physical-device QA is outstanding — see `docs/PHASE_10_QA.md`.
