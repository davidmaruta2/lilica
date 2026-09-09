# Lilica — Core System Contract & Implementation Roadmap

Status: **Proposed for product-owner review**
Phase: **2, design and architecture only**
Prepared: **9 September 2026**
Implementation authority: **None. This document does not authorise Phase 3 or any code, dependency, schema, cloud, or screen change.**

Implementation note, 9 September 2026: the product owner subsequently approved this contract as the architectural authority and separately authorised Phases 3 and 4. Phase 4's implemented environment, profile schema, RLS, tests, and operational limits are recorded in `docs/SUPABASE_OPERATIONS.md`.

## How To Read This Contract

This document distinguishes four kinds of statement:

- **Existing:** verified in the Phase 1 repository at commit `4def7c7`.
- **Proposed:** the recommended finished-product contract, subject to approval.
- **Assumption:** a working default that needs validation but is safe enough to design around.
- **Decision required:** a product, legal, operational, or technical choice that must be settled before the relevant implementation begins.

The word **must** describes a proposed invariant. It does not mean the behaviour already exists.

---

## 1. Executive Summary

Lilica should be one coherent information system, not a collection of screens with separate logic. A fact or obligation is captured once, then projected into Home, Calendar, To Do, Person, reminders, history, search, collaboration, and eventually Ask Lilica according to deterministic rules and the current user's permission.

The recommended core is:

```text
authenticated account
  -> user profile
  -> care-space membership
  -> care space
  -> supported person
  -> record
       -> zero or more occurrences
       -> zero or more linked actions/records
       -> assignments
       -> confirmations
       -> attachments and document versions
       -> immutable activity events
       -> reminder rules and delivery history
```

The decisive architectural change is to separate a durable **record** from its time-bound **occurrences** and from related **actions**:

- `Blue Badge` is long-lived information.
- `Blue Badge document, version 2` is a versioned attachment.
- `Expires 30 November 2027` is a dated occurrence or milestone.
- `Renew Blue Badge` is a linked action.
- `David marked renewal complete` is an activity and confirmation.

They remain connected, but they are not duplicate copies and do not share one overloaded status.

The second decisive change is to separate stored lifecycle facts from derived display state:

- Stored: active, archived, scheduled, open, completed, cancelled, missed, awaiting confirmation.
- Derived: upcoming, due soon, due today, overdue, past awaiting outcome, unresolved, recently changed.

A date passing never proves completion. A reminder dismissal never completes a record. A user marking a bill paid is a user assertion, not bank verification. An appointment passing becomes `past awaiting outcome`, not automatically completed or overdue.

Recurring items should use a stable series/record with individual occurrences. Completed history is immutable. Changing a recurrence rule affects future occurrences according to an explicit scope and never rewrites completed history.

Supabase is the intended backend. The recommended environment model is local development plus a dedicated Lilica non-production project and a separate Lilica production project within the Luxford Interactive organisation. No evidence of an existing Lilica Supabase project is present in the repository or local environment, and cloud existence could not be verified without account access. No cloud resource was created or changed during this review.

Before implementation, the product owner must approve the decisions in section 19, especially lifecycle terminology, recurrence behaviour, linked-action defaults, Home horizons, assignment acceptance, permission granularity, deletion/retention, and offline conflict presentation.

---

## 2. Current Implementation Assessment

### 2.1 Verified Phase 1 Baseline

The repository currently provides:

- A protected three-slide Welcome / How Lilica Works foundation.
- Placeholder Apple, Google, local login, and email-entry actions.
- Supported-person relationship and preferred-name capture.
- An active privacy declaration gate, version `privacy-basis-v2`, and acceptance timestamp.
- A horizontal interest carousel that changes ordering but does not hide record categories.
- A vertical snapping onboarding stack with eight entry types.
- Compact bottom-sheet editors with mounted-session draft retention.
- Local `LilicaRecord[]` persistence inside a single AsyncStorage onboarding object.
- Local document picking, rear-camera capture, and app-document-directory copies.
- Deterministic date parsing and a first due/overdue/upcoming calculation.
- A Home screen populated only from real saved records.
- Placeholder Calendar, To Do, and Person tabs.

There is no production authentication, organiser profile, care-space model, backend, cloud storage, notification engine, search, sync engine, RLS policy, database migration, lint script, or configured automated test suite.

### 2.2 What Can Be Preserved

| Existing element | Assessment | Contract treatment |
|---|---|---|
| `LilicaRecord` IDs, type, title, notes, dates, category fields | Useful migration source | Preserve as a versioned Phase 1 import shape; map into the new entities rather than discard it. |
| Supported-person ID on records | Correct ownership direction | Make required server-side through care-space ownership. |
| ISO calendar-date storage and UK input parsing | Useful foundation | Preserve for all-day dates; add timezone-aware timestamps for timed events. |
| Recurrence interval/unit | Useful intent | Migrate into a recurrence rule, but do not treat a calculated next date as an occurrence. |
| Completion timestamp and confirmation history | Useful evidence | Migrate into occurrence transitions, confirmations, and activity events. |
| Attachment metadata and durable native URI | Useful local source | Preserve locally until each object is uploaded, verified, and linked to a private cloud object. |
| `records[]` rather than fake Home data | Correct principle | Preserve absolutely. |
| Deterministic `deriveRecordState` direction | Correct principle | Replace its overloaded rules with kind-aware, timezone-aware selectors covered by tests. |

### 2.3 Code And Documentation Discrepancies Or Limitations

1. **Today appointments are misclassified.** `HomeScreen.sectionFor` tests `dueToday` before its appointment-specific Today rule. Because `deriveRecordState` uses `eventDate` as a relevant date, today's appointment enters Needs attention and the Today branch is unreachable.
2. **Passed appointments can become overdue.** The current shared date rule treats a past event date like an unpaid deadline. The finished contract must distinguish events from actionable due dates.
3. **Latest is not activity.** Undated contacts, notes, documents, completed records, and other fall-through records remain in Latest indefinitely. `recentlyUpdated` is calculated but not used by Home.
4. **Status is overloaded and can disagree with completion.** A record has both `status` and `completed`; edits recalculate status from type and checkbox state. There is no guarded transition model.
5. **Recurrence does not preserve occurrences.** The code calculates `nextDueDate` only after completion. It neither persists the next occurrence nor prevents duplicates nor preserves a recurrence-rule history.
6. **Confirmation is free-text attribution.** Completion history may use the responsible person's typed name or `You`; neither is a stable authenticated actor.
7. **Responsibility is a string.** It cannot represent a member assignment, invitation, acceptance, revocation, or safe notification target.
8. **No activity history exists.** `createdAt` and `updatedAt` cannot explain who changed what or distinguish meaningful changes from saves.
9. **The onboarding stack manages one record per type.** It opens the first matching record even though the array can contain more than one. It is not a permanent record manager.
10. **Legacy shape remains live.** `firstItem`, `selectedFirstItemType`, old `date/time`, and `ItemFormScreen` remain for compatibility. They should be migrated deliberately, not allowed to become parallel models.
11. **Attachment lifecycle is incomplete.** Native files are durable on one device, but web picker URIs may be temporary, removal leaves orphan local files, and there is no versioning, upload, access log, or cross-device availability.
12. **Home is a prototype projection.** There are no stable sort rules, list limits, item actions, time zones, or deduplication rules across sections.
13. **AsyncStorage writes one whole object.** It has no transactional mutation log, version conflict detection, per-entity sync state, retry queue, or multi-space isolation.

These are findings, not criticism of the Phase 1 scope. Phase 1 proved the flow; Phase 2 defines the contract needed to extend it safely.

---

## 3. Core Architectural Principles

### 3.1 One Source Of Truth

Each real-world object has one canonical identity. Home, Calendar, To Do, Person, reminders, search, and Ask Lilica query projections of that identity. They never create screen-owned copies.

### 3.2 Separate Facts, Intent, And Derived State

- **Facts:** dates, title, completion assertion, cancellation, actor, attachment, recurrence rule.
- **Intent:** this item requires action; this member is responsible; remind this user two days before.
- **Derived state:** due today, overdue, upcoming, needs attention, recently changed.

Derived state is recalculated from authoritative facts at read/scheduling time. It is not persisted as a second mutable truth unless needed as a cache that can be rebuilt.

### 3.3 Records, Occurrences, And Actions Are Distinct

A record represents the durable subject or series. An occurrence represents one dated instance. An action represents work someone can complete. A record may itself be action-like, but a long-lived information record must not be marked complete merely because one related action was completed.

### 3.4 History Is Append-Only

Current state may change, but meaningful actions create immutable activity entries. Recurrence never rewrites a completed occurrence. Document replacement creates a new version. Reopening does not erase the earlier completion.

### 3.5 Unknown Is A Valid State

Lilica must preserve uncertainty. Unknown payment status, unknown attendance, unaccepted assignment, unavailable attachment, or pending sync must remain explicit. The system must not infer reassuring facts from silence.

### 3.6 Solo Value, Collaboration Ready

One authenticated organiser can use a care space alone. The model still separates account, profile, supported person, care space, and membership so collaboration can be added without changing record ownership later.

### 3.7 Server-Enforced Permission

The backend, not hidden UI, decides access. Every care-space entity carries the policy boundary needed for Row Level Security. Supabase recommends enabling RLS and defining least-privilege grants and operation-specific policies for exposed tables ([official RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)).

### 3.8 Local First, Server Authoritative For Shared Truth

The client may create and change records offline. The server is authoritative for membership, permissions, accepted shared state, and conflict resolution. Local data remains a cache plus pending mutation queue, not an independent permanent version of a shared care space.

### 3.9 Data Minimisation And Adult Autonomy

Collect only what serves a defined product purpose. Health data may be special-category data and requires a lawful basis, an Article 9 condition, transparency, minimisation, appropriate security, and likely DPIA consideration; specialist UK privacy advice is required before production ([ICO guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/?q=small)).

### 3.10 Semantic Operations, Not Blind Last-Write-Wins

`Complete`, `cancel`, `reschedule`, `assign`, `replace document`, and `archive` are domain operations. They must be validated transactionally and logged. Treating them as arbitrary row replacement would make offline and collaborative conflict handling unsafe.

---

## 4. Entity And Relationship Model

### 4.1 Proposed Conceptual Model

```text
AuthAccount 1--1 UserProfile
UserProfile 1--* CareSpaceMembership *--1 CareSpace
CareSpace 1--1 primary SupportedPerson
CareSpace 1--* Record

Record 1--* Occurrence
Record *--* Record (through typed RecordLink)
Record/Occurrence 1--* Assignment
Record/Occurrence 1--* Confirmation
Record/Occurrence 1--* ActivityEvent
Record 1--* Attachment
Document Record 1--* DocumentVersion 1--* Attachment
Record 0--1 RecurrenceRule 1--* Occurrence
Record/Occurrence 1--* ReminderRule 1--* NotificationDelivery

CareSpace 1--* Invitation
CareSpaceMembership 1--* DomainGrant / RecordGrant
```

### 4.2 Entities

