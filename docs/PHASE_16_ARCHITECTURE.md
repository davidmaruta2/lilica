# Phase 16: Document Maturity — Foundation

Date: 12 September 2026. Status: **the durable data/permission/transfer foundation is implemented, tested and validated. UI integration into RecordEditor/RecordDetail (the actual "Related to" picker, "Does anything need doing?" flow, and bidirectional detail display) is explicitly NOT part of this pass — deferred to Phase 17 by direct product-owner instruction.** This document describes exactly what exists today so an incoming agent can pick up Phase 17 without re-deriving any of it.

Implemented from `Downloads\card.txt` (the approved Phase 16 brief). Read `docs/PHASE_16_DOCUMENTS_INVESTIGATION.md` first — this phase builds directly on that investigation's findings, and this document assumes it.

## What Problem This Solves

An Important Document could be added but not reliably reopened, connected to the thing it relates to, acted upon, found on another device, or surfaced when relevant. This phase makes the data underneath a document genuinely durable, secure and linkable — the schema, permissions and file-transfer machinery a real "Related to" / "Does anything need doing?" / "View document" experience needs. Building that experience itself is Phase 17.

## Product Model (unchanged from the brief, now real)

- **RECORD** — the existing `LilicaRecord`. Unchanged.
- **DOCUMENT** — not a new entity; `type: 'document'`, one RECORD. Unchanged.
- **ATTACHMENT** — the file belonging to a record. Now has BOTH a local-device representation (unchanged local capture) AND a durable cloud representation (new this phase).
- **LINK** — a typed relationship between two canonical records. Newly persisted this phase (`record_links`), where before it was only a TypeScript shape (`src/domain/types.ts`'s `RecordLink`) exercised solely by `tests/domain-contract.test.ts`.
- **TASK** — the existing `type: 'task'` (or bill/homeMatter) RECORD. Unchanged; Phase 17 will create these through the existing, unmodified save path and link them to a document.
- **OCCURRENCE** — the existing Phase 8 projection. Not touched.
- **ASSIGNMENT** — the existing stable membership-based responsibility architecture. Not touched; a link and an assignment remain unrelated (a link never grants access, exactly per the brief's "Assignment does not grant visibility" rule).

## Database (`supabase/migrations/20260912100000_phase16_document_maturity.sql`)

### `record_links`

One row per relationship, stored once, queryable from either side. Columns: `id`, `care_space_id`, `source_record_id`, `target_record_id`, `link_type` (`'related_to' | 'action_for'` — the two vocabulary values the brief asked for at minimum; both already existed in `src/domain/types.ts`'s `RecordLink.type` enum, so no renaming was needed, just a narrower set actually implemented), `created_by_membership_id`, `created_at`, `deleted_at`. A partial unique index on `(source_record_id, target_record_id, link_type) where deleted_at is null` makes creation idempotent without needing a separate receipts table — a retried `create_record_link()` call returns the existing row rather than duplicating it.

RLS: no direct table writes (`insert`/`update`/`delete` policies deliberately absent) — every mutation goes through the security-definer RPCs below, exactly like `care_space_domain_grants`' own precedent. The one `select` policy requires the caller to currently have READ access to **both** the source's and the target's domain — this is the server-side enforcement of "must not discover the existence of a linked record you can't see": a contributor who can see a document but not the appointment domain it's linked to simply never receives that row, not a redacted one.

RPCs: `create_record_link(care_space_id, source, target, link_type)` (requires WRITE on source's domain, READ on target's domain; idempotent; rejects self-links, cross-care-space records, invalid types), `remove_record_link(link_id)` (tombstones; requires WRITE on the source's domain), `list_record_links(record_id)` (returns every OTHER record linked to/from the given one, each already filtered to what the caller may see, with a `direction: 'outgoing' | 'incoming'` computed relative to the record passed in — this is the ONE query that gives bidirectional presentation for free, since it's the same stored row read from either side).

### `record_attachments`

Durable, RLS-protected, cloud-side attachment metadata — distinct from (and complementary to) `records.attachment_manifest` (existing since Phase 7, unchanged). Columns: `id` (client-generated, matching `records.id`'s own stable-ID pattern — makes a retried upload idempotent), `care_space_id`, `record_id`, `kind`, `display_name`, `mime_type`, `size_bytes`, `storage_object_path` (unique), `upload_status` (`'pending' | 'uploaded' | 'failed'`), `created_by_membership_id`, `created_at`, `updated_at`, `deleted_at`.

RLS: `select` requires domain READ; no direct writes. RPCs: `upsert_record_attachment(...)` (requires domain WRITE; `insert ... on conflict (id) do update` makes a retried call converge, never duplicate), `mark_attachment_upload_status(id, status)` (requires domain WRITE; the only way `upload_status` ever becomes `'uploaded'` — never set optimistically before the byte transfer genuinely succeeds), `remove_record_attachment(id)` (tombstones; requires domain WRITE).

**Why both `record_attachments` and the existing `records.attachment_manifest` now exist side by side** (a deliberate "extend, don't replace" choice, per the brief's own instruction): `record_attachments` is the authoritative, independently-RLS-protected source of truth for cloud/upload state, with its own narrow mutation RPCs (so an "uploading..." status tick never has to go through the generic record outbox's conflict-merge machinery meant for user edits). `records.attachment_manifest` (and the client's `record.attachments`) remains the existing local-first convenience mirror — and since `recordPayload()` in `src/recordSync.ts` already spreads every field of an attachment except `uri` into that manifest, the new `storageObjectPath`/`uploadStatus` fields on `RecordAttachment` (see below) flow through the **existing, unmodified** sync mechanism with zero changes needed there.

### Storage: private `document-attachments` bucket

`insert into storage.buckets (...)` with `public = false`, 25 MB file size limit. Path convention: `{care_space_id}/{record_id}/{attachment_id}-{safe filename}` — stable IDs identify ownership; the filename suffix is for human readability only and is never itself a security boundary (RLS is). A new `storage_object_care_space_id(name)` helper parses the first path segment (via the built-in `storage.foldername()`) and casts it to a UUID; four `storage.objects` policies (select/insert/update/delete) all gate on `can_access_care_space_records(that_care_space_id, 'documents', read-or-write)` — the exact same domain-grant decision every record read/write already uses. No second authorisation system, no service-role key ever reaches the client.

### A real, previously-suspected-but-unproven fact, now literally tested

`docs/PHASE_15_ARCHITECTURE.md`'s addendum already established the organiser-only RLS concern was a false alarm generically. This phase's own pgTAP file (below) proves it specifically for the `documents` domain, per the brief's explicit ask, including a scenario the existing UI can't even produce yet (a domain grant with `can_read=true`/`can_write=false`) to prove the underlying primitive is correct independent of what today's invite UI happens to offer.

## Client

- **`src/recordLinks.ts`** — thin RPC wrapper (`listRecordLinks`, `createRecordLink`, `removeRecordLink`), following `src/careCircle.ts`'s exact `{ok, data|message}` pattern. `LinkedRecordSummary` is the shape a future RecordDetail "Related to"/"Documents" section would render directly.
- **`src/attachments.ts`** — the cloud upload/retrieval orchestration:
  - `attachmentStoragePath(careSpaceId, recordId, attachment)` — the deterministic path (pure function).
  - `queuePendingAttachmentUploads(careSpaceId, record)` — for a document record, uploads every attachment not yet marked `'uploaded'`: persists metadata via `upsert_record_attachment`, uploads the bytes (the local `File` object is passed directly to `supabase.storage.from(...).upload()`, since Expo's `File` implements `Blob`), then calls `mark_attachment_upload_status(...,'uploaded')` — only on genuine success. On any failure at any step, the attachment is left `'pending'` (never falsely marked uploaded) for a later retry. **Not yet wired to any caller** — see "What Phase 17 Still Needs" below.
  - `openAttachment(attachment)` — "View document": prefers this device's own local copy (checked via `File(...).exists`); otherwise requests a short-lived signed URL (the bucket is private — there is no permanent public URL), downloads it to a scratch cache directory, then hands it to the native share/open sheet via the newly-added `expo-sharing` dependency (`Sharing.shareAsync`) — the established, no-custom-renderer mechanism the brief asked for. Every failure mode (missing local copy, cloud-only file not yet uploaded, download failure, sharing unavailable) resolves to a friendly `{ok:false, message}`, never a throw. **Not yet wired to any UI button** — see below.
- **`src/types.ts`** — `RecordAttachment.uri` is now **optional** (was required), with two new optional fields: `storageObjectPath` and `uploadStatus`. This is a deliberate, necessary type change: a record pulled fresh on a second device genuinely has no local `uri` until that device downloads its own copy — the type now says so, rather than lying.
- **`src/recordSync.ts`** — **the second-device attachment bug fix** (flagged in the investigation, section 3): `localRecordFromRow()` previously reconstructed a pulled record's `attachments` from `local?.attachments` only — i.e. always whatever THIS device already had, which is empty on a fresh device, even though `attachment_manifest` had the real metadata sitting in Supabase the whole time. It now builds `attachments` from the server's `attachment_manifest` (the authoritative list), overlaying a local `uri` only for an attachment id this same device already has a copy of. This alone is what makes Section 8 ("second device discovers the attachment record") possible — regardless of whether Phase 17 builds a "View document" button, the DATA now correctly arrives.

## What Phase 17 Still Needs (explicitly deferred, not started)

Everything below is real, scoped UI/orchestration work — none of it is blocked by anything in this phase; the foundation is ready for it:

1. **Wire `queuePendingAttachmentUploads`** — nothing calls it yet. It needs to run after a document record saves (the natural integration point is `App.tsx`'s `saveRecord()`, mirroring how `syncAfterLocalMutation` already fires-and-forgets after every save; the returned updated `attachments` array then needs a second, lightweight local-state update — never re-triggering the upload itself).
2. **"Related to" picker** on the document editor (brief section 14) — a new step/section in `RecordEditor.tsx`, offering `currentSpace.records` filtered to the current care space and to appropriate types (appointment/bill/homeMatter/task at minimum), calling `createRecordLink`. Needs a "second record" orchestration layer, since today's `RecordEditor.save()` produces exactly one record — the investigation already flagged this as new orchestration, not an extension of existing logic.
3. **"Does anything need doing?"** (brief section 16) — the optional inline task-creation prompt on a document, reusing the existing task save path plus `createRecordLink(..., 'action_for')`. Same new-orchestration-layer note as above.
4. **RecordDetail bidirectional sections** (brief sections 15/20/21) — `RecordDetail.tsx` needs new conditional rows (following its own established per-type-conditional-row pattern — no new detail architecture) driven by `listRecordLinks(record.id)`, plus a "View document" button calling `openAttachment()`.
5. **RecordQuickEditor / FirstThingScreen wiring** — both hosts need to fetch links for whatever record is open and pass the result + `onOpenLinkedRecord` down to `RecordDetail`; opening a linked record from within an already-open sheet is new (today's hosts only ever show one record at a time).
6. **Document discoverability groupings** (brief section 22) — "Needs attention"/"Expiring soon" derivations on top of `expiryDate` (new pure functions in `src/records.ts`; the investigation already scoped exactly what's derivable vs. not).
7. **Deletion/file-lifecycle wiring** — calling `remove_record_attachment`/actual Storage object deletion when a document (or one of its attachments) is removed, and NOT cascading to a linked task/record (`remove_record_link` already exists for this; nothing currently calls it on record delete).
8. **Existing-document migration path** — an existing local-only attachment (no `storageObjectPath`) needs `queuePendingAttachmentUploads` to run for it too, so it becomes cloud-backed without any user action beyond having the app open and online again.
9. **Physical-device QA** (brief section 36) — meaningless until 1-6 exist; see `docs/PHASE_16_QA.md`.

## Testing

- **Database**: `supabase/tests/database/phase16_document_maturity.test.sql` — 45 pgTAP assertions (228 total across 7 files, zero regressions): link creation/idempotency/tombstone/cross-care-space rejection/non-disclosure to an unauthorised viewer; the full explicit documents-domain matrix from the brief's section 13 (organiser, contributor-with-grant, contributor-without-grant, a synthetic read-only grant, viewer, pending invitee, cross-care-space member, revoked member, assignment-does-not-grant-access); attachment metadata idempotent upsert/upload-status transition/domain-write enforcement; `storage.objects` RLS proven at the row level (insert/select correctly allowed/denied per domain grant). One documented limitation: the `storage.objects` DELETE policy could not be exercised via raw SQL locally — Supabase's local storage schema raises `storage.protect_delete()` ("Direct deletion... Use the Storage API instead") for ANY raw delete regardless of role, before RLS is even evaluated; the policy itself is still in the migration for when the real Storage API is used.
- **Client**: `tests/phase16-record-links.test.ts` (5 tests — RPC wrapper mapping/error-handling), `tests/phase16-attachments.test.ts` (12 tests — deterministic path construction, upload success/failure never falsely marking uploaded, `openAttachment`'s local/cloud/missing/unavailable branches, all with explicit `expo-file-system`/`expo-sharing` mocks), plus two updated `tests/record-sync.test.ts` cases proving the second-device fix (metadata now arrives; this device's own local `uri` still survives its own create-then-echo round trip).
- **Full suite**: 36 Jest suites / 366 tests (up from 34/349), TypeScript clean, secret scan clean, 228 pgTAP assertions, clean database lint, clean local rebuild.

## Hosted `lilica-development`

Dry-run only, per standing instruction — **not yet applied**: `npx supabase db push --linked --dry-run` on 12 September 2026 reported exactly one pending migration, `20260912100000_phase16_document_maturity.sql`, with no unrelated diff. Apply only on explicit product-owner instruction, then re-verify linked pgTAP/lint per `docs/SUPABASE_OPERATIONS.md`'s established pattern.

## Backward Compatibility

Every existing document record already has zero link/task data (nothing could have created one before this phase) and, per the type change above, an `attachments` array whose entries may now lack `uri` legitimately — both are additive, non-breaking states the existing UI already handles (`RecordDetail`/`RecordEditor` never assumed `uri` was populated for anything other than local display, which they still get correctly on the originating device). No existing record needed migrating, and none was.
