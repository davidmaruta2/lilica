# Phase 18 QA — Privacy, Settings, Export & Account Lifecycle

Status: **implemented and automated-validated (12 September 2026). Nothing below has been physically tested; no item may be marked passed until the product owner actually performs it on a real device.** Not committed or pushed yet, per the brief's own instruction — see `docs/PHASE_18_ARCHITECTURE.md` for what was built, what was deliberately not built (real account/auth-identity deletion — a genuine schema blocker, reported not worked around), and why.

## Automated validation already performed (not a substitute for the checklist below)

- `npm run typecheck` — clean.
- `npm test` — 43 suites / 425 tests passing (up from 39/395 at Phase 17's committed head), zero regressions.
- `npm run secrets:check` — clean (206 files).
- `npm run db:reset && npm run db:test && npm run db:lint` — clean, 245 pgTAP assertions across 8 files (up from 228/7).
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

### Delete account
S. Tap "Delete account" as the sole organiser of at least one care space — a message names exactly which care space(s) currently block deletion.
T. Tap "Delete account" when you are not the sole organiser of anything (e.g. only a contributor/viewer everywhere, or a co-organiser) — a message honestly states that account deletion isn't available in this version yet (never a fake "your account has been deleted" confirmation).
U. Confirm no button on this screen ever actually deletes the auth account, the profile, or any care-space data.

### Regression
V. Sign out (existing Account control) still works exactly as before and is visibly distinct from Clear-data and Delete-account.
W. Existing Care Circle screen (permissions/roles/invites) is unaffected — Privacy & data does not duplicate or interfere with it.
X. Every other Phase 16/17 document behaviour (add/view/link/task/upload/delete) still works unchanged — deleting a record still enqueues and completes cloud cleanup (confirm via a second device or reinstall that a deleted document's attachment/link rows are actually gone, not just hidden).
Y. Kill the app immediately after deleting a document, before cleanup can finish, then relaunch — confirm cleanup resumes and completes rather than being stranded (this is the new durable retry queue; a hang or a permanently-orphaned cloud file is a failure).

### Layout
Z. Android and iPhone: Privacy & data screen scrolls correctly, safe-area/keyboard behaviour on the name-edit field, long care-space names don't break the Leave/Delete rows, accessibility text scaling.

Do not claim any of the above passed until the product owner has actually tested it.
