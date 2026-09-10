# Lilica — Core System Contract & Implementation Roadmap

Status: **DRAFT FOR PRODUCT-OWNER REVIEW — NO CODE CHANGED TO PRODUCE THIS DOCUMENT**

> Historical note: this is an earlier Phase 2 draft and its implementation-state statements are no longer current. `docs/CORE_SYSTEM_CONTRACT.md` is the authoritative approved contract; `docs/LUMEN_HANDOFF.md` describes the implemented Phase 5/6 state and current next steps.

Legend used throughout:

- **[EXISTING]** — true today, verified against the actual code (not just the docs).
- **[PROPOSED]** — a new decision this document is asking you to approve.
- **[ASSUMPTION]** — something taken as given because no evidence contradicts it; flag if wrong.
- **[OPEN]** — a decision this document does not make for you.

---

## 1. Executive Summary

Phase 1 built a real, working foundation: a calm onboarding flow, a generic `LilicaRecord` model, deterministic due/overdue/upcoming derivation, and a Home screen that only ever shows real data. That part of the GPT conversation's assessment is correct and verified — Phase 1 is not a throwaway prototype.

But three structural gaps exist that would cause exactly the "we have to redo this" pain you're trying to avoid, and none of them are cosmetic:

1. **Recurrence has no lifecycle.** A completed recurring record computes a `nextDueDate` and then does nothing with it. There is no code path that creates a new occurrence, and no code path that reopens the record. A "yearly boiler service" marked complete today has, in the current system, no way to become "upcoming" again next year without a person manually editing the date back.
2. **One record type is doing two jobs.** `bill`, `homeMatter` and `task` conflate "this is a fact I want to remember" with "this is something that must be actioned by a date." There is no relationship model between a long-lived record (Blue Badge, insurance policy) and the action it generates (renew it), which is exactly the gap GPT's conversation identified independently.
3. **Identity is genuinely a placeholder**, confirmed in code, not just in docs: `AuthState` stores a method and an unverified email string; there is no organiser profile; `supportedPersonId` is a single client-generated string (`person-${Date.now()}`) with no model for supporting more than one person.

None of these require a rewrite. The existing `LilicaRecord` shape is fundamentally sound and this document recommends extending it, not replacing it. But they do require the sequencing GPT's conversation ultimately converged on: **define the contract first, build identity and backend second, expand screens third.** This document is that contract.

---

## 2. Current Implementation Assessment

Verified directly against source, `git log`, and `git status` (clean, `master` in sync with `origin/master`, 4 commits, latest: "Add structured onboarding record workflow").

| Area | File(s) | Verified state |
|---|---|---|
| Onboarding stages | `App.tsx`, `src/types.ts` | 11-stage `OnboardingStage` union incl. two dead stages (`how`, `itemForm`) kept only for backward compatibility with old persisted state |
| Record model | `src/types.ts` (`FirstItem` aliased as `LilicaRecord`) | One generic record shape for all 8 categories, as documented |
| Derived state | `src/records.ts` | `dueToday`, `overdue`, `upcoming`, `completed`, `unresolved`, `recentlyUpdated`, `nextDueDate` — all computed from `Date`, no AI involved. **Confirmed deterministic**, matching every doc's claim. |
| Persistence | `src/storage.ts` | Single AsyncStorage key (`lilica:onboarding:v1`) holding the entire `OnboardingState` as one JSON blob. Legacy `firstItem` → `records[]` migration exists and is non-destructive. |
| Record entry | `src/screens/FirstThingScreen.tsx`, `src/components/RecordSheet.tsx`, `src/components/RecordEditor.tsx` | Matches docs: vertical snapping stack, bottom-sheet editor, draft retention while mounted, document upload + camera capture with local copy to `Paths.document/attachments` |
| Home | `src/screens/HomeScreen.tsx` | Groups into Needs attention / Today / Coming up / Latest, empty sections omitted, no fake records — confirmed |
| Interests | `src/screens/InterestsScreen.tsx` | Horizontal chip carousel with scroll arrows — matches `PROJECT_BRIEF.md`'s description, this is current, not stale |
| Backend | — | **No Supabase configuration exists anywhere in the repository** (confirmed by full-repo search). `package.json` has no Supabase SDK dependency. This matches the docs, which is good — no code/doc contradiction here. |
| Tests | — | No test files, no test runner, no lint script anywhere in the repo. `package.json` scripts are `start`, `android`, `ios`, `web`, `typecheck` only. |

### Discrepancies between documentation and actual code

1. **Dead code not flagged as dead.** `ItemFormScreen.tsx`, the `itemForm` onboarding stage, and the `FirstItemType` type still exist and are exported/imported in `App.tsx`, but no live code path sets `state.stage` to `'itemForm'` or sets `selectedFirstItemType` any more — the only way to reach that branch is a stale persisted `OnboardingState` from before this change shipped. No document mentions this. **[Recommendation: delete in a later cleanup phase, not now.]**
2. **`RecordStatus` includes `'cancelled'`, but nothing sets it.** `RecordEditor.statusFor()` never returns `'cancelled'`; there is no "cancel this appointment" UI action anywhere. The type promises a capability the product doesn't have yet. Not documented as a gap anywhere.
3. **`RecordConfirmation.status` includes `'confirmed'` as distinct from `'completed'`, but only `'completed'` is ever written.** The type already anticipates the responsibility/confirmation distinction Section 8 below defines, but no code exercises the `'confirmed'` value yet.
4. **A real timezone bug in `HomeScreen`'s "Today" section**, not previously documented: `sectionFor()` compares `item.eventDate === new Date().toISOString().slice(0, 10)`, which is a **UTC** calendar date, while `deriveRecordState()` in `records.ts` correctly uses local-time `Date` components throughout. In the UK during BST (UTC+1), these two can disagree for part of the day (e.g. an appointment dated "today" in local time may not match the UTC-derived string between midnight and 1am local, or vice versa near the other boundary). This is a genuine, if narrow, correctness bug worth fixing alongside Phase 5 (Home), not urgent enough to break design-only scope now.
5. **Recurrence is only offered on `bill` and `homeMatter`**, not on `appointment`, despite the product brief's own examples (repeat prescriptions, dental check-ups, boiler services) being a roughly even mix of appointment-shaped and bill-shaped recurring things. This isn't a doc/code contradiction so much as a gap the docs don't call out.

