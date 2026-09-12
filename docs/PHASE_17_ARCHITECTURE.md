# Phase 17: Document Experience & Integration

Date: 12 September 2026. Status: **implemented and validated. Not committed/pushed — awaiting product-owner review and physical-device QA, per the brief's own explicit instruction.** This document assumes `docs/PHASE_16_ARCHITECTURE.md` (the durable foundation this phase wires up) and `docs/PHASE_16_DOCUMENTS_INVESTIGATION.md`.

**The split is now:** Phase 16 = durable document/storage/link foundation (schema, RLS, Storage bucket, client library — no UI called any of it). Phase 17 = the user-facing document experience described below, which actually calls that foundation.

## Migration Now Applied

`20260912100000_phase16_document_maturity.sql` (Phase 16's own migration, deliberately left unapplied) was applied to `lilica-development` as the first step of this phase: dry-run confirmed exactly this one pending migration with no unrelated diff, applied, migration histories verified to match, then the full 228-assertion pgTAP suite and a clean database lint re-run against the LINKED database (not just local). The private `document-attachments` bucket was independently verified to exist there (`public: false`, 25 MB limit).

## What Now Actually Works

### Adding a document
`RecordEditor.tsx` (document type only) gained two optional, calmly-worded sections between Expiry date and Notes:
- **Related to** — a "+ Link something" button opens `RelatedRecordPicker.tsx` (a small modal listing the host's own care-space-scoped, already-eligible candidates — appointment/task/bill/homeMatter, per `isLinkableRecordType()` in `src/records.ts`; never a UUID, database type or domain name, just title + the same date/time summary the record already shows elsewhere via the new `linkPickerSummary()` helper). Picking one on a **brand-new draft** stages it locally (nothing persisted yet — there's no stable record id to link against until Save); picking one on an **existing document** links it immediately.
- **Does anything need doing?** — a two-choice segmented control ("No — just keep this document" / "Yes — add something to do"), never a generic follow-up checkbox. Choosing Yes reveals the existing task fields (What needs doing?/By when?/Assigned to, the last two reusing exactly the same date wheel and assignment-option logic every other record already uses). On a **brand-new draft**, this is deferred to the main Save button (matching the brief's own flow: capture → describe → optionally link → optionally add a task → save, as one action); on an **existing document**, a separate "Add this task" button fires immediately, independent of the record's own "Save changes".

Both sections are entirely optional — a reference-only document (passport copy, Power of Attorney) is untouched by either and remains exactly as valid.

### Where the second-record orchestration lives
`RecordEditor.save()` already knew the final record's id before calling `onSave` (needed for `createUuid()`). It now also flushes, immediately after `onSave`, whatever was staged: `onLinkRecord?.(recordId, targetId, 'related_to')` and/or `onCreateLinkedTask?.(recordId, task)`. The actual persistence lives in the HOST (`RecordQuickEditor.tsx`/`FirstThingScreen.tsx`), which:
- calls `createRecordLink()` (Phase 16's RPC wrapper) for `onLinkRecord`;
- for `onCreateLinkedTask`, builds a REAL canonical task record (stable id via `createUuid()`, same shape every task already has) and calls the SAME `onSaveRecord` every other "Add" flow already uses — then links it to the document via `createRecordLink({..., linkType: 'action_for'})`, with the task as `sourceRecordId`. No second task editor, no embedded task state inside the document record, no `followUp`/`needsAction` boolean anywhere.

### Bidirectional presentation (RecordDetail)
`RecordDetail.tsx` gained a new `relatedRecords?: RelatedRecordEntry[]` prop (host-resolved: each link's `LinkedRecordSummary` looked up against the already-loaded `records` list, so RecordDetail itself never fetches anything). One stored `record_links` row renders differently depending on which side is open (`relatedSectionLabel()`):
- a document showing an outgoing `related_to` link → **"Related to"**;
- an appointment/bill/homeMatter/etc. showing an incoming `related_to` link (the other side is a document) → **"Documents"**;
- a document showing an incoming `action_for` link (the other side is a task) → **"Action"**, with the task's own due date/assignee (`relatedSubtitle()`);
- a task showing its outgoing `action_for` link (the other side is a document) → **"Related document"**.

No duplicate reverse row is ever created — this is the SAME `list_record_links()` query, called with a different anchor id. Tapping a related row calls `onOpenLinkedRecord(recordId)`, never opening Edit.

### View document
`RecordDetail.tsx` renders one row per attachment (never assumes index 0 — see the brief's own multiple-attachments caution), each with its own "View" action calling `onViewDocument(attachmentId)`. The host wires this straight to Phase 16's `openAttachment()` (local copy → signed-URL download → native share sheet), showing a plain `Alert` with the friendly message `openAttachment` already returns on failure — never a raw exception, signed URL, storage path or UUID reaches the user.

### In-sheet link navigation, without loops
`RecordQuickEditor.tsx` gained an internal `activeRecordId` (initialised from the `recordId` prop) that `onOpenLinkedRecord` retargets — the SAME sheet re-renders showing the newly-opened record's own detail, never closing/reopening a different sheet instance. `FirstThingScreen.tsx`'s `openLinkedRecord()` does the analogous thing across its own category-stack (finding the target's category/index, since a linked record can belong to a different category than whatever was focused). Both hosts always open a link target in `mode/openView === 'view'` (never Edit) and each navigation replaces what's on screen rather than stacking — Back/Done still close the ONE sheet actually open, so a Document → Appointment → Document → Appointment traversal never accumulates hidden state; it just keeps replacing the same view, exactly like normal in-app navigation.

### Upload wiring and retry
Phase 16's `queuePendingAttachmentUploads()` is now actually called:
- **On every document save**, from both hosts' `onSave` handler (`afterDocumentSaved()`), fire-and-forget — a slow/failed upload never blocks or delays the record save that already succeeded.
- **App-wide retry**, in `App.tsx`: a new effect scans `currentSpace.records` whenever they change (care-space switch, sync completing, app startup) for document records with attachments that have a local `uri` but `uploadStatus !== 'uploaded'`, and queues them — this is what satisfies "a restart must not strand a valid pending upload forever" and "existing pre-Phase-16 documents get uploaded when encountered on the device that still has the local file", using the exact same function, no second upload path. A per-session `Set` (`uploadAttemptedThisSession`) avoids re-queuing the same attachment id every render within one session — purely to avoid wasted RPC calls (the function is already idempotent), not a correctness requirement; a genuine app restart naturally retries anything still pending.
- **Legacy local file no longer present**: `queuePendingAttachmentUploads()` already skips any attachment without a `uri` (added in Phase 16); nothing here fabricates a file. Its metadata (title, expiry, notes) remains exactly as valid and visible as before — see `docs/PHASE_16_ARCHITECTURE.md`'s backward-compatibility section, unchanged by this phase.

### Deletion / cloud cleanup
`App.tsx`'s existing `removeRecord()` now also fires (fire-and-forget, AFTER the canonical record's own tombstone/sync is already enqueued — never before, so a failed cleanup never leaves the record deletion itself inconsistent):
- `removeAllLinksForRecord(recordId)` (new, `src/recordLinks.ts`) — tombstones every link where this record is either side, never touching the record on the other end;
- `cleanupDocumentAttachments(record)` (new, `src/attachments.ts`, document type only) — removes each attachment's Storage object then tombstones its `record_attachments` row.

**Known, explicitly accepted limitation**: both cleanup calls are best-effort and NOT yet retried if they fail (e.g. deleting while offline) — a small durable retry queue was judged out of scope for this pass; the canonical record deletion itself is always safe and complete regardless, and this is named here rather than silently left unmentioned, per the brief's own instruction not to overclaim.

## Permissions and Isolation

Nothing new was introduced. Every new UI path calls the exact same Phase 15/16 RPCs already permission-checked server-side (`can_access_care_space_records`, `membership_has_domain_access`) — View document's visibility, Edit's visibility, and every link/task action are gated exactly as before; a viewer sees View document but never Edit, a contributor's behaviour follows their granted domains, a revoked member's next RPC call is rejected server-side regardless of what the client attempted. All new client-side lookups (`relatableRecords`, `relatedRecords`) are built from the SAME already-care-space-scoped `records` array every screen already uses — a different supported person's records are never in that array to begin with, so cross-person leakage is structurally impossible at the UI layer, on top of the server's own RLS.

## What Remains Deliberately Not Built (explicitly out of scope for this pass)

- A durable, retried cleanup queue for offline deletes (see "Deletion / cloud cleanup" above) — best-effort only today.
- Lightweight "Expiring soon"/"Recently added" groupings on the Important Documents gateway (brief section 26) — the gateway's existing generic category list already shows expiry per record (unchanged from before this phase) and remains fully clickable; no new grouping/classification logic was added, since none is safely derivable beyond what already exists without inventing thresholds (a product decision, not an architecture one).
- A given document supports only ONE actively-staged "Related to" pick before its first Save (an existing, already-saved document can accumulate several links over time via repeated immediate picks — that path is unlimited). This is a deliberate scope reduction for the create flow, not an architectural limit — `record_links`/`list_record_links` already support any number of links per record.
- Physical-device QA (see `docs/PHASE_16_QA.md`, now the live Phase 17 checklist) — not performed; no claim of a passed physical test appears anywhere in this document or the completion report.

## Testing

New: `tests/phase17-record-editor.test.tsx` (8 tests — Related-to staging/immediate-linking, Does-anything-need-doing default/deferred/immediate/blank-title paths), `tests/phase17-record-detail.test.tsx` (8 tests — all four context-aware section labels, no-section-when-nothing-to-show, tap-to-open, multiple-attachments View rows), `tests/phase17-record-quick-editor.test.tsx` (7 tests — real host wiring: link creation/removal, linked-task-plus-link creation, in-sheet bidirectional navigation without duplication, View document success/failure, upload queuing on save). Extended: `tests/phase16-attachments.test.ts` (+4 for `cleanupDocumentAttachments`), `tests/phase16-record-links.test.ts` (+2 for `removeAllLinksForRecord`). Total new/changed Phase 17 tests: 29. Full suite: 39 Jest suites / 395 tests (up from 36/366), TypeScript clean, secret scan clean, 228 pgTAP assertions unchanged (no new migration this phase), clean local and linked database lint, clean web export.
