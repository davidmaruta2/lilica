# Phase 14 Physical-Device QA — Reminder And Notification Engine

Status: implementation complete, automated tests passing (see `docs/PHASE_14_ARCHITECTURE.md`); physical-device QA not yet run.

**Requires a development build.** Since Expo SDK 53, Expo Go does not reliably support scheduled local notifications (and push is unsupported entirely). Testing this phase for real requires a dev-client build (`eas build --profile development`) installed on the test device, not the usual Expo Go session.

## Test-time acceleration

Waiting a real day/hour for a reminder to fire is impractical. For development testing only, temporarily create a record with a due date/time a few minutes in the future (e.g. an appointment with `eventTime` 5 minutes from now) rather than changing any production scheduling logic — the 1-day/2-hour and 3-day/due-day offsets themselves must never be altered for testing.

## Checks

1. **Permission not yet requested** — a fresh install shows no OS permission prompt on launch or during onboarding.
2. **Enable first reminder** — open a task/bill/homeMatter/appointment, toggle "Remind me".
3. **Pre-permission explanation** — before the OS dialog, Lilica's own toggle/copy is visible so the prompt isn't a surprise.
4. **OS permission prompt** — the real OS dialog appears.
5. **Permission granted** — the toggle turns on; a reminder is later delivered.
6. **Permission denied** — the toggle stays off; a short in-app note explains notifications are off in device settings.
7. **App remains usable after denial** — Home/Calendar/To Do/Person/record editing all continue working normally.
8. **Appointment reminder** — 1-day-before and 2-hours-before notifications arrive for an appointment with a time.
9. **Bill/date-only reminder** — 3-days-before and on-the-due-date notifications arrive for a bill/task/home matter.
10. **Reschedule** — change the date/time of a record with reminders on; old pending notifications are replaced, no duplicates fire.
11. **Completion** — mark the record complete (from the editor or To Do); no further reminder fires for it.
12. **Cancellation** — cancel the record; no further reminder fires for it.
13. **Snooze** — from a delivered notification, snooze; a new reminder arrives later, the record's own due date is unchanged.
14. **Dismiss** — dismiss a delivered notification; the record remains exactly as it was (not completed, not paid, not attended).
15. **Mute/disable** — turn the master switch off in Account; no further reminders arrive until turned back on.
16. **Quiet hours** — turn quiet hours on; a reminder that would fire during the window instead arrives at the window's end.
17. **Notification tap** — tapping a delivered notification opens the app to the correct record's normal editor.
18. **Correct care space** — with two supported people, a notification for one opens that person's context even if the other was active when tapped.
19. **Correct canonical record** — the opened record matches the notification exactly (same title/date), and editing it updates Home/Calendar/To Do identically.
20. **Stale notification** — force a record to be completed/cancelled after a reminder was already scheduled (e.g. via another quick edit), then open the (now stale) delivered notification if it still fires; the app shows the current, correct state rather than a stale action.
21. **Offline** — schedule a reminder, turn off connectivity, restart the app; the reminder still fires at the right time.
22. **Reconnect** — after reconnecting, no duplicate reminder appears for the same occasion.
23. **Two-person switch** — Maggie and Jackie each have a reminder-eligible record; confirm each person's reminders and notifications reference only their own record.
24. **Long person/item names** — a long person or record title doesn't break notification text or in-app copy.
25. **Lock-screen privacy wording** — the notification text on a locked device shows only a conservative title ("Maggie's appointment is tomorrow"), never notes or other detail.

## Known limitations (by design, not defects)

- Real push/server delivery is not implemented — see `docs/PHASE_14_ARCHITECTURE.md`'s "Deferred: server/push" section for exactly what would need to be built and the external (Apple/Google/EAS) setup required.
- Two-device reconciliation happens on next sync, not instantly server-side.
- Quiet hours is a single fixed window (21:00–08:00) toggled on/off; no custom time picker yet.
