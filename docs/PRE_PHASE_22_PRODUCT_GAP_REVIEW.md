# Pre-Phase-22 Product Gap Review - Final Jointly-Inspired Gap Reconciliation

**RECONCILIATION / RECOMMENDATION ONLY, per `prephase22.txt`'s own Part D authority level. No feature in this document was implemented. This revisits only the items `docs/PHASE_20_GAP_AUDIT.md` left deferred - it does not redo that audit.**

---

## 41. Collaboration notifications

**What Jointly exposed**: proactive push notification when another circle member changes something.

**Does Lilica now satisfy it?** Partly, and the partial coverage is genuinely new since Phase 20A: Recent Activity (Phase 20B) now exists, and this session made it materially more discoverable (Phase 20C, both the People link and the new Settings-drawer route). The underlying need Phase 20A itself named - "I need to know what other carers changed" - is a PULL need (I can go look) that Recent Activity now answers reasonably well; it is explicitly NOT a PUSH need (I am told the moment it happens) - that remains completely unbuilt, and Phase 14's own architecture (local-device-only, no server/push infrastructure at all) means building it would require genuinely new infrastructure, not a small addition.

**Disposition: KEEP DEFERRED.** Recent Activity's own existence and improved discoverability meaningfully narrows this gap without justifying new push infrastructure yet - there is no evidence this session that carers are actually missing changes because they have to open the app to see Recent Activity rather than being pushed a notification. Reconsider only if real usage feedback (post-launch) shows collaborators are genuinely missing time-sensitive changes.

## 42. Handover / narrative export

**What Jointly exposed**: an exportable "Contingency Plan."

**Does Lilica now satisfy it?** Substantially more than at Phase 20A's own time of writing: Care Summary (Phase 20B) now provides exactly the "narrative, curated view" `docs/PHASE_20_GAP_AUDIT.md` section 22 said was missing, and `export_my_data()` (Phase 18B) already provides the complete, technically-exhaustive alternative. Combined, a user today CAN produce both a quick human-readable overview (open Care Summary) and a complete data export (Privacy & data) - just not as one combined "handover pack" document.

**Disposition: ADEQUATELY COVERED - NO NEW FEATURE.** The two existing capabilities, used together, satisfy the underlying need well enough that building a third, combined "pack" artifact is not justified without evidence the two-step version is genuinely insufficient. This is a real downgrade from Phase 20A's own P1/P2 framing, made possible specifically because Care Summary has since shipped - stated here explicitly as the reasoning, not silently assumed.

## 43. Contingency / emergency information

**What Jointly exposed**: a distinct "Contingency Plan" concept, structurally separate from ordinary browsing.

**Does Lilica now satisfy it?** Asking the brief's own explicit test directly - "if the primary carer suddenly became unavailable, could another authorised person quickly understand who Maggie is, key contacts, care information, tasks/appointments, documents, essential instructions?" - the honest answer is: **mostly yes, IF that person already has Care Circle access**. Care Summary alone now answers most of this in one screen (Key Contacts, Care Circle, Care information, Documents, Bills, upcoming/overdue work, recent activity, all in one bounded view) - a materially stronger answer than Phase 20A had available when it first identified this gap. What remains genuinely unaddressed: (a) someone WITHOUT existing Care Circle access has no path to this information in a genuine emergency (correctly, by design - Lilica does not implement an access-control bypass, and this document does not propose one); (b) there is no explicit "essential instructions" concept (e.g. "call 999 first, then call X" style guidance) distinct from ordinary care notes - a real, narrow, possibly-worthwhile addition, but not evidenced as urgent by anything in this session.

**Disposition: RECONSIDER BEFORE RELEASE, but narrowly.** Not "build an emergency system" - specifically, consider whether Care Summary's existing sections are sufficient framing for this exact use case, or whether a one-line addition (e.g. explicitly labelling Care Summary as also suitable for "if someone needs to step in quickly") would close the remaining gap in USER UNDERSTANDING rather than in actual capability. This is closer to a copy/framing decision than an engineering one.

## 44. Medication

**What Jointly exposed**: a dedicated medication module (current/past, image upload).

**Does Lilica now satisfy it?** No change since Phase 20A - medication information remains folded into generic `careNote` free text, with no structured dosage/schedule fields and (correctly, deliberately) no administration-tracking of any kind. Nothing built this session touches this.

**Disposition: KEEP DEFERRED**, exactly as Phase 20A concluded, and for the same reason: any structured version carries a real UK-GDPR special-category-data classification requiring legal review before a schema commitment (unchanged fact, not re-litigated here), and the brief's own explicit instruction (`prephase22.txt` section 39) not to build a module merely because a competitor has one is followed. Medication information (a structured but non-clinical "what/dose/schedule" reference) and medication administration/tracking (a much higher-risk, much higher-complexity concept) remain explicitly distinguished, per the brief's own instruction - only the former was ever a plausible candidate, and it remains gated on legal review, not ready for a product decision either way.

## 45. Supported-person profile fields

**What Jointly exposed**: DOB, condition, caring needs, likes/dislikes on a profile page.

**Does Lilica now satisfy it?** No change since Phase 20A. Still no structured fields; DOB remains deliberately excluded per the product's own standing decision.

