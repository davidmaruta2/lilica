# Phase 13 Physical-Device QA — Person Projection

Status: implementation complete, automated tests passing; physical-device QA not yet run.

Person is a projection of the same records Home, Calendar and To Do already read. There is no separate data store to verify — these checks confirm the projection, self-care wording, editing and cross-view consistency behave correctly on a real device.

## Setup

Use an account with at least one supported person who has: a contact, a piece of care information, a home matter, a document, and a bill/renewal — plus an appointment and a task, to confirm they're correctly excluded. Also useful: a second supported person, and (if available) a "Myself" care space.

## Checks

1. **Open Person** — tap the tab labelled with the selected person's name. It opens without delay or a blank flash.
2. **Correct selected person** — the header shows the currently active person's name (or "You" for self-care).
3. **Switch person** — tap the person card, choose someone else. All sections refresh to the new person; nothing from the previous person remains visible.
4. **Self-care wording** — for a "Myself" care space, headings read naturally in the second person ("You"), not "David's information".
5. **Contacts** — a saved contact (e.g. GP surgery) appears under "Important contacts" with its role/phone.
6. **Care information** — a saved care note appears under "Care & health information", showing only what was actually entered.
7. **Home information** — a saved home/car matter appears under "Home".
8. **Documents** — a saved document appears under "Documents & paperwork" with its file count/expiry.
9. **Bills/renewals** — a saved bill appears under "Bills & renewals" with its provider/reference/renewal date.
10. **Appointments/tasks excluded** — an appointment or open task never appears anywhere on Person, even though they're dated.
11. **Open an existing item** — tap a row. The normal record editor opens, pre-filled with its real details.
12. **Edit and return** — change something and save. Person shows the update immediately.
13. **Home/Calendar/To Do consistency** — the same edited record shows the same title/date/status on Home, Calendar and To Do.
14. **Add from Person** — tap "Add" on a section (e.g. "Add a contact"). It opens a new draft in the normal category editor, not a separate form.
15. **Account access** — tap "Account" in Person's header. The organiser's account screen opens, with a back arrow returning to Person; Sign out still works from there.
16. **Offline** — turn off network connectivity. Person still shows cached information.
17. **Restart** — close and reopen the app while offline. Person still shows the same cached information.
18. **Reconnect** — restore connectivity. No duplicate items appear.
19. **Empty/sparse state** — a newly added person with nothing saved shows one calm message, not five empty boxes.
20. **Long names** — a long display name or contact title doesn't break the layout.
21. **Small Android layout** — sections and cards fit and scroll correctly on a smaller Android screen.
22. **iPhone layout** — the same checks read cleanly at iPhone width.
23. **Bottom-nav/safe-area behaviour** — the tab bar is never covered by or covering Person content, on both platforms.

## Known limitations (by design, not defects)

- No per-record "added by" attribution exists yet — rows show when something was added, not who added it.
- Care circle always shows just "You" — no invitations exist yet (Phase 15).
- No AI-generated summaries, diagnoses, or legal-authority claims are ever shown — only what was explicitly entered.