| Entity | Purpose | Key invariants |
|---|---|---|
| Auth account | Supabase authentication identity | One stable auth UUID; email/provider identity is not the user-facing profile. |
| User profile | The organiser/helper as a recognisable person | One per account; required display name; optional photo; DOB absent unless separately justified. |
| Supported person | The person receiving support | Does not require an account; may later link to an account without changing identity. |
| Care space | Security, ownership, and collaboration boundary | One primary supported person per space in the initial product; one user may join many spaces. |
| Membership | Relationship between user and care space | Carries role, status, relationship label, and effective access; never inferred from a free-text name. |
| Invitation | Pending offer to join a care space | Expiring, single-use, revocable, bound to intended email and proposed role/grants. |
| Record | Canonical durable object or series | Belongs to exactly one care space; has kind, user-facing type, title, lifecycle, creator, version, timestamps. |
| Occurrence | One dated instance or actionable cycle | Belongs to one record; preserves its own date, status, completion, cancellation, and recurrence identity. |
| Record link | Typed relationship between canonical records | Directional, explicit, non-duplicative; deletion does not silently cascade across business objects. |
| Recurrence rule | Definition for generating occurrences | Versioned/effective-dated; generation is idempotent; completed history is immutable. |
| Assignment | Who is expected to act | Targets an active membership or a non-member contact, never an ambiguous string only. |
| Confirmation | Explicit human assertion | Names claim, actor, time, source, and optional evidence; does not imply external verification. |
| Activity event | Immutable account of a meaningful change | Actor, verb, target, care space, time, mutation ID, and safe change summary. |
| Attachment | Metadata for one stored object | Private object path, MIME, size, hash, upload state, creator, and access scope. Local URI is device-local cache metadata only. |
| Document version | Immutable version of a logical document | Replacement creates a new version and moves `current_version_id`; old authorised versions remain history until retention/deletion applies. |
| Reminder rule | User-specific intent to be reminded | Separate from record status and from delivered notifications. |
| Notification delivery | One scheduled/sent/dismissed/snoozed delivery | Idempotent; dismissal affects only delivery state. |
| Sync mutation | Offline operation awaiting server acknowledgement | Stable client operation ID, actor, base version, semantic operation, retry state. |
| Conflict | Preserved unresolved incompatible mutations | Never silently drops authorised user work or resurrects revoked/deleted data. |

### 4.3 Record Classification

Every record has both a **kind** and a **user-facing type**.

Proposed kinds:

- `information`: long-lived facts or reference information.
- `event`: something scheduled to happen.
- `action`: work that can be completed.
- `document`: a logical document with versions.
- `contact`: a person or organisation used as information, not an authenticated member.
- `update`: a user-authored observation or handover note.

The eight Phase 1 types remain valid user entry points, but may map to different kinds according to intent. `Home matter`, for example, may be an information record for a boiler, an event for a booked service, or an action to arrange a repair. The creation workflow should choose this through plain-language questions rather than expose the word `kind`.

### 4.4 Required Common Fields

The future canonical record should include at least:

- `id` UUID generated client-side for offline creation.
- `care_space_id` required.
- `kind` and `type` constrained values.
- `title`, optional notes, and structured type-specific details.
- `lifecycle` (`active` or `archived`) plus nullable `deleted_at` tombstone.
- `created_by_membership_id`, `created_at`, `updated_at`.
- Integer `version` for optimistic concurrency.
- `source` (`native`, `phase1_import`, later `confirmed_extraction`).
- Optional sensitivity/domain classification used by access policies.

Timed state does not belong only on this row. It belongs on occurrences or milestones.

### 4.5 Date And Time Contract

- All-day dates are stored as calendar `date` values and must not shift through UTC conversion.
- Timed events are stored as UTC instants plus the IANA timezone used to interpret them.
- Each care space has a default timezone; an occurrence can override it.
- Due dates may be all-day (`due_on`) or timed (`due_at`), but never ambiguous free text.
- Derived day boundaries use the care space/occurrence timezone, not the device's accidental timezone.
- Rescheduling records old and new values in activity and increments the entity version.

**Decision required:** approve `Europe/London` as the default for newly created UK care spaces while still storing an explicit IANA timezone.

---

## 5. Record Lifecycle And State Model

### 5.1 Stored Versus Derived States

| Term | Stored or derived | Definition |
|---|---|---|
| Draft | Local workflow state | Unsaved or not-yet-submitted input. Not visible to collaborators or reminders. Server drafts may be added later only for a defined need. |
| Active | Stored record lifecycle | Canonical record participates in normal views and may generate occurrences. |
| Archived | Stored record lifecycle | Hidden from active views and reminder generation but retained in search/history where permitted. |
| Open | Stored occurrence status | Action/deadline remains outstanding. |
| Scheduled | Stored occurrence status | Event is planned and has no recorded outcome yet. |
| Awaiting confirmation | Stored occurrence status, exceptional | A completion/outcome was reported but the workflow explicitly requires another authorised confirmation. Not the default for ordinary solo use. |
| Completed | Stored occurrence status | An authorised user explicitly completed the action or confirmed the relevant outcome. |
| Cancelled | Stored occurrence status | The occurrence will not happen or no longer applies. It is not completed. |
| Missed | Stored occurrence status | A user explicitly records that a scheduled occurrence did not happen. Time passing alone does not set it. |
| Upcoming | Derived | Active, non-terminal occurrence is after today and within the selected view horizon. |
| Due soon | Derived | Open actionable occurrence falls within its reminder lead window but is not due today/overdue. |
| Due today | Derived | Open actionable occurrence has a due date in the current care-space day. |
| Overdue | Derived | Open actionable occurrence has passed its due instant/date. Events are excluded. |
| Past awaiting outcome | Derived | Scheduled event end/start has passed with no completed, cancelled, or missed outcome. |
| Unresolved | Derived | Any active actionable occurrence still open or awaiting confirmation. It is not a stored status. |
| Reopened | Activity/transition, not a durable status | A completed occurrence returned to open/scheduled. Prior completion remains in history. |
| Deleted | Tombstone then purge | `deleted_at` removes active visibility/sync use; physical purge follows approved retention rules. |

### 5.2 Valid Transitions

```text
Record: active <-> archived
Record: active/archived -> deleted tombstone -> purged after policy window

Action occurrence: open -> awaiting_confirmation -> completed
Action occurrence: open -> completed
Action occurrence: open/awaiting_confirmation -> cancelled
Action occurrence: completed -> open        (reopen operation)
Action occurrence: cancelled -> open        (restore operation, if permitted)

Event occurrence: scheduled -> completed    (attended/finished confirmation)
Event occurrence: scheduled -> cancelled
Event occurrence: scheduled -> missed       (explicit outcome)
Event occurrence: completed/cancelled/missed -> scheduled (reopen/restore with activity)
```

Every transition is a domain operation that validates permission and current version, updates the occurrence in one server transaction, and appends activity. Invalid transitions return a conflict; clients do not silently overwrite them.

### 5.3 Behavioural Rules

**When a due date passes:** no stored status changes. An open action derives `overdue`. Its reminders may escalate according to the user's rule.

**When an appointment time passes:** no completion is inferred. It derives `past awaiting outcome` and may prompt `Attended`, `Did not happen`, `Reschedule`, or `Add follow-up`.

**When a task is completed:** its occurrence becomes completed, `completed_at/by` are recorded, a confirmation/activity is appended, pending reminders are cancelled, and any parent information record remains active.

**When a bill is marked paid:** the bill occurrence becomes completed with completion kind `paid`. The confirmation is labelled user-reported unless backed by a separately approved external evidence source. The billing arrangement/series remains active.

**When an appointment is cancelled:** the occurrence becomes cancelled, reason is optional, pending reminders are cancelled, and linked tasks are evaluated according to their link policy rather than silently deleted.

**When a record is rescheduled:** only the selected occurrence moves unless the user explicitly chooses `this and future`. Existing reminder deliveries are cancelled and replacement schedules are generated idempotently. Linked actions with relative-date policies are recalculated; manually dated actions prompt for review.

**When a completed item is reopened:** status returns to open/scheduled, a reopening activity is recorded, prior completion evidence remains immutable, and reminders are recalculated.

**When a record is archived:** no new occurrences or reminders are generated. Existing open occurrences require an explicit choice to cancel, keep, or complete before archive. Archive never means completed.

**When a record is deleted:** create a tombstone immediately, stop reminders, remove it from normal views, and retain server metadata/files only for the approved recovery/audit period. Linked records survive and show that their former target was deleted unless the user separately deletes them.

**When a recurring occurrence is completed:** preserve it, then transactionally ensure the next required occurrence exists once. Do not move the completed occurrence's date.

**When a recurring item is missed:** the user marks an event occurrence missed, or an actionable occurrence remains overdue. Future occurrences continue unless recurrence is paused/stopped. Missing one does not collapse the series.

---

## 6. Record Types And Linked Actions

### 6.1 User-Facing Entry Points

| Entry point | Default model | Important exceptions |
|---|---|---|
| Appointment | Event record plus one scheduled occurrence | Regular visits use recurrence; transport/follow-up are linked actions. |
| Something to do | Action record plus one open occurrence | May link to any other record. |
| Bill or renewal | Long-lived obligation record plus actionable due occurrence | A one-off bill still has one occurrence; policy document is linked/versioned, not embedded as status. |
| Home matter | Ask whether it is information, an action, or a booked event | Boiler details, arrange service, and booked engineer visit are related but distinct. |
| Important document | Document record with immutable versions | Expiry is a milestone; renewal is a linked action when work is required. |
| Contact | Contact record | May later be linked to a membership, but never silently becomes one. |
| Care information | Information record, optionally with linked events/actions | Must not become a diagnosis or medication-administration claim. |
| Update | User-authored update record plus activity announcing creation | Distinct from system-generated activity history. |

The eight entry points are sufficient for initial capture. They are not sufficient as database types by themselves; the `kind`, occurrence, and link structure supplies the missing semantics.

### 6.2 Link Types

Proposed directional link types:

- `action_for`: task required by another record.
- `transport_for`: transport task for an appointment/event.
- `follow_up_to`: action or update following an event.
- `renews`: action or occurrence renewing a long-lived record.
- `documents`: document supports another record.
- `contact_for`: contact is relevant to another record.
- `result_of`: update/document is an outcome of an event/action.
- `related_to`: neutral relationship when no stronger semantic applies.
- `replaces`: logical replacement where version entities are unsuitable.

Links carry optional behaviour metadata, not copied dates. Examples:

- A transport task can be `relative to appointment start minus 2 days` or `manual date`.
- A renewal task can be `relative to expiry minus 30 days`.
- If the source date changes, relative links recalculate; manual links generate a review prompt.

### 6.3 Avoiding Duplicate Work

- Calendar displays occurrences, not cloned calendar records.
- To Do displays actionable occurrences, including a bill occurrence when payment itself is the action.
- Do not automatically create `Pay electricity bill` as a second task when the bill occurrence already represents that action.
- Create a linked action only when the work is meaningfully separate, such as `Compare renewal quotes`, `Arrange transport`, or `Call GP for results`.
- Suggested actions remain suggestions until accepted; automatic background creation would create clutter and false responsibility.