None of these are regressions to fix right now. They are findings that the system-contract work below needs to resolve *before* Phase 6 (record engine) touches this code, or they will be built on top of and get expensive to unwind.

---

## 3. Core Architectural Principles

**[PROPOSED — this is the central design decision of this document]**

Confirming GPT's "one coherent source of truth" principle, made concrete against the actual types:

1. **One record store, many views.** `LilicaRecord[]` remains the single source of truth. Home, Calendar, To Do and Person are all pure filters/sorts over the same array — never separate copies. This is **already true today** in `HomeScreen` (it filters `state.records`); the job going forward is to keep it true as Calendar and To Do stop being placeholders.
2. **A record's identity is separate from its schedule.** Every record has exactly one lifecycle status (Section 5). Whether it shows up in "Needs attention" or "Coming up" is *always derived*, never stored redundantly. This is already the pattern in `records.ts` — extend it, don't parallel it.
3. **Long-lived information and the actions it generates are linked, not merged.** A Blue Badge (fact, has an expiry) and "Renew Blue Badge" (task, has a due date) are two records connected by a `generatedFromRecordId` (or similar) relationship, not one record wearing two hats. This does not exist today and is the most consequential net-new concept in this document (Section 6).
4. **Recurrence produces new occurrences; it does not mutate history.** Completing a recurring record must not silently rewrite its own date. This does not exist today (see Section 2, finding 1) and is the second most consequential net-new concept (Section 7).
5. **Responsibility, confirmation and activity are three different fields, not one.** Already anticipated by the type system (`responsiblePerson`, `confirmationHistory`, `createdAt`/`updatedAt`) but not yet fully distinct in behaviour (Section 8).
6. **Identity is layered: Account → User profile → Supported-person profile → Care-space membership.** None of the later three exist yet; only a placeholder `AuthState` exists (Section 11).

---

## 4. Entity and Relationship Model

```
Account (Phase 3 — not built)
  └─ owns → User profile (organiser) (Phase 3 — not built)
                └─ member of → Care-space membership (Phase 10 — not built) ─┐
                                                                              │
Supported-person profile (Phase 4 — currently a bare id + name string) ←─────┘
  └─ has one → Care space
                 └─ contains → LilicaRecord[] (Phase 1, EXISTS)
                                  ├─ may generate → LilicaRecord (linked task)   [PROPOSED, Section 6]
                                  ├─ may recur into → LilicaRecord (next occurrence) [PROPOSED, Section 7]
                                  ├─ has → RecordAttachment[]                    (EXISTS)
                                  ├─ has → RecordConfirmation[]                  (EXISTS, underused)
                                  └─ has → ActivityEvent[]                       [PROPOSED, Section 8]
```

**[EXISTING]** Today, "supported-person profile" is just `supportedPersonId: string` (a client-generated timestamp string) plus `supportedPersonName: string` sitting directly on `OnboardingState` — there is no separate profile entity, and the architecture implicitly assumes exactly one supported person per install. **[OPEN — Phase 4 decision]**: whether to model this as `SupportedPerson { id, name, ... }[]` now (cheap, prevents retrofit pain) even though the UI will still only expose one for a while.

---

## 5. Record Lifecycle / State Model

### Stored vs derived

**[EXISTING]** `status: 'scheduled' | 'unresolved' | 'completed' | 'saved' | 'cancelled'` is the one stored field. Everything else (`dueToday`, `overdue`, `upcoming`, `unresolved`-as-shown, `recentlyUpdated`) is derived in `records.ts` from `status`, `completed`, and dates — never independently stored. This is correct and should stay this way.

**[PROPOSED]** Clarify and slightly extend the stored enum:

| Stored status | Meaning | Set by |
|---|---|---|
| `draft` | Being entered, not yet saved | Never persisted today — `RecordSheet` drafts live in component state only, which is correct; no change needed |
| `scheduled` | Has a future/pending date, not yet due | `appointment` default |
| `unresolved` | Needs action, no hard due-date gate | `task`, `bill`, `homeMatter` default |
| `completed` | Done | Any type, user-marked |
| `cancelled` | No longer happening | **[NEW — not currently reachable via UI]** |
| `archived` | Completed/cancelled and hidden from active views, kept for history | **[NEW]** |

`awaiting confirmation` is **[PROPOSED — not adopted]** as a separate stored status; it is better modelled as a derived state (`completed === true && confirmationHistory is empty`) once multi-user confirmation exists in Phase 11, rather than a status a single-user Phase 1–9 system needs to track.

### Valid transitions

