# Phase 14 Reminder And Notification Engine Architecture

Status: local reminder foundation implemented and automatically validated; server/push delivery deferred (see "Deferred: server/push" below); physical-device QA pending (see `docs/PHASE_14_QA.md`)
Date: 11 September 2026

## Boundary

Phase 14 makes Lilica proactively remind the signed-in user about genuinely actionable, dated work — using **local device notifications only**. It introduces no new database table, no server-side push infrastructure, and no collaboration/invitation notifications (Phase 15). It does not weaken Home, Calendar, To Do or Person, and does not touch RLS, occurrence semantics, or assignment architecture.

## Three-State Separation (the core invariant)

Three concepts are kept strictly apart, matching the brief's absolute rule:

1. **Record/occurrence state** — `status`, `completed`, `completedAt` on `LilicaRecord`. Unchanged by Phase 14.
2. **In-app attention state** — `deriveRecordState()`'s `overdue`/`dueToday`/`upcoming`. Unchanged; still the only source Home/Calendar/To Do read.
3. **Notification delivery state** — a scheduled local OS notification, identified only by a deterministic string. Never written back onto a record. Dismissing or snoozing a notification changes only what the OS has scheduled — it never touches `completed`, `status`, or any due/event date. The domain layer already anticipated this exact separation in `src/domain/core.ts`'s `acknowledgeReminder()` (`{ occurrence, acknowledgement: { deliveryId, action } }`, never mutating the occurrence) — Phase 14's local implementation follows the same principle for the client-side model.

## Reminder Domain Logic (`src/reminders.ts`)

Pure functions, no native dependency, fully unit-testable:

- `isReminderEligible(record)` — only `appointment`/`task`/`bill`/`homeMatter`, never cancelled or completed. Informational types (document/contact/careNote/update) never qualify, matching Phase 12's `isActionableRecord()` precedent plus appointments.
- `reminderOccasionsForRecord(record, now)` — the default policy: appointments get 1-day-before and 2-hours-before occasions (using the record's own local wall-clock date/time, the same "no guessed UTC conversion" precedent as the rest of the app); date-only records (task/bill/homeMatter) get 3-days-before and on-the-due-date (09:00) occasions. An occasion whose fire time has already passed is simply omitted, never manufactured retroactively.
- `applyQuietHours(fireAt, quietHours)` — a fire time inside the configured window moves forward to the moment quiet hours end (supports an overnight window crossing midnight); a fire time outside the window is untouched. Quiet hours affect delivery timing only — never due dates, occurrence status, or Home's attention state.
- `reminderNotificationId(recordId, offsetKey, scheduleVersion)` / `snoozeNotificationId(...)` — deterministic identifiers. The same inputs always produce the same identifier (idempotent scheduling); a snoozed delivery is namespaced separately so it can never collide with or replace the original occasion.
- `reminderTitle`/`reminderBody` — conservative, lock-screen-safe wording ("Maggie's appointment is tomorrow"), using only the record's type and title — never notes or other detail.

## Notification Delivery (`src/notifications.ts`)

The thin OS boundary, platform-guarded throughout (`Platform.OS === 'ios' || 'android'`; every exported function no-ops safely on web):

- `configureNotificationHandler()` — calm foreground presentation (banner, no sound), an Android "Reminders" channel.
- `getPermissionState()`/`requestPermission()` — map directly to `expo-notifications`' own result; permission is requested only from `reconcileRecordReminders`'s caller at an explicit reminder-value moment (the record editor's "Remind me" toggle, or the Account screen's master switch) — never at launch or during onboarding.
- `reconcileRecordReminders(record, previousScheduleVersion, careSpaceId, personName, settings)` — the single reconciliation entry point. Cancels whatever the previous schedule version left pending, cancels the current version too (idempotency safety), then — only if the record is still eligible and reminders are enabled both globally and for the record — schedules fresh occasions. Called from `App.tsx`'s `saveRecord()` after every save (covering creation, date edits, completion and cancellation alike, since they all flow through that one path) and from `removeRecord()` on deletion.
- `snoozeReminder(record, offsetKey, option, careSpaceId, personName)` — a restrained two-option set (later today / tomorrow morning). Refuses to schedule past the record's own natural ceiling (an appointment's start time, or end-of-day for a date-only item).
- `disableAllReminders()` — the global mute (Account screen's master switch turned off): cancels every pending local notification outright.
- `addNotificationResponseListener`/`extractReminderData` — notification-tap handling.

## Reminder State On The Record

No new table: `remindersEnabled?: boolean` and `reminderScheduleVersion?: number` ride inside the existing `LilicaRecord`/`record_data` shape, exactly like Phase 9's `assignedMembershipId` — no migration needed. `reminderScheduleVersion` is a pure fingerprint of the fields an occasion is computed from (event/due date and time); `RecordEditor.save()` bumps it only when those fields actually change, regardless of whether reminders are currently on, so re-enabling later still reconciles against the correct version.

## Permission Flow

Never requested at launch or during onboarding. The record editor's "Remind me" toggle (appointment/task/bill/homeMatter only) is the primary entry point: turning it on calls `onRequestReminderPermission`, which requests OS permission if not yet determined and, on success, also turns on the global master switch. Denial leaves the toggle off and is never retried automatically. The Account screen (reached via Person's "Account" link) offers the same master switch plus a quiet-hours toggle, for a user who wants to review/turn off reminders without opening a specific record.

