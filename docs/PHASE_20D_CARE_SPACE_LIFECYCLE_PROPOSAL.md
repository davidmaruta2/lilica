# Phase 20D - Supported-Person / Care-Space Lifecycle: Architecture Proposal Only

**PROPOSAL ONLY. Per `prephase22.txt`'s own Part B authority level, no lifecycle RPC, migration, archive/delete mechanism, or destructive button was implemented in producing this document.**

**Important note on sequencing, stated plainly rather than glossed over**: while this proposal was being written, the product owner separately and explicitly asked "as organiser, how do I remove a supported person if they no longer need support?" and, on hearing the honest answer ("there is currently no way"), explicitly instructed "fix this now... implement this now." That real, working feature (`delete_care_space()`, a genuine irreversible deletion, checkbox-confirmed in Privacy & data) was built, tested (358 pgTAP assertions, both locally and on `lilica-development`) and deployed in the session immediately before this proposal was written - it already exists in the working tree as this document is being produced. This creates a direct tension with this brief's own Part B instruction ("ABSOLUTELY NO implementation... remove supported person... the consequences are too significant to guess"). That instruction is correct in general - a lifecycle decision this significant should not normally be implemented ahead of the kind of analysis this document performs - but in this specific case the product owner's own explicit, direct instruction for exactly this capability was received and acted on first. This document does not pretend that instruction did not happen, does not revert the shipped feature on its own authority, and instead treats what was built as **Scenario C/D's already-implemented DELETE path** - analysed honestly below (including where it currently falls short of the fuller lifecycle model this document proposes), so the product owner and GPT can decide whether to keep it as-is, extend it, or gate it further.

---

## 13. Current care-space lifecycle (today, before this proposal)

There is no explicit lifecycle state on `care_spaces` at all - no `status`, `active`/`archived` flag, or `deleted_at` column exists on that table (confirmed by direct schema inspection: `care_spaces` carries only `id`, `bootstrap_owner_id`, `commercial_owner_id`, and its `created_at`/`updated_at` timestamps). A care space today has exactly two real states:

1. **Exists**, with at least one active membership - fully functional, appears in the supported-person switcher, fully readable/writable subject to normal entitlement/domain rules.
2. **Does not exist** - either it was never created, or (as of this session) it has been genuinely, irreversibly deleted via the newly-built `delete_care_space()`.

There is no dormant/inactive middle state. A care space that a family simply stops using indefinitely just sits there, fully intact, forever consuming no special handling - not a designed outcome, simply the absence of any lifecycle concept at all.

## 14. Current data ownership map

Traced directly from the schema (the same foreign-key graph mapped in full while building `delete_care_space()` this session - not re-guessed):

