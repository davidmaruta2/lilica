# Phase 9 Physical-Device QA

Status: Awaiting product-owner testing on physical Android and iPhone devices
Date prepared: 10 September 2026

Use development accounts and `lilica-development` only. Record device model, OS, Expo Go/build version and result. Most of Phase 9's underlying category-gateway/list/add/edit behaviour was already covered by earlier QA rounds — this checklist focuses on what Phase 9 actually changed: the Assigned-to control and the everyday-copy variant.

## Everyday Add (new)

1. From Home, after setup is already complete, tap `Add`.
2. Confirm the heading reads `"[Name]'s records"`, not `"Let's get [Name] organised."`
3. Confirm the empty-category footer button reads `Back to Home`, not `I'll add things later`.
4. Open a category with existing records and confirm the list/add/edit behaviour is identical to onboarding (no visible difference beyond the heading/footer copy above).
5. Add a new record, confirm it appears in Home afterwards without needing to "finish onboarding" again.

## Assignment Control (new)

6. Open an appointment, task, bill or home/car matter editor. Confirm an "Assigned to" control appears with exactly two options: `Unassigned` and `You`.
7. Select `You`, save, reopen the record, and confirm `You` is still selected.
8. Select `Unassigned`, save, reopen, and confirm it reads `Unassigned`.
9. Confirm the existing free-text responsibility field (`Who's taking them` / `Who's dealing with it`) still works exactly as before, independently of the Assigned-to control — enter text in it, save, and confirm both the free text and the Assigned-to choice are retained together.
10. Open a contact, document, care information or update record and confirm no "Assigned to" control appears (not applicable to those categories).
11. Force-close and reopen the app after assigning a record to `You`; confirm the assignment is retained.
12. Create the record offline, reconnect, and confirm the assignment syncs with the rest of the record (it is stored as part of the same record, so no separate sync check is needed beyond the existing record-sync QA).

## Regression Spot Check

13. Repeat a normal first-time onboarding pass (Myself or Someone else) through to Home and confirm the "Let's get [Name] organised." wording and "I'll add things later" button are unchanged for that first-time path.
14. Confirm Home, the self/someone-else fork, wheel date/time pickers, keyboard behaviour, and multi-person switching all still work exactly as before (Phase 9 touched no code in any of those areas).

Phase 9 must remain unapproved until both Android and iPhone checks pass.
