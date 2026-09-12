# Phase 16/17 QA — Document Maturity Foundation & Experience

Status: **Phase 16's foundation and Phase 17's UI integration are both implemented and automated-validated (12 September 2026) — this checklist is now the live Phase 17 physical-device QA, updated in place per that phase's own instruction rather than replaced.** Nothing below has been physically tested; no item may be marked passed until the product owner actually performs it on a real device.

## What changed since this document was first written (Phase 16)

At Phase 16, this file said physical QA was "not applicable yet" because no UI called the foundation. That is no longer true: Phase 17 wired the Add-document flow, "Related to", "Does anything need doing?", bidirectional RecordDetail presentation, View document, upload retry, and deletion cleanup into the real app — see `docs/PHASE_17_ARCHITECTURE.md` for exactly what exists and what is explicitly still out of scope (a durable offline-delete retry queue; lightweight document-gateway groupings).

## Automated validation already performed (not a substitute for the checklist below)

- `npm run typecheck` — clean.
- `npm test` — 39 suites / 395 tests passing.
- `npm run secrets:check` — clean.
- `npm run db:reset && npm run db:test && npm run db:lint` — clean, 228 pgTAP assertions.
- `npx supabase db push --linked` — the Phase 16 migration applied to `lilica-development`; migration histories verified to match; `npx supabase test db --linked` — 228 assertions pass on the linked database; `npx supabase db lint --linked` — clean; the private `document-attachments` bucket independently confirmed to exist there.
- `npx expo config --type public` and `npx expo export --platform web` — both clean.

## Physical-device checklist (Phase 17 acceptance journey)

A. Add a reference-only document (no link, no task) — save succeeds, no task/link created.
B. Reopen it (close and reopen the app) — still there, exactly as saved.
C. View document — opens the actual file via the native share/open sheet.
D. Restart the app and reopen the same document — still opens correctly.
E. Add a document linked to an appointment via "+ Link something".
F. Open the document → tap the related appointment → its own detail opens.
G. Open that appointment → its own "Documents" section shows the same document → tap it → back to the document's detail.
H. On a document, choose "Does anything need doing?" → Yes → fill in a task → save/add.
I. The new task appears in To Do.
J. The new task appears on Home where the existing rules already say it should.
K. Open the task → its "Related document" section shows the originating document → tap it → the document's detail opens.
L. Complete the task (from To Do, as normal) → reopen the document → it remains, unaffected.
M. Document expiry (if set) displays correctly and stays visibly different from the linked task's own due date.
N. Add a document while offline → reconnect → confirm it uploads (check on a second device or after reinstall that the file becomes available).
O. Restart the app while an upload is still pending → confirm it resumes/completes rather than being stranded.
P. Open the same document on a second authorised device/account in the same care space — confirm the attachment is discoverable and opens via View document (secure retrieval, no dependency on the first device).
Q. Open an existing (pre-Phase-16) document that still has a valid local file on the device that created it — confirm it still opens, and check it becomes available on a second device shortly after (upload retry).
R. Open an existing document whose local file is genuinely gone (e.g. after reinstalling without the original device) — confirm a calm "unavailable" state, no crash, no fabricated file.
S. Remove a "Related to" link (Edit → Remove on that link) — confirm only the relationship disappears, both records remain intact.
T. Delete a document that has a linked appointment and a linked task — confirm the appointment and task both survive untouched, and the document itself is gone.
U. Switch between two supported people (e.g. Beauty and Jackie) — confirm no document, link, or task from one ever appears, is linkable, or is retrievable under the other.
V. As a contributor granted the "documents" domain — confirm normal add/view/edit/link/task behaviour.
W. As a contributor WITHOUT the "documents" domain — confirm documents are simply not visible/offered.
X. As a viewer with the "documents" domain — confirm View document works but Edit/Related-to/Does-anything-need-doing are not offered.
Y. As a revoked member (if practical to test) — confirm no further document/attachment retrieval succeeds after removal.
Z. Android: file picker, camera scan, native share/open sheet, system Back through a Document → Appointment → Document traversal, small-screen layout, accessibility text scaling.
AA. iPhone: the same set as Z, plus keyboard avoidance on the document editor's new sections and safe-area behaviour on the RecordDetail sheet.
AB. Long document/related-record titles do not break any of the new layouts (picker, related rows, View document rows).

Do not claim any of the above passed until the product owner has actually tested it.
