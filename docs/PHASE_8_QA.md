# Phase 8 Physical-Device QA

Status: Awaiting product-owner testing on physical Android and iPhone devices
Date prepared: 10 September 2026

Use development accounts and `lilica-development` only. Record device model, OS, Expo Go/build version and result. Phase 8 is mostly architectural; where no UI exists, the automated proof is named instead of inventing a test screen.

## Existing Experience

- Create and edit each currently dated record type; confirm the existing sheets, wheel selectors and displayed `DD/MM/YYYY` / `HH:mm` values are unchanged.
- Confirm an appointment that has passed remains awaiting an explicit outcome and is not labelled completed, missed or overdue.
- Where recurrence is exposed, complete an item and confirm exactly one next item appears; force-close/reopen and confirm no duplicate.
- Confirm the approved Home design, counts, cards, empty state and person switcher still display correctly.
- Confirm the self/someone-else fork, self-care setup and another-person setup are unchanged.

## Offline, Restart And Identity

- Create a dated record offline, force-close, reopen offline and confirm it remains under the same person.
- Edit a dated record offline, force-close/reopen, reconnect and confirm the edit synchronises once with no duplicate.
- Queue a change for Beauty, switch to Jackie before reconnecting and confirm it remains bound to Beauty.
- Exercise self-care only, another-person only, and self plus another person; confirm no record crosses care spaces.
- Sign out with queued work and confirm no upload occurs; sign back into the same account and confirm authorised work resumes.
- On a second device, sign into the same development account and confirm the same cloud record/occurrence is reconciled once after local setup gates.

## Attachments And Regression

- Open a pre-Phase-8 local attachment on its originating device and confirm it remains available.
- Confirm a second device does not claim locally unavailable attachment bytes exist.
- Repeat create/edit, wheel selection, keyboard reveal, force-close/reopen, person switching and Home checks on Android and iPhone.
- Confirm no Calendar, To Do, assignment, invitation, notification or collaboration UI has appeared.

## Automated Invariants

- `tests/domain-contract.test.ts`: lifecycle, past appointments, due/overdue, date/time zones, recurrence edges/edit scopes, immutable history and assignment separation.
- `tests/record-sync.test.ts`: offline cache/restart, retry, ordering, tombstones, sign-out boundary, care-space switching, occurrence persistence and second-device reconciliation.
- `supabase/tests/database/occurrences_rls.test.sql`: deterministic migration, malformed history, attachment and responsibility preservation, occurrence history, recurrence retry, stable assignment identity and anonymous/cross-user/revoked denial.

Phase 8 must remain unapproved until both Android and iPhone checks pass. Failures should be reported against this checklist without beginning Phase 9.
