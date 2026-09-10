# Phase 12 To Do Projection Architecture

Status: Implemented and automatically validated; physical-device QA pending (see `docs/PHASE_12_QA.md`)
Date: 10 September 2026

**Roadmap numbering note:** the canonical roadmap in `docs/CORE_SYSTEM_CONTRACT.md` numbers this phase 12, following Phase 11 Calendar Projection (which was implemented and committed under the working label "Phase 10" — see `docs/PHASE_10_ARCHITECTURE.md`'s note). Historical commits are not renamed; numbering resumes canonically from here.

## Boundary

Phase 12 adds a To Do tab that projects the existing records already established by Phases 1-9. It introduces no task store, no To Do-specific record type, no To Do-specific editor, and no To Do-specific completion mechanism. It does not implement reminders, notifications, invitations, real collaboration or permissions UI.

## Source Of Truth And Eligibility

To Do reads exactly the same `state.records` Home and Calendar already read. A new `isActionableRecord()` in `src/records.ts` decides eligibility, per `docs/CORE_SYSTEM_CONTRACT.md` section 9.3: `type` is `task`, `bill` or `homeMatter`, and `status !== 'cancelled'`. Appointments, documents, contacts, care information and updates never qualify, even though some are dated and already appear in Calendar — a dated record having calendar meaning does not make it actionable work. The active list additionally excludes anything `deriveRecordState()` already reports as `completed`.

## Grouping And Sorting

Three groups, matching the brief's fixed test scenario wording exactly:

- **Overdue** — `deriveRecordState(record).overdue`, sorted oldest-due-first.
- **Today / Needs doing** — `deriveRecordState(record).dueToday`.
- **Upcoming** — everything else still due within a 30-day horizon (the same horizon Home's own Coming Up section already uses, per `docs/CORE_SYSTEM_CONTRACT.md` section 9.2), sorted soonest-first; undated actionable records are appended at the end of this group, sorted by title, rather than introducing a fourth visible section the brief did not specify.

## Assignment Filtering

`All` / `Mine` / `Unassigned` chips filter the active list before grouping. `Mine` compares `record.assignedMembershipId` to the organiser's own `activeMembershipId` for the active care space (the same stable identity Phase 9's Assigned-to control already writes) — never a display name, email, or the legacy `responsiblePerson` text. `Unassigned` matches records with no `assignedMembershipId`. An "Others" filter is deliberately not offered, since no other active membership exists yet; the filter set will extend naturally once Phase 15 introduces real collaboration, without changing this filtering logic.

Each row also shows a small "You"/"Unassigned" badge for the same reason. If `assignedMembershipId` is ever set to something other than the organiser's own membership (not possible under the current Phase 9 scope, which offers only Unassigned/You), the badge is omitted rather than fabricating a name.

## Completion And Reopen

A new `completionUpdate(record, completed, confirmedBy?)` in `src/components/RecordEditor.tsx` is the exact same status/completed/completedAt/confirmationHistory transition `RecordEditor.save()` already applies inline for its "Already sorted" checkbox, factored out so a projection that completes or reopens a record without opening the full editor produces a byte-identical result — never a second interpretation of what "complete" means. `RecordEditor.save()` itself is unchanged. To Do calls `completionUpdate()` and passes the result straight to the same `onSaveRecord` prop every other save path already uses, so the mutation goes through the existing Phase 7 cache/outbox exactly as any other edit would.

Per-type wording follows the brief: a task's action is "Mark complete", a bill's is "Mark paid". Reopening a completed item clears the active `completedAt` pointer but preserves `confirmationHistory` — the historical completion evidence remains intact. Completed items are reachable via a "Show completed" toggle (off by default, so the primary view stays focused on active work) rather than a second screen.

## Recurrence

No new recurrence logic was added. `deriveRecordState()`'s existing `nextDueDate` is a presentational hint only — completing a recurring record in this codebase has never materialised a new row automatically (client-side; the Phase 8 server-side occurrence/recurrence engine exists but has no client caller yet, per the Phase 8/9 architecture docs). To Do simply re-projects whatever records exist; it does not manufacture a next occurrence.

## Cross-View Identity

Home, Calendar and To Do all read the same `state.records` array and the same record IDs — there is no copying. Tapping a To Do row calls the same `initialOpenRecordId`/`onOpenRecord` mechanism Calendar already uses to open the established `FirstThingScreen` editor for the exact underlying record. Completing from To Do updates that same record via `onSaveRecord`, so Home's sections and Calendar's day badges reflect the change immediately on the next render — no separate sync path exists to keep in step.

## Care-Space Isolation And Self-Care

`ToDoScreen` takes no care-space ID of its own; it is mounted with `key={currentSpace.careSpaceId}` (matching Calendar) and reads only the already-isolated `state.records` projection. The same architecture applies unchanged when the active care space is the organiser's own ("Myself") — there is no separate personal-tasks system.

## Offline Behaviour

`ToDoScreen` makes no network or storage call of its own. It is a pure function of its `records` prop; completion goes through the existing `onSaveRecord` → outbox path, which already handles offline queuing, retry and idempotent server reconciliation (Phase 7). No To Do-specific sync mechanism was added.

## Permissions

Visibility is already enforced upstream: `state.records` only ever contains records the organiser's active membership can see (Phase 7/8 RLS). To Do applies no additional filtering beyond eligibility and the assignment chips, and reveals nothing about restricted records through counts, filters or labels, because restricted records are never present in the array to begin with.

## Not Implemented (Deferred)

Reminders, push notifications, invitations, real care-circle collaboration, permissions UI, and any assignment representation beyond Phase 9's Unassigned/You scope. Assigned to Others is architected for (the filter set is a simple enum) but not populated, since no other active membership exists yet.

## Current Limitations

- The 30-day Upcoming horizon is a deliberate bound, not a canonical contract value beyond Home's own precedent; revisit if the product owner wants a different window.
- No recurrence materialisation happens client-side yet, matching the existing Phase 8/9 boundary.
- Physical-device QA is outstanding — see `docs/PHASE_12_QA.md`.
