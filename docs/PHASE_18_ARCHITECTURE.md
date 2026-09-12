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

## Known Limitations (explicit, not silent)

- **Real account (auth identity) deletion is not implemented** — see the load-bearing finding above. This is the single largest gap against the brief's own acceptance standard, and is a deliberate stop-and-report per section 31's own instruction, not an oversight.
- Email change and in-app password change are not implemented (sections 7/8) — reported, not faked.
- Export does not include actual document file bytes, nor activity/history (no activity-log table exists yet).
- No About screen was added this pass.
- The document-cleanup queue and local-data clearing are per-device, per-owner — they do not (and cannot) reach into a different device's own local queue/cache.
- Care-space deletion has no implementation or UI — reported, not improvised.
