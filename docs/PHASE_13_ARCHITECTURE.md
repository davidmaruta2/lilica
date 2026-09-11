# Phase 13 Person Projection Architecture

Status: Implemented and automatically validated; physical-device QA pending (see `docs/PHASE_13_QA.md`)
Date: 11 September 2026

> **Superseded in part by Corrective Task 10** (see
> `docs/CORRECTIVE_TASK_10_PEOPLE_IA.md`, same date): the five-section
> "durable knowledge" design below duplicated Home's own dashboard and
> gave the tab (now renamed People) no distinct purpose. The
> identity/self-care/isolation/offline/permissions guarantees documented
> here are unchanged and still accurate; the section list under "Source
> Of Truth And Groupings" and the placeholder "Care Circle" section
> below are not — read the corrective task doc for the current design.

## Boundary

Phase 13 makes the Person tab a real projection of the same canonical records Home, Calendar and To Do already read. It introduces no Person-specific record type, store, or editor. It does not implement reminders, care-circle collaboration, document cloud maturity, OCR, Ask Lilica, search/history, or any medical/legal inference.

## What Was Actually There

The tab labelled with the supported person's name previously rendered `AccountScreen` — the organiser's own account settings (display name, email, sign out) — under copy that promised a person knowledge space it never delivered ("Keep their appointments, home details, documents and contacts together here."). That mismatch is what Phase 13 corrects: `PersonScreen.tsx` is now the real destination, and `AccountScreen` (unchanged in substance, minus that stale copy) is reached from a small "Account" link in Person's header, preserving sign-out access. See "Out-of-scope findings" in the Phase 13 completion report for why this was necessary rather than optional.

## Source Of Truth And Groupings

`PersonScreen` reads exactly `state.records` — the same active-care-space projection Home/Calendar/To Do already read — and groups it into five durable-knowledge sections, each backed by one existing record type:

- **Important contacts** — `contact`
- **Care & health information** — `careNote`
- **Home** — `homeMatter`
- **Documents & paperwork** — `document`
- **Bills & renewals** — `bill`

`appointment`, `task` and `update` records are deliberately excluded from every section: appointments belong to Calendar, tasks to To Do, and updates to Home's chronological Latest — Person answers "what do we know", not "when" or "what needs doing". A record with `status === 'cancelled'` is excluded from Person; completed records are still shown (a finished home-matter or document is still durable knowledge, unlike To Do's active work list).

Each section is omitted entirely when empty (never "0 contacts"); if every section is empty, one calm empty state replaces the whole list rather than five empty boxes.

## Identity And Editing

Tapping a Person row calls the same `openRecordFromProjection`/`initialOpenRecordId` mechanism Calendar and To Do already use, opening the identical established record editor for the same record ID. Per-section "Add" links call a new `openNewFromProjection(type)`, which sets a new one-shot `initialOpenType` on `FirstThingScreen` (a sibling of the existing `initialOpenRecordId`, same consume/clear contract) so "Add a contact" opens a *new* draft of that category directly, still through the exact same category/record creation architecture — never a separate form.

## Self-Care

Wording is driven entirely by the explicit `isSelf` prop (`currentSpace.relationshipType === 'Myself'`, the same check already used elsewhere), never by matching a display name. `isSelf` renders "You" and first-person copy; otherwise the person's real display name and relationship label are shown.

## No Inference

Person shows only what a record's own fields already say. It never derives a diagnosis from an appointment title or medication note, never asserts legal authority from a "Power of attorney" document title beyond showing it as paperwork, and never generates a summary sentence ("Maggie is generally healthy"). Where information has no source in the record model — an author/provenance field, for instance — Person shows what is genuinely known (`Added <createdAt date>`) rather than fabricating who entered it.

## Care Circle

A static "Care circle" section always shows the organiser as "You", the only person with access today. No invitations affordance is offered, and no additional members are fabricated — this is structural anticipation of Phase 15, not a working feature.

## Care-Space Isolation And Self-Care

`PersonScreen` takes no care-space ID of its own; the same care-space isolation Home/Calendar/To Do already have (the `state.records` projection scoped to `activeCareSpaceId`) applies unchanged. The same architecture applies when the active care space is the organiser's own ("Myself").

## Offline Behaviour

`PersonScreen` makes no network or storage call of its own — a pure function of its `records` prop, already cache-backed at the app level via the existing Phase 7 mechanism.

## Permissions

`state.records` already contains only records the organiser's active membership can see (Phase 7/8 RLS). Person applies no additional filtering beyond category grouping, and reveals nothing about inaccessible records through counts or labels, because inaccessible records are never present in the array.

## Not Implemented (Deferred)

Reminders/notifications (Phase 14), real care-circle collaboration/invitations (Phase 15), document cloud maturity/OCR (Phase 16), search/history (Phase 17), account lifecycle/export (Phase 18), and any AI summarisation.

## Current Limitations

- No per-record authorship/provenance field exists in the current model, so Person shows `Added <date>` rather than "Added by X" — flagged rather than fabricated.
- "Add a contact"/etc. open a new draft of the right category directly; there is still no dedicated Person-only creation form (by design).
- Physical-device QA is outstanding — see `docs/PHASE_13_QA.md`.