**Disposition: KEEP DEFERRED**, same reasoning as Phase 20A (genuinely useful, but timing - mandatory vs. optional/post-onboarding - and the health-adjacent legal classification both remain unresolved, and nothing this session changes that analysis).

## 46. Contact import

**What Jointly exposed**: device address-book import for Key Contacts.

**Does Lilica now satisfy it?** No change since Phase 20A - manual entry only, no `expo-contacts` dependency installed.

**Disposition: KEEP DEFERRED.** Still a genuine, low-risk convenience win whenever prioritised, but nothing in this session's own work (navigation, lifecycle, documents) makes it more or less urgent than Phase 20A already assessed.

## 47. Contextual record comments

**What Jointly exposed**: (the narrower slice of general messaging Phase 20A identified) a short, attributable, timestamped note tied to one specific record.

**Does Lilica now satisfy it?** No change since Phase 20A - `careNote`/per-record `notes` fields remain static, single-value fields, not an append-only attributed history.

**Disposition: KEEP DEFERRED**, pending the same explicit product-owner scope decision Phase 20A already flagged (the real risk being scope creep from "comment on a record" into "general chat with a record-shaped entry point") - nothing resolved by this review.

## 48. Calendar export

**What Jointly exposed**: calendar invites to circle + external contacts; Lilica's own gap is one-way visibility in a carer's OWN calendar app.

**Does Lilica now satisfy it?** No change since Phase 20A - no `.ics` feed or export of any kind exists.

**Disposition: KEEP DEFERRED**, same P2 reasoning as before (a one-way export feed remains the recommended shape if ever pursued, not two-way sync).

## 49. Former-member visibility / cross-record filtering

**What Jointly exposed**: filtering any list (Events/Notes/Reminders/Tasks) by circle member; Lilica's own gap is no client-facing former-member list despite the underlying Phase 18B data existing.

**Does Lilica now satisfy it?** No change since Phase 20A for the filtering half. The former-member DATA itself is unaffected by this session's own `delete_care_space()` work in the ordinary case (deleting one member's account still correctly produces a `former_display_name` snapshot via `delete_my_account()`, untouched) - but Phase 20D's own analysis (section 19 of that document) surfaces a related, NEW finding: whole-care-space deletion now deletes former-member snapshots ALONG WITH the space, whereas they previously only ever disappeared when the entire account they belonged to was separately, individually deleted. This is a natural, correct consequence of choosing full deletion as the space-ending mechanism, not a defect in this specific feature - flagged here for completeness since it touches this exact backlog item.

**Disposition: KEEP DEFERRED** for the original filtering/UI gap; **no new action recommended** regarding the interaction with `delete_care_space()`, since that behaviour was already analysed and accepted in `docs/PHASE_20D_CARE_SPACE_LIFECYCLE_PROPOSAL.md` section 19/31.

## 50. Documents collection

**What Jointly exposed**: (not a direct Jointly feature, but the same underlying "can I browse everything of type X" need Jointly's own module-per-category structure incidentally satisfies for documents specifically).

**Does Lilica now satisfy it?** No - this is the exact gap `docs/PHASE_20E_DOCUMENTS_PROPOSAL.md` analyses in full. Not resolved by this review; see that document for the complete proposal.

**Disposition: RECOMMEND BEFORE RELEASE.** Of every item revisited in this Part D review, this is the one this document actively recommends acting on soon, specifically because `docs/PHASE_20E_DOCUMENTS_PROPOSAL.md` section 39 assesses it as low engineering risk/cost relative to its real, plainly-stated user value ("show me Maggie's documents") - a meaningfully different risk/value ratio than every other still-deferred item above, most of which carry either a legal gate (medication, profile fields) or a genuine, unresolved scope-creep risk (contextual comments) that Documents does not.

---

## Final gap dispositions (consolidated, per the brief's own five-category taxonomy)

**A. NO LONGER A GAP**: none of the ten revisited items - even where a related capability shipped (Recent Activity, Care Summary), each item's own FULL original need is only partially rather than completely satisfied, so "no longer a gap" was not assigned to any of them; the closest is #42 (Handover/export), assigned category B instead since the need is met by combining two existing tools, not by any one feature being literally unnecessary.

**B. ADEQUATELY COVERED - NO NEW FEATURE**:
- Handover / narrative export (#42)

**C. KEEP DEFERRED**:
- Collaboration notifications (#41)
- Medication (#44)
- Supported-person profile fields (#45)
- Contact import (#46)
- Contextual record comments (#47)
- Calendar export (#48)
- Former-member visibility/filtering (#49)

**D. RECONSIDER BEFORE RELEASE**:
- Contingency/emergency information (#43) - narrowly, as a framing/copy question about Care Summary, not a new build

**E. RECOMMEND BEFORE RELEASE**:
- Documents collection (#50) - see `docs/PHASE_20E_DOCUMENTS_PROPOSAL.md` for the full proposal

No item was assigned "RECOMMEND BEFORE RELEASE" purely because Jointly has it - each recommendation above traces to a specific, named, current-state reason (low engineering cost relative to a plainly real gap, for Documents; a framing question rather than a feature gap, for Contingency information), consistent with the brief's own repeated instruction not to chase menu parity for its own sake.