| Entity | Owned by | On today's only "ending" (delete_care_space) |
|---|---|---|
| `supported_people` (the person's identity/display name) | `care_space_id`, `on delete restrict` | Deleted |
| `care_space_memberships` (organiser/contributor/viewer) | `care_space_id`, `on delete restrict` | Deleted (and `care_space_domain_grants` cascades from membership) |
| `care_space_invitations` | `care_space_id`, `on delete cascade` from care_spaces, but `on delete no action` from memberships | Deleted explicitly before memberships |
| `records` (every appointment/task/bill/document/contact/care-note/update) | `care_space_id`, `on delete restrict` | Deleted |
| `occurrences` / `occurrence_versions` / `recurrence_rules` / `recurrence_series` | `care_space_id`/`record_id`, all `restrict` | Deleted |
| `assignments` | `care_space_id`/`record_id`/`occurrence_id`/`membership_id`, all `restrict` | Deleted |
| `record_links` | `care_space_id`, `restrict` | Deleted |
| `record_attachments` (metadata) | `care_space_id`/`record_id`, `restrict` | Deleted (DB row); the actual Storage object is removed by the client, best-effort with retry - **the one part of this whole graph the database itself cannot reach** |
| `care_space_activity` (Phase 20B) | `care_space_id`/`record_id`/`actor_membership_id`, `restrict`, and immutable-by-trigger | Deleted (required a deliberate, narrow, transaction-scoped exception to its own immutability trigger - a genuine finding from building this, not anticipated) |
| `care_space_contacts` | `care_space_id`, `restrict` | Deleted |
| `record_mutation_receipts` / `occurrence_mutation_receipts` (idempotency ledgers) | `care_space_id`, `restrict` | Deleted |
| Former-member identity snapshots (`former_display_name`, Phase 18B) | Lives ON the membership row itself | Deleted along with the membership - **a real, deliberate consequence discussed in section 21 below**: a care space's own audit trail of who-contributed-what does not survive its own deletion, unlike an individual account deletion, which preserves the audit trail for everyone ELSE's benefit |
| `commercial_owner_id` / `bootstrap_owner_id` (Phase 21B, Phase 6) | Columns ON `care_spaces` itself | Gone with the row - no separate handling needed |
| Entitlement (`entitlements`, `entitlement_events`) | User-scoped, not care-space-scoped | **Completely untouched** - deleting one care space never affects the account's own subscription, which correctly remains account-level per Phase 21's own design |
| Local device cache/outbox (`src/recordSync.ts`), document-cleanup queues | Device-local, per (owner, care space) | Removed by the client alongside the server deletion (`removeCareSpace()` in `src/careSpaceState.ts`) |
| Search / Care Summary / Recent Activity | Pure projections over the above, no separate storage | Nothing to clean up - they simply have nothing left to project once the underlying data is gone |
| Export (`export_my_data()`) | Reads live data at request time | A care space deleted before export runs is, correctly, simply absent from a later export - there is no separate "was once part of an export" record to reconcile |

**What happens TODAY if a care space simply stops being used (nobody deletes it)**: nothing. It persists indefinitely, fully intact, exactly as if still active - correct and safe, but also the reason Scenario A (below) cannot currently be satisfied by anything short of the new, fully destructive delete.

---

## 15-20. The six scenarios, analysed separately (per the brief's own explicit instruction not to design one action for every circumstance)

### Scenario A - Care no longer required

**Today**: no distinct outcome exists. The only lifecycle action available is the new `delete_care_space()` - fully destructive, irreversible, and requiring a checkbox confirmation exactly because it is that serious. Using it for "Maggie has recovered and we just don't need active coordination any more" is a **mismatch of severity**: the family may well want to look back at Maggie's care history later (a common, reasonable want - "when did she last see the GP", "what was that document called"), and today's only tool would destroy that permanently.

**What this scenario actually needs**: an `ARCHIVED` state (see section 18) - hidden from the active supported-person switcher and normal navigation, but fully intact and re-viewable/exportable on request. This is **not built**, and this document recommends it be built as a genuinely separate, lower-severity action from delete, before archive is offered as the "soft" alternative next to the (already-shipped) hard delete.

### Scenario B - Organiser no longer responsible, others continue

**Today, already correctly handled**, and already tested: `leave_care_space()` lets a non-sole organiser step away, `remove_member()` lets any active organiser remove a member (including another organiser, subject to the "never leave zero organisers" guard), and neither of these can ever delete the underlying care space - only `delete_care_space()` can, and it requires being an active organiser AT THE TIME of the call, so a departed organiser cannot destroy what they just left. **No change needed here.** The new delete capability was deliberately built (per the brief's own reasoning already recorded in its migration comment) to require only "any active organiser," not sole-organiser - this is CORRECT for Scenario A/C/D (an organiser acting on behalf of the family/person), but it is worth naming explicitly as the one place Scenario B's own safety property ("David leaving does not destroy Maggie's space for Marion") depends entirely on David no longer being an active organiser once he has left - which `leave_care_space()` already guarantees, so the two mechanisms compose correctly today, but only because that ordering happens to hold.

### Scenario C - Supported person explicitly asks to be removed

**Today**: `delete_care_space()` is available and does perform a genuine, complete deletion - this is the closest thing to satisfying an explicit removal request that exists. But it was built and confirmed this session as an **organiser-initiated** action (any active organiser, not the supported person themselves, since a supported person very often has no Lilica account of their own at all - see section 21). This is a genuine, honest gap worth naming: Lilica has no mechanism today for the supported person's OWN voice to trigger this directly if they are not also an organiser - the request necessarily has to be relayed to an organiser to act on. This is very likely the correct model in practice (most supported people using Lilica are exactly the people the product's own `docs/PROJECT_BRIEF.md` describes - someone being cared for, not necessarily managing their own account), but it should be named as a **product decision**, not assumed: does Lilica need a distinct "I am the supported person and I am asking to be removed" request/consent flow, or is "ask your organiser" always sufficient? This document does not resolve that; it is flagged in section 31.

### Scenario D - Sole organiser

**Today**: the sole organiser can call `delete_care_space()` freely (deletion does not require being non-sole - only the pre-existing `leave_care_space()`/`remove_member()` guard the "never leave zero organisers" invariant, which is a different concern from deletion itself). This is arguably correct - if the sole organiser genuinely wants to end the whole care space, requiring them to first invent a second organiser just to delete it would be an unreasonable, artificial obstacle. **No change recommended here**, but this is the scenario where an `ARCHIVE` alternative (section 18) matters most: today a sole organiser wanting a "softer" outcome than full deletion has no such option.

### Scenario E - Multiple organisers, differing authority

**Today**: every active organiser has IDENTICAL authority - any one of them can invite, remove any other member (down to the one-organiser floor), change roles, and (now) delete the entire care space unilaterally, with no requirement for the other organiser(s) to consent or even be notified beforehand. This was a deliberate, direct mirror of `remove_member()`'s own existing "any active organiser" authority level (a considered choice made explicitly while building `delete_care_space()` this session, not an oversight), but it is worth stating plainly as a genuine question for review: **should the single most destructive action in the entire app require the SAME authority level as removing one member, or a higher bar** (e.g. unanimous organiser consent, or at minimum a notification to co-organisers before it happens)? This document does not resolve that either; it is flagged in section 31 as a live product decision, precisely because the capability already exists and is live on `lilica-development`.

### Scenario F - Commercial owner leaves/is affected

**Already correctly handled by Phase 21B's own existing design, unchanged by this proposal**: `commercial_owner_id` lives on `care_spaces` itself, is set to `null` automatically if that user's account is ever deleted (`delete_my_account()`'s own existing `on delete_my_account, set commercial_owner_id = null` step), and `care_space_has_active_entitlement()` already correctly treats a null commercial owner as inactive (`coalesce(..., false)`) rather than crashing or defaulting to active. `transfer_care_space_commercial_ownership()` already exists for the "another organiser explicitly claims commercial responsibility" case. When `delete_care_space()` runs, `commercial_owner_id` simply disappears along with the row - there is nothing left to reassign, correctly. **No Phase 21 redesign needed or proposed.**

---

## 17. Archive vs Leave vs Transfer vs Delete - rigorous semantic distinction

| | ARCHIVE (proposed, not built) | LEAVE CARE SPACE (exists) | TRANSFER RESPONSIBILITY (exists, commercial only) | DELETE/REMOVE (exists, built this session) |
|---|---|---|---|---|
| Purpose | Care ended, history matters | One member steps away | Commercial billing moves to another organiser | Permanent end, data genuinely gone |
| Actor | Any active organiser (proposed) | The member themselves | The current commercial owner, or (once they're inactive) any remaining active organiser | Any active organiser |
| Prerequisites | None proposed beyond being an organiser | Non-sole-organiser status if the leaver is an organiser | Target must be an active organiser of that specific space | None beyond active organiser status (currently) |
| Data retained | Everything, fully intact | Everything - only the leaver's own membership changes | Everything - only `commercial_owner_id` changes | Nothing (full cascade delete) |
| Data hidden | From normal active-switcher/navigation only (proposed) | Nothing hidden from anyone else; the leaver simply loses access | Nothing | Everything, because it no longer exists |
| Reversibility | Proposed: yes, an authorised "unarchive" | No (a fresh invitation would be needed to rejoin) | Yes (another transfer) | **No - explicitly, deliberately irreversible, per the product owner's own instruction** |
| Care Circle effect | Unchanged (proposed) | The leaver's own membership becomes `revoked` | Unchanged | Every membership deleted |
| Commercial-owner effect | Unchanged (proposed) | If the leaver held commercial ownership, `commercial_owner_id` would need explicit handling - **not yet analysed for archive specifically, see section 18's own open question** | Changes by design | Gone with the row |
| Subscription effect | None (account-level, unaffected) | None | None | None (account-level, unaffected) |
| Supported-person switcher effect | Removed from the active list (proposed) | Removed for the leaver only | Unchanged | Removed for everyone (nothing left) |
| Search effect | Excluded while archived (proposed) | Unaffected for remaining members | Unaffected | Nothing left to search |
| Calendar/To Do effect | Excluded while archived (proposed) | Unaffected for remaining members | Unaffected | Nothing left |
| People effect | Excluded while archived (proposed) | The leaver no longer sees it at all | Unaffected | Nothing left |
| Documents effect | Retained, viewable via an explicit "archived spaces" route (proposed) | Unaffected for remaining members | Unaffected | Deleted (DB rows) + best-effort Storage cleanup |
| Export effect | Still exportable (proposed) | The leaver can no longer export it (no access); remaining members unaffected | Unaffected | Nothing left to export once deleted - **anyone wanting a copy must export BEFORE deleting**, which the current UI does not explicitly prompt for (see section 31) |
| Audit/history effect | Fully preserved (proposed) | Preserved (Phase 20B activity, member-lifecycle event logged) | Preserved | **Lost** - `care_space_activity` for that space is deleted along with everything else, a deliberate but significant difference from `delete_my_account()`'s own audit-preserving design (section 26) |

---

## 18. Archive model - assessment

**Recommendation: a genuine `ARCHIVED` care-space state is worth building**, as the missing "soft" counterpart to the new "hard" delete, but this document does not consider its exact design settled - only sketches the shape:

- A new `care_spaces.lifecycle_status` column (`active` | `archived`, default `active`) would be the natural, minimal schema change - far smaller than the full deletion cascade this session already had to build, since archive touches nothing but this one flag.
- **Allowed reads**: fully unchanged for an archived space - every existing RLS policy already keys off active membership, not any lifecycle flag, so archived data would remain exactly as readable to existing members as before.
- **Allowed writes**: this is the one genuinely new enforcement point - every gated mutation RPC (the same list Phase 21B's own `care_space_has_active_entitlement()` already gates: `apply_record_mutation`, attachment/link RPCs, `invite_member`, etc.) would need one additional check, "and the care space is not archived," mirroring exactly how the entitlement check itself was added at each function's own existing point.
- **Visibility**: excluded from `list_my_supported_people()`'s normal result (the RPC the supported-person switcher reads) unless an explicit `include_archived` parameter is passed - the proposed "Manage [Name]'s care" destination (section 22) would be the one place that parameter is ever used.
- **Membership behaviour**: unaffected - members remain members; only the space's own writability changes.
- **Restoration**: an `unarchive_care_space()` RPC, symmetrically simple (flip the flag back), authorised the same way archiving is (see the open Scenario E question above about whether this needs a higher bar than ordinary organiser authority).
- **Billing implications**: **an open question this document does not resolve** - should an archived space's commercial entitlement continue to be charged for, or should archiving pause it? Phase 21's own model charges per ACCOUNT, not per care space, so archiving one of several spaces an account commercially owns would not reduce their subscription cost today regardless - worth the product owner's explicit confirmation that this is acceptable (most likely yes, since the £8.99/year price was explicitly set as one price covering everything an account organises), but not assumed here.

**This is not assumed to be the correct exact design** - it is the smallest model that satisfies Scenario A's own stated need, evaluated against the current schema, and is offered as a strong starting point for a future, separately-approved Phase 20D implementation brief.

## 19. Deletion model - what was actually built, mapped honestly against the brief's own required questions

This section answers the brief's own explicit "what would be deleted, what would be retained" questions against the REAL, already-shipped `delete_care_space()`, since pretending it does not exist would make this document less useful, not more careful:

- **What is deleted**: every row mapped in section 14's table - records, occurrences, recurrence state, assignments, links, attachment metadata, activity, contacts, invitations, mutation-receipt ledgers, memberships, the supported-person row, and the care_spaces row itself.
- **What is retained**: nothing server-side. The ONLY things that survive are: (a) the deleting organiser's own account and their OTHER care spaces (proven directly by pgTAP cross-space-isolation assertions), and (b) each removed member's own account (their membership is deleted, not their account - they simply lose access, exactly like `remove_member()`'s existing behaviour, just permanently rather than revocably).
- **Other members' contributions**: gone. Unlike `delete_my_account()` (which deliberately detaches and snapshots a membership so the REST of a shared care space keeps truthful historical attribution), `delete_care_space()` deletes the entire shared space, so there is no "rest of the space" left for anyone's contribution to remain attributed within. This is internally consistent (there is nothing left to attribute anything within), but it does mean a collaborator's own work is not separately preserved anywhere once the space they contributed to is gone - a real, honest trade-off of choosing full deletion as the mechanism, not a design flaw exactly, but worth the product owner explicitly confirming is the intended severity for Scenario C in particular (an explicit supported-person removal request) versus Scenario A (care ended, no removal request) - which is exactly why this document recommends Archive be built as the distinct, lower-severity option for the latter.
- **Documents/attachments/Storage objects**: DB metadata deleted transactionally; the actual Storage bytes are removed by the client afterward, best-effort, with retry via the same durable queue Phase 18 built for individual document cleanup. This is the one part of the whole deletion that is NOT fully atomic with the database transaction - a device that goes offline immediately after a successful deletion could leave orphaned Storage objects for a period until the retry queue next runs. This is an accepted, named limitation (matching Phase 17/18's own precedent of "best-effort Storage cleanup with durable retry, not a hard guarantee"), not a new risk class for this codebase.
- **Reminders**: local-device-only (Phase 14), never server-side - nothing to clean up server-side; a device would simply stop being able to resolve notifications for records that no longer exist, which the existing reminder-cancellation-on-record-removal logic already contemplates for ordinary record deletion.
- **Invitations**: deleted (any still-pending invitation to the now-gone space simply vanishes - an invitee who had not yet accepted will find their invitation gone, correctly, rather than pointing at nothing).
- **Activity/audit evidence**: deleted, per the immutability-trigger exception built this session - **this is the one place this document recommends the product owner's explicit attention**: is it acceptable that a care space's own activity history does not survive its own deletion? An alternative (not built) would be to snapshot activity into a separate, minimal, care-space-independent audit table before deletion - genuinely more engineering, and this document does not recommend it without the product owner first confirming a real need for post-deletion audit evidence (e.g. a dispute about who deleted what). Named here as a real, deliberate design choice, not an oversight.
- **Former-member identity snapshots**: deleted along with the memberships that carried them - see the same audit-evidence question immediately above.
- **Commercial ownership/entitlement**: unaffected (account-level, per Phase 21's own design, confirmed correct in section 20 above).
- **No silent orphaning occurred**: every table in the FK graph was either explicitly deleted in the correct dependency order or (in exactly one case, `care_space_domain_grants.membership_id`) genuinely cascades - proven directly by re-running the full pre-existing pgTAP suite (358 assertions) against the new function with zero regressions, and by two real bugs actually being CAUGHT by that process (the activity-immutability trigger, and the domain-grants `granted_by_membership_id` non-cascading FK) rather than merely assumed clean.

## 20. Privacy/legal boundary

Distinguished honestly, per the brief's own explicit instruction not to invent legal conclusions:

- **Engineering requirement** (settled, already built): the deletion must be transactional, complete, and leave no orphaned row anywhere in the FK graph - proven by the pgTAP suite.
- **Product decision** (open, listed in section 31): whether Archive should exist as a separate, lower-severity action; whether deletion authority should require more than one active organiser's say-so; whether a pre-deletion export prompt should be mandatory; whether audit evidence should survive a space's own deletion.
- **Legal/privacy review required, not decided here**: an organiser deleting a supported person's information is, in the general case, one living person's data being deleted by another person acting on their behalf (or, in Scenario C, at their own request but relayed through someone else) - this genuinely touches UK data-protection questions this document has no standing to resolve (whose "right to erasure" is actually being exercised; whether a supported person without their own Lilica account has any independent means of requesting or objecting to this; whether collaborators' own contributions, now deleted, raise a separate data-subject question for THEM). `docs/PROJECT_BRIEF.md`'s own existing standing instruction not to invent legal conclusions is followed here exactly as it was for Phase 18B's own account-deletion legal flags, which remain unresolved in the same way. **This document explicitly recommends specialist UK data-protection advice before this capability is publicised or relied upon at scale**, exactly as Phase 18B's own architecture doc already recommended for account deletion generally.

## 21. Supported-person participation - analysed separately per case

- **No Lilica account at all** (the common case per `docs/PROJECT_BRIEF.md`'s own framing): can only ever act through an organiser relaying their wishes - Lilica has no independent channel for them. This is very likely acceptable given the product's own target audience, but is a real limitation worth naming rather than assuming away.
- **A Care Circle member in their own right** (has since joined as a Contributor/Viewer of their own space): could theoretically request removal directly if extended appropriate permission, but no such self-removal-request concept exists today - they would use ordinary `leave_care_space()` for THEIR OWN membership, which does not touch the space itself at all.
- **An organiser of their own care space**: already has full existing authority, including the new delete capability - no gap here.
-**The commercial owner**: entitlement-wise unaffected by any of this (section 20/Scenario F); their own billing continues regardless of what happens to any one care space they organise, unless they specifically transfer or lose organiser status there.
- **Requests removal but does not own the space commercially or organisationally**: this is Scenario C's own hardest case, and this document does not resolve it - it is exactly the kind of "the organiser does not automatically have unilateral moral authority over another living person's data merely because they hold the technical role" question flagged for legal/product review in section 20, not an engineering one.

## 22. Proposed "Manage [Name]'s care" destination

**Recommended, not built.** Purpose: a single, deliberately infrequent-use destination for exactly the lifecycle actions this document discusses - kept OUT of People's own everyday overview (which Corrective Task 10 already established should stay focused on "who is involved," not administrative actions) and out of the new "[Name]'s care" Settings-drawer group this session just implemented (which is for FREQUENT, read-oriented destinations - Care Summary, Recent Activity - not rare, destructive ones).

Proposed hierarchy (illustrative, not final):

```
Manage Maggie's care
  Transfer commercial ownership   (already exists as an RPC - currently has NO
                                    dedicated UI at all, a genuine, separate,
                                    smaller gap worth noting)
  Archive Maggie's care            (proposed, not built - section 18)
  Remove Maggie from Lilica         (the delete capability - ALREADY BUILT and
                                    already live in Privacy & data; this
                                    proposal suggests it may belong here
                                    instead, or in addition, once this
                                    destination exists - not moved as part of
                                    this document)
```

This deliberately does NOT duplicate ordinary Care Circle member management (invite/remove/role-change) - those stay exactly where they are (Care Circle's own screen), since they are about WHO can help, not about the care space's own lifecycle as a whole.

## 23. Drawer implication (proposal only, not implemented in Part A)

If Archive and/or "Manage [Name]'s care" are approved in a future phase, the natural extension of THIS session's own newly-implemented "[Name]'s care" group would be:

```
Maggie's care
  Care Summary        (implemented, Part A)
  Recent Activity      (implemented, Part A)
  Documents            (proposed, Phase 20E - see that document)
  Manage Maggie's care (proposed, this document)
```

This is explicitly a proposal for a LATER phase - Part A of this task implements only the first two rows, exactly as approved.

## 24. Lifecycle state machine (proposed, minimal)

```
ACTIVE  <-->  ARCHIVED   (organiser-initiated either direction, proposed)
ACTIVE  -->  [deleted]   (already built - delete_care_space(), irreversible)
ARCHIVED  -->  [deleted]  (would need to be explicitly allowed - not yet analysed)
```

No `PENDING_DELETION` state is recommended - the brief's own instruction not to invent states merely for completeness is followed here; the existing checkbox-confirmation UI already provides the "are you sure" friction a pending-state grace period would otherwise exist to provide, and a genuine "undo window" (e.g. a 30-day soft-delete before hard purge) is a real, separate product decision this document flags but does not recommend without explicit confirmation, since it would meaningfully change what "irreversible" currently, correctly, means to a user reading the existing confirmation copy.

## 25. Server authority / security - which existing concepts would authorise archive/unarchive

No new permission CONCEPT is needed - archiving would reuse the exact same "active organiser of this care space" check `delete_care_space()` already uses (or, if Scenario E's own open question resolves toward a higher bar, a new "all active organisers must agree" check built from the same membership table, no new concept, just a stricter predicate). Required, not built: an `archive_care_space()`/`unarchive_care_space()` RPC pair; one additional `lifecycle_status = 'active'` condition added to every currently-gated mutation RPC (mirroring exactly how the entitlement check itself was added); a `lifecycle_status` column with a `check` constraint; an `archive_status_changed` activity event type (Phase 20B's own existing closed-enum pattern); and a corresponding pgTAP suite proving both directions and proving every gated RPC genuinely respects the new flag - the same rigour this session applied to `delete_care_space()` itself.

## 26. Phase 18B interaction

`delete_my_account()`'s own fundamental rule - one member deleting their OWN account never destroys shared care data, only detaches and snapshots their own membership - is completely unaffected by anything in this document or by `delete_care_space()` itself. The two operate on genuinely different objects (a user identity vs. an entire care space) and neither can trigger the other. The one thing worth stating explicitly: `delete_care_space()` is MORE destructive than `delete_my_account()` by design - the latter was built specifically to protect shared data from one member's own departure; the former was built specifically to intentionally NOT protect it, because ending the whole space is the entire point. Any future Archive implementation must preserve this same asymmetry - archiving is closer in spirit to account deletion's own "detach, don't destroy" philosophy, while delete remains the one deliberately total operation.

## 27. Phase 21 interaction

Fully covered in Scenario F (section 20) and section 19's own commercial-ownership line - no redesign of `commercial_owner_id`, entitlement, or the £8.99/year account-level pricing model is proposed or was made. The one open billing question (section 18's archive-and-entitlement interaction) is explicitly named as unresolved, not silently assumed.

## 30. Legal/privacy decisions requiring external review (consolidated)

1. Whether an organiser's unilateral authority to delete another (often account-less) person's entire care record is itself something requiring a documented consent/authorisation model beyond "they hold the organiser role today."
2. Whether collaborators whose own contributions are deleted along with a care space have any independent data-protection interest in that deletion.
3. Whether a supported person without their own Lilica account has, or should have, any independent means of requesting or contesting this action.
4. General UK data-protection review of the deletion capability's current scope, mirroring Phase 18B's own standing recommendation for account deletion.

## 31. Exact product-owner decisions required before further implementation

1. **Should Archive be built** as the lower-severity alternative to the now-existing hard delete, for Scenario A specifically? (This document recommends yes, but does not implement it.)
2. **Should the existing `delete_care_space()` capability's authority level be raised** (e.g. requiring more than one active organiser's agreement, or at minimum notifying co-organisers) given it is the single most destructive action in the app and currently sits at the same authority level as removing one ordinary member?
3. **Should the UI require or strongly prompt an export before allowing deletion**, given there is currently no "did you want a copy of this first" step in the confirmation flow?
4. **Should care-space activity/audit evidence survive the space's own deletion** in some minimal, separate form, or is full removal (the current, shipped behaviour) correct?
5. **Should a "Manage [Name]'s care" destination be built**, and should the existing delete capability move there (or be duplicated there) once it exists?
6. **Does Scenario C need a distinct supported-person-initiated request/consent flow**, or is "ask your organiser" the accepted model?
7. External legal/privacy review, per section 30, before this capability is publicised or relied upon at meaningful scale.

None of these are resolved by this document - each requires the product owner's own explicit decision, with GPT's review, before any further engineering.
