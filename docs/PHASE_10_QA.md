# Phase 10 Physical-Device QA — Calendar Projection

Status: implementation complete, automated tests passing; physical-device QA not yet run.

Calendar is a projection of the same records/state Home already reads (`state.records`). There is no separate Calendar data store, cache or outbox to verify — these checks confirm the projection, navigation and edit round-trip behave correctly on a real device.

## Setup

Use an account with at least one supported person who has some appointments, bills, tasks and home/car matters spread across today, a past date and a future date, plus at least one undated contact or care note.

## Checks

1. **Opening Calendar** — tap the Calendar tab. It opens without delay or a blank flash.
2. **Current month** — the month header shows the real current month and year.
3. **Month forward/back** — tapping the arrows moves one month at a time; the header updates; nothing else on screen jumps or flashes.
4. **Today indicator** — today's date is visually distinguished from other dates in the grid.
5. **Selecting dates** — tapping any date in the grid highlights it and updates the list below to that date's items.
6. **Multiple items on one day** — a date with more than one appointment/bill/task shows all of them, not just one.
7. **Appointments** — an appointment shows its category, title and time (where set) in the list.
8. **Bills** — a bill shows its category and title; no fabricated time.
9. **Tasks** — a task shows its category and title.
10. **Home or car matters** — where a home/car matter has a relevant date, it appears on that date the same way.
11. **Past appointment state** — a past appointment that was never confirmed/completed shows as Overdue, exactly as it does on Home. It is never silently shown as completed.
12. **Overdue state agreement** — for the same record, Home and Calendar agree on whether it is Overdue.
13. **Opening an item** — tapping an item in the day list opens the normal record editor (the same screen used everywhere else in the app), pre-filled with that record's real details.
14. **Edit reflected elsewhere** — change something on that record and save. Go back to Calendar: the change is visible immediately. Check Home too: it shows the same updated record.
15. **Person switching** — with more than one supported person, switch the active person from the switcher. Calendar shows only the newly active person's items — nothing from the previous person is visible, and the calendar resets to today/current month.
16. **Offline cached view** — turn off network connectivity after Calendar has loaded once. Calendar continues to show the cached data. Reopening the app while still offline still shows it.
17. **Restart** — close and reopen the app. Calendar opens on the real current month/day, not wherever it was left.
18. **Empty day** — select a date with nothing scheduled. It shows a calm "Nothing planned for this day." message, not an error or a blank space.
19. **Small Android layout** — on a smaller Android screen, the month grid and day list both fit and scroll correctly; nothing is cut off.
20. **iPhone layout** — the same checks on iPhone; the grid and list read cleanly at iPhone width.
21. **Bottom-nav/safe-area behaviour** — the tab bar at the bottom is never covered by or covering Calendar content, on both platforms.

## Known limitations (by design, not defects)

- Only appointments, tasks, bills, home/car matters and documents with a relevant date appear in Calendar. Contacts, care information and updates have no calendar meaning and are correctly absent.
- Assignment shown is limited to Unassigned/You, per the existing Phase 9 scope — no other members exist yet to assign to.
- There is no Calendar-specific "add" flow beyond the existing category/record creation Home already offers.
