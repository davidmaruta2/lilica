# Phase 20E - Documents Collection

**STATUS UPDATE, 15 September 2026: APPROVED and implemented via `\downloads\20-22.txt`.** `src/documents.ts` + `src/screens/DocumentsScreen.tsx`, exactly as proposed below: a pure client-side projection over the existing `record_attachments` table, no new schema, modelled on `ContactsListScreen.tsx`. Added to the "[Name]'s care" drawer group. See `docs/REVISION_LOG.md`'s "15 September 2026 - Phase 20D structural closure" entry for full detail. The proposal below is preserved as originally written.

---

**Original status (superseded above): PROPOSAL ONLY. No `DocumentsScreen`, drawer row, schema change, search, category, or migration was created in producing this document, per `prephase22.txt`'s own Part C authority level.**

---

## 32. Current document architecture (mapped directly from code, not guessed)

- **How documents enter Lilica**: exactly like any other record - a `document`-type `LilicaRecord`, created via the same universal Add flow (`RecordEditor.tsx`) every other category uses. There is no separate "upload a document" entry point anywhere in the app.
- **What record owns/links them**: the `document` record itself owns zero or more `RecordAttachment` entries (`record.attachments`, confirmed in `src/types.ts`) - a document record can have a title, notes, and an expiry date (`expiryDate`) with no attachment at all (a purely informational entry, e.g. "Blue Badge - kept in the kitchen drawer"), or one or more real file attachments. Separately, Phase 16/17's `record_links` table lets a document be explicitly linked to any OTHER record (e.g. an appointment, or a task created via "Does anything need doing?") - a directional, typed relationship, not a folder/parent-child structure.
- **Storage model**: attachment metadata lives in `record_attachments` (id, `care_space_id`, `record_id`, `kind` ('file'|'scan'), `display_name`, `mime_type`, `size_bytes`, `storage_object_path`, `upload_status`), RLS-protected identically to every other care-space table; the actual file bytes live in a private Supabase Storage bucket (`document-attachments`), never public, accessed only via short-lived signed URLs (`src/attachments.ts`'s `openAttachment()`).
- **Metadata available per document**: title (from the record itself), notes, expiry date (optional), one or more attachments each with a display name/MIME type/size/upload status, and zero or more typed links to other records. There is **no document "type" or category field** beyond the record's own generic `document` type - Lilica has never distinguished "insurance policy" from "ID document" from "photo of a form," for instance.
- **Current open/share/download behaviour**: `RecordDetail.tsx`'s existing document-specific branch shows a plain "View" link per attachment, which calls `openAttachment()` - downloads a fresh copy if needed (never trusts a stale local file, per Phase 16's own documented invariant) and opens/shares it via the OS. This is unchanged by anything in this proposal.
- **Replacement/versioning**: none exists. Editing a document record can add or replace which files are attached to it, but there is no explicit "version 2 of this same document" concept, no history of prior versions, and no "this replaces that older one" relationship - a genuine, separate gap from the one this document addresses (Phase 20A's own audit did not flag it either; noted here for completeness, not proposed for action).
- **Offline behaviour**: consistent with every other record type - documents sync via the same outbox/cache Phase 7 established; a freshly-pulled document record on a second device has attachment metadata immediately but downloads the actual file bytes only on demand (`openAttachment()`), never assumed already present.
- **Deletion behaviour**: deleting a document record enqueues its attachment/link cleanup via the durable `documentCleanupQueue.ts` (Phase 18), which best-effort removes the Storage object and retries if offline - unchanged by this proposal, and (as of this session) reused verbatim for the new `delete_care_space()`'s own whole-space Storage cleanup.
- **Search indexing**: `src/search.ts`'s existing `searchRecords()` already includes `document` records in its results (title/notes match, grouped under "Documents" - confirmed directly in `docs/PHASE_20_ARCHITECTURE.md`'s own description of the eight canonical result groups) - **a document is already findable via Home's existing search bar today**, just not browsable as a standalone collection.

## 33. The exact Documents gap

There is **no screen anywhere in the app that lists every document for the current supported person as its own collection** - the only ways to see a document today are: (a) it happens to appear in one of Home's own Today/Upcoming/Recently-added sections (only if it has a relevant date, e.g. an expiry), (b) Care Summary's own bounded "Important documents" section (capped at 4-5 items, by design - a summary, not a browsable list), or (c) typing a matching keyword into Search. A user who simply wants to look through "everything I've got on file for Maggie" - the exact plain-language need named in the brief - has no direct route to that today. This is a genuine, real gap, distinct from (and smaller than) anything Phase 20A's original audit flagged (that audit assessed document search/grouping specifically, not the absence of a collection screen at all).

## 34. Proposed Documents collection (smallest useful version)

A new `DocumentsScreen`, following the **exact same architecture `ContactsListScreen.tsx` already established** for Key Contacts' own "bounded preview -> View all" pattern (Corrective Task 10/People final visual pass) - not a new pattern:

