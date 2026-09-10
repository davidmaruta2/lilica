# Phase 9 Everyday Add And Record Management

Status: Implemented and automatically validated; physical-device QA pending
Date: 10 September 2026
Implementation agent: Claude, taking over from Codex per a written product-owner brief (`fork.txt`)

## Boundary

Phase 9's brief asked for a complete everyday add/list/edit/lifecycle workflow, a stable-identity assignment control, and a preservation audit against Phases 1-8. A full trace of the current repository — not assumption — found that the category-gateway → list → add → edit → save architecture the brief describes was **already fully implemented** before Phase 9, as part of the 10 September 2026 "Structured Category And Wheel-Picker Correction" (see `docs/REVISION_LOG.md`), and already reachable from Home's everyday `Add` action (`onAddSomething` in `App.tsx` already routed to the same `firstThing` stage regardless of setup status). That architecture is unchanged by Phase 9.

What Phase 9 actually added, once the trace established what already existed:

1. A stable-identity **Assigned to: Unassigned / You** control, replacing nothing — it sits alongside the existing legacy free-text responsibility field, which is preserved exactly.
2. An **everyday-copy variant** of the same `FirstThingScreen`, so its heading and footer read naturally when reached from Home after setup is already complete, rather than always showing first-time onboarding language.

No new screen, no new navigation stage, no new migration, and no new sync/RPC surface were needed.

## Why No New Occurrence/Assignment Client API Was Needed

Tracing `src/domain/recordOccurrence.ts` and `src/recordSync.ts` (the only two files that reference the Phase 8 occurrence domain module) established that a Phase 8 "occurrence" is a **derived projection** computed automatically from the existing `LilicaRecord` fields (`eventDate`, `dueDate`, `completed`, `status`, `recurrence`) — both in the local cache (`canonicalOccurrenceForRecord`, called from `enqueueRecordUpsert`/`enqueueRecordDelete`) and server-side (a database trigger using the same algorithm, per `docs/PHASE_8_ARCHITECTURE.md`). There is no independent occurrence-mutation API the UI needs to call: editing a record through the existing `RecordEditor` → `onSaveRecord` → `saveRecord()` → `enqueueRecordUpsert()` path already produces a correct canonical occurrence projection, locally and on the server, with no Phase 9 changes required to that path at all.

## Assignment Control

`LilicaRecord`/`FirstItem` gained one new optional field, `assignedMembershipId?: string` (`src/types.ts`). It stores the active care space's own `membershipId` (already loaded locally as part of Phase 6/7's `LocalCareSpaceState`) — never a display name, email, or free text.

`RecordEditor` renders a two-option segmented control, "Assigned to: Unassigned / You", for the four record types that already show a responsibility field (appointment, task, bill, home matter). "You" stores the caller's own `activeMembershipId` prop; "Unassigned" stores `undefined`. The control is not rendered at all when no `activeMembershipId` is available, so nothing fabricates a populated care circle. Only Unassigned and You are offered because, today, a care space's only active membership is the organiser themselves — Phase 15 owns invitations and real collaboration; this control will extend to list other active memberships once they exist, without changing its stable-identity contract.

The existing free-text `responsiblePerson` field (labelled "Who's taking them"/"Who's dealing with it") is completely unchanged and rendered independently. Nothing here converts it into an assignment, matches it by name, or deletes it. The two fields coexist on the same record.

`assignedMembershipId` requires no migration: it rides inside the existing generic `record_data` JSONB column already written by `apply_record_mutation(...)`, exactly like every other record field Phase 7 already persists. It is not (yet) written to the separate server-side `assignments` table Phase 8 created as a foundation — that table has no client caller anywhere in the repository today (confirmed by search) and remains available for a later phase to wire up once genuine multi-member collaboration exists to exercise it. This was a deliberate scoping decision, not an oversight: building real `create_assignment` RPC integration, its own sync/outbox handling and RLS test coverage for a feature with only one possible assignee today would be substantial speculative work with nothing yet to validate it against.

## Everyday Copy

`FirstThingScreen` gained an optional `everyday` prop (`App.tsx` passes `currentSpace?.setupStatus === 'ready'`). When true:

- Heading: `"[Name]'s records"` instead of `"Let's get [Name] organised."`
- Supporting text: `"Add, review or update anything Lilica keeps track of for [Name]."`
- Empty-category footer button: `"Back to Home"` instead of `"I'll add things later"`

Nothing else about the screen changes. The category gateway, the compact record list, the bottom-sheet editor, wheel date/time pickers, keyboard behaviour and draft retention are exactly the same code path in both modes.

## Explicit Non-Goals (Per Brief)

Not implemented in Phase 9, matching the brief's explicit exclusions: Calendar projection (Phase 11), To Do projection (Phase 12), assignment invitations/collaboration/real care-circle population (Phase 15), a recurrence-rule editor beyond the existing Weekly/Monthly/Yearly toggle, any Home redesign, and any change to Phase 7/8 cache, outbox, RLS or migration history.

## Deployment

No migration was created or needed. No hosted `lilica-development` change was made.

See `docs/PHASE_9_QA.md` for physical checks.
