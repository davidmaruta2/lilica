# Phase 18 QA — Privacy, Settings, Export & Account Lifecycle

Status: **Phase 18A implemented and automated-validated (12 September 2026); Phase 18B (real account deletion + complete document export) implemented and automated-validated the same day.** Nothing below has been physically tested EXCEPT the one item explicitly marked PASSED (the To Do background correction — a presentation-layer fix unrelated to Phase 18B's own account-deletion/export work, physically inspected and approved 13 September 2026, see `docs/REVISION_LOG.md`). No other item below may be marked passed until the product owner actually performs it on a real device — the Phase 18B section additionally requires **two genuine Supabase accounts**, not one pretending to be two (same requirement as Phase 15's own two-account QA). Do not infer Android or iPhone results that were not actually supplied. See `docs/PHASE_18_ARCHITECTURE.md` for what was built and why, including Phase 18B's own known limitations (no `.zip` archive; "David M · Former member" attribution not yet wired into every surface).

## PASSED — To Do background correction (13 September 2026, physically approved)

Unrelated to Phase 18B's own account/export scope — a presentation-layer QA correction found and fixed after Phase 18B's own automated validation (see `docs/REVISION_LOG.md`'s "To Do background" entry for the fix itself). Physically confirmed on a real device: existing olive To Do identity retained; the background reads as one continuous surface through the full available content viewport in the empty, populated and scrolling states; no accidental cream rectangle above the tab bar; bottom navigation unaffected; no To Do functional/domain behaviour changed.

## Automated validation already performed (not a substitute for the checklist below)

- `npm run typecheck` — clean.
- `npm test` — 44 suites / 450 tests passing (up from 39/395 at Phase 17's committed head), zero regressions.
- `npm run secrets:check` — clean (213 files).
- `npm run db:reset && npm run db:test && npm run db:lint` — clean, 274 pgTAP assertions across 9 files (up from 228/7 at Phase 17).
- `npx supabase db push --linked` — both the Phase 18A and Phase 18B migrations applied to `lilica-development`; migration histories verified matching; `npx supabase test db --linked` — 274 assertions pass; `npx supabase db lint --linked` — clean.
- `npx supabase db push --linked --dry-run` then applied — `20260912150000_phase18_privacy_export.sql` applied to `lilica-development`; migration histories verified to match; `npx supabase test db --linked` — 245 assertions pass; `npx supabase db lint --linked` — clean.
- `npx expo config --type public` and `npx expo export --platform web` — both clean.

## Physical-device checklist

### Settings entry point
A. Open Settings (cog) — a new **Privacy & data** entry appears alongside Account and Care Circle.
B. Tap it — the Privacy & data screen opens; Back returns to the previous screen exactly as before.

### Account: edit display name
C. Open Account — the organiser's name is shown with an "Edit name" link.
D. Tap it, change the name, Save — the new name appears immediately and survives an app restart.
E. Cancel while editing — no change is made.
F. Attempt an empty/whitespace-only name — rejected with a clear message, no save.

### Export your data
G. Tap "Export your data" — after a short wait, the native share/save sheet opens with a `.json` file.
H. Open the exported file — it contains your profile, your care space(s), and only the records/attachments-metadata/links you're actually authorised to see (spot-check against what Home/Calendar/To Do/People show you).
I. As a domain-restricted contributor or viewer — export contains only your granted domain's records; confirm nothing from a domain you're not granted appears anywhere in the file.
J. While offline — tapping Export shows a real, honest failure message (not a fake success, not a silent hang).
K. Attachment entries in the export are metadata only (name, type, size, status) — confirm no file content, no signed URL, no direct storage path is present.

### Device & local data
L. With nothing pending, tap "Clear data from this device" — a plain confirmation appears; confirming signs you out.
M. Sign back in — all your care space data reappears correctly, rebuilt from the cloud.
N. Create a pending situation first (e.g. add a document and immediately go offline before it finishes uploading, or make an edit while offline) — now tap "Clear data from this device" — the warning specifically names that something is still in progress before you can confirm.
O. Cancel out of that warning — nothing is cleared, the pending work is untouched and still completes normally once you proceed normally.

### Leave a care space
P. As a contributor or viewer (not organiser) of a care space — Privacy & data shows a "Leave [space name]" option; confirming removes you from that care space and returns you to your remaining space(s)/onboarding as appropriate.
Q. As that same care space's organiser — confirm the Leave option is not offered at all on this screen.
R. After leaving, confirm on a second device/account (if practical) that the organiser can see you've left (Care Circle member list) and that you can no longer open anything from that care space.

### Delete account (superseded by Phase 18B below — kept for the precheck-only behaviour it still shares)
S. Tap "Delete account" as the sole organiser of at least one care space — a message names exactly which care space(s) currently block deletion, and the real "Delete my account" button is not offered.
T. See Phase 18B section below for the now-real deletion flow once the precheck clears.
U. Confirm the precheck itself never deletes the auth account, the profile, or any care-space data — only the confirmed final action (Phase 18B, below) does.

### Regression
V. Sign out (existing Account control) still works exactly as before and is visibly distinct from Clear-data and Delete-account.
W. Existing Care Circle screen (permissions/roles/invites) is unaffected — Privacy & data does not duplicate or interfere with it.
X. Every other Phase 16/17 document behaviour (add/view/link/task/upload/delete) still works unchanged — deleting a record still enqueues and completes cloud cleanup (confirm via a second device or reinstall that a deleted document's attachment/link rows are actually gone, not just hidden).
Y. Kill the app immediately after deleting a document, before cleanup can finish, then relaunch — confirm cleanup resumes and completes rather than being stranded (this is the new durable retry queue; a hang or a permanently-orphaned cloud file is a failure).

### Layout
Z. Android and iPhone: Privacy & data screen scrolls correctly, safe-area/keyboard behaviour on the name-edit field, long care-space names don't break the Leave/Delete rows, accessibility text scaling.

Do not claim any of the above passed until the product owner has actually tested it.

## Phase 18B — Account Deletion (requires TWO genuine Supabase accounts)

Set up exactly as the brief's own scenario: **David** (organiser of Beauty) and **Sarah** (a second organiser of Beauty, promoted via Care Circle). Give Beauty an appointment, a task, a document, a document linked to a task, and an assignment to David before starting.

AA. As David, sole organiser of Beauty: Settings → Privacy & data → Delete account → the blocker names Beauty specifically, and no "Delete my account" button appears.
AB. Promote Sarah to organiser (Care Circle → change role). As David again: Delete account → precheck now clears, and a real "Delete my account" destructive confirmation appears (naming what will happen, that it cannot be undone).
AC. Cancel out of that confirmation — nothing happens, David's account and access are completely unaffected.
AD. Confirm deletion for real. Expect: a real success message, then an automatic sign-out on David's device.
AE. Attempt to sign back in as David on any device — confirm it is genuinely refused (the account no longer exists).
AF. As Sarah (a different device/account): confirm Beauty, the appointment, the task, the document, the document/task link, and the historical activity are ALL still present and openable, exactly as before.
AG. As Sarah: confirm the assignment David held is still shown as his (a truthful "no longer available"/former-member state is acceptable; it must NOT silently show as Sarah's, the organiser's, or "Unassigned").
AH. Confirm no other care space either of them belongs to was affected.
AI. Repeat with David as a SOLE organiser (a different, throwaway care space) to re-confirm AA's block still applies cleanly with no other organisers in play.
AJ. Kill the app immediately after tapping "Delete my account" but before its result returns, then relaunch — confirm there is no ambiguous "half-deleted" state: either it completed (retry-safe, confirmed idempotent server-side) or it plainly didn't, never local data cleared without server confirmation.
AK. While offline, attempt Delete account — confirm it is refused/fails cleanly rather than being queued for later.

## Phase 18B — Complete Data Export (real document files)

Set up: **Beauty** (organiser access, containing an appointment, a bill, a PDF document, and a document linked to a task) and **Jackie** (a second, restricted-viewer-only care space for the same account, containing one permitted general record and one restricted financial/document record).

AL. Export your data → the resulting file list includes `data.json` plus one entry per authorised document (labelled by care space).
AM. Tap Share on `data.json` → open it → confirm it's valid JSON describing both care spaces, with each included attachment carrying `exportPath`/`fileAvailable` and no `storageObjectPath`/signed URL/token anywhere in it.
AN. Tap Share on the PDF entry → confirm it actually opens as the real document, not a placeholder.
AO. Confirm Jackie's restricted financial/document record — and any document/link only visible through it — is completely absent from both the file list and `data.json` (no id, no metadata, no hidden link target).
AP. If any legacy document has no cloud file available, confirm it's honestly marked (`fileAvailable: false`) and the export still completes for everything else — no crash, no fabricated file.
AQ. Two documents with the same filename in the same care space — confirm both are included as distinct files, safely renamed.
AR. iPhone and Android: confirm the Share sheet works for both `data.json` and at least one document on each platform.

## Phase 18B — Settings Drawer Regression (must still be true)

AS. From every one of Home/Calendar/To Do/People: open Settings → Privacy & data → Export your data (or Delete account's precheck) → back → Settings root → close → confirm you're back on the exact same tab/person/state you started from.
AT. Settings → Account → back → Care Circle → back → Privacy & data → back → close, from any tab — confirm Settings never turns into an ordinary full-screen route at any point, exactly as the originally-approved drawer behaves.

Do not claim any of the above passed until the product owner has actually tested it.