```
scheduled/unresolved → completed
scheduled/unresolved → cancelled
completed → reopened (→ scheduled/unresolved, confirmationHistory entry preserved, not deleted)
cancelled → reopened (→ scheduled/unresolved)
completed/cancelled → archived (terminal, no further transition except explicit "restore")
completed (recurring) → next occurrence created (Section 7) — the ORIGINAL record stays `completed`, forever; it does not transition again
```

### Explicit answers to the "do not assume" list in the brief

- **A due date passing does NOT complete a record.** `deriveRecordState` already gets this right — `overdue` is a derived read-only flag, `status` is untouched. **[EXISTING, correct, preserve.]**
- **An appointment time passing does NOT mark it completed.** **[EXISTING, correct]** — nothing in the code marks appointments complete automatically. **[PROPOSED, Phase 9]**: once reminders exist, a passed appointment should surface a prompt ("Was this appointment attended? Mark complete or reschedule?") rather than silently doing either.
- **Marking a bill "paid" is a user assertion, not a bank fact.** **[PROPOSED]** — no verification claim should ever be implied in copy or data. Store it as `status: 'completed'`, nothing more.
- **Dismissing a reminder ≠ confirming completion.** **[PROPOSED, Phase 9]** — reminder dismissal is UI-only state (Section 10), never writes to `status` or `confirmationHistory`.
- **Rescheduling** an appointment **[PROPOSED]**: updates `eventDate`/`eventTime` in place, appends nothing to `confirmationHistory` (that's for completion, not editing), but does update `updatedAt` (already happens automatically via `RecordEditor.save`).
- **Deleting** a record **[OPEN — Phase 6 decision]**: hard delete vs soft delete (`archived` + retained). Given GDPR/export requirements in Section 14, recommend soft delete with a genuine hard-delete-on-request path, not implemented until Phase 17.

---

## 6. Record Types and Linked Actions

**[EXISTING]** 8 user-facing entry points (`appointment`, `task`, `bill`, `homeMatter`, `document`, `contact`, `careNote`, `update`) map onto one `LilicaRecord` shape via per-type field usage in `RecordEditor`. This is verified sufficient as a set of entry points — no 9th type is needed for the brief's example list (Blue Badge, Attendance Allowance, MOT, Power of Attorney, etc. all map onto `homeMatter` or `document` with a category-ish free-text field already available via `title`/`notes`/`provider`).

### The information/event/task/deadline/document/contact/activity distinction

**[PROPOSED — the key net-new concept]**

| Concept | Example | Current model fit | Change needed |
|---|---|---|---|
| Long-lived information record | Blue Badge, insurance policy, Power of Attorney | `document` or `homeMatter`, `expiryDate` field exists | None — already fits |
| Event | GP appointment, family visit | `appointment`, `eventDate`/`eventTime` | None |
| Task/action | "Arrange transport", "Renew Blue Badge" | `task` | None — but needs a link back to what generated it |
| Deadline | Council Tax due, MOT due | `bill`/`homeMatter`, `dueDate` | None |
| Recurring obligation | Boiler service, repeat prescription | `bill`/`homeMatter` today, `recurrence` field exists but unused after completion | **Section 7** |
| Document | Uploaded letter, scan | `document`, `attachments[]` | None |
| Contact | GP surgery, Sarah | `contact` | None |
| Activity/update | "Sarah marked X collected" | `update` today conflates "a manual note the user typed" with "a system-generated activity log entry" | **Section 8 — split these** |

**[PROPOSED]** Add one nullable field to `LilicaRecord`: `generatedFromRecordId?: string`. When set, this record is an action/task spawned by another record (e.g. the "Arrange transport" task generated from a hospital appointment). No UI needs to force this link — it can be optional and manual at first ("+ Add related task" from an open record), automatic generation is a later product decision. This single field, added now, avoids the exact retrofit GPT's conversation worried about.

**[OPEN]** Whether/when to auto-suggest linked tasks (e.g. prompting "Add transport?" when saving a hospital appointment) is a Phase 7 product decision, not an architecture decision — the field above supports it whenever you're ready, without forcing it now.

---

## 7. Recurrence Model

This is the most important unresolved piece of the current implementation (Section 2, finding 1).

**[EXISTING]** `RecordRecurrence = { interval: number; unit: 'week'|'month'|'year' }` stored per-record. `deriveRecordState` computes `nextDueDate` when `completed && recurrence && relevantDate` — **but nothing consumes `nextDueDate`.** No code creates a new record, no code advances the existing one. Today, completing a yearly boiler service simply leaves that one record permanently `completed`.

**[PROPOSED]** Adopt the **"parent + occurrences" model**, which is the option GPT's conversation converged on for the same reasons:

- The record the user originally creates becomes the **template/parent** the first time recurrence is turned on (`recurrence` field set).
- Completing an occurrence does **not** mutate that record's date. Instead:
  - The completed record is stamped `status: 'completed'`, `completedAt` set, and (new) marked `archived: true` once a next occurrence exists — it remains permanently queryable in history/search (Section 13).
  - A **new** `LilicaRecord` is created: same `type`, `title`, `recurrence`, `generatedFromRecordId` pointing at the just-completed one (reusing the Section 6 field — one relationship concept serves both linked-task and recurrence-successor needs), and a fresh `dueDate`/`eventDate` computed via the existing `addRecurrence()` logic in `records.ts` (already correct, just currently unused for this purpose).
- This satisfies every requirement in the brief's Section 7 checklist:
  - **Completed history preserved** — original record never rewritten, just archived.
  - **Next occurrence** — the new record, `scheduled`/`unresolved` as appropriate.
  - **Missed occurrences** — if the new occurrence's due date itself passes uncompleted, it becomes `overdue` through the existing deterministic logic; no special handling needed.
  - **Rescheduling** — edits the *current open* occurrence only, never touches history.
  - **Changing the recurrence rule** — edits `recurrence` on the current open occurrence; only future-generated occurrences use the new rule.
  - **Stopping recurrence** — clear `recurrence` on the current open occurrence; no further occurrences generated.
  - **Completing one occurrence without completing all future ones** — trivially true, since only one occurrence is ever "open" at a time.
  - **Avoiding duplicate next occurrences** — generation happens exactly once, at the moment of completion, inside the same save transaction that marks the current one complete (not via a background job), so there is no dual-write race in a single-user local-storage system. **[OPEN — Phase 5]**: once collaboration (Phase 11) allows two people to complete the same record near-simultaneously, this needs a server-side idempotency guard — not a Phase 1–9 concern.

**[OPEN — product decision, not architecture]**: should the new occurrence appear immediately in Home/Calendar the moment the old one is completed, or only once its due date is "coming up"? Recommend: immediately, filed under Coming up/Latest as its date warrants, consistent with "everything is always a real record."

---

## 8. Responsibility, Confirmation and Activity

**[EXISTING]** `responsiblePerson: string` (free text), `confirmationHistory: RecordConfirmation[]` (only ever gets a `'completed'` entry, written by whoever's device saves the completion), `createdAt`/`updatedAt` timestamps.

**[PROPOSED]** Three distinct, non-conflated concepts, matching GPT's framing exactly:

1. **Responsibility** = an expectation, currently and for the near future just a **display label** (`responsiblePerson: string`). It is explicitly **not** the same as a care-circle member until Phase 10 exists — do not silently promote a free-text name into an authenticated identity. Once Phase 10 ships, add an optional `responsiblePersonMemberId?: string` alongside the existing free-text field (don't remove the free-text option — an organiser should still be able to write "the district nurse" without that being a real account).
2. **Confirmation** = an explicit user action, already modelled correctly by `confirmationHistory[]`; the only change needed is actually writing `'confirmed'` entries distinctly from `'completed'` ones once collaboration exists (e.g. Sarah confirms she saw the update, without marking the underlying task done).
3. **Activity** = a system-observed event log, **[NEW — does not exist yet]**. Proposed shape (additive, not a replacement for anything):

```ts
type ActivityEvent = {
  id: string;
  recordId?: string;          // optional: some activity isn't record-specific
  supportedPersonId: string;
  kind: 'created' | 'updated' | 'completed' | 'reopened' | 'cancelled'
      | 'attachmentAdded' | 'assigned' | 'note';
  actorMemberId?: string;      // Phase 10+; undefined pre-collaboration = "you"
  summary: string;             // "Sarah marked the prescription as ordered"
  occurredAt: string;
};
```

This directly replaces trying to derive "Latest" forever from `updatedAt` (which cannot express "Sarah did X" once multiple people can edit). **[OPEN — Phase 6 decision]**: whether `ActivityEvent`s are written client-side alongside every record mutation now (cheap, future-proofs Home's "Latest" section) or deferred entirely until Phase 11 collaboration. Recommend writing them starting Phase 6, even single-user, so "Latest" in Phase 5's Home rebuild has real activity text instead of guessing from timestamps.

**[PROPOSED — explicit non-claims]**: a marked-paid bill is not bank-verified; a dismissed reminder is not a confirmation; a free-text responsible person is not an authenticated account. All three must be either reflected honestly in copy or left unstated — never implied as verified.

---

## 9. Home / Calendar / To Do / Person as Views

All four are read-models over `LilicaRecord[]` (Section 3, principle 1). None should ever own its own writable copy of a record.

### HOME **[EXISTING structure, PROPOSED refinement]**

- **Needs attention**: `overdue`, or `dueToday`, or (`unresolved` for task/bill/homeMatter). Already implemented in `sectionFor()`.
- **Today**: appointments whose `eventDate` is today (**fix the UTC bug from Section 2 finding 4** as part of this work).
- **Coming up**: `upcoming === true`.
- **Latest**: catch-all today; **[PROPOSED]** once `ActivityEvent` exists (Section 8), Latest becomes "recent activity", not "everything else."
- Tapping an item **[OPEN — Phase 5]**: open the record for viewing/editing vs. quick-complete inline. Recommend: tap opens detail (reuses `RecordEditor`), a lightweight complete affordance lives directly on the row for the common case (mark bill paid, tick off a task).
- Empty state: **[EXISTING, correct]** — no fake sections, single "add something" CTA when nothing exists.

### CALENDAR **[Phase 6, currently a placeholder]**

- Every record with an `eventDate` or `dueDate` appears in Calendar (event date preferred for display, due date as fallback) — no separate calendar entity.
- Recurring occurrences appear individually (each is its own record, per Section 7), never as a computed repeating ghost entry.
- Cancelled/completed records remain visible in Calendar for their original date (struck through/muted), not hidden — this is how history stays visible without a separate archive UI.
- Opening a Calendar entry opens the same `RecordEditor` used everywhere else.

### TO DO **[Phase 7, currently a placeholder]**

- Explicit `task` records, plus any `unresolved`/`overdue` `bill`/`homeMatter` record (surfaced here, **not duplicated as a second task record** — Section 6's `generatedFromRecordId` link is for genuinely separate actions like "arrange transport," not for showing the same bill twice).
- **[OPEN — Phase 7 decision]**: filters (`All/Mine/Assigned/Overdue/Completed`) — recommend shipping without filters first, add once real usage shows they're needed.

### PERSON **[Phase 8, currently a placeholder]**

- Long-lived, non-time-critical information: `contact` records, `document` records, `careNote` records, household `homeMatter` records without an active due date, plus (once it exists) the supported-person profile itself and the care-circle entry point.
- **[PROPOSED]** explicitly not a medical dossier — no vitals, no diagnosis fields, matching the brief's repeated exclusion.

---

## 10. Reminder and Attention Engine

**[EXISTING]** "Attention" today is entirely in-app and derived (`overdue`/`dueToday`/`unresolved` flags feeding Home). **No notifications of any kind exist** — confirmed, no `expo-notifications` dependency, no scheduling code anywhere.

**[PROPOSED]** Three distinct layers, all deterministic (per the brief's explicit rule — no AI decides overdue/due state):

1. **In-app attention state** — [EXISTING, keep] — purely derived from dates/status, recomputed on every render, never stored.
2. **Local notifications** (Phase 9) — scheduled client-side from the same derived rules (due-soon, due-today, overdue-once, appointment-reminder-before). Rescheduled automatically whenever the underlying record's date changes (cancel old scheduled notification, schedule new one) — **[OPEN]** exact lead times (e.g. "due soon" = 3 days before?) is a product decision, not architecture.
3. **Server/push notifications** (Phase 9, requires Phase 5 backend) — for care-circle assignment ("Sarah, you've been assigned...") — cannot exist before accounts and a backend exist to route them.

**[PROPOSED — anti-spam rule]**: one due-today notification, one overdue notification (not daily repeats), one pre-appointment reminder. A record's reminder state (`lastNotifiedAt`, `notificationIds[]`) is a new, purely local field — never affects `status`.

**[PROPOSED]** Snoozing/dismissing writes only to this local reminder-state field, never to `status` or `confirmationHistory` (per Section 5's explicit rule). Completing on another device (Phase 5+) should cancel any locally-scheduled notification for that record on next sync — **[OPEN — Phase 9 decision]**, depends on the sync design in Section 12.

---

## 11. Identity and Care-Space Architecture

**[EXISTING, verified in code]**: `AuthState = { method: 'apple'|'google'|'email'|'local'; email?: string; returning?: boolean }`. No password, no verification, no organiser name/profile/photo field exists anywhere in `types.ts`. `supportedPersonId` is a bare generated string on `OnboardingState`, not a separate entity.

**[PROPOSED]**, matching both docs and GPT's conversation, four separate entities:

| Entity | Minimum fields | Owner |
|---|---|---|
| Account | id, verified email or OAuth subject, created/last-login | Supabase Auth (Phase 3) |
| User profile (organiser) | accountId, firstName, surname, displayName, photo (optional) | App-owned table (Phase 3) |
| Supported-person profile | id, name, createdByAccountId | App-owned table (Phase 4) |
| Care-space membership | userId, supportedPersonId, role, invitationStatus, invitedBy | App-owned table (Phase 10) |

**[PROPOSED]** Roles kept simple initially: `Organiser` (full control, always the creator) and `Member` (view/add/update ordinary records) — matching GPT's recommendation and avoiding a premature permissions matrix. **[OPEN — legal/product]**: whether a `Member` can ever remove the `Organiser`, and what happens to a care space if the sole Organiser deletes their account (Section 14).

**No DOB field** unless a specific, named product requirement emerges — none has been identified in any document reviewed. **[EXISTING copy rule, preserve]**: PROJECT_BRIEF.md already states this; this document doesn't change it.

A supported person is never required to hold an account — **[PROPOSED, consistent with existing brief]** — they can be represented purely as data inside someone else's care space indefinitely.

---

## 12. Supabase, Sync and Document Strategy

**[EXISTING — verified]**: no Supabase project reference, config file, environment variable, or SDK dependency exists anywhere in this repository. This document cannot confirm or deny whether a Lilica-specific Supabase project already exists at the account level — that is outside repo inspection. **[OPEN — first action of Phase 5, not this phase]**: check the Luxford Interactive Supabase organisation for an existing Lilica project before creating one; do not assume another Luxford app's project should be reused, and do not create/modify any Supabase resource during this design-only phase (per instruction).

**[PROPOSED]** Migration direction, matching GPT's recommendation:

```
existing local AsyncStorage types → server schema (Postgres tables mirroring LilicaRecord shape)
                                   → local cache/offline layer reading through the same types
```
Not: delete AsyncStorage, design tables from scratch, backfill later.

**[PROPOSED]** Practical migration behaviour:

- **Duplicate records**: dedupe on the existing `id` field (already a stable string per record) during first upload; never generate new ids for existing local records.
- **Interrupted migration**: idempotent upload — re-running the migration for a record already present server-side (matched by `id`) is a no-op, not a duplicate insert.
- **Failed uploads**: record stays flagged locally as "not yet synced" (`[NEW] syncedAt?: string` field, absent = pending); retried on next app foreground, never silently dropped.
- **Local files not yet synchronised**: attachment `uri` values are local file paths today (Section 2) — **[PROPOSED]** do not assume these can move between devices; the sync layer must re-upload the actual file bytes to Supabase Storage, not just the metadata, and only then can a second device resolve the attachment.
- **Records changed on more than one device**: **[OPEN — Phase 5 decision]**, recommend last-write-wins on `updatedAt` for Phase 5/6 (simple, matches single-organiser-mostly-one-device reality), with a real conflict UI deferred until Phase 11 collaboration makes concurrent edits common enough to justify the complexity.
- **Never delete or replace existing local data** during migration — **[EXISTING instruction, restated as a hard constraint on Phase 5 implementation]**.

---

## 13. Search and History

**[PROPOSED, Phase 16]** — not built, no architecture blocker today because everything already lives in one `LilicaRecord[]` array (and, once Section 8 ships, one `ActivityEvent[]` array). Search is a client-side (later server-side, once Postgres exists) filter over `title`, `notes`, category-specific fields (`provider`, `reference`, contact `role`/`phone`/`email`), and attachment filenames. History is simply: don't hard-delete, use `archived` (Section 5), and let search include archived records with a visible "completed"/"archived" marker.

**[PROPOSED — grounding for future Ask Lilica]**: any future retrieval-based assistant answers from this same structured store and states uncertainty when data is missing/ambiguous, never inferring facts not present in a record. Not building this now; noting it so Phase 6+ doesn't accidentally choose field names or shapes that would make grounded retrieval harder later.

---

## 14. Privacy and Data Lifecycle

**[EXISTING, verified]**: `privacyDeclarationAccepted: boolean`, `privacyDeclarationVersion` (current `privacy-basis-v2`), `privacyDeclarationAcceptedAt` — active gate, correctly never implies the supported person personally consented (only the organiser's declaration is stored). **Preserve as-is.**

**[OPEN — every item below requires either a product decision or specialist legal review before Phase 10+ implementation; none are answered by this document]**:

- Account deletion: what happens to a care space where the deleted account was the sole Organiser? (candidate: space becomes read-only / offered to another Member to adopt / scheduled for deletion after a grace period — **needs a decision, not assumed here**).
- Leaving vs. being removed from a care circle: does the leaving member's `responsiblePersonMemberId` linkage on past records get anonymised, or retained as historical fact? **[OPEN]**.
- Data export format and scope (GDPR right to portability) — **[OPEN, likely needs legal review]**.
- Retention after supported-person "removal" — **[OPEN, likely needs legal review]** given the supported person is often not the account holder and cannot request their own deletion directly.

This document does not invent policy text or answers for any of the above, per instruction — it only records that they must be settled before Phase 10 (care-circle foundation) ships.

---

## 15. End-to-End Workflow Walkthroughs

Each walkthrough is run against the **proposed** model (Sections 5–12), noting where it depends on a phase not yet built.

**A. New organiser creates an account, creates a supported-person space, adds a first appointment.**
Account created (Phase 3) → User profile completed → Supported-person profile created (Phase 4) → care space exists with zero records → organiser adds `appointment` record via the existing `RecordEditor` flow (unchanged from today) → record appears in Home's Today/Coming up and in Calendar (Phase 6) simultaneously, same underlying row. *No gaps.*

**B. Electricity bill: due reminder, missed, overdue, paid, history retained.**
`bill` record created, `dueDate` set → Phase 9 schedules a due-soon + due-today local notification → date passes uncompleted → `deriveRecordState` (unchanged) flags `overdue: true` → surfaces in Needs attention automatically, no write needed → user marks paid → `status: 'completed'`, `completedAt` set, one `ActivityEvent` written ("You marked the electricity bill paid") → record leaves Needs attention, remains in Latest/search permanently. *No gaps once Phase 9 exists.*

**C. Annual home insurance, renewal completed, next occurrence created correctly.**
This is the scenario that exposes today's real gap (Section 2, finding 1) and is fixed by Section 7: on completion, original record archived (not deleted, not date-mutated), new record created via `generatedFromRecordId` + `addRecurrence()`, dated one year forward. History of every past renewal remains searchable. *Requires Section 7 to be implemented (Phase 6) before this works — does not work today.*

**D. Hospital appointment → linked "Arrange transport" task → appointment rescheduled → transport task's fate.**
Appointment saved → user adds a linked task ("Arrange transport") with `generatedFromRecordId` = appointment id (Section 6) → appointment rescheduled (date edited in place, per Section 5) → **[OPEN — product decision, not answered here]**: does the linked task's due date auto-shift with it, or does the organiser get prompted ("Transport was arranged for the old date — update it?")? Recommend the prompt, not silent auto-shift, to avoid quietly wrong data — **flag for product-owner decision in Phase 7.**

**E. Repeat prescription task assigned to Sarah; Sarah completes it; David sees the update.**
Requires Phase 10 (membership) + Phase 11 (collaboration) fully. `responsiblePersonMemberId` set to Sarah's membership id → Sarah completes on her device → `status: 'completed'` + `ActivityEvent{kind:'completed', actorMemberId: sarah}` sync to David's device (Phase 5 sync) → Home's Latest shows "Sarah marked the prescription as ordered." *No architectural gap once Phases 5/8/10/11 exist; this is the payoff of Sections 8 and 12 being right.*

**F. Power of Attorney document uploaded, found later, replaced with a newer version, access understood.**
`document` record with `attachments[]` (Phase 1, exists) → search (Phase 16) finds it by title → **[OPEN — Phase 15 decision, not answered here]**: does "replace" create a new attachment entry alongside the old (versioned) or overwrite it? Recommend versioned (append, mark previous `supersededBy`), since a Power of Attorney's *history* of versions plausibly matters. Access is governed by care-space membership (Phase 10) — no per-document ACL beyond that, unless a real need emerges.

**G. Organiser supports both Mum and Dad, switches spaces without mixing records.**
Requires the Section 4 `[OPEN]` decision resolved in favour of a proper `SupportedPerson[]` model from Phase 4 onward (not the current single `supportedPersonId` string). If Phase 4 is built correctly, this "just works" because every record already carries `supportedPersonId` and every view already filters by it — **the risk is entirely in Phase 4 not future-proofing for more than one, which is exactly the retrofit GPT's conversation warned about.**

**H. Invite a family member, grant access, change role, later remove access.**
Phase 10 end-to-end: invitation created (email, pending state) → accepted → membership row created with role `Member` → role changed to... **[OPEN — no third role currently proposed beyond Organiser/Member]**, changing "role" today would just mean toggling between the two — if more granular roles are wanted later, add them without breaking this simple model. Access removed → membership deleted/revoked, past `ActivityEvent`s and `responsiblePersonMemberId` references remain (Section 14 `[OPEN]` governs whether they're anonymised).

**I. Offline completion + concurrent edit elsewhere — conflict behaviour.**
Per Section 12: Phase 5/6 ships last-write-wins on `updatedAt`. Concretely: David completes a task offline at 2pm; Sarah edits the same task's notes online at 2:05pm; David's device syncs at 2:10pm. Last-write-wins means Sarah's 2:05pm edit is what's stored if it has the later `updatedAt` after sync resolution — **David's completion could be silently lost.** This is an honest, named limitation of the Phase 5/6 recommendation, not hidden — **[OPEN, explicitly flagged as a risk to accept for now]**, proper conflict resolution (e.g. field-level merge, or a "completed" flag that always wins over a "notes" edit) is Phase 11+ work.

**J. Dismiss/snooze a reminder without completing the item.**
Per Section 10: writes only to local reminder-state fields. `status` and `confirmationHistory` untouched. The record remains `unresolved`/overdue on its own merits. *No gap once Phase 9 exists.*

**K. Cancel an appointment after reminders were scheduled.**
`status → 'cancelled'` (Section 5, currently unreachable in UI — needs a "Cancel" action added, likely Phase 6) → Phase 9's notification layer must cancel the previously-scheduled local notification for that record id when status changes to `cancelled` — **[OPEN — implementation detail for Phase 9, architecture already supports it via the record-id-keyed `notificationIds[]` field proposed in Section 10].**

**L. Reopen a completed item.**
Per Section 5: `completed → reopened`, `confirmationHistory` entry is **kept**, not deleted (history is never rewritten), status reverts to `scheduled`/`unresolved` as appropriate for its type. **No gap, but the "reopen" UI action itself doesn't exist yet — Phase 6 deliverable.**

**M. Search for an old hospital letter or completed boiler service.**
Per Section 13: works once search exists (Phase 16) because nothing is ever hard-deleted and archived records remain in the same array. *No architectural gap, purely a missing feature until Phase 16.*

**N. Delete account / leave a care circle — ownership and shared info handled correctly.**
This is the one scenario this document cannot fully resolve, by design (Section 14) — it depends on legal/product decisions not yet made. The architecture (Section 4/11) supports whatever answer is chosen (membership rows can be revoked/reassigned without touching the underlying records), but the *policy* (what happens to shared records, retention period, who inherits Organiser role) is explicitly **[OPEN]** and flagged for product-owner + legal decision before Phase 10 ships.

---

## 16. Gap and Risk Register

| Area | Classification | Note |
|---|---|---|
| Record model shape | Already implemented and suitable | Extend via one additive field (`generatedFromRecordId`), not a rewrite |
| Deterministic due/overdue/upcoming logic | Already implemented and suitable | Preserve exactly; fix the UTC "Today" bug (Section 2.4) alongside Phase 5 |
| Recurrence | Implemented but needs extension | `nextDueDate` computed, never consumed — Section 7 closes this |
| Responsibility field | Implemented but needs extension | Free-text today; extend, don't replace, once membership exists |
| Confirmation history | Implemented but needs extension | Type supports it; behaviour only writes `'completed'` today |
| Activity log | Missing | Section 8 — new, additive, non-breaking |
| Linked record relationships | Missing | Section 6 — one new field closes this |
| Record cancel/archive | Missing | Type has the enum value; no UI/behaviour yet |
| Authentication | Prototype only | Confirmed in code: unverified email string, no password/OAuth |
| Organiser profile | Missing | No fields exist anywhere |
| Supported-person profile as entity | Missing | Currently a bare id+name pair, not a real entity |
| Care-circle membership | Missing | No types, no UI |
| Backend/Supabase | Missing | Confirmed zero references in repo |
| Multi-device sync | Missing | Depends on backend |
| Notifications | Missing | Confirmed zero references in repo |
| Calendar / To Do / Person tabs | Prototype only | Static placeholder text, confirmed in `App.tsx` |
| Test suite | Missing | Requires product decision on tooling + priority (Section 18) |
| Multi-supported-person architecture | Requires product decision | Section 4 — decide before Phase 4, expensive to retrofit after |
| Conflict resolution strategy | Requires product decision | Section 12/15-I — last-write-wins accepted as an interim, named risk |
| Account deletion / leaving-circle policy | Requires legal/product review | Section 14 |
| Data export / retention | Requires legal/product review | Section 14 |
| Document versioning on replace | Requires product decision | Section 15-F |

**Most expensive-to-retrofit-later risks, ranked:**
1. Building Phase 4 (supported-person model) as single-person-only — matches GPT's own top concern.
2. Shipping Phase 6 (full record engine) without the `generatedFromRecordId` field — every later linked-task/recurrence feature would then need a migration.
3. Choosing a conflict-resolution strategy implicitly (by not deciding) rather than explicitly accepting last-write-wins as an interim, documented risk.

---

## 17. Numbered Implementation Roadmap

Simple numbering per instruction (no 2A/2B). This phase (system contract) has consumed "Phase 2." Numbering continues from 3.

| Phase | Purpose | Key exclusions | Stop point |
|---|---|---|---|
| **3** | Account & organiser identity | No care-circle UI, no record/dashboard redesign | User can create/verify an account and complete "About you"; existing supported-person flow unchanged downstream |
| **4** | Supported-person & care-space model as a real entity (not a bare id) | No multi-person UI required yet, but the *model* must support it | One supported-person space, cleanly separable from the organiser; architecture supports more than one without migration |
| **5** | Backend, sync & safe migration | No collaboration UI | Existing local records/attachments migrate to Supabase without loss; app works online with local cache |
| **6** | Full record engine: recurrence occurrences, linked records, cancel/archive/reopen | No Calendar/To Do UI changes yet | Section 7's recurrence model and Section 6's linked-record field are real and tested |
| **7** | Universal Add & domain workflows for all 8 types, everyday (not just onboarding) use | No notifications yet | User manages many records per category outside onboarding |
| **8** | Home rebuild | No Calendar/To Do | Home matches Section 9's rules exactly, UTC bug fixed |
| **9** | Reminder & notification engine | No push/server notifications (local only) | Section 10 rules implemented, anti-spam respected |
| **10** | Calendar | — | Time-based view over the same records, no second data model |
| **11** | To Do | — | Task-focused view, no duplicate records |
| **12** | Person space | — | Long-lived info organised, not a medical dossier |
| **13** | Care-circle foundation: membership, invitations, roles | No fine-grained permissions matrix | Invite/accept/revoke works; server-enforced, not just UI-hidden |
| **14** | Care-circle collaboration: assignment, activity attribution | — | Two people coordinate without identity/permission conflicts |
| **15** | Documents & information maturity: cloud attachments, versioning, expiry | No OCR unless separately approved | Section 15-F resolved |
| **16** | Search & history | — | Find anything, including archived/completed |
| **17** | Settings, privacy & account lifecycle | — | Section 14's open legal questions resolved and implemented |
| **18** | End-to-end hardening | No new features | Regression tests, offline/conflict edge cases, accessibility, performance, physical-device QA |

Each phase, per your existing process: **inspect → propose scope → get approval → implement only that → verify → document → stop for review.**

---

## 18. Regression Protection Strategy

**[EXISTING, confirmed still true, must remain true]**: Welcome/How Lilica Works, account-choice presentation, privacy gate+version+timestamp, interest carousel (ordering only, never hiding), `Let's get [Name] organised` stack, bottom-sheet editor gestures, draft retention while mounted, document picker/camera, real-record-only Home, legacy `firstItem` migration, Expo SDK 57.

**[PROPOSED — practical test strategy, since none exists today]**:

1. **Now (no dependencies)**: a small set of pure-function unit tests for `src/records.ts` (`deriveRecordState`, `toIsoDate`, `addRecurrence` behaviour) — this is the highest-value, lowest-cost test investment available, since it's the deterministic logic every other phase builds on. Add before Phase 6 touches recurrence.
2. **Phase 6+**: snapshot/assertion tests around the record-save reducer logic in `App.tsx` (`saveRecord`, `completeOnboarding`) once it grows to handle occurrence-creation — this is exactly the kind of state-machine code that regresses silently.
3. **Ongoing**: manual physical-device checklist (already exists in `LUMEN_HANDOFF.md`'s "Incoming Agent Checklist") stays mandatory until Phase 18 introduces automated E2E coverage — do not treat `npm run typecheck` passing as proof the UI works, per existing instruction.

---

## 19. Decisions Requiring Product-Owner Approval

Before Phase 3 begins, please confirm or redirect:

1. **Recurrence model (Section 7)**: approve the "parent record archived, new occurrence created via `generatedFromRecordId`" approach, or prefer an alternative?
2. **Linked-record field (Section 6)**: approve adding `generatedFromRecordId?: string` to `LilicaRecord` now (Phase 6), even before any UI uses it, to avoid a later migration?
3. **Multi-supported-person architecture (Section 4)**: build Phase 4's data model to support more than one supported person from day one (recommended), even though the UI will keep exposing only one for several phases?
4. **Conflict resolution (Section 12/15-I)**: accept last-write-wins as the named, documented interim risk through Phase 6, with real conflict handling deferred to Phase 11?
5. **Roles (Section 11)**: confirm the simple Organiser/Member split is sufficient to start, with no third role yet?
6. **Activity log (Section 8)**: start writing `ActivityEvent`s from Phase 6 onward (single-user, future-proofing Home's Latest section), or defer entirely to Phase 11?
7. **Two known bugs found during this review (Section 2)**: confirm these should be fixed opportunistically in Phase 8 (Home rebuild) rather than as an immediate hotfix now: (a) the UTC/local timezone mismatch in "Today," (b) the unreachable `cancelled` status / dead `ItemFormScreen` code.
8. **Legal/privacy items (Section 14)**: account deletion policy, leaving-circle data retention, and export scope all need either your product decision or a specialist legal review before Phase 13 — who should own getting that review scheduled?

---

*No application code, dependencies, or Supabase resources were modified in the production of this document. `git status` remains clean.*