### 6.4 UK Examples

| Example | Recommended representation |
|---|---|
| Council Tax monthly payment | Bill/obligation record, monthly recurrence rule, individual due occurrences. |
| Home insurance | Information/obligation record, policy document/version, annual renewal occurrence, optional linked comparison task. |
| MOT | Vehicle/home information record, annual deadline occurrence, optional booking action and booked event. |
| Blue Badge | Information record, document/version, expiry milestone, linked renewal action. |
| Attendance Allowance | Information record plus application/review actions and correspondence documents; no eligibility decision engine. |
| Repeat prescription | Recurring action occurrences; medication information may be a separate linked information record. |
| District nurse visit | Event occurrence; note/update may be linked as outcome. |
| Power of Attorney | Sensitive document record and contact/reference information; no implication that upload validates legal authority. |

---

## 7. Recurrence Model

### 7.1 Recommendation

Use one stable record/series, one versioned recurrence rule, and individual occurrence rows.

Do not advance one date in place. That would destroy history. Do not create unrelated successive records. That would break series-wide editing, reminders, and search.

### 7.2 Recurrence Rule

The rule should support:

- Frequency and interval: daily, weekly, monthly, yearly where approved.
- Start anchor and care-space timezone.
- Optional day-of-week/day-of-month/month rules.
- Optional end date or count.
- Active, paused, or stopped state.
- Effective-from date and rule version.
- Generation horizon and `generated_through` marker.

### 7.3 Occurrence Identity And Idempotency

Each generated occurrence has:

- Stable UUID.
- `record_id`/series ID.
- Recurrence rule version.
- Original recurrence anchor.
- Scheduled/due date actually in force.
- Sequence or deterministic occurrence key.
- Exception flag for manual reschedule/edit.

A unique constraint on series plus deterministic occurrence key prevents duplicate generation. Next-occurrence creation and completion should occur in one transaction or through an idempotent server job.

### 7.4 Generation Strategy

- One-off records create one occurrence.
- Recurring series materialise a bounded future window sufficient for Home, Calendar, reminders, and offline use.
- Completion ensures the next required occurrence exists but does not create duplicates.
- A scheduled server process extends the horizon even if nobody opens the app.
- The client may preview recurrence locally but the server owns accepted occurrence generation.

### 7.5 Editing Recurrence

Users must choose scope:

- `This occurrence`: creates an exception; series rule is unchanged.
- `This and future`: closes the old rule version before this occurrence and creates a new effective rule. Completed/past occurrences remain unchanged.
- `Stop repeating`: prevents future generation and offers a choice to keep or cancel already generated future occurrences.

Rescheduling one occurrence never moves completed siblings. Pausing recurrence stops generation/reminders without deleting history.

### 7.6 Calendar Edge Rules

- Monthly recurrence anchored on the 29th, 30th, or 31st needs an explicit policy. **Proposed:** use the last valid day in shorter months, returning to the requested day when available.
- Yearly 29 February recurrence needs an explicit policy. **Proposed:** use 28 February in non-leap years unless the user selects 1 March.
- Daylight-saving changes preserve local wall-clock time for human appointments and visits.
- A missed occurrence does not prevent the next occurrence.

---

## 8. Responsibility, Confirmation, And Activity

### 8.1 Responsibility

An assignment states who is expected to deal with an occurrence or record. It is not access permission and not proof of completion.

Assignment target types:

- Active care-space membership: authenticated, permission-checkable, notification-capable.
- Contact/non-member: display-only responsibility; cannot accept, receive app notifications, or perform attributed app actions.
- Unassigned: explicit and valid.

Proposed assignment states for members: `assigned`, optionally `accepted`, `declined`, `removed`, `completed`. Initial solo use may treat self-assignment as accepted immediately.

### 8.2 Confirmation

A confirmation is an immutable assertion containing:

- Claim type: completed, paid, attended, collected, reviewed, or another constrained domain claim.
- Target record/occurrence.
- Actor membership.
- Timestamp and device/client mutation ID.
- Source: `user_report`, later `document_evidence` or approved external integration.
- Optional evidence attachment and note.
- Optional supersedes/revokes reference.

The UI must label ordinary confirmations as member-reported where ambiguity matters. `David marked this paid` is accurate. `This was paid by the bank` is not accurate without authorised bank evidence.

An awaiting-confirmation workflow should be used only where there is a concrete need for a second person to verify. It must not burden ordinary solo task completion.

### 8.3 Activity

Activity is an append-only explanation of meaningful events, separate from user-authored updates. Minimum activity verbs include:

- created, edited, rescheduled, assigned, accepted, declined;
- completed, marked paid, reopened, cancelled, missed;
- recurrence changed/stopped;
- document uploaded/replaced/removed;
- member invited/joined/role changed/removed;
- record archived/restored/deleted;
- conflict resolved and migration completed.

Each event records actor, timestamp, target, care space, mutation ID, and a minimal structured change summary. Sensitive values should not be copied unnecessarily into activity payloads.

`Latest` is a projection of meaningful activity, not a list of records sorted by `updatedAt`. Technical sync retries, reminder deliveries, and background occurrence generation are excluded unless they require user attention.

### 8.4 Unknown And Unconfirmed Information

- A typed non-member name may be shown as `Responsible: Sarah (not connected)`.
- Completion by a non-member can only be entered as an authenticated user's report about that person.
- Conflicting assertions remain in history; the current state reflects the latest authorised transition or an explicit conflict requiring resolution.
- Ask Lilica must say `I do not have confirmation` when no reliable confirmation exists.

---

## 9. Home, Calendar, To Do, And Person Rules

All projections apply permission filtering first. A user never learns that an inaccessible record exists through counts, search, activity, reminders, or linked-record labels.

### 9.1 Home

Home answers four different questions and assigns each current occurrence to one primary summary section. It does not duplicate the same occurrence across Needs attention, Today, and Coming up.

#### Needs Attention

Qualifies when any of the following is true:

1. An actionable occurrence is overdue and remains open.
2. An actionable occurrence is due today and remains open.
3. A passed event awaits an explicit outcome.
4. An occurrence assigned to the current user awaits their acceptance or confirmation.
5. A sync/upload failure requires this user's intervention. This appears as a service message linked to the item, not as a fake record.

Sort order:

1. Blocking conflicts or failures requiring the current user.
2. Overdue items, oldest due date first.
3. Due-today items, timed deadlines before all-day deadlines.
4. Past events awaiting outcome, most recent first.
5. Awaiting assignment/confirmation, oldest waiting first.

Within equal priority, the current user's assignments come before unassigned/other-member work. Home should show a small bounded set, proposed maximum three, then `View all`.

#### Today

Contains scheduled events whose local occurrence date is today, ordered by start time, followed by all-day events. Open due-today actions are already in Needs attention and are not duplicated here. Completed/cancelled/missed items do not remain in the active Today list, but may appear briefly in a collapsed `Completed today` affordance or history.

#### Coming Up

Contains the next active scheduled events and actionable due occurrences after today. **Proposed default horizon:** 30 calendar days, with a maximum of three on Home and a route to the full Calendar/To Do view. Sort chronologically. An item already in Needs attention or Today is excluded.

Long-lived information appears only when it has an upcoming occurrence/milestone, such as a document expiry. The underlying document itself is not duplicated.

#### Latest

Contains meaningful authorised activity, newest first, proposed maximum five and proposed default lookback 14 days. Examples include a member adding an appointment, marking a bill paid, replacing a document, changing an assignment, or posting an update.

Exclude background recurrence generation, sync retries, local notification delivery, read/open activity, and trivial saves with no material change. A record may appear in another Home section and have a Latest activity because these answer different questions; the activity must deep-link to the same underlying record.

#### Empty States And Actions

- Whole-space empty: `Start with one thing you want to keep track of` and a universal Add action.
- Section empty: omit the section rather than show zero counts.
- All clear: show a concise reassurance only when no Needs attention items exist; do not infer that every real-world obligation is known.
- Tap opens the canonical detail view.
- Safe direct actions may include complete task, mark bill paid, record appointment outcome, accept assignment, or snooze attention.
- Delete, archive, recurrence changes, and permission changes require detail/confirmation flows.

### 9.2 Calendar

Calendar is a projection of occurrences with meaningful dates:

- Event start/end: appointments, visits, booked services, family visits.
- Action due date: tasks, bill/renewal deadlines, prescription collections, follow-ups.
- Information milestone: document expiry, policy renewal, MOT date.
- Recurring occurrences: each materialised occurrence, never one endlessly moving event.

Rules:

- Timed events appear at local start time; all-day events and date-only deadlines appear as all-day entries.
- A due date is visually distinguished from an event time.
- A task and its linked appointment can both appear because they are different work, but labels make the relationship clear.
- Cancelled occurrences remain in history and may appear struck/muted when the user enables cancelled items; they are excluded from normal upcoming views.
- Completed past events and actions remain discoverable through history; the default future calendar does not become cluttered by them.
- Selecting an item opens the same canonical record/occurrence detail used elsewhere.
- Editing/rescheduling invokes the domain operation and updates every projection and reminder through one source of truth.

### 9.3 To Do

To Do contains actionable occurrences, not every dated record:

- Explicit tasks.
- Open bill/payment or renewal occurrences where the due occurrence itself is actionable.
- Open home actions, prescription collections, transport, follow-ups, and accepted suggested actions.
- Awaiting-confirmation items relevant to the current user.

Appointments, contacts, documents, notes, and informational expiry milestones do not enter To Do unless an explicit linked action exists. This prevents an insurance policy and `Renew insurance` from appearing as two equivalent tasks.

Proposed initial filters:

- Open
- Mine
- Overdue
- Completed

Sort open work by overdue, due today, due soon, no due date, then assignment/title. Completing in To Do performs the same occurrence transition used from Home/detail and records activity once.

### 9.4 Person

Person is the durable knowledge space for the selected supported person:

- Basic supported-person details and care-space switcher.
- Important contacts.
- Home and household information.
- Care information and preferences, subject to access.
- Documents and versions.
- Bills/renewal arrangements and other long-lived information.
- Search and history entry points.
- Care-circle/member management for authorised users.

It is not a medical dossier, completion dashboard, or dumping ground for every occurrence. Event/task history is reachable contextually and through History rather than repeated as static profile fields.

### 9.5 Cross-View Invariants

- Same entity and occurrence ID everywhere.
- Same title, status, assignment, and date after sync.
- One domain transition creates one activity event and updates all projections.
- No screen writes its own derived category back to the record.
- A permission change removes inaccessible content from every projection and local cache.

---

## 10. Reminder And Notification Rules

### 10.1 Three Separate Concepts

1. **In-app attention state:** deterministic query result such as due today or overdue. Exists without notification permission.
2. **Local notification:** scheduled on one device for that signed-in user. Useful offline, but device-specific and cancellable only when that device receives the change.
3. **Server/push notification:** server-evaluated delivery to authorised devices. Required for assignments, multi-device changes, and reliable collaboration.

None is the underlying record status.

### 10.2 Reminder Rules