- **Data source**: `currentSpace.records.filter(record => record.type === 'document')` - the exact same array already loaded everywhere else, sorted most-recently-added/updated first (mirroring `ContactsListScreen`'s own existing sort). **No new schema, no new RPC, no new client fetch.**
- **List/card presentation**: one row per document record - title, a small category-tint icon (reusing the existing `CategoryIcon`/`visualFor('document')` pair, unchanged), and a short detail line combining whatever is available (expiry date if set, e.g. "Expires 17 Sept 2027," or the linked record's own title if the document has exactly one link, e.g. "Related to: Orthopaedic appointment") - reusing `RecordDetail.tsx`'s own existing `relatedSectionLabel`/date-formatting logic rather than inventing new copy rules.
- **Type**: not proposed as a new field - see section 33's own honest note that no document-type concept exists today; introducing one would be new schema, outside this proposal's own "reuse only" scope. If genuinely wanted later, it is a separate, small, additive `record_data` field (mirroring how `careNote`'s own type-specific fields already work), not a reason to delay this screen.
- **Sort**: most-recently-added first by default (no new sort UI) - consistent with every other bounded list in the app (Key Contacts, Care Circle preview).
- **Search/filter**: **not proposed** for the first version - the brief's own instruction ("only if genuinely necessary") is not met by anything found this session; Home's existing search bar already covers the "find one specific document by keyword" need, and a typical care space's document count (tens, not hundreds, based on the realistic-volume reasoning `docs/PHASE_20_GAP_AUDIT.md` already used for its own one-year-user test) does not obviously need a second, in-screen filter yet. Worth revisiting if real usage proves otherwise.
- **Opening a document**: tapping a row opens the exact same shared record-detail path (`onOpenRecord`) every other list in the app already uses - never a new detail view, never bypassing the existing view/edit-capability check.
- **Permissions**: nothing new - the underlying `records` array a `DocumentsScreen` would read is already exactly as domain-filtered as every other screen's own copy (server-side RLS via `can_access_care_space_records()`, unchanged); a Contributor without `documents` domain access already does not receive document records into their local `records` array at all, so this screen would structurally never need its own separate permission check.
- **Empty state**: "No documents saved for {name} yet" plus the existing universal Add action - matching the calm, specific tone every other empty state in the app already uses (`docs/PHASE_22_VISUAL_AUDIT.md` section 11's own finding that this app's empty states are already a genuine strength).

## 35. Proposed information shown per document (summary)

Title, category icon, one short detail line (expiry OR single linked-record title OR nothing if neither applies), matching `ContactsListScreen`'s own existing row density exactly - no new visual language, consistent with `docs/PHASE_22_VISUAL_AUDIT.md`'s own finding that the flat-outlined-card family is already a coherent, reusable pattern.

## 36. Permissions

Fully inherited, not reimplemented - see section 34's own permissions note. No RLS change, no new access-control decision.

## 37. Context/linked-record behaviour

The brief's own explicit instruction - "documents should remain contextual, not detached generic cloud storage" - is satisfied structurally, not by any new UI cleverness: because this screen reads the SAME record array and reuses the SAME `onOpenRecord` -> `RecordDetail` path as everywhere else, opening a document here lands on the exact same detail view (showing its notes, expiry, and any linked records) a user would see opening it from Home, Calendar, Search, or Care Summary. There is no separate, thinner "documents-only" detail view proposed - deliberately, to avoid exactly the "generic cloud storage" outcome the brief warns against.

## 38. Drawer recommendation

**If approved**, `Documents` would join the existing `"[Name]'s care"` Settings-drawer group implemented this session (Care Summary, Recent Activity) as a third row, using the identical `careCircleAvailable`-style guard already established there - **but this document does not add that row now**, per the brief's own explicit instruction (section 34: "do not add the row yet"). A second, independent entry point from People (e.g. alongside Key Contacts' own "View all") is also plausible and not mutually exclusive with a drawer row, mirroring Care Circle's own already-proven dual-route pattern - both options are named here for a future decision, not chosen.

## 39. Engineering complexity/risk

**Low.** This is, by a wide margin, the smallest of the three proposals in this pre-Phase-22 review: one new presentational screen, zero schema change, zero new RPC, zero new permission logic, reusing three already-proven patterns verbatim (`ContactsListScreen`'s own bounded-list architecture, `RecordDetail`'s own document rendering, `CategoryIcon`/`visualFor`'s own shared visual language). The main engineering cost is simply writing and testing one more screen in the established idiom - comparable in size to the `ContactsListScreen` it is modelled on, not to anything in Phase 20D's own lifecycle proposal.

## 40. Exact product-owner decisions required

1. **Approve or defer** building `DocumentsScreen` itself (this document recommends approval given the low cost and genuine, real gap, but does not implement it).
2. **Drawer vs. People vs. both** as the entry point (section 38) - this document does not choose.
3. **Whether a document "type/category" field is ever wanted** (section 34) - explicitly out of THIS proposal's scope either way, flagged only so it is not silently forgotten.