## Care-Space Routing And Revalidation

Every scheduled notification carries `{ recordId, careSpaceId, offsetKey }` — never the full record content. On tap, `App.tsx` resolves `careSpaceId` against `state.careSpaces` and switches the active space if needed *before* opening the record, so a Maggie notification opened while Jackie is active correctly shows Maggie. If the referenced care space no longer exists locally, the tap is silently ignored rather than opening the wrong record — the only form of "access revoked" possible in this single-device, pre-Phase-15 scope.

## Idempotency

Deterministic identifiers mean `Notifications.scheduleNotificationAsync` with the same identifier replaces rather than duplicates. `reconcileRecordReminders` also explicitly cancels before rescheduling, so calling it repeatedly (e.g. on every save) never accumulates duplicate deliveries — verified directly in `tests/phase14-notifications.test.ts`.

## Offline

`notifications.ts` makes no network call. Scheduling, cancelling and reconciling all happen locally regardless of connectivity, through the same `saveRecord`/`removeRecord` paths that already go through the Phase 7 cache/outbox — no second sync system was created.

## Medication Safety

A reminder being scheduled, sent, opened, dismissed or snoozed is never recorded as evidence medication was taken. No administration-record concept exists anywhere in Phase 14.

## Deferred: Server/Push Delivery

Not implemented in this pass, per the brief's own explicit instruction to implement only the safe foundation and stop rather than fake delivery. Real push requires:

- An Expo push token registered per device, requiring `expo-notifications`' push token API plus a `projectId` (EAS project configuration).
- A device-registration table (RLS-protected, one row per authenticated user's device, supporting token rotation/revocation/logout) — genuinely new schema, not created here per the brief's "no migration for convenience" instruction and because it has no safe use without a working push send path.
- A Supabase Edge Function (or equivalent) to send pushes via Expo's push service, holding the Expo access token server-side only — never in the mobile client.
- Product-owner action: an EAS project must exist with push credentials configured (Apple Push Notification service key for iOS, Firebase Cloud Messaging for Android) before any of the above can be exercised for real.

This also means the two-device reconciliation scenario (Device A has a pending reminder, Device B completes the item) is **not yet real cross-device** — each device's local schedule reconciles independently from its own local `state.records`, which already sync via the existing Phase 7 cache/outbox, so Device A *will* see the completed state and stop showing it as due next time it opens the app or syncs, but it cannot proactively cancel an already-scheduled local OS notification it doesn't know has become stale until it next syncs. Opening a stale notification still safely revalidates current state before showing anything (the tap handler always reads live `state.records`, never trusts notification payload content as current data).

## Not Implemented (Deferred)

Server/push delivery and device-token registration (above), care-circle/collaboration notifications (Phase 15 — the architecture already only ever resolves "Unassigned"/"You", never a fake name), a daily-summary notification, custom quiet-hour time selection (only a fixed default 21:00–08:00 window with an on/off toggle exists), reminders/notifications for external contacts (they have no application access, and never will independent of Phase 15), notification-based completion actions (opening a notification always leads to the normal editor, never a one-tap "mark complete" from the notification itself).

## Current Limitations

- Local notifications require a development build to test on-device (Expo Go does not reliably support scheduled local notifications since SDK 53) — see `docs/PHASE_14_QA.md`.
- Quiet hours are a single fixed window (21:00–08:00), toggled on/off; no custom start/end time picker yet.
- No true multi-device push reconciliation yet (see "Deferred: server/push" above) — each device reconciles from its own next sync of the shared record data, not a proactive server cancel.