A reminder rule belongs to a user and targets a record, occurrence, or recurrence series. It contains channel, offset/absolute time, timezone, enabled state, quiet-hour behaviour, and optional escalation policy.

Proposed defaults require approval:

- Appointments: one day before and two hours before when time exists.
- Date-only actions/bills: three days before and on the due date.
- No automatic repeated overdue push more than once per day, with a short maximum escalation window.
- No medication-taken implication and no emergency promise.

Notification permission is requested only in context after the user chooses a reminder or reaches a clear reminder-value moment.

### 10.3 Delivery Lifecycle

Proposed delivery states: `scheduled`, `sent`, `opened`, `dismissed`, `snoozed`, `acted`, `cancelled`, `failed`.

- Dismiss marks only the delivery dismissed.
- Snooze cancels/replaces that delivery with a new idempotent schedule; the item remains open.
- Completing/cancelling the occurrence cancels pending deliveries.
- Opening a stale notification revalidates current server/local state before presenting an action.
- Every scheduled delivery uses a deterministic key based on user, rule, occurrence, and schedule version to prevent duplicates.

### 10.4 Date Changes And Other Devices

When a deadline/event changes:

1. Increment schedule version.
2. Cancel pending local/server deliveries for the old version where possible.
3. Create deliveries for the new version idempotently.
4. Retain delivered-history entries for audit/troubleshooting.

When another device completes/cancels an item, server delivery is suppressed at send time. Realtime/sync instructs other devices to cancel local schedules. If an operating-system race still shows a stale local notification, opening it displays the current completed/cancelled state rather than offering an invalid action.

### 10.5 Preferences And Spam Control

Preferences are per user, not globally imposed by the organiser:

- Global channel enablement and quiet hours.
- Care-space overrides.
- Record/series overrides.
- Assignment notifications.
- Daily summary option instead of many individual alerts.

Use progressive escalation only for unresolved actionable occurrences. Informational records do not generate nagging. Log technical delivery state separately from user-visible activity.

---

## 11. Identity, Care Spaces, And Permissions

### 11.1 Identity Separation

| Concept | Meaning |
|---|---|
| Auth account | Security principal in Supabase Auth. |
| User profile | Name, display identity, optional private avatar, preferences. |
| Supported person | Person about whom the care space is organised; account not required. |
| Care space | Data and access boundary for one supported person. |
| Membership | Authenticated user's relationship to and permissions within a care space. |
| Contact | Address-book/reference person; not automatically authenticated or assignable in-app. |

