# Phase 18: Privacy, Settings, Export & Account Lifecycle

Date: 12 September 2026. Status: **implemented and validated for everything safely achievable today. Full auth-identity ("Delete account" for real) deletion is explicitly NOT implemented — a genuine, investigated architectural blocker, reported below rather than worked around. Not committed/pushed — awaiting product-owner review and physical QA, per the brief's own instruction.**

## The One Load-Bearing Finding

Before writing any UI, the schema was inspected (brief section 31's own instruction) to see what happens if `auth.users` is deleted:

```
care_space_memberships.user_id references auth.users(id) on delete restrict
```

...and `care_space_memberships` rows are themselves permanently `on delete restrict`-referenced from `records.created_by_membership_id`/`updated_by_membership_id`, `occurrences`, `assignments`, `record_links.created_by_membership_id`, `record_attachments.created_by_membership_id`, and every mutation-receipt table — **by design**, to preserve historical attribution (this is Phase 7's own stated goal, carried through every phase since).

**Consequence: `auth.users` cannot be deleted today without either (a) a foreign-key violation, or (b) first destroying every membership row that references it — which would cascade into destroying the historical attribution on every record, occurrence, link and attachment that membership ever touched.** Both outcomes are explicitly forbidden by this same brief (sections 27, 31, 36: "do NOT automatically erase Maggie's care record", "STOP and report the required lifecycle design rather than using destructive cascade").

Per section 31's own explicit instruction, this investigation stops there rather than forcing a workaround. **Real account deletion needs its own, separately-approved schema change** — the smallest correct shape is likely decoupling `care_space_memberships.user_id` from a hard FK (e.g. `on delete set null` plus a captured display-name/email snapshot at membership-creation time for historical display), so a membership row — and everything historically attributed to it — can outlive the auth identity it once pointed to. That is a deliberate identity-model change, not a Phase 18-sized correction, and is not made here without explicit sign-off.

**What this phase ships instead, honestly:** a real, safe, read-only precheck (`account_deletion_precheck()`) that tells the user exactly what would block deletion (being a care space's sole organiser) — genuinely useful today, and the correct first step regardless of how the identity-deletion question is eventually resolved. The "Delete account" entry point calls it, and is honest that deletion itself isn't available yet rather than pretending to succeed (brief section 43: never show something as functioning that isn't).

## 1. Closing the Phase 17 Document-Cleanup Gap

**New `src/documentCleanupQueue.ts`** — the smallest durable mechanism, not a job system. An AsyncStorage-backed queue keyed by owner id (same pattern as `src/recordSync.ts`'s own cache):

- `enqueueDocumentCleanup(ownerId, record)` — called and **awaited** as the literal first step of `App.tsx`'s `removeRecord()`, before any network attempt. A durable write, so an app kill or offline delete can never forget this record still owes cloud cleanup. Idempotent (re-enqueuing the same record id is a no-op).
- `retryPendingDocumentCleanup(ownerId)` — attempts each queued entry: removes the Storage object (skipped if the attachment never actually uploaded), tombstones its `record_attachments` row, tombstones all of the record's `record_links` (via Phase 17's `removeAllLinksForRecord`). An entry is cleared from the queue only once genuinely successful; a failure leaves it queued. Every underlying operation was already idempotent server-side (Phase 16/17), so a repeated retry converges, never duplicates or corrupts anything.
- Retried at the same two lifecycle points `App.tsx` already uses for upload retry: app startup once authenticated, and every care-space-records reconciliation pass — no new background daemon.
- `hasPendingDocumentCleanup(ownerId)` — used by "Clear data from this device" to warn before discarding a queue entry that hasn't finished yet.

`App.tsx`'s `removeRecord()` no longer calls `cleanupDocumentAttachments`/`removeAllLinksForRecord` directly (Phase 17's best-effort fire-and-forget) — it now awaits `enqueueDocumentCleanup` first, then attempts `retryPendingDocumentCleanup` immediately as today's best chance to finish it right away.

**Care-space isolation and authorisation**: unchanged from Phase 16/17 — every operation the queue retries goes through the exact same RLS-protected RPCs (`remove_record_attachment`, `remove_record_link`) that already refuse a caller without write access to that record's domain, or belonging to a different care space. The queue itself holds no elevated privilege; it is just a durable reminder to retry a call the authenticated user could already make.

## 2. Settings Information Architecture

No second settings system. `src/components/SettingsMenu.tsx` (the existing shared modal) gained one new entry, **Privacy & data**, alongside the existing Account and Care Circle entries — opening a new `src/screens/PrivacyDataScreen.tsx`.

- **Account** (existing `AccountScreen.tsx`, unchanged destination) now also lets the organiser edit their own display name inline, reusing `AuthProvider`'s existing `saveProfile()` — the exact same function onboarding's "About you" step already calls, so there remains only one place that ever writes `profiles.display_name`. Never touches a supported person's own identity (a separate table, `supported_people`, never written by this).
- **Notifications**: unchanged — already lives inside Account (Phase 14), not duplicated.
- **Privacy & data** (new `PrivacyDataScreen.tsx`): What Lilica stores (static, plain-language copy — not a legal document; no formal Privacy Policy/Terms exist in this repository, so none is fabricated, per section 9's own instruction), Export your data, Device & local data (explainer + Clear data action), a **Care spaces** section (current care space + role, with Leave offered only when the signed-in member is not that space's organiser), and Delete account (precheck + honest current-limitation message).
- **Care Circle**: unchanged existing destination for organisers managing who else has access — Privacy & Data does not duplicate its permissions editor, only reads the current space/role for its own Leave action.
- **About / Sign out**: not added this pass — Sign out already lives in Account (unchanged); a dedicated About screen was judged non-essential scope for this phase and is named here as a small, deliberate scope reduction rather than silently skipped.

**Settings navigation correction (12 September 2026, `Downloads\settings.txt`):** the first version of this drawer opened Account/Care Circle/Privacy & data as separate top-level screens that replaced whichever tab was showing, so leaving one landed the user back on the dashboard instead of back in Settings, and a physically-tested revision after that (an anchored dropdown card) was rejected for the same underlying reason. **Settings is now a right-hand application drawer with its own internal navigation hierarchy. Settings subsections render within the drawer and do not become ordinary application screens.** `src/components/SettingsMenu.tsx` owns a `section: 'menu' | 'account' | 'careCircle' | 'privacyData'` prop (state lives in `App.tsx` as `settingsSection`) and slides in from the right at ~88% of screen width; a menu row switches the drawer's own body to that screen's real, unmodified component (`AccountScreen`/`CareCircleScreen`/`PrivacyDataScreen`, unchanged Phase 15/18 business logic) with its `onBack` now pointed at `setSettingsSection('menu')` instead of exiting; only the drawer's own Close (or the dimmed backdrop) calls `onClose`, which also resets the section so the next open starts at the menu root. The underlying tab (Home/Calendar/To Do/People) is never unmounted or replaced while the drawer is open, and closing it restores exactly the tab/person/state that was showing before. People's own direct "Manage care circle" link (independent of the Settings cog) is deliberately unchanged — still a full top-level screen, since that entry point was never part of this complaint.

## 3. Profile / Email / Password

- **Display name**: real, wired to `saveProfile()` (above).
- **Email change**: inspected — Supabase's auth flow doesn't currently have a wired "change email + reverify" path in this app, and building one is genuinely new auth-flow surface (its own verification screens, its own error states) rather than a small addition. **Not implemented this phase; reported per section 7's own instruction rather than faked.**
- **Password change**: the existing password-recovery architecture (`docs/PHASE_5...` era screens) already lets a signed-out user reset their password by email. A signed-in "Change password" control inside Settings was judged the same category of new-surface work as email change, and was also not added this pass for the same reason — reported, not faked.

## 4. Data Export

**New migration `20260912150000_phase18_privacy_export.sql`**, `export_my_data()`: a single `security definer`, `stable` (read-only) function returning one `jsonb` document —

```
{
  "generatedAt": "...",
  "profile": { "display_name": "...", ... },
  "careSpaces": [
    {
      "careSpaceName": "...",
      "yourRole": "organiser" | "contributor" | "viewer",
      "yourGrantedDomains": [...],
      "records": [...],
      "attachments": [...],   // metadata only -- see below
      "recordLinks": [...]
    }
  ]
}
```

Every array is filtered through `membership_has_domain_access()` — the **exact same** function every ordinary read already goes through, never a second permission system. A `record_links` entry is included only when **both** its source and target pass that check individually for the caller's own membership, exactly mirroring `record_links`' own read RLS policy — so a restricted target's id/title/existence never leaks through export (proven by pgTAP, see below).

**Client** (`src/accountLifecycle.ts`'s `exportMyData()`): calls the RPC, writes the JSON to a local file (`expo-file-system`), then hands it to the native share/save sheet (`expo-sharing`) — the file exists only on the requesting device, generated fresh from the caller's own current permissions each time. No Storage bucket, no signed URL, no server-generated file, no durable server-side artifact to clean up — this sidesteps essentially all of section 15's storage-security concerns by construction rather than needing a cleanup mechanism.

**What's NOT in export, explicitly**: actual document file bytes (metadata only — `id`, `recordId`, `displayName`, `mimeType`, `sizeBytes`, `uploadStatus`, `createdAt`, never `storageObjectPath`, never a signed URL); activity/history (no activity-log table exists yet in this schema to export from); auth tokens, service keys, credentials (never touched by this function at all). Bundling actual file bytes into the export package was judged a materially larger feature (downloading every authorised file, packaging a multi-file archive, sharing it as one bundle) and is named here as a deliberate scope reduction, not silently dropped.

**Export activity/audit** (section 16): not recorded — no activity-log table exists in the current schema to record it in. Named as a gap rather than fabricated.

## 5. Local Data

**New `src/localData.ts`**:

- `hasUnuploadedAttachment(records)` — pure, shared with `App.tsx`'s existing upload-retry effect so "what counts as a pending upload" never has two competing definitions.
- `pendingLocalWork(ownerId, records)` — reads the record cache's outbox (pending mutations), checks for unuploaded attachments, and checks the new cleanup queue (pending cleanup) — the exact three things section 19 asks to inspect before clearing.
- `clearLocalDataForOwner(ownerId)` — removes only this owner's AsyncStorage keys (onboarding state, record cache, the cleanup queue) and this device's local attachment directories (captured/scanned originals, downloaded-document preview cache). Never touches Supabase.

**`PrivacyDataScreen`'s "Clear data from this device"**: always requires confirmation (`Alert.alert`); if `pendingLocalWork` reports anything pending, the warning names exactly what ("a document file that hasn't finished uploading yet", etc.) before the user can proceed — never a silent destructive clear. After confirmed clearing, the app **signs the user out** (`App.tsx`'s new `handlePrivacyClearLocalData`) rather than attempting a risky live rebuild of in-memory state from a cache that was just wiped out from under it — signing back in reconstructs everything fresh from the cloud, exactly as a genuinely fresh device would. This is a deliberate, safety-first simplification, named here rather than left implicit.

## 6. Sign Out vs Clear Local Data vs Delete Account

Kept as three genuinely distinct actions (section 17/45), never conflated:
- **Sign out** (`AccountScreen`, unchanged): ends the session; local cache survives for a fast next sign-in as the same user.
- **Clear data from this device** (`PrivacyDataScreen`, new): removes local cache/files, then signs out (see above) so the next sign-in rebuilds cleanly. Never touches cloud data.
- **Delete account** (`PrivacyDataScreen`, new): the precheck only — see the load-bearing finding above. Genuinely destructive identity removal is not implemented.

## 7. Leave a Care Space

Wires the existing, already-implemented-but-never-called Phase 15 `leave_care_space()` RPC (`src/careCircle.ts`'s `leaveCareSpace`) into real UI for the first time. Offered only when the signed-in member is **not** that space's organiser (an organiser leaving is the sole-organiser-safety case below, and the existing RPC already refuses it regardless — this UI simply doesn't offer the button to an organiser in the first place, since Care Circle's own role-change/removal flow is the correct route there). After a successful leave, `App.tsx` re-runs the exact same care-space reconciliation (`reconnectCareSpaces()`/`integrateReconnectedCareSpaces()`) already used after accepting an invitation — the left space simply doesn't come back.

## 8. Sole-Organiser Safety

Already enforced server-side, unchanged, by Phase 15's `leave_care_space()`/`remove_member()` (both refuse to drop a care space below one active organiser). This phase adds the READ-side equivalent for account deletion specifically: `account_deletion_precheck()` reuses the identical "count active organisers" logic, so the UI can tell a user which named care spaces block them **before** they'd ever attempt anything destructive.

## 9. Care-Space Deletion

Inspected, not implemented. No existing lifecycle policy for deleting a `care_spaces` row exists anywhere in this schema (every current cascade path is `on delete restrict`, matching every other "preserve history" boundary already documented in this codebase). Per section 25's own instruction, this is reported rather than improvised — a "Delete Beauty" action would need its own, separately-approved design (what happens to its records, documents, memberships, and the supported person it represents) before any button for it should exist.

## 10. Billing

Not implemented, not referenced in any code path. Recorded here, as instructed, as **future approved commercial direction only**: new users receive full Lilica access for one month; continued use thereafter is intended to cost £9.99 per year. No subscription, paywall, purchase, entitlement, or billing screen exists anywhere in this change.

## Testing

- **Database**: `supabase/tests/database/phase18_privacy_export.test.sql` — 17 new pgTAP assertions (245 total across 8 files, zero regressions): sole-organiser precheck blocking/unblocking, an organiser-of-nothing gets an empty precheck, export scoped to exactly the caller's own active memberships, an organiser sees every domain's records/attachments/links, a domain-restricted viewer sees only their granted domain (no financial bill, no attachment metadata, no record link — since neither endpoint of that link is visible to her), no auth-token field ever present, a pending (unaccepted) invitee exports nothing.
- **Client**: `tests/phase18-document-cleanup-queue.test.ts` (8 — enqueue idempotency, durable-before-network-attempt, successful cleanup clears the queue, a failure leaves it queued for the next retry, a never-uploaded attachment skips Storage removal but still tombstones metadata/links, empty-queue no-op), `tests/phase18-account-lifecycle.test.ts` (8 — precheck filtering, export writes-then-shares a local file and never uploads it anywhere, graceful failure on RPC/sharing errors), `tests/phase18-local-data.test.ts` (9 — the shared unuploaded-attachment predicate, pending-work detection across all three categories, clearing removes only the target owner's keys/directories and never throws), `tests/phase18-privacy-data-screen.test.tsx` (8 — every button calls a real function, destructive actions require confirmation, pending-work warnings are specific, Leave is hidden for an organiser, Delete account is honest about its current limitation). Total new: 42 tests across 5 files (1 extended: none — all new files this phase, since Phase 18 introduced entirely new client modules).

## Hosted `lilica-development`

Applied. `npx supabase db push --linked --dry-run` confirmed exactly one pending migration (`20260912150000_phase18_privacy_export.sql`) with no unrelated diff; applied; migration histories verified matching; 245 pgTAP assertions and clean lint re-run against the linked database. See `docs/SUPABASE_OPERATIONS.md`'s "Hosted Phase 18 deployment" entry (which also retroactively records Phase 16/17's own hosted deployment, missed at the time).

## Known Limitations (as of Phase 18A — superseded where noted)

- ~~Real account (auth identity) deletion is not implemented~~ — **implemented in Phase 18B, see below.**
- Email change and in-app password change are not implemented (sections 7/8) — reported, not faked. Still true after 18B; out of that phase's scope too.
- ~~Export does not include actual document file bytes~~ — **implemented in Phase 18B, see below.** Activity/history export is still not included (no activity-log table exists yet).
- No About screen was added this pass. Still true.
- The document-cleanup queue and local-data clearing are per-device, per-owner — they do not (and cannot) reach into a different device's own local queue/cache. Still true.
- Care-space deletion has no implementation or UI — reported, not improvised. Still true after 18B; out of scope for it too (brief section 0 explicitly excludes it).

---

# Phase 18B: Account Deletion & Complete Data Export

Date: 12 September 2026 (`Downloads\18b.txt`). Status: **implemented and validated. Not committed/pushed — awaiting product-owner review, physical QA and two-account QA, per the brief's own instruction.**

## The Second Blocker Phase 18A Missed

Phase 18A's investigation found one `on delete restrict` reference from `care_space_memberships.user_id` to `auth.users(id)`. It missed a second, separate one: `care_spaces.bootstrap_owner_id` **also** `references auth.users(id) on delete restrict` — a Phase 6 idempotency marker ("Idempotency metadata only; access is granted exclusively through membership", per its own existing comment), not itself a security boundary, but still a hard FK that blocks `delete from auth.users` for anyone who ever bootstrapped a care space (i.e. every organiser who created one). This was found the way it should be — a failing pgTAP assertion (`update or delete on table "users" violates foreign key constraint "care_spaces_bootstrap_owner_id_fkey"`) during this phase's own test-writing, not discovered later. Both references are now handled by the same detach-not-delete treatment.

## Live Identity vs Historical Membership Identity

The core design, per the brief's own accepted product principle: **a Lilica account and a Lilica care-circle membership are not the same thing.** The authenticated account is temporary; historical care activity must be able to survive it.

- `care_space_memberships.id` — the stable historical identity every other table's foreign keys already point at — is **never** deleted or regenerated by account deletion. Nothing about this changed.
- `care_space_memberships.user_id` — previously `not null` — is now **nullable**. It holds the live auth identity while one exists, and becomes `null` the moment that identity deletes their account.
- `care_space_memberships.former_display_name` (new column) — a minimal, human-readable snapshot ("David M"), captured **only** at the moment of detachment, **never** an email or login identity (data minimisation, brief section 6). Null while the membership is live.
- `care_space_memberships.membership_status` gains a third value, `'former'`, alongside the existing `'active'`/`'revoked'`. Because **every** existing access decision in this schema (`can_access_care_space_records()`, `membership_has_domain_access()`, and every RLS policy built on them) already requires `membership_status = 'active'`, a former membership is denied access everywhere, automatically — **zero new RLS logic was needed for this** (brief section 44).
- `care_spaces.bootstrap_owner_id` also becomes nullable and is nulled the same way, for the same reason (see above).
- `protect_membership_identity()` (the trigger making `care_space_id`/`user_id`/`bootstrap_id` immutable, extended once already in Phase 15 to allow `role` changes) is extended again to allow **exactly one** new transition: a live `user_id` detaching to `null`. It still refuses reassignment to a different live user, and refuses ever re-attaching a detached membership to any live identity again — both proven directly in pgTAP, independent of `delete_my_account()` itself.

## `delete_my_account()`

A single `security definer` Postgres function, the narrowest secure mechanism available given this project has no separate Edge Function/service-role backend (a mobile client talking directly to Supabase) — this is the standard, established pattern for self-serve account deletion in exactly that architecture. Alternative considered and rejected: a Supabase Edge Function holding a service-role key — rejected as unnecessary extra infrastructure (a new deployable, a new secret to manage) when a `security definer` function already gives the same authority scoped to exactly one operation, with no client ever seeing a privileged credential.

Sequence (exact, as implemented):

1. Derive the target **exclusively** from `auth.uid()` — never a caller-supplied id, so a caller can only ever delete themselves.
2. Idempotency check: if this identity no longer exists in `auth.users` (a retried call after a prior successful deletion, or the response was lost), return successfully as a safe no-op — nothing is redone, nothing is duplicated.
3. Re-run the sole-organiser safety check **server-side**, from scratch — never trusts a client-side `account_deletion_precheck()` call alone. Refuses with a plain-language message naming the specific care space if the caller is any space's only active organiser.
4. Snapshot every membership the caller holds (their current profile display name, or "Former member" if none), detach `user_id` to null, mark `membership_status = 'former'` — all in one statement, care_space_memberships.id untouched.
5. Detach `care_spaces.bootstrap_owner_id` the same way for any space the caller originally bootstrapped.
6. Revoke the caller's own still-**pending** *sent* invitations (`status = 'revoked'`) — an already-accepted membership (now former, step 4) and invitations created by other organisers are both left untouched.
7. Delete the `auth.users` row. `profiles.id references auth.users(id) on delete cascade` (Phase 5) already removes the live profile row as a consequence — not duplicated here.

No server-side device-registration or push-notification table exists in this schema at all (Phase 14's reminders are local-device-only by design — see `docs/PHASE_14_ARCHITECTURE.md`), so there was nothing further to revoke server-side for "device registrations"/"reminders" (brief sections 22/23); the client clears its own local reminder/notification state as part of its existing local-data cleanup after this call succeeds.

## Sole-Organiser Protection / Multi-Organiser Behaviour

Identical rule and identical underlying check to `account_deletion_precheck()` (Phase 18A) and `leave_care_space()`/`remove_member()` (Phase 15): a care space may never drop below one active organiser. `delete_my_account()` re-runs this itself rather than trusting the client. If a second active organiser already exists in every space the caller organises, deletion proceeds and that space, its records, documents, links and history are all completely untouched — the departing organiser simply loses all future access.

## Assignments, Records, Occurrences, Documents, Links, Attachments — All Survive Unmodified

None of these tables reference `user_id` — they all reference `care_space_memberships.id`, which is never deleted or regenerated. `delete_my_account()` never touches `records`, `occurrences`, `assignments`, `record_links`, `record_attachments`, or `recurrence_series`/`recurrence_rules` at all. Proven directly in pgTAP: a record, a link, an attachment and an assignment all created/attributed to the deleting user are asserted to survive, still pointing at that (now-former) membership id, with the assignment's own `display_name_snapshot` (an existing Phase 8 field, unrelated to this phase, that already captured a name at assignment-time) untouched. **Work is never silently reassigned** — the assignment still names the former membership; nothing promotes it to the remaining organiser or to "Unassigned".

## Truthful Historical Display: `resolve_membership_identities()`

A second, small, new, read-only function: given a set of membership ids the caller already encountered in their own authorised data (an assignee, a document's creator), resolves each to a truthful display name — the live name if still active, or the historical snapshot (with `is_former = true`) if detached — scoped to memberships in a care space the caller is themselves an active member of. This is what lets a surface show "David M · Former member" instead of silently rendering nothing once a membership drops off the active member list.

**Wired into `RecordDetail.tsx`/`ToDoScreen.tsx`'s existing `assignmentLabel()`**: previously, an assignee not found in `careCircleMembers` (which only ever lists active members) silently resolved to `undefined`, rendering nothing at all. It now returns the honest fallback "Assignee no longer available" instead. **Not yet wired to call `resolve_membership_identities()` for the fuller "David M · Former member" treatment** — a deliberate, named scope reduction given this phase's size: the server capability exists and is tested, but threading it through every surface that shows an assignee/creator (RecordDetail, ToDoScreen, and any future "added by" display) was judged more than this pass should add on top of everything else in it.

## Failure Handling / Idempotency

Supabase Auth sits across a boundary that prevents one perfect all-or-nothing transaction spanning both `auth.users` and every downstream effect through a single client round-trip guarantee — but every individual write `delete_my_account()` makes (the membership detach/snapshot update, the invitation revocation, the `auth.users` delete) runs inside the SAME Postgres transaction the function itself executes in, so from the database's own perspective it either all commits or all rolls back; there is no state where membership snapshots exist but the account wasn't actually deleted, or vice versa. What Postgres cannot guarantee across a network is the CLIENT learning the outcome — hence idempotency: a retried call against an identity already gone is a safe, silent no-op (proven in pgTAP), never a duplicate snapshot, never a second revocation pass, never an error.

**Client-side order (brief sections 24/27)**: account deletion requires network access and is never queued for later — there is no "delete when back online" path. The client calls `delete_my_account()` and waits for its result; only on genuine server success does it proceed to clear local device state and sign out (reusing the exact same `clearLocalDataForOwner()` used by "Clear data from this device" — see `src/localData.ts`). A failed server call leaves local data completely untouched, so nothing is ever lost to a deletion attempt that didn't actually happen.

## Delete Account UX

Still entirely inside the existing, physically-approved Settings drawer (`Privacy & data → Delete account`) — this phase did not touch the drawer itself in any way. Flow: tap "Delete account" → real precheck (`checkAccountDeletionEligibility()`, unchanged from 18A) → if blocked, names the care space(s) and the real "Delete my account" button is never offered → if clear, a genuine destructive `Alert.alert` confirmation appears, naming exactly what will happen → on confirmation, `deleteMyAccount()` is called for real → on success, sign-out and local cleanup follow automatically; on failure, the real error is shown and nothing local is touched.

## Complete Data Export: Actual Document Files

`export_my_data()` (the Phase 18A RPC) is **completely unchanged** — no new server-side export logic was needed. Every attachment entry it already returns is metadata-only (id, display name, mime type, upload status — never a storage path or signed URL), already filtered through the same domain-grant check every other read uses. Phase 18B's own work is entirely **client-side** (`src/accountLifecycle.ts`): for each attachment the export includes, the client separately queries `record_attachments` directly (its own SELECT RLS already scopes this to exactly what `export_my_data()` itself just authorised — no new permission surface) for that one attachment's `storage_object_path`, then downloads the actual current file via a short-lived signed URL (the same private-bucket mechanism "View document" already uses) — **always the authoritative current cloud copy, never a possibly-stale local device copy** (brief section 30's own instruction).

**No `.zip` archive**: the brief's own preferred shape was a single `Lilica-export-YYYY-MM-DD.zip`. No zip library exists in this project, and the brief's own section 38 explicitly requires stopping for approval before adding one. Given that choice, **the product owner chose not to add a new dependency** — export instead produces `data.json` plus one downloaded file per authorised, available document, organised into the same `documents/<care space>/<safe filename>` folder structure the brief describes, and offers **each file individually** through the native share sheet (PrivacyDataScreen lists every produced file with its own "Share" action) rather than one combined archive. This is a real, deliberate, product-approved scope reduction, not a silent gap — named here plainly. Filenames are sanitised and deterministically de-duplicated (`letter.pdf`, `letter (2).pdf`, ...) so two documents that would otherwise collide both survive.

`data.json` gains, per included attachment: `exportPath` (e.g. `"documents/Beauty/Hospital letter.pdf"`, matching where its bytes actually live in this export session) and `fileAvailable` (`true`/`false`). A legacy attachment that never finished uploading, or whose signed-URL download fails for any reason, is marked `fileAvailable: false` rather than aborting the whole export or fabricating bytes (section 37) — and the export screen tells the user honestly how many documents, if any, could not be included. **Never written anywhere**: `storageObjectPath`, a signed URL, an auth token, or any credential (verified directly in tests — the written `data.json` is asserted not to carry a `storageObjectPath` field).

**Permission filtering happens before packaging, at two independent layers**: `export_my_data()`'s own domain-grant filter decides which attachment metadata rows even appear in the export in the first place (a restricted document's metadata, and therefore its id, never reaches the client at all); the Storage bucket's own RLS policy (Phase 16, unchanged) independently re-checks the SAME domain-grant decision before ever serving a byte, so there is no path where a forbidden file's bytes could be fetched even if the metadata filter were ever wrong. A multi-care-space export (e.g. organiser of Beauty, restricted viewer of Jackie) is authorised entirely per-space by the existing per-membership domain grants — no organiser role is ever treated as a global authority across spaces the caller doesn't organise.

## Testing

- **Database**: `supabase/tests/database/phase18b_account_deletion.test.sql` — 29 new pgTAP assertions (274 total across 9 files, up from 245/8, zero regressions): unauthenticated/permission-denied rejection; sole-organiser block naming the space, leaving the membership untouched; an account with no care spaces at all deletes freely; a second organiser unblocks deletion; the deleted identity's `auth.users` row and cascaded `profiles` row are genuinely gone; the membership survives with its id unchanged, detached (`user_id` null), marked `former`, carrying the real snapshot; the caller's own still-pending sent invitation is revoked while an already-accepted one is untouched; the shared record/link/attachment/assignment all survive, still attributed to the now-former membership, with the assignment's historical snapshot untouched; the remaining organiser still sees everything; `resolve_membership_identities()` returns the correct snapshot and `is_former` flag for both a former and a live membership; a retry against an already-deleted identity is a safe no-op that doesn't duplicate anything; the trigger refuses both reattaching a detached membership and reassigning a live one to someone else.
- **Client**: `tests/phase18-account-lifecycle.test.ts` extended (+11: `deleteMyAccount` success/blocker-message-passthrough/generic-failure; `exportMyData` now covers downloading an authorised uploaded document into the file list and `data.json`'s `exportPath`/`fileAvailable`, always re-fetching from the current cloud copy rather than trusting a stale local one, skipping a never-uploaded legacy attachment without aborting, surviving one document's download failure without failing the rest, de-duplicating a same-named collision safely; `shareExportFile` success/unavailable). `tests/phase18-privacy-data-screen.test.tsx` extended (+7: the real per-file Share list and skipped-document count render; Delete account's real final confirmation is offered only once the precheck genuinely clears, never while blocked; a confirmed deletion calls the real `deleteMyAccount()` then `onAccountDeleted()`; a failed deletion shows the real error and never calls `onAccountDeleted()`). `tests/record-detail.test.tsx`/`tests/todo-card-hierarchy.test.tsx` each gained one test proving the new "Assignee no longer available" fallback.
- **Regression**: full existing suite re-run — 44 suites / 450 tests passing (up from 44/436 pre-Phase-18B), zero weakened or removed assertions. `tests/settings-navigation.test.tsx` (unchanged) continues to prove the Settings drawer's internal-navigation behaviour is untouched — Delete account's new real flow lives inside the exact same `PrivacyDataScreen` the drawer already hosted, so no new drawer-specific test was needed to prove non-regression there.

## Hosted `lilica-development`

Applied. `npx supabase db push --linked --dry-run` confirmed exactly one pending migration (`20260912170000_phase18b_account_deletion.sql`) with no unrelated diff; applied; migration histories verified matching; 274 pgTAP assertions and clean lint re-run against the linked database. See `docs/SUPABASE_OPERATIONS.md`'s "Hosted Phase 18B deployment" entry.

## Explicitly Out of Scope / Not Started (per the brief's own section 0)

Settings drawer redesign, Home/Calendar/To Do/People redesign, onboarding changes, the self/someone-else fork, billing/trial/paywall, OCR, Ask Lilica expansion, global search, and whole-care-space deletion — none of these were touched, discussed, or begun.

## Known Limitations (Phase 18B, explicit, not silent)

- No `.zip` archive — see "Complete Data Export" above; a deliberate, product-approved substitution (share each file individually) rather than adding a new dependency.
- `resolve_membership_identities()` is implemented and tested server-side but only its safety-net fallback ("Assignee no longer available") is wired into the client today, not the fuller "David M · Former member" historical-name treatment the brief's own examples show — a named scope reduction.
- Email change, in-app password change, an About screen, and care-space deletion remain not implemented — all previously named in Phase 18A, unaffected by this phase, out of its scope too.
- Legal/retention questions (data-retention periods, GDPR conclusions, supported-person legal authority) are deliberately not addressed — no legal claims are made anywhere in this implementation, per the brief's own instruction not to invent them.
