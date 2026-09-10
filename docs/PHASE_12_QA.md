# Phase 12 Physical-Device QA — To Do Projection

Status: implementation complete, automated tests passing; physical-device QA not yet run.

To Do is a projection of the same records Home and Calendar already read. There is no separate data store to verify — these checks confirm the projection, filters, completion and cross-view consistency behave correctly on a real device.

## Setup

Use an account with at least one supported person who has: an overdue bill, a task due today, an upcoming task/home-or-car matter, an appointment (to confirm it's excluded), and at least one completed item.

## Checks

1. **Opening To Do** — tap the To Do tab. It opens without delay or a blank flash.
2. **Overdue item** — an overdue bill/task/home-or-car matter appears under "Overdue".
3. **Due-today item** — appears under "Today / Needs doing".
4. **Upcoming item** — a task/bill/home-or-car matter due later appears under "Upcoming".
5. **Appointment excluded** — an appointment never appears in To Do, even when it has a date.
6. **Multiple items** — a group with more than one item shows all of them.
7. **Assigned to You** — a record assigned to the organiser (via the existing Assigned-to control) shows a "You" badge and appears under the "Mine" filter.
8. **Unassigned** — a record with no assignment shows "Unassigned" and appears under the "Unassigned" filter.
9. **Complete an item** — tap "Mark complete" (or "Mark paid" for a bill). It disappears from the active groups immediately.
10. **Reopen** — tap "Show completed", find the item, tap "Reopen". It returns to its correct active group (Overdue/Today/Upcoming, recalculated from its due date).
11. **Open/edit an item** — tap an item (not the action button). The normal record editor opens, pre-filled with its real details.
12. **Home reflects it immediately** — after completing or editing from To Do, go to Home: the same change is visible there.
13. **Calendar consistency** — a dated actionable item completed from To Do no longer shows as overdue on its Calendar day.
14. **Offline completion** — turn off network connectivity, mark an item complete. It updates locally.
15. **Force-close/reopen** — close and reopen the app while still offline. The completion is still reflected.
16. **Reconnect** — restore connectivity. No duplicate item or duplicate completion appears once synced.
17. **Person switching** — switch from Maggie to another supported person. To Do shows only the new person's actionable work — nothing from Maggie is visible.
18. **Self-care** — if the organiser has their own ("Myself") care space, To Do works identically there.
19. **Sign-out/sign-in** — sign out and back in; To Do shows the correct current state, not stale local data.
20. **Small Android layout** — the filter row, groups and cards fit and scroll correctly on a smaller Android screen; nothing is cut off.
21. **iPhone layout** — the same checks read cleanly at iPhone width.
22. **Bottom-nav/safe-area behaviour** — the tab bar is never covered by or covering To Do content, on both platforms.

## Known limitations (by design, not defects)

- Only open task/bill/home-or-car-matter records appear; appointments, documents, contacts, care information and updates never do, even if dated.
- Assignment offers only All/Mine/Unassigned — no "Others" filter, since no other active membership exists yet (Phase 15).
- Upcoming shows items due within 30 days; nothing further out appears until it enters that window.
- No automatic next-occurrence is created on completing a recurring item (matches existing Phase 8/9 client behaviour).
