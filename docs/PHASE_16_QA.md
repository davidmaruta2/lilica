# Phase 16 QA — Document Maturity Foundation

Status: **physical-device QA is not applicable yet.** Phase 16, as scoped and completed on 12 September 2026, is the database/permission/file-transfer foundation only (see `docs/PHASE_16_ARCHITECTURE.md`) — there is no new UI in this app to test on a device. The full physical checklist the original brief (`Downloads\card.txt` section 36) asked for depends on Phase 17's UI work (the "Related to" picker, "Does anything need doing?" flow, RecordDetail's bidirectional sections, and the "View document" button) and should be written and run once that lands.

## What was verified this phase (automated only)

- `npm run typecheck` — clean.
- `npm test` — 36 suites / 366 tests passing.
- `npm run secrets:check` — clean.
- `npm run db:reset && npm run db:test && npm run db:lint` — clean local rebuild, 228 pgTAP assertions (45 new for Phase 16), no lint errors.
- `npx supabase db push --linked --dry-run` against `lilica-development` — confirmed exactly one pending migration with no unrelated diff. **Not yet applied to the hosted database** — apply only on explicit product-owner instruction.

None of the above is a substitute for physical-device testing. No physical-device claim is made here.

## Checklist to write and run once Phase 17 lands (carried forward from the original brief, for the next agent)

A. Add a reference-only document.
B. Close/reopen the app and find it.
C. Open the actual file ("View document").
D. Add a document linked to an appointment.
E. Open document → appointment.
F. Open appointment → document.
G. Add a document, choose "Does anything need doing?" → create a task.
H. Verify the task appears in To Do.
I. Verify the task appears on Home where expected.
J. Complete the task and verify the document remains, untouched.
K. Document expiry display.
L. Document expiry differs from the linked task's own due date (never conflated).
M. Offline add → reconnect → upload.
N. App restart during a pending upload.
O. A second authorised device opens the same document.
P. An authorised contributor (with the `documents` grant) can access it.
Q. A contributor without the `documents` grant cannot.
R. A viewer can read but not edit.
S. A revoked member loses future access.
T. Two supported people — no cross-space leakage.
U. An existing pre-Phase-16 document remains valid and reference-only.
V. A missing legacy local file is handled safely (no crash, clearly represented as unavailable).
W. Delete a document and verify any linked record/task survives.
X. Android file picker/viewer/back behaviour.
Y. iPhone file picker/viewer/back behaviour.
Z. Keyboard/safe-area regression spot-check on any new screens/sheets.

Do not mark any of the above as passed until a real product-owner physical-device pass has actually been performed.