Supabase Auth supports password, magic link, OTP, and social providers and integrates its user identity with database RLS ([official Auth overview](https://supabase.com/docs/guides/auth)). The exact sign-in method is a later UX/security decision. Apple/Google users should not also need a Lilica password.

### 11.2 Care-Space Model

- A user can be an active member of multiple care spaces.
- Each initial care space has one primary supported person to prevent accidental record mixing.
- A supported person can later link their own auth account to their existing profile without duplicating the person.
- Creating a care space records `created_by`; it does not imply legal ownership of another adult or unlimited authority over their data.
- Solo organiser use creates one active organiser membership immediately.

### 11.3 Roles And Capabilities

Proposed simple roles:

- `organiser`: manage ordinary records, invitations, memberships, and settings within granted/legal scope.
- `contributor`: view and change permitted domains/records; cannot manage the care space by default.
- `viewer`: read permitted domains/records only.
- `supported_person`: optional linked account with specifically designed autonomy and sharing controls.

Role is a bundle of capabilities, not the only access decision. Minimum capabilities should distinguish:

- View/create/edit/archive/delete ordinary records.
- Complete/cancel occurrences.
- Assign work.
- Upload/download documents.
- Invite/remove members and change grants.
- Export or delete the care space.

### 11.4 Domain And Record Access

To avoid an expensive privacy retrofit, every record must support a domain/sensitivity classification and optional record-level restriction. Proposed domains include appointments, tasks, home, finance/admin, documents, care/health, contacts, and updates.

Access is calculated from:

1. Active membership.
2. Base role capability.
3. Domain grant.
4. Optional record-specific allow/deny.
5. Record lifecycle and any legal/administrative hold.

Default-deny sensitive domains until explicitly granted. Administrative ability to invite members must not automatically imply visibility into every restricted record. Exact supported-person and organiser defaults require product and legal approval.

Do not encode memberships only in user-editable JWT metadata. Supabase warns that user metadata is user-changeable and that JWT claims may remain stale until refresh; care-space access and revocation should be checked against indexed membership/grant tables in RLS ([official RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)).

### 11.5 Invitations And Revocation

An invitation has intended email, inviter membership, proposed role/grants, expiry, single-use token hash, and status (`pending`, `accepted`, `expired`, `revoked`). Acceptance requires authentication with the intended identity or an explicit authorised correction flow.

On revocation/removal:

- Database and Storage access fails immediately through RLS.
- Realtime channel access is refreshed/disconnected.
- Local protected cache is cleared at next sync/session event.
- Pending assignment notifications to that member are cancelled.
- Existing activity attribution remains, displayed according to retention/privacy policy.
- Previously issued signed file URLs may remain usable until expiry, so use short lifetimes.

Supabase applies RLS to Postgres Changes and supports private-channel authorisation, but permission caches/tokens must still be refreshed appropriately ([official Realtime authorisation](https://supabase.com/docs/guides/realtime/authorization)).

---

## 12. Supabase, Local Data, Sync, And Documents

### 12.1 Current Finding

The repository contains no Supabase dependency, client configuration, `supabase/` directory, migration, environment file, access token, or installed Supabase CLI. Therefore:

- No Lilica cloud project is evidenced by the repository.
- This review cannot determine whether somebody created a project manually in the Luxford organisation.
- An authorised human must check the Supabase dashboard before Phase 3.
- No project, table, bucket, policy, or cloud resource was created or modified in Phase 2.

### 12.2 Proposed Environment Strategy

Use dedicated Lilica resources, never another Luxford app's database:

1. Local Supabase development for migrations and policy tests.
2. Dedicated Lilica development/staging project with synthetic data.
3. Separate dedicated Lilica production project with production secrets/data.

Schema changes must be migration files in Git, tested locally/staging, and deployed through a controlled pipeline. Supabase recommends local development plus migrations and separate staging/production environments; dashboard-only production edits bypass migration history and create drift ([environment guidance](https://supabase.com/docs/guides/deployment/managing-environments), [migration guidance](https://supabase.com/docs/guides/deployment/database-migrations)).

### 12.3 Proposed Database Areas

Conceptual tables, subject to schema review:

- `profiles`
- `supported_people`
- `care_spaces`
- `care_space_memberships`
- `membership_domain_grants`
- `record_access_grants`
- `invitations`
- `records`
- `occurrences`
- `recurrence_rules`
- `record_links`
- `assignments`
- `confirmations`
- `activity_events`
- `attachments`
- `document_versions`
- `reminder_rules`
- `notification_deliveries`
- `sync_mutations`/idempotency receipts
- `sync_conflicts`
- `phase1_import_batches`

Type-specific structured fields may use constrained extension tables or validated JSONB where they do not drive cross-record queries. Dates, status, care-space ownership, permissions, assignments, links, recurrence, and search-critical values must remain queryable first-class columns.

### 12.4 RLS And Secrets

- Enable RLS on every exposed care-space table.
- Revoke unnecessary `anon` and `authenticated` grants, then grant only required operations.
- Write separate allow/deny policy tests for select, insert, update, and delete.
- Central membership helpers must use a fixed safe search path and be performance-reviewed.
- Index care-space, membership, status, occurrence date, and policy-filter columns.
- The mobile app uses only the publishable/anon client key with user JWT and RLS.
- Secret/service-role keys stay in trusted server functions only because they bypass RLS ([Supabase secure data guidance](https://supabase.com/docs/guides/database/secure-data)).
- Mutating operations with lifecycle side effects should use database functions/transactions or trusted server functions, not several uncoordinated client writes.

### 12.5 Local Cache And Outbox

Replace the single AsyncStorage object gradually with a versioned local entity cache and semantic mutation outbox. The eventual local store must support transactions and indexing; the technology choice belongs to implementation planning.

Each local entity carries:

- Server ID/client-generated UUID.
- Server version and last-synced version.
- Local pending/deleted/conflict state.
- Last server update cursor.

Each outbox mutation carries:

- Stable operation UUID/idempotency key.
- Entity and care-space IDs.
- Semantic operation and payload.
- Base server version.
- Actor/account/device ID.
- Created time, attempt count, last error, and retry time.

### 12.6 Sync Algorithm

1. Apply authorised user action to local cache transactionally and enqueue mutation.
2. Push pending mutations in order per entity, with idempotency key and base version.
3. Server validates current membership, permission, transition, and version.
4. Server applies mutation and activity atomically or returns a typed conflict/rejection.
5. Client pulls changes/tombstones since durable cursor, applies them, and acknowledges outbox entries.
6. Realtime may prompt an early pull but is not itself the durable sync protocol.

Retry transient failures with capped exponential backoff and jitter. Authentication, permission, validation, and conflict failures require different user handling and must not retry forever.

### 12.7 Conflict Rules

- Append-only entities such as distinct attachments and activities merge by ID.
- Non-overlapping scalar edits may merge if the server can prove different fields changed from the same base.
- Competing edits to the same meaningful field create a conflict for user review; never silently choose by device clock.
- Semantic completion may apply on top of a compatible remote text/date edit, preserving both the edit and completion activities.
- Remote cancellation/deletion blocks an offline completion and presents the local attempt as unresolved; it never resurrects the item.
- Permission revocation always wins. Rejected local content remains only in a protected recovery view long enough for the user to copy/export it if legally appropriate.
- Server time orders accepted events; device time is retained as diagnostic metadata only.

### 12.8 Phase 1 Data Migration

Migration is resumable and non-destructive:

```text
not_started -> inventory -> local_backup -> entities_uploaded
-> attachments_uploaded -> server_verified -> complete
                              \-> failed/retryable
```

Rules:

- Keep the original `lilica:onboarding:v1` blob and local files until server verification and an approved retention period complete.
- Create an import batch with account, care space, device, source version, and state.
- Map legacy `supportedPersonId` to the new supported person/care space.
- Import each record using a unique `(account, import_batch, legacy_record_id)` key.
- Convert old `date/time` fields deterministically and flag ambiguous values for review.
- Convert recurrence intent into a rule plus first occurrence; do not fabricate historical occurrences.
- Convert completion/confirmation strings into `phase1_import` activities with honest unknown actor attribution where necessary.
- Hash files before upload and use content hash plus legacy attachment ID for deduplication.
- A failed file does not delete the record; mark attachment `local_only`/`upload_failed` and retry.
- Web attachment URIs that are no longer readable require reselection and must not be described as uploaded.
- Interrupted migration resumes from durable per-entity receipts.
- Never delete or replace local data automatically merely because an upload partially succeeded.

### 12.9 Private Document Storage

Use a private Supabase Storage bucket for care-space documents. Private buckets enforce access through RLS for download as well as mutation; authorised download or short-lived signed URLs are required ([private bucket guidance](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)).

Recommended object path:

```text
care-space/{care_space_id}/document/{document_id}/version/{version_id}/{attachment_id}
```

The path aids policy and operations but is not permission by itself. Database metadata is canonical. Validate allowed MIME types, maximum size, hash, and optional malware-scanning status before making an upload generally available. Never place sensitive care documents in a public bucket.

### 12.10 Document Version Lifecycle

- Upload enters `local_only` then `uploading`, `available`, `failed`, or `quarantined` state.
- Create new object under a new version ID; do not overwrite the current object in place.
- Verify object size/hash, then transactionally set the new document version current.
- Old versions remain authorised history until retention/deletion policy applies.
- Removal creates activity and tombstones metadata; storage purge happens through a controlled job.
- Access uses authenticated download or short-lived signed URLs. Signed URLs cannot be assumed instantly revocable, so expiry should be brief ([Supabase download guidance](https://supabase.com/docs/guides/storage/serving/downloads)).

---

## 13. Search And History

### 13.1 Search Scope

Search is care-space scoped by default and permission-filtered before ranking. It should cover:

- Record titles and authorised notes.
- Contacts and organisations.
- Document names, types, version labels, and confirmed metadata.
- Past/completed/cancelled occurrences.
- Meaningful activity labels.
- Structured filters: type, kind, status, assignee, date range, and archived state.

Postgres full-text search can index authorised textual fields. Search documents by metadata first. OCR/extracted text is a future separately approved source with provenance, confidence, and confirmation state.

### 13.2 History

History has two related views:

- **Record history:** transitions, edits, assignments, confirmations, document versions, and related actions for one record.
- **Care-space activity:** authorised meaningful events across the selected space.

Activity is immutable; corrections append a superseding event and update current state. History must preserve former-member attribution according to the approved privacy/retention policy without leaking deleted profile data unnecessarily.

### 13.3 Future Ask Lilica

Ask Lilica is retrieval over authorised records, occurrences, confirmed metadata, and activity. It must:

- Apply the same permission boundary as every other view.
- Cite/link the source records and distinguish recorded facts from member assertions.
- Preserve unknown and conflicting information.
- Never infer payment, medication administration, attendance, diagnosis, legal authority, or completion from silence.
- Require explicit review before any extracted fact or proposed write becomes authoritative.

No AI implementation is authorised by this contract.

---

## 14. Privacy And Data Lifecycle

### 14.1 Existing Declaration

Preserve the active Phase 1 declaration gate, version, and timestamp. It records the organiser's acknowledgement; it does not prove the supported person's consent or the controller's complete lawful basis.

### 14.2 Required Production Work

Before a production service processes sensitive care/health information:

- Establish controller/processor roles and lawful bases, including any Article 9 condition.
- Complete an appropriate DPIA and specialist UK privacy review.
- Publish accurate privacy information and terms.
- Define data categories, purpose, minimisation, retention, deletion, export, incident, and subject-rights procedures.
- Verify Supabase/vendor contractual, location, subprocessors, backup, and security arrangements.
- Threat-model account takeover, invitation abuse, insecure local cache, document leakage, and support/admin access.

This document is product architecture, not legal advice.

### 14.3 Access And Sharing

- Sharing is explicit, scoped, reviewable, and revocable.
- Joining a family does not grant blanket access.
- Sensitive records can be domain- or record-restricted.
- Supported-person autonomy must be designed with legal advice and user research, especially where the organiser acts without the person's direct account.
- Do not store bank passwords or credentials in ordinary notes or invent a password vault.

### 14.4 Leaving And Removing Members

- A member may leave if doing so does not orphan required care-space administration; otherwise transfer/close options are presented.
- An organiser may remove another member only with the required capability and any protected supported-person rules.
- Revocation stops future access immediately at RLS and sync layers.
- Shared records remain with the care space by default so history is not corrupted; former-user attribution is minimised/pseudonymised where appropriate.
- Private-to-member drafts/notes follow their own ownership policy.
- Whether erasure requires removing or anonymising historical attribution is a legal/product decision, not a blanket cascade.

### 14.5 Account Deletion

Account deletion is a workflow, not a direct auth-row delete:

1. Reauthenticate and explain consequences.
2. Resolve sole-organiser care spaces by transfer, care-space deletion, or an approved retention route.
3. Cancel invitations/tokens and revoke sessions/devices.
4. Export data if requested and permitted.
5. Remove/pseudonymise profile data and private data according to policy.
6. Preserve or lawfully delete shared care-space records according to ownership/legal decisions.
7. Remove owned Storage objects where required; Supabase notes that users owning Storage objects cannot simply be deleted until ownership/object handling is resolved ([user-management guidance](https://supabase.com/docs/guides/auth/managing-user-data)).
8. Delete the auth identity and record completion in restricted operational audit logs.

### 14.6 Supported-Person/Care-Space Deletion

- Requires appropriately authorised confirmation and a recovery period unless immediate deletion is legally required.
- Tombstone the space, stop reminders/invitations, revoke member access, and queue database/file purge.
- Prevent orphan links and storage objects.
- Backups and operational logs follow a disclosed retention schedule and restricted access.

### 14.7 Export

Provide a machine-readable export of authorised structured records and a human-readable package of records/history, plus separately packaged authorised original documents. Exports must not include information the requester cannot access or another user's private profile fields.

---

## 15. End-To-End Workflow Stress Tests

These walkthroughs test the proposed contract, not the current Phase 1 implementation. Each begins inside one selected care space. Every write carries a stable client operation ID so retries cannot duplicate it; every read is permission-filtered.

### A. New Organiser, Care Space, And First Appointment

1. David creates and verifies an `AuthAccount`; an incomplete `UserProfile` is created separately.
2. David supplies the minimum organiser profile fields approved for launch. Date of birth and photo remain optional unless a justified workflow later requires them.
3. David creates a `SupportedPerson` and its `CareSpace`; an organiser `Membership` is created transactionally. The supported person is not silently treated as an authenticated user.
4. David adds an appointment. One `Record(kind=event)` and one scheduled `Occurrence` are written, with activity recording David as actor.
5. The same occurrence appears in Calendar and, according to date, Home Today or Coming Up. It does not become a separate To Do item.
6. Default reminders are proposed before save and become explicit `ReminderRule` rows only after acceptance.

Failure handling: retrying care-space creation is idempotent; a failed appointment upload remains an identifiable local pending mutation. No empty or fabricated Home card is created.

**Decision dependency:** required organiser fields and whether the supported person receives an invitation immediately.

### B. Electricity Bill: Due, Overdue, Paid, Retained

1. David creates `Record(kind=action, actionSubtype=bill_payment)` with a due occurrence. The bill occurrence itself is actionable; Lilica does not also manufacture a duplicate task.
2. Due-soon and due-today rules schedule deliveries. Dismissing either delivery changes only that delivery.
3. At the care-space-local date boundary, an open occurrence derives `overdue`; it moves to Needs Attention without a state-changing midnight write.
4. David chooses **Mark paid**. The occurrence transitions `open -> completed`; the confirmation records David's assertion, method, and time. The activity log records the transition.
5. It leaves active To Do and Needs Attention, remains searchable, and may appear in Latest because of the meaningful activity.
6. A later correction uses **Reopen**, preserving the original paid assertion and appending a reversal activity.

Lilica must say “marked paid by David,” not “payment verified,” unless a future verified financial integration exists.

### C. Annual Home Insurance Renewal

1. The policy is `Record(kind=information)`; its document versions are attachments. `Renew home insurance` is a linked recurring action series.
2. Completing the 2027 occurrence closes only that occurrence and materialises the next eligible annual occurrence with the same series identity.
3. Leap-day and end-of-month rules use the approved calendar policy in section 7.6. A retry cannot create a second 2028 occurrence.
4. Replacing the policy document adds a version; it does not overwrite the prior file or alter completed renewal history.
5. Cancelling the policy archives/cancels future renewal obligations only through an explicit action and scope.

This scenario confirms that recurrence belongs to a stable series with immutable occurrences, not to a record whose due date is repeatedly overwritten.

### D. Hospital Appointment And Linked Transport Task

1. The hospital visit is an event occurrence. `Arrange transport` is a separately actionable linked record with `linkType=preparation_for`.
2. Its due date may be stored as an explicit date plus an optional relative-date policy, such as “three days before appointment.”
3. If the appointment is rescheduled, Lilica previews affected linked actions. Relative dates may recompute only after confirmation; explicit dates never move silently.
4. Completed transport work does not reopen automatically. Lilica instead flags that the source appointment changed and offers a new/reopened task.
5. Cancelling the appointment cancels its reminders and asks whether open linked actions should also be cancelled. It does not silently cancel unrelated transport bookings.

**Decision dependency:** launch support for relative-date policies. Conservative default: prompt and preserve the old task date until confirmed.

### E. Prescription Assigned To Sarah

1. David creates or assigns an action occurrence to Sarah's active membership. Assignment does not itself prove Sarah accepted responsibility.
2. Sarah sees it only if her capabilities and domain/record grants permit it. Optional acceptance transitions the assignment `proposed -> accepted`.
3. Sarah marks it complete. The occurrence, confirmation, and activity are committed atomically and attributed to Sarah's immutable membership identity.
4. David's device pulls the change; the action leaves his attention views and Latest reports “Sarah marked the prescription ordered.”
5. If Sarah loses access before her offline completion syncs, revocation wins: the server rejects the write, retains it locally for explanation/export, and does not forge completion.

Medication ordering is distinct from collection, delivery, or administration. Lilica must not infer one from another.

**Decision dependency:** whether assignment acceptance is required or optional by default.

### F. Power Of Attorney Document

1. David creates `Record(kind=document)` and uploads a file to a private path scoped to the care space and record.
2. Metadata and upload state are committed without ever exposing a public URL. A short-lived signed URL is generated only after an authorised read.
3. Search finds the record by authorised metadata. Full-text extraction/OCR is absent unless separately approved and verified.
4. **Replace** uploads a new immutable `DocumentVersion`; the old version becomes superseded but remains available to authorised members according to retention policy.
5. Download/view activity is captured only if approved and proportionate; access rules are enforced at query and object-storage layers.
6. Failed uploads are resumable. Unreferenced objects are quarantined and cleaned by a verified job rather than left indefinitely.

**Decision dependency:** document access logging, prior-version retention, and whether any record-level restricted access ships initially.

### G. Supporting Mum And Dad

1. Mum and Dad have separate supported-person records and separate care spaces. David has an independent membership in each.
2. A visible care-space switch changes the active context. Every query, cache key, outbox operation, notification route, and file path carries `careSpaceId`.
3. Home, Calendar, To Do, Person, search, Add, and Ask operate on exactly one selected space unless a future deliberately designed overview is approved.
4. Deep links and notifications resolve the referenced care space only after permission is rechecked and display its person's identity before showing details.
5. Switching while an unsaved sheet is open either retains that draft under its original space or requires explicit discard; it can never save into the newly selected space.

This requires multi-space architecture before multi-person UI. Filtering a global array only at render time is insufficient because caches and writes can still leak across spaces.

### H. Invite, Change Role, Remove Access

1. David creates a single-use, expiring invitation containing intended role and scope but no sensitive care details.
2. The recipient authenticates, sees the inviter and supported-person context, accepts, and receives a membership. Acceptance is transactional and replay-safe.
3. A role or scope change writes new authorisation state and activity; open clients refresh claims/data immediately rather than waiting for a stale token alone.
4. Removal revokes membership, pending invitations, realtime subscriptions, signed URL issuance, and future sync. Cached sensitive data is deleted or cryptographically rendered inaccessible according to the approved device policy.
5. Historic activity remains attributed to a stable former-member identity with only the minimum retained display information.

**Decision dependency:** role names, granular domains, supported-person protections, and cache-removal guarantees.

### I. Offline Completion Versus Remote Change

Scenario: David completes a task offline while Sarah edits its note online.

1. David's semantic operation is `complete occurrence X at T with assertion Y`, not “replace row with this old JSON.” Sarah's operation changes only the note field.
2. On sync, the operations are compatible: the server applies completion and the note update, preserving both activities.
3. If Sarah cancelled/deleted occurrence X, David's completion conflicts. Cancellation/deletion is not overwritten; David sees a resolvable conflict with both facts and no false success.
4. If both edit the same scalar field, server state is retained until explicit resolution unless a field-specific merge rule exists.
5. Duplicate retries share an operation ID and create one transition/activity only.

Blanket last-write-wins is rejected because it can silently lose completion, cancellation, permissions, or clinical/care context.

### J. Dismiss Or Snooze Without Completion

- **Dismiss** closes one notification delivery. The item remains open and can still be overdue or visible in Needs Attention.
- **Snooze** schedules a replacement delivery against the same rule/occurrence and records who requested it. It does not alter due date or status.
- **Mute this item/series** changes reminder preferences only after explicit confirmation.
- Completing on another device invalidates queued deliveries before presentation where platform support allows; tapping a stale notification revalidates and shows the current completed state.

### K. Cancel Appointment After Reminders Exist

1. David cancels the event occurrence with an optional reason. Status becomes `cancelled`; it is not deleted.
2. Pending reminder schedule versions for that occurrence are cancelled. Already delivered notifications remain delivery history.
3. Calendar may show cancelled items according to its filter; Home/To Do exclude them from active sections. Latest records the cancellation.
4. Linked actions are reviewed as in workflow D. A later restoration is an explicit activity and re-schedules only valid future reminders.
5. An offline stale reminder tap re-fetches current state and never presents the appointment as still scheduled.

### L. Reopen A Completed Item

1. An authorised member chooses **Reopen** and supplies a reason when policy requires it.
2. The occurrence transitions `completed -> open`; completed timestamp is superseded in current state but retained in confirmation/activity history.
3. Date-derived state is recalculated: a past due date makes it overdue immediately; a future date makes it upcoming.
4. Reminder rules are reconsidered, but Lilica does not replay every missed historical reminder. It proposes a sensible next reminder.
5. For a recurring series, reopening an old occurrence does not remove or duplicate later occurrences.

### M. Find An Old Hospital Letter Or Boiler Service

1. Search runs within the selected care space and current permission scope.
2. “Hospital letter” can match authorised record title, organisation, type, confirmed metadata, and later approved extracted text. Results state why they matched.
3. Completed boiler-service occurrences remain discoverable by date/status and open into the stable series plus that occurrence's history.
4. Archived and cancelled records are excluded by default but included by an explicit filter.
5. A revoked member receives no search result, snippet, count, cached preview, or signed download URL.

### N. Delete Account Or Leave A Care Circle

1. **Leave:** revoke the membership, preserve shared care-space records, resolve open assignments, and retain minimum historic attribution. Private member-owned drafts follow their separate policy.
2. **Remove another member:** same data effects, with actor attribution and capability check.
3. **Delete account:** reauthenticate, resolve every membership and sole-organiser space, revoke devices/tokens, fulfil any export, then delete or pseudonymise personal data according to policy.
4. Shared records do not become owned by the first person who happens to remain; care-space stewardship is transferred explicitly.
5. Deleting a care space is separate, delayed, auditable, and cascades through database and private storage using a verified purge process.

**Unresolved and blocking:** lawful retention, supported-person rights, sole-organiser succession, historic attribution, backup deletion windows, private draft ownership, and export format.

### 15.1 Model Revisions Exposed By Stress Testing

The scenarios require four additions to the conceptual model in section 4:

- **DeviceRegistration:** member/account device, push token, platform, revocation, and last-seen state. Tokens are secrets and never activity content.
- **ActivityCursor:** per-membership/per-care-space last-seen position for meaningful “what changed” behaviour; it does not hide history from other members.
- **RelativeDatePolicy:** optional link policy defining how an action date relates to a source occurrence, always with a preview/confirmation rule.
- **UploadSession:** resumable attachment upload state and object-cleanup ownership, separate from an authoritative document version.

These are additive. They reinforce rather than change the record/occurrence/activity model.

---

## 16. Gap And Risk Register

“Retrofit” estimates the cost if the issue is ignored until collaboration or production data exists.

| Area | Classification | Risk | Retrofit | Required response |
|---|---|---:|---:|---|
| Phase 1 onboarding presentation and flow | Already implemented and suitable | Low | Low | Freeze behaviour; protect with characterization and visual tests. |
| Eight structured entry categories | Already implemented and suitable | Low | Medium | Preserve as user-facing entry points, map into richer internal kinds. |
| Generic `LilicaRecord` migration boundary | Already implemented and suitable | Medium | High | Evolve additively; never let the legacy shape become the cloud schema. |
| Local deterministic date helpers | Implemented but needs extension | High | Medium | Centralise timezone-aware derivation and fix Today/Needs Attention ordering. |
| Record status/completed fields | Implemented but needs extension | High | High | Replace divergent flags with validated transitions during migration. |
| Appointment-past behaviour | Implemented but needs extension | High | Medium | Introduce `past_awaiting_outcome`; never label a passed visit paid/completed/overdue. |
| “Latest” Home logic | Prototype only | Medium | Medium | Drive from meaningful activity and a defined cursor/horizon. |
| Recurrence | Prototype only | Critical | Very high | Stable series plus immutable occurrences, versioned rules, idempotent generation. |
| Typed record links | Missing | High | High | Add before transport, renewal, document-expiry, and preparation workflows. |
| Relative linked dates | Requires product decision | Medium | High | Decide whether launch supports policy-driven dates; never shift explicit dates silently. |
| Responsibility | Prototype only | High | High | Replace free text with membership/contact/unassigned references plus snapshots. |
| Assignment acceptance | Requires product decision | Medium | Medium | Decide proposed/accepted model before collaboration UI. |
| Confirmation | Implemented but needs extension | High | High | Store assertion, actor, method, timestamp, and confidence/source separately. |
| Immutable activity | Missing | Critical | Very high | Introduce before shared writes; prohibit mutable audit strings. |
| Cancellation/archive/reopen | Prototype only | High | Medium | Implement explicit state-machine commands and activity. |
| Multi-supported-person model | Missing | Critical | Very high | Scope every entity, cache, mutation, notification, and object to a care space. |
| Real authentication | Prototype only | Critical | High | Use Supabase Auth in a dedicated non-production environment first. |
| Organiser user profile | Missing | High | Medium | Separate account identity from supported-person data; minimise mandatory fields. |
| Care-space memberships | Missing | Critical | Very high | Capability-based membership model with server-enforced access. |
| Invitation lifecycle | Missing | High | High | Expiring, single-use invitations; no sensitive data in invite payloads. |
| Role and domain granularity | Requires product decision | Critical | Very high | Approve launch roles/capabilities before RLS is written. |
| Supabase project existence/ownership | Requires technical investigation | High | High | Authorised owner checks organisation/dashboard; establish named dev/staging/prod ownership. |
| Database schema and migrations | Missing | Critical | Very high | Version-controlled migrations; no dashboard-only production schema edits. |
| RLS policy matrix | Missing | Critical | Very high | Write allow/deny tests for every table, function, realtime channel, and storage path. |
| Local cache/outbox | Missing | Critical | Very high | Introduce semantic mutations, idempotency, per-space partitioning, and migration checkpoints. |
| Conflict handling | Missing | Critical | Very high | Reject blanket last-write-wins; define field/transition rules and visible conflicts. |
| Realtime | Missing | Medium | Medium | Use only as invalidation/pull trigger, not as the durable sync protocol. |
| Phase 1 local-data migration | Implemented but needs extension | Critical | High | Fixture-test old states; retain local source until server verification succeeds. |
| Local document capture | Implemented but needs extension | High | Medium | Preserve picker/camera UX; add durable upload lifecycle and cleanup. |
| Private cloud documents | Missing | Critical | Very high | Private buckets, RLS, short signed access, immutable versions, malware/content controls. |
| Document version/retention policy | Requires product decision | High | High | Decide replacement, access-log, retention, and deletion semantics. |
| Home exact horizons/limits | Requires product decision | Medium | Low | Approve horizons, row limits, and “recently changed” definition. |
| Calendar | Prototype only | Medium | Medium | Project occurrences only; distinguish events from action deadlines. |
| To Do | Prototype only | Medium | Medium | Project actionable occurrences only; no mirrored task store. |
| Person | Prototype only | Medium | Medium | Project durable information/documents/contacts; avoid an inferred medical dossier. |
| Reminder scheduler | Missing | High | High | Versioned rules and deliveries; reconcile all date/status/permission changes. |
| Push/device lifecycle | Missing | High | High | Device registration, token rotation/revocation, stale-notification revalidation. |
| Notification defaults/quiet hours | Requires product decision | Medium | Medium | User research and approval before enabling defaults. |
| Search | Missing | Medium | Medium | Permission-filter before ranking; include archived history by explicit filter. |
| OCR/document extraction | Requires product decision | High | High | Defer; require provenance, confidence, review, retention, and threat analysis. |
| Ask Lilica | Prototype only | High | Very high | Defer until permissions, retrieval provenance, and no-inference rules are enforced. |
| Account deletion/space succession | Requires product decision | Critical | Very high | Resolve before shared production data; do not cascade blindly. |
| Sensitive-care lawful basis/DPIA | Requires legal/privacy review | Critical | Very high | Specialist UK review before production sensitive-data processing. |
| Supported-person rights/autonomy | Requires legal/privacy review | Critical | Very high | Define consent/authority, access, challenge, and deletion pathways. |
| Retention/export/backups | Requires legal/privacy review | Critical | Very high | Approve schedules/formats/processes before account lifecycle ships. |
| Automated test suite | Missing | Critical | High | Build characterization and contract harness before modifying shared foundations. |
| Accessibility/performance/physical devices | Implemented but needs extension | Medium | Medium | Establish release matrix and budgets; retain physical-device sign-off. |

### 16.1 Highest-Cost Mistakes To Avoid

1. Shipping cloud tables before the care-space boundary and RLS capability matrix are approved.
2. Treating recurrence as “change this record's date to next year.”
3. Treating activity as editable prose or deriving it later from current rows.
4. Syncing whole JSON records with last-write-wins.
5. Building one-person caches, storage paths, or notifications and adding a person switcher later.
6. Uploading sensitive files before private-storage deletion, revocation, and orphan-cleanup paths exist.
7. Expanding features before a regression harness protects Phase 1.

---

## 17. Numbered Implementation Roadmap

Phase 2 ends with approval or revision of this contract. Every later phase follows the same gate: inspect current state, approve exact scope, implement, verify automated and physical-device behaviour, update documentation, and stop. A phase does not silently pull forward the next phase.

### Phase 3 - Safety Harness And Executable Domain Contract

**Purpose:** protect Phase 1 and encode the approved pure rules before shared infrastructure changes.

**Dependencies:** product approval of lifecycle, recurrence, date/time, and view rules.

**Deliverables:** test tooling chosen deliberately; characterization tests for current onboarding/storage/Home; pure domain fixtures and transition/recurrence/date tests; migration fixture catalogue; physical-device baseline and screenshots; CI typecheck/test gate.

**Acceptance:** current app behaviour is unchanged; tests reproduce known limitations rather than quietly “fixing” them; approved rules have executable examples including workflows B, C, D, I, K, and L.

**Regression protection:** Welcome through Home, drafts, picker/camera, legacy migration, and Expo SDK 57 launch pass.

**Explicit exclusions:** auth, Supabase resources, production fixes, screen redesign, record migration.

**Stop point:** review the test evidence and proposed technical stack.

### Phase 4 - Supabase Environment And Security Foundation

**Purpose:** create controlled infrastructure before user data is moved.

**Dependencies:** authorised dashboard investigation; environment ownership, region, cost, and privacy review; Phase 3 gates.

**Deliverables:** dedicated non-production project; documented production separation; CLI-linked local workflow; versioned migrations; secrets strategy; base account/profile schema; first RLS and database-policy tests; backup/recovery and operator-access notes.

**Acceptance:** no service-role credential is shipped; anonymous/authenticated allow/deny tests prove isolation; schema can be rebuilt from version control; production remains untouched unless separately approved.

**Regression protection:** app still runs without migrating Phase 1 data.

**Explicit exclusions:** care spaces, record sync, cloud documents, UI redesign.

**Stop point:** owner/security review of environment and policy evidence.

### Phase 5 - Authentication And Organiser Profile

**Purpose:** replace placeholder account state with a durable authenticated person while preserving onboarding tone.

**Dependencies:** Phase 4; approved auth methods, mandatory profile fields, recovery, verification, and deletion entry point.

**Deliverables:** sign-up/sign-in/verification/recovery/session handling; separate minimal `UserProfile`; optional photo lifecycle if approved; secure local session handling; migration path from placeholder email state.

**Acceptance:** a returning user restores the correct account; unverified/expired/revoked sessions are handled; organiser data is not confused with supported-person data.

**Regression protection:** account-choice, relationship/name, privacy gate, interests, structured record onboarding, and Home remain visually and behaviourally stable.

**Explicit exclusions:** family invitations, shared records, full account deletion, record cloud sync.

**Stop point:** product owner tests complete account/recovery journey on physical devices.

### Phase 6 - Supported People, Care Spaces, And Membership Kernel

**Purpose:** establish the permanent isolation and ownership boundary before records sync.

**Dependencies:** approved role/capability model and supported-person policy.

**Deliverables:** supported-person, care-space, membership, invitation-domain skeleton, active-space context, per-space cache keys, policy functions and RLS tests; one initial care space migrated from onboarding identity.

**Acceptance:** one account can belong to two fixture spaces without any cross-space query/write/search/cache leakage; sole-organiser and revocation constraints are represented even if their final UI is later.

**Regression protection:** the existing single-person journey looks the same and resolves to exactly one initial space.

**Explicit exclusions:** invitation UI, collaboration feed, full multi-person switcher polish, record migration.

**Stop point:** architecture/RLS review using workflow G and adversarial cross-space tests.

### Phase 7 - Record Persistence, Local Cache, Sync, And Migration

**Purpose:** move Phase 1 records to durable shared-ready storage without losing offline value.

**Dependencies:** Phases 3-6; approved record schema and conflict policy.

**Deliverables:** server record/occurrence/link/operation schema; partitioned local cache and outbox; semantic sync protocol; resumable idempotent Phase 1 migration; server verification and rollback checkpoint; sync status/error UX.

**Acceptance:** old fixture states migrate once with IDs/timestamps/attachments intact; offline create/edit/complete syncs; compatible concurrent edits merge; incompatible edits surface; retries never duplicate records/activity.

**Regression protection:** legacy `firstItem` and current `records[]` fixtures; forced interruption at every migration checkpoint; no local deletion before verified completion.

**Explicit exclusions:** full recurrence generation, collaboration UI, cloud file bytes, broad visual changes.

**Stop point:** signed data-integrity report and owner test on a copied real-device state.

### Phase 8 - Core Record And Occurrence Engine

**Purpose:** implement the approved lifecycle, recurrence, links, assignments, confirmations, and activity semantics.

**Dependencies:** Phase 7; owner decisions D1-D8 in section 19.

**Deliverables:** validated commands/transitions; stable recurrence series and occurrence materialisation; typed links; relative-date handling if approved; cancel/reschedule/reopen/archive; assignment/confirmation primitives; immutable activity.

**Acceptance:** workflows B, C, D, I, K, and L pass end to end; completed history never mutates; a recurring retry produces one occurrence; no whole-record last-write-wins.

**Regression protection:** property/transition tests, timezone/DST/leap-year matrix, migration fixtures, current editors and Home characterization.

**Explicit exclusions:** new tab designs, notifications, family invitations, OCR.

**Stop point:** domain-contract review with stored rows and activity evidence.

### Phase 9 - Everyday Add And Record Management

**Purpose:** make the Phase 1 structured entry model usable after onboarding for many records.

**Dependencies:** Phase 8.

**Deliverables:** universal Add entry; list/detail/edit actions for all eight categories; document source choices; draft persistence across sheet dismissal; archive/cancel/reopen; linked-action creation without duplication.

**Acceptance:** users can add, edit, close, find, and correct multiple records of each type; sheets expand/retract gracefully; tapping outside, swipe-down, and Done preserve the agreed draft semantics.

**Regression protection:** exact protected onboarding stack and sheet behaviours remain; keyboard/device tests on supported form factors.

**Explicit exclusions:** tab rebuilds, cloud document maturity, reminders.

**Stop point:** owner signs off everyday workflows and protected Phase 1 visuals.

### Phase 10 - Home Projection

**Purpose:** make Home a deterministic, trusted projection of the core model.

**Dependencies:** approved horizons/limits; Phases 8-9.

**Deliverables:** exact Needs Attention, Today, Coming Up, Latest queries/sorts; activity cursors; empty/loading/offline/sync-error states; stable timezone handling.

**Acceptance:** no item is duplicated across active sections contrary to section 9; past appointments await outcome; recently changed is finite and attributable; permission changes remove content.

**Regression protection:** visual baselines and date-boundary fixtures including BST/GMT transitions.

**Explicit exclusions:** Calendar and To Do changes, AI summaries.

**Stop point:** owner reviews a fixed scenario dataset.

### Phase 11 - Calendar Projection

**Purpose:** provide time-based navigation over the same occurrences.

**Dependencies:** Phase 10 and approved calendar scope.

**Deliverables:** agenda/month views as approved; event-versus-deadline distinction; person/assignee filters; recurring-instance actions; reschedule/cancel routes.

**Acceptance:** edits are immediately consistent with Home/To Do; all-day and timed items survive timezone/DST tests; completed/cancelled filters are explicit.

**Regression protection:** cross-view identity assertions ensure every displayed item opens the same record/occurrence.

**Explicit exclusions:** separate calendar database, external calendar sync unless separately scoped.

**Stop point:** owner review on phone sizes and accessibility settings.

### Phase 12 - To Do Projection

**Purpose:** show actionable work without duplicating source records.

**Dependencies:** Phase 11.

**Deliverables:** open/overdue/upcoming/assigned groupings; completion/reopen; filters; linked source context; assignment-state presentation.

**Acceptance:** bills and renewal actions appear once; appointments do not become tasks; completing from To Do updates every view and history atomically.

**Regression protection:** query-contract tests and workflow B/E fixtures.

**Explicit exclusions:** new action records created merely to populate To Do.

**Stop point:** task-flow usability review.

### Phase 13 - Person Projection

**Purpose:** organise durable information about the supported person without turning Lilica into an inferred dossier.

**Dependencies:** Phase 12; approved categories and sensitivity rules.

**Deliverables:** authorised information/document/contact groupings; unknown/unconfirmed labels; source/history links; safe editing and restricted-domain handling if approved.

**Acceptance:** no inferred health/legal fact becomes authoritative; Person, search, and record detail agree; access is capability-filtered.

**Regression protection:** permission fixtures and no-cross-space snapshots.

**Explicit exclusions:** diagnosis, medical advice, or automatic profile inference.

**Stop point:** product/privacy review.

### Phase 14 - Reminder And Notification Engine

**Purpose:** deliver useful prompts while keeping reminder state separate from record truth.

**Dependencies:** approved defaults/quiet hours; stable occurrence engine and device registration.

**Deliverables:** versioned reminder rules; local and server-push scheduling as separately approved; delivery/snooze/dismiss/mute; reconciliation on edit/cancel/complete/revoke; stale-notification validation.

**Acceptance:** workflows B, J, and K pass across two devices; no cancelled/completed item is presented as current after revalidation; spam limits and quiet hours hold.

**Regression protection:** fake-clock scheduling tests, platform notification tests, permission denial/token rotation.

**Explicit exclusions:** SMS/email escalation or emergency monitoring unless separately approved.

**Stop point:** owner tests notification timing and language on physical iOS/Android devices.

### Phase 15 - Care-Circle Invitations And Collaboration

**Purpose:** make shared coordination real on top of already-enforced membership boundaries.

**Dependencies:** legal/product sharing decisions; Phases 6-14.

**Deliverables:** invite/accept/decline/expire; role/scope management; remove/leave; assignment acceptance if approved; attributable activity; revocation and cache cleanup.

**Acceptance:** workflows E and H pass with two real accounts/devices; forbidden API, realtime, search, and storage reads fail; removal takes effect without waiting for app restart.

**Regression protection:** RLS/storage/realtime adversarial matrix and offline-revocation tests.

**Explicit exclusions:** professional/agency workflows, emergency access, unsupported legal authority claims.

**Stop point:** security/privacy/product review before wider testing.

### Phase 16 - Document Maturity

**Purpose:** make sensitive documents durable, private, versioned, and recoverable.

**Dependencies:** approved retention/access-log policy; cloud storage threat model.

**Deliverables:** private upload/download, resumable sessions, immutable versions, replacement/supersession, orphan cleanup, access revocation, expiry-linked actions, export/deletion integration.

**Acceptance:** workflow F passes; no public URLs; interrupted uploads recover; superseded versions obey policy; revoked users cannot obtain or reuse access beyond approved short expiry.

**Regression protection:** storage policy tests, malformed/oversized file cases, picker/camera regression, purge verification.

**Explicit exclusions:** OCR, AI extraction, document editing unless separately approved.

**Stop point:** security and owner document-lifecycle review.

### Phase 17 - Search, History, And Explainability

**Purpose:** let authorised users find old truth and understand how current state arose.

**Dependencies:** mature activity and document metadata.

**Deliverables:** permission-first search; filters; record and care-space history; source/match explanation; archived results; activity cursor controls.

**Acceptance:** workflow M passes; removed users receive no snippets/count leakage; current state can be traced to actor and transition without reconstructing from mutable rows.

**Regression protection:** permission-index tests, ranking fixtures, history immutability checks.

**Explicit exclusions:** Ask Lilica, OCR, external web search.

**Stop point:** relevance/privacy review on representative datasets.

### Phase 18 - Privacy, Settings, Export, And Account Lifecycle

**Purpose:** implement the approved operational data lifecycle before production scale.

**Dependencies:** specialist decisions on lawful basis, retention, supported-person rights, succession, export, and backups.

**Deliverables:** preferences; access review; leave/remove; ownership transfer; export; account/care-space deletion workflows; purge jobs; disclosures and operational runbooks.

**Acceptance:** workflow N passes for sole/multiple organiser cases; exports respect permissions; deletion spans auth/database/storage/devices with auditable completion and disclosed backup treatment.

**Regression protection:** destructive-flow staging rehearsals, recovery-window tests, orphan scans, legal acceptance checklist.

**Explicit exclusions:** any policy invented by engineering.

**Stop point:** owner and specialist sign-off.

### Phase 19 - Production Hardening And Release Readiness

**Purpose:** prove the complete system under realistic load, failure, accessibility, and security conditions.

**Dependencies:** all approved launch phases.

**Deliverables:** end-to-end A-N suite; performance/offline/restore tests; accessibility audit; penetration/security review; observability and incident runbooks; store/release checks; production migration rehearsal.

**Acceptance:** no critical/high unresolved issue; RLS/storage tests green; recovery objectives demonstrated; physical-device matrix signed; Phase 1 protected flows remain intact.

**Regression protection:** the full automated and manual release gate becomes mandatory.

**Explicit exclusions:** new product features and Ask Lilica.

**Stop point:** explicit product-owner go/no-go; production release is never implied by completion of engineering work.

---

## 18. Regression Protection Strategy

### 18.1 Protected Phase 1 Baseline

Until the owner explicitly changes a requirement, every phase must preserve:

- Welcome and How Lilica Works.
- Account-choice presentation and existing transition rhythm.
- Relationship and supported-person naming flow.
- Privacy declaration gate, version, and timestamp.
- Interest carousel ordering behaviour without using interests to hide features.
- “Let's get [Name] organised” structured onboarding and its eight categories.
- Vertical snap stack, compact cards, expand/retract sheet motion, tap-outside/swipe/Done closure, and retained unsaved draft semantics.
- Working file picker and camera entry points and attachment persistence during the current local phase.
- Legacy `firstItem -> records[]` migration.
- Home rendering only real user data.
- Expo SDK 57 compatibility and current supported physical-device launch.

Characterization tests should capture current behaviour even where the contract later changes it. A deliberate change first updates the contract/acceptance case, then the implementation and baseline together after approval.

### 18.2 Test Layers

| Layer | Minimum coverage | Gate |
|---|---|---|
| Type/static | TypeScript and schema-generated types; forbidden dependency directions | Every change |
| Pure domain | lifecycle, derivation, sorting, recurrence, links, permissions, reminder eligibility | Every change to shared rules |
| Property/invariant | no duplicate occurrence, immutable completed history, no cross-space identity, valid transition only | Core-engine phases onward |
| Migration | every known legacy fixture, interruption/retry, duplicate IDs, malformed optional data, attachment paths | Every schema/cache migration |
| Database | constraints, transactions, functions, idempotency, clock/timezone behaviour | Every migration |
| Authorisation | positive and negative RLS, Storage, Realtime, RPC tests for every role/scope | Every backend change |
| Sync/integration | offline queue, retry, compatible merge, hard conflict, revocation, two devices | Sync onward |
| Component | sheets/forms/drafts/view projections/loading/error/accessibility states | Every affected surface |
| End to end | workflows A-N with fixed actors/spaces/dates | Before each relevant phase sign-off |
| Visual | protected onboarding and key screen states at agreed phone sizes/text scales | Every UI phase |
| Physical device | keyboard, gestures, picker, camera, notifications, offline/relaunch | Every release candidate |
| Security/privacy | dependency scan, secret scan, object access, cache removal, export/purge, logs | Every release candidate |
| Performance/reliability | large record sets, search, sync resume, cold start, memory, poor network | Hardening and regression releases |

### 18.3 Required Domain Fixture Matrix

- UK dates around midnight, BST start/end, leap day, month end, and annual recurrence.
- All-day and timed events created/viewed from different timezones.
- Open, due today, overdue, completed-then-reopened, cancelled, missed, archived, and deleted/tombstoned cases.
- Series edits for one occurrence, this-and-future, and entire series.
- Two care spaces with intentionally similar names/records to expose leakage.
- Organiser, contributor, viewer, supported-person, expired invite, removed member, and revoked device.
- Compatible and incompatible concurrent offline operations.
- New, uploading, failed, current, superseded, quarantined, and deleted document versions.
- Dismissed, snoozed, cancelled, stale, delivered, and preference-blocked reminders.

### 18.4 Release Gates

No phase is complete until:

1. Its acceptance criteria and exclusions are checked in writing.
2. Typecheck, unit, migration, integration, authorisation, and relevant UI suites pass reproducibly.
3. No unexplained schema drift, secret, public storage object, orphan upload, or cross-space result exists.
4. The protected Phase 1 checklist passes on physical devices.
5. Documentation describes actual behaviour and any accepted limitation.
6. `git diff` contains only approved scope and the workspace status is understood.
7. Product-owner review occurs before the next numbered phase.

### 18.5 Rollout And Recovery

- Use feature flags only for controlled rollout, never as a substitute for server permission.
- Make database changes backward-compatible across the supported client rollout window.
- Expand schema, backfill/verify, switch reads/writes, then contract only after old clients are retired.
- Rehearse restore and migration rollback in non-production with representative encrypted data.
- Prefer disabling a failing new capability while retaining readable data over attempting destructive automatic rollback.
- Record operational correlation IDs without logging sensitive record text, document names, tokens, or signed URLs.

---

## 19. Decisions Requiring Product-Owner Approval

The recommendation column is the architecture default, not an implemented decision. “Needed by” means work should stop before that phase if unresolved.

| ID | Decision | Recommendation | Needed by |
|---|---|---|---|
| D1 | Approve record + occurrence + typed-link model | Approve; preserve `LilicaRecord` only as migration boundary | Phase 3 |
| D2 | Lifecycle vocabulary | Approve record active/archived/deleted and occurrence open/scheduled/awaiting confirmation/completed/cancelled/missed | Phase 3 |
| D3 | Passed appointment behaviour | `past_awaiting_outcome`; ask what happened, never infer | Phase 3 |
| D4 | Recurrence identity and edit scopes | Stable series; immutable occurrences; one/this-and-future/all scopes | Phase 3 |
| D5 | Completion/confirmation wording | Treat as named member assertion unless externally verified | Phase 3 |
| D6 | Bill modelling | Due occurrence is actionable; no automatic duplicate task | Phase 8 |
| D7 | Linked action date changes | Prompt; recompute only explicit relative policies, never silent explicit-date changes | Phase 8 |
| D8 | Assignment acceptance | Support proposed/accepted; make acceptance optional by care-space preference initially | Phase 8 |
| D9 | Home horizons and limits | Coming Up 30 days; Latest 14 days; limit rows with See all | Phase 10 |
| D10 | Calendar scope | All authorised event occurrences plus optional actionable deadlines; visually distinct | Phase 11 |
| D11 | Initial roles and capabilities | Organiser, contributor, viewer; supported person is identity/capability-based, not merely a weak role | Phase 6 |
| D12 | Domain/record restriction at launch | Build schema/RLS capability now; expose minimal UI only after user research | Phase 6 |
| D13 | Required organiser profile fields | Display name required; photo and DOB optional/omitted unless justified | Phase 5 |
| D14 | Supported-person account/linking | Never auto-create an account; explicit invitation/linking flow | Phase 6 |
| D15 | Supabase organisation/project/region/owners | Dedicated Lilica non-production and production projects; authorised owner to confirm | Phase 4 |
| D16 | Offline conflict presentation | Semantic merges plus explicit conflict; reject blanket last-write-wins | Phase 7 |
| D17 | Notification defaults/quiet hours | Conservative opt-in defaults and configurable quiet hours; validate in research | Phase 14 |
| D18 | Escalation channels | No SMS/email/emergency escalation at initial reminder launch | Phase 14 |
| D19 | Document prior-version retention | Immutable versions; retain superseded files under approved retention policy | Phase 16 |
| D20 | Document access logs visible to members | Capture security audit only if proportionate; decide user-facing visibility with privacy review | Phase 16 |
| D21 | OCR and extracted text | Defer beyond initial document maturity | After Phase 16 |
| D22 | Care-space switching and aggregate overview | One active space at a time; defer cross-person overview | Phase 6 |
| D23 | Sole-organiser succession | Require transfer or explicit whole-space closure; define emergency/legal exceptions | Phase 15 |
| D24 | Former-member attribution | Retain minimum immutable attribution, pseudonymise where policy requires | Phase 15 |
| D25 | Account/care-space deletion and recovery period | Product plus specialist legal/privacy decision required | Phase 18 |
| D26 | Retention, backup erasure, and export formats | Specialist legal/privacy and operational decision required | Phase 18 |
| D27 | Supported-person consent, authority, and rights path | Specialist legal/privacy decision and user research required | Before production shared care data |
| D28 | Ask Lilica scope | Keep out of these phases; later retrieval must cite authorised source records and require review for writes | Future phase only |

### 19.1 Technical Investigations Before Approval Becomes Implementation

1. An authorised Luxford Interactive owner must confirm whether any Lilica Supabase project already exists, who owns it, its region, plan, environments, and whether it contains data. Repository inspection cannot answer this.
2. Confirm current Expo SDK 57 compatibility for the chosen auth, secure-storage, database/cache, background task, document, and notification libraries at the phase where each is proposed. Do not install them during this design phase.
3. Prototype RLS and sync semantics against a disposable non-production schema before accepting performance or realtime assumptions.
4. Measure iOS/Android background and notification constraints on physical devices before promising delivery guarantees.
5. Obtain specialist review for UK GDPR special-category processing, supported-person autonomy/authority, DPIA, retention, vendor arrangements, and incident obligations.

---

## Approval Boundary

This contract is complete as a design proposal. It does not authorise implementation. Phase 3 begins only after the product owner reviews the proposed decisions, resolves or explicitly defers the relevant open items, and issues a separate implementation prompt.

No application code, dependency, package lock, Supabase resource, or production configuration was intentionally changed while preparing this document.
