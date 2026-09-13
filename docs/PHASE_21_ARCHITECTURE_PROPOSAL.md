# Phase 21A - Billing, Subscription & Membership/Entitlement: Architecture Proposal

**This is a PROPOSAL, not the final architecture.** No line of billing code, no dependency, no migration, no schema exists yet. This document exists so GPT and the product owner can approve (or amend) the architecture before `docs/PHASE_21_ARCHITECTURE.md` and any Phase 21B implementation brief are written. Nothing in this document is implemented. See the completion report for the explicit zero-implementation confirmation.

## 1. Approved commercial model (recorded, not redesigned)

Lilica is completely free for two months. After that, £8.99/year to continue actively using it. No monthly tier, no freemium tier, no feature-tier ladder, no per-record charge, no advertising, no per-supported-person charge currently intended. This section is a record of the brief's own decision, not a proposal - it is not questioned below.

## 2. Current account/care-space architecture (traced before proposing anything)

- `auth.users` (Supabase Auth) is the one stable account identity. `public.profiles` (1:1 with `auth.users.id`) holds the organiser's own display name/avatar.
- `care_spaces` (`id`, `bootstrap_owner_id references auth.users`, `bootstrap_id`) - one row per supported person's security/data partition. **`bootstrap_owner_id` is explicitly commented in its own migration as "idempotency metadata only; access is granted exclusively through membership"** - it is nullable since Phase 18B (detached, never deleted, on account deletion) and was never intended as an authority field. This is the single most important existing-architecture finding for Phase 21: **`bootstrap_owner_id` must not be repurposed as billing ownership** - it already carries a different, narrower meaning, and overloading it would contradict its own documented purpose and its Phase 18B detachment behaviour (detaching it currently has zero access consequence; making it also mean "who pays" would suddenly make that detachment commercially significant, which nothing in Phase 18B accounted for).
- `care_space_memberships` (`care_space_id`, `user_id` nullable since Phase 18B, `role` - `organiser`/`contributor`/`viewer`, `membership_status` - `active`/`revoked`/`former`) is the sole security/collaboration record. `role = organiser` already means "unconditional access to this care space," and a care space can have **more than one** organiser (Phase 15's `change_member_role()`/multiple invitations already allow this) - there is no existing 1:1 assumption between "a care space" and "a single responsible person" to lean on.
- No commercial/billing field exists anywhere in this schema today. No `entitlement`, `subscription`, `trial`, or `billing_owner` concept exists.

## 3. Recommended commercial ownership model

**A care space has exactly one `commercial_owner_id` (a `care_space_id` → the owning `auth.users.id`), set once at creation to the bootstrapping user, distinct from and never derived from `bootstrap_owner_id` or from `role = organiser`.** This is Option A below; it was chosen over the alternatives.

- **OPTION A - a dedicated `commercial_owner_id` column on `care_spaces`** (or an equally simple separate 1:1 table, `care_space_billing_owner`). *Benefits*: one obvious, queryable fact per care space; trivially answers "does this care space have active entitlement" via one join to the owner's own entitlement row; completely independent of how many organisers/contributors/viewers exist or churn; survives an organiser being removed/leaving without any special-case logic (the commercial owner is a fact about the care space, not about its current membership list). *Drawbacks*: needs an explicit transfer mechanism for the rare "owner leaves and someone else must become responsible" case (Scenario F/H below - addressed in section 8). *Complexity*: low. *Security*: low risk - a single foreign key, no new access-control surface. *Recommendation*: **adopt this.**
- **OPTION B - reuse `bootstrap_owner_id` as the commercial owner.** *Drawbacks*: directly contradicts that column's own documented purpose and its established Phase 18B detachment semantics (see above) - this would be a real regression risk to already-shipped, already-tested behaviour. **Rejected.**
- **OPTION C - derive commercial ownership implicitly from "the first active organiser."** *Drawbacks*: ambiguous and unstable in a multi-organiser space (which one? the one added first? the one with the earliest membership row?), and would silently change meaning the moment organisers are added/removed/reordered - exactly the "role = organiser automatically equivalent to must pay" trap section 8 of the brief warns against. **Rejected.**

Entitlement itself (trial/subscription state) is then modelled **per user account** (`auth.users.id`), not per care space - a user's own `entitlement` row says whether *they* are currently entitled, and a care space's own active-use gate is "does this care space's `commercial_owner_id` currently hold active entitlement." This cleanly answers section 6 (multiple supported people) for free: one entitled David covers every care space where `commercial_owner_id = David`, with zero extra schema.

## 4. Multiple-supported-person behaviour

Direct consequence of section 3: David subscribes once; every care space with `commercial_owner_id = David` (Beauty, Jackie, any future person he bootstraps) is covered by that one entitlement row. No per-care-space charge, no schema needed to express "N care spaces, 1 subscription" beyond the foreign key already described. Bootstrapping a new supported person simply inserts a new `care_spaces` row with `commercial_owner_id` set to the bootstrapping user - no separate purchase event, no additional entitlement row.

## 5. Care Circle collaborator behaviour

A collaborator's (Contributor/Viewer's) ability to actively mutate a care space depends on **two independent, both-must-pass conditions**: (1) their own Care Circle permission (unchanged, Phase 15's existing role/domain-grant model) and (2) that care space's own commercial entitlement (via its `commercial_owner_id`'s entitlement state) being in an active-mutation-permitted state. **A collaborator never needs their own personal subscription to help in someone else's entitled care space** - Scenario A's expected direction, satisfied structurally: Marion's own `entitlement` row (if she even has one) is irrelevant to whether she can help with Beauty; only Beauty's `commercial_owner_id` (David)'s entitlement matters for Beauty. Marion's own personal care space (Scenario E) has its own, entirely independent `commercial_owner_id` (Marion) and entitlement - the two are structurally unrelated, answering Scenario E directly: yes, fully independent, by construction, not by an extra check.

## 6. Multi-organiser behaviour

Two organisers do not automatically mean two payers (section 8's own warning, directly honoured): `role = organiser` is a security concept; `commercial_owner_id` is a separate commercial fact that happens to usually - but not necessarily - be held by one of the care space's organisers. **Scenario D (two organisers, David's subscription expires, Marion's is active) is a genuine open product decision, not resolved by architecture alone** - the architecture supports either of two policies, and this document flags this as an open decision requiring product-owner approval (see section 41 of the completion report):
- **Policy 1 (recommended): entitlement stays tied to the specific `commercial_owner_id`.** Beauty becomes read-only when David's entitlement lapses, regardless of Marion's own unrelated subscription, unless/until the commercial ownership is explicitly transferred to Marion (section 8's transfer mechanism). This is simpler, more predictable, and avoids an ambiguous "whichever organiser happens to be entitled covers everyone" rule that would make the commercial relationship opaque to the very people relying on it.
- **Policy 2 (rejected, but named): any active organiser's own entitlement keeps the space active.** *Drawbacks*: reintroduces exactly the ambiguity section 8 warns against (now "is this space active" depends on an unstated OR across a variable, sometimes large set of organisers), complicates the read-only/active state machine (it must now be recomputed on every organiser add/remove/entitlement change across potentially several people, rather than one owner lookup), and creates a perverse incentive for organisers to avoid ever declaring themselves the payer since someone else's entitlement quietly covers them. **Recommended against.**

## 7. Billing-owner continuity model (Scenario F/H)

When the commercial owner leaves the care space (Scenario F) or becomes unavailable (Scenario H), commercial ownership does **not** automatically transfer to another organiser (that would reintroduce Policy 2's ambiguity). Instead: **a small, explicit `transfer_care_space_commercial_ownership(care_space_id, new_owner_membership_id)` RPC, callable only by the current commercial owner (self-transfer, e.g. "I'm leaving, make Marion the payer") or, when the current owner's membership is no longer active (left/removed/former), by any remaining active organiser** (covering Scenario H, where the original owner cannot act). This is explicitly **not** a general "transfer between arbitrary users" feature (section 28's own prohibition) - it only ever reassigns which already-active organiser is commercially responsible for a care space they already have full security access to; it never touches the underlying Apple/Google purchase itself (a `commercial_owner_id` change does not create, cancel, or move any store subscription - Marion would need her own entitlement, or David's subscription continues covering the space under his name until he actively transfers it). Recommended for the Phase 21B implementation sequence, not built now.

## 8. Trial-start recommendation

**Recommended authoritative event: the first successful `bootstrap_supported_people()` call for that account** (i.e., the moment the user actually creates their first supported person/care space - not account creation, not email verification, not "completion of onboarding" as a separate concept, since bootstrapping a person already coincides with the practical end of onboarding in this app's architecture). *Why this event and not the alternatives*: account creation/email verification/first login all happen before the user has done anything Lilica-specific - starting a trial clock before someone has even created a supported person risks the free period partly expiring during account setup for a slow or interrupted onboarding, which feels unfair and is not what "try Lilica free for two months" should mean. "First meaningful care record" is too fuzzy to be a single authoritative event (which record? does an update-only record count?). Bootstrapping is the one clean, already-transactional, already-idempotent event (`bootstrap_supported_people()` is `security definer`, already the sole entry point) that unambiguously marks "the user has actually started using Lilica for a real supported person."

**Server-authoritative, never client-derived**: `trial_started_at` is written exactly once, server-side, inside (or immediately after, in the same transaction) the first successful `bootstrap_supported_people()` call for that `auth.users.id` - guarded so a second bootstrap call (adding a second supported person) never overwrites it. This structurally satisfies the brief's own list of things the trial must not do: reinstalling, logging out/in, switching device, creating another supported person, or clearing local storage all leave the server's own `trial_started_at` untouched, because none of them can re-trigure a *first* bootstrap for an account that already has one.

## 9. Exact two-month semantics

**Product-owner update: the free period is now two months, not one - a deliberate strategic choice to build more dependency on the product before the purchase decision, per direct product-owner instruction.** Recommended: exactly 60×24 hours (a fixed 60-day duration) from `trial_started_at`, not "two calendar months." *Why*: a calendar-month rule is genuinely ambiguous at month-end (the brief's own example - started 31 January, calendar-month expiry has no unambiguous "31 February," and the same problem recurs at "two months after 31 January" - would need an arbitrary fallback rule such as "last day of the following-following month," which is exactly the kind of ambiguity the brief asks to avoid) and calendar months vary in length (28-31 days), meaning two users starting a day apart could get meaningfully different trial lengths depending purely on which months they span. A fixed 60-day duration is: predictable (every user gets exactly the same trial length, always); technically robust (`trial_started_at + interval '60 days'`, one deterministic Postgres expression, no calendar-arithmetic edge cases); easy to explain ("your free two months" reads naturally even though it is precisely 60 days, not two-calendar-months-exact - nobody notices or cares about the 1-2 day difference from two true calendar months); and compatible with Apple/Google, whose own introductory-trial periods are themselves expressed in fixed day/week/month units, not calendar-month boundaries - see section 11.

## 10. App-managed vs store-managed trial recommendation

**Recommended: Option A - an app-managed, server-tracked two-month free period, with no store subscription started until the user actively chooses to subscribe at (or before) expiry.** Compared directly against Option B (an immediate annual store subscription with a store-provided two-month introductory free trial):

| | Option A: app-managed free period | Option B: store-managed intro trial |
|---|---|---|
| User friction to START using Lilica | None - no payment details required at all | Must enter payment details / confirm a subscription up front, even though nothing is charged for two months |
| Automatic charging | Never happens without an explicit, separate purchase action at/after expiry | Happens automatically at trial end unless the user separately remembers to cancel - a real source of complaints/chargebacks for exactly this "forgot to cancel" reason across the industry |
| Matches the product owner's own stated proposition ("use it free for two months; if useful, it's £8.99") | Exactly - the free period and the purchase decision are two clearly separate, sequential moments | Not quite - technically an immediate purchase decision (with deferred billing) rather than a genuinely no-commitment trial, which is a materially different psychological/legal framing even if the free-period cost is identical |
| App Store / Google Play rules | Fully compatible - nothing prevents an app from being free-to-use before a purchase decision | Also compatible, but requires the subscription's own introductory-offer configuration and carries the platforms' own auto-renewal disclosure obligations (Apple's April 2026 guideline update explicitly requires telling the user what they get/cost/duration/cancellation before they sign up - see section 32) applying at the START of the free period rather than at its end |
| Conversion | Likely somewhat lower raw "started a subscription" number (since Option B counts everyone who begins the free trial as already subscribed), but conversion quality/trust is likely higher, since the eventual £8.99 charge is a genuine, freshly made decision rather than an unremembered auto-charge | Higher nominal "trial starts," but a materially higher share never intended to pay past the free period and simply forgot to cancel - this inflates apparent conversion while increasing refund/chargeback/complaint risk |
| Customer trust | High - matches what was promised in plain language | Risk of "I didn't know I'd already started a subscription" complaints, a known industry pain point | 
| Entitlement architecture | Server tracks `trial_started_at`/`trial_expires_at` independent of any store product; the store product is only ever created at the moment of an actual purchase | Requires the store's own trial-state to be treated as authoritative from day one, and requires verifying a "trial" transaction identically to a paid one from the very start |
| Restore/cross-platform behaviour | Simpler - nothing to restore until an actual purchase exists; the free period itself is purely an account-level fact, not a store transaction | A trial-in-progress technically has a receipt/transaction to restore, adding an extra state to every restore-flow branch for no real user benefit |

**Recommendation: Option A**, primarily on customer-trust and product-fidelity grounds (it is what was actually promised) and secondarily on lower engineering/entitlement-state complexity - this is not a decision made on engineering convenience alone, but the simpler option also happens to be the one that best matches the proposition, which is the strongest possible justification for it.

## 11. Direct store integration vs subscription-management service

**Recommended: use a subscription-management service (RevenueCat) rather than direct StoreKit/Google Play Billing integration, specifically because Lilica's product shape (exactly one product, one price, two platforms) is the case such a service is cheapest and most valuable for, not despite it being simple.**

| | Direct integration (StoreKit 2 + Google Play Billing separately) | RevenueCat (or equivalent) |
|---|---|---|
| Cost | No vendor fee, but real engineering time to build and MAINTAIN two separate, platform-specific receipt-verification/webhook pipelines | Free until $2,500/month tracked revenue (verified current pricing, September 2026 - see sources below), then 1% of tracked revenue - at Lilica's likely early-stage revenue, this is £0 for a long time, and even at scale is a small fraction of the £8.99 price |
| Complexity | Must independently implement Apple Server Notifications V2 verification AND Google Real-time Developer Notifications verification, each with its own JWT/signature format, retry semantics, and payload shape - two full, separately-maintained integrations for one product | One unified webhook format and one unified entitlement API across both stores - Lilica's own server only ever needs to understand ONE notification shape, not two |
| Reliability | Correctness depends entirely on Lilica's own, first-time implementation of two vendor-specific verification protocols - a materially higher bug-surface for a small team building this for the first time | A widely-used, already-hardened implementation of exactly this problem, used by a large number of production apps - lower first-time-implementation risk |
| Server requirements | Lilica's own Supabase Edge Functions would need to implement receipt verification against Apple's/Google's own APIs directly | RevenueCat handles verification; Lilica's Supabase Edge Function only needs to verify RevenueCat's own (simpler, unified) webhook signature and update the local `entitlement` table |
| Cross-platform consistency | Two independent code paths that must be kept behaviourally identical by hand | One consistent entitlement model surfaced identically regardless of platform |
| Maintenance | Apple/Google both evolve their own APIs/notification formats independently over time - Lilica would need to track both | RevenueCat absorbs platform API changes; Lilica's own integration surface changes rarely |
| Privacy/data implications | Lilica would see and store raw Apple/Google receipt/transaction identifiers directly | RevenueCat sits between Lilica and the stores; Lilica still needs to retain a minimal identifier (see section 34) but does not need to parse or directly relay raw store receipts itself |
| Vendor dependency | None (no third party) | A real, material dependency - if RevenueCat has an outage, purchase verification for new purchases would be delayed until it recovers (existing entitlement state cached server-side is unaffected - see the offline design in section 12) |

**Recommendation: RevenueCat.** For a single-product, two-platform, small-scale app, the cost is effectively zero at launch, and the engineering-risk reduction (one unified webhook/verification path instead of two vendor-specific ones, built for the first time) materially outweighs the one real cost (a third-party dependency) - this is not "RevenueCat because it's popular," it is RevenueCat because Lilica's own shape (one product) is exactly the case where a unification layer earns its dependency cost back immediately, per the brief's own instruction to compare on Lilica's actual scale rather than in the abstract. `Store Kit`/`Google Play Billing` remain the actual purchase-flow libraries on-device either way (RevenueCat wraps them, it does not replace the platform purchase sheet) - this recommendation is about the *verification/entitlement* layer, not the purchase UI itself.

Sources consulted (per the brief's own instruction not to rely on remembered pricing): RevenueCat's own current (2026) published pricing - free up to $2,500 monthly tracked revenue, 1% of MTR above that.

## 12. Proposed entitlement state machine

Not necessarily these exact names, but this exact shape - **no ambiguous boolean premium flag anywhere**:

| State | Meaning | Active mutations | Read access | Export | Care Circle participation (as a collaborator) | Purchase/restore available | Offline behaviour |
|---|---|---|---|---|---|---|---|
| `TRIAL_ACTIVE` | Within 60 days of `trial_started_at`, no purchase yet | Yes | Yes | Yes | Yes (their own space's owner is in trial) | Yes (can purchase early) | Cached, works normally within a reasonable re-verification window |
| `TRIAL_EXPIRED` | 60 days elapsed, no purchase | No (read-only) | Yes | Yes | No, for spaces owned by this account | Yes | Cached "expired" state persists; does not silently re-grant access |
| `SUBSCRIPTION_ACTIVE` | Verified, current paid subscription | Yes | Yes | Yes | Yes | Yes (restore/manage) | Cached, works normally within re-verification window |
| `GRACE_PERIOD` | Renewal payment failed; store is retrying, still within its own grace window | Yes (deliberately generous - see below) | Yes | Yes | Yes | Yes | Treated as active for continued-use purposes |
| `BILLING_RETRY` / `ACCOUNT_HOLD` | Store-specific extended failure state beyond grace | No (read-only) | Yes | Yes | No | Yes | Cached state persists |
| `SUBSCRIPTION_EXPIRED` | Subscription lapsed with no further store retry pending | No (read-only) | Yes | Yes | No | Yes | Cached state persists |
| `REVOKED` / `REFUNDED` | Store revoked/refunded the purchase | No (read-only) | Yes | Yes | No | Yes (can re-purchase) | Cached state persists; never re-grants access based on stale local data |
| `UNKNOWN` / `VERIFICATION_REQUIRED` | Server cannot yet establish a verified state (new account pre-trial-start, or verification pending) | No (read-only, conservative default) | Yes | Yes | No | Yes | See offline design below - this is the deliberately conservative fallback, never `TRIAL_ACTIVE`/`SUBSCRIPTION_ACTIVE` by default |

`GRACE_PERIOD` is deliberately treated the same as active-and-entitled: Apple's and Google's own grace-period mechanics exist precisely so a legitimate subscriber with a temporarily failed card is not immediately locked out while the store itself keeps retrying - Lilica should not be stricter than the platform's own intended behaviour here.

## 13. Read-only rules (product principle, technical model)

Confirmed and adopted verbatim from the brief's own section 3/4: expiry never removes access to previously entered information. Viewing/navigating/searching Calendar/To Do/People/Care Summary/Recent Activity, reading documents, exporting, Privacy & Data, account deletion, and subscription management/restoration all remain available in every non-mutating state above. Only active care-management mutation (add/edit/delete/complete/reopen/mark-paid/assign/upload/reminder-change/Care-Circle-membership-and-permission-change) is gated. See section 15 for the exact mutation inventory and section 16 for exactly where this is enforced.

## 14. Complete mutation inventory (brief section 31)

| Mutation path | Entitlement required? |
|---|---|
| `apply_record_mutation()` (create/import/update/delete of any record) | **YES** |
| Completion/reopen (a specific `update` shape of the above) | YES (same path) |
| Assignment change (same path) | YES (same path) |
| Date change (same path) | YES (same path) |
| Reminder toggle (client-only field inside `record_data`, same path) | YES (same path - no separate gate needed) |
| `upsert_record_attachment()` / `mark_attachment_upload_status()` (document upload) | **YES** |
| `remove_record_attachment()` | YES |
| `create_record_link()` / `remove_record_link()` | YES |
| `invite_member()` (sending a Care Circle invitation) | **YES** - inviting more collaborators is active care-space management |
| `accept_invitation()` | **NO - see section 32's explicit recommendation below** |
| `decline_invitation()` | NO (a safety/account-control action, symmetrical with accept) |
| `revoke_invitation()` | YES (organiser actively managing the space) |
| `change_member_role()` | YES |
| `remove_member()` | YES |
| `leave_care_space()` | **NO - see section 32** |
| `bootstrap_supported_people()` (creating a NEW supported person) | **YES for a SECOND+ person** - the very first bootstrap for a brand-new account must NOT be gated (there is no entitlement state to check yet; this is the event that STARTS the trial, per section 8) |
| `delete_my_account()` | **NO - never gated, regardless of entitlement state** |
| `export_my_data()` / `account_deletion_precheck()` | **NO - never gated** |
| `resolve_membership_identities()`, `list_*` read-only RPCs (members, invitations, activity) | NO - reads are never gated |
| Profile display-name/avatar change (`AuthProvider.saveProfile`, `uploadProfilePhoto`) | Proposed **NO** - account-identity actions, not care-space management; flagged as an open decision in the completion report since it is genuinely borderline (not explicitly listed in the brief's own examples either way) |

## 15. Server enforcement design

**One shared, small function, not duplicated logic across RPCs.** Proposed: `public.care_space_has_active_entitlement(target_care_space_id uuid) returns boolean` (`security definer`, `stable`) - resolves `care_spaces.commercial_owner_id` → that owner's `entitlement` row → whether its current state is in the "mutation-permitted" set (`TRIAL_ACTIVE`, `SUBSCRIPTION_ACTIVE`, `GRACE_PERIOD`). Every mutation RPC in the "YES" column of section 14 adds exactly one new check, in the same place its existing membership/domain check already lives: `if not public.care_space_has_active_entitlement(target_care_space_id) then raise exception 'Subscription required to continue managing this care space' using errcode = '42501'; end if;` - a single, consistent, easily-auditable line, not a bespoke reimplementation per function. This mirrors the exact pattern `can_access_care_space_records()` already established for permission checks: one shared decision function, called consistently, never inlined differently in different places.

**Collaborator enforcement (section 18 of the brief)**: unchanged from the above - a collaborator's own Care Circle domain-grant check and the shared entitlement check are simply two independent conditions both evaluated inside the same RPC, exactly as `apply_record_mutation()` already evaluates domain-write-access and assignee-visibility as two independent conditions today. Commercial entitlement is never used as a substitute for RLS, and RLS is never used as a substitute for entitlement - they remain two separate, both-required gates.

**What must NOT be touched**: read-only RLS `select` policies (already correct, unaffected), `export_my_data()`, `account_deletion_precheck()`/`delete_my_account()`, and every `list_*` read RPC - none of these gain an entitlement check, per the brief's own explicit instruction not to accidentally block essential account/privacy actions.

## 16. Offline entitlement design

- The client caches the last **server-verified** entitlement state plus a `last_verified_at` timestamp (mirroring the existing `recordSync.ts` cache-with-timestamp pattern already used for records) - never a bare boolean, and never trusted as authoritative for a server-side mutation (the server always re-checks via section 15's function regardless of what the client believes).
- **Reasonable offline grace**: a cached `TRIAL_ACTIVE`/`SUBSCRIPTION_ACTIVE`/`GRACE_PERIOD` state remains usable client-side (the UI does not block mutation attempts) for a bounded window since `last_verified_at` - proposed 72 hours, long enough to cover a genuinely offline day or two (a lift, a rural area, a flight) without indefinitely trusting a stale cache. Past that window, the client shows a "reconnect to confirm your subscription" state rather than either silently blocking (annoying for someone who is still entitled) or silently allowing forever (defeats the purpose of server authority).
- **The critical case named in section 16 of the brief**: a mutation is created offline while the client believes entitlement is active, but by the time it reaches the server (via the existing outbox/retry mechanism), entitlement has genuinely expired. **The server remains authoritative and rejects the mutation** - but the user's work must not be silently discarded. Recommended: the existing outbox entry, on a `42501` entitlement-rejection response specifically (distinguished from a genuine conflict/version-mismatch response, which the outbox already handles differently), is moved to a small "couldn't be saved - subscription needed" holding area rather than being dropped, discarded, or endlessly retried - the same UX pattern already established for a permanently-failed document-cleanup entry (`src/documentCleanupQueue.ts`'s own retry-with-visible-failure-state precedent), reused rather than inventing a new one. The user is told clearly what happened and can subscribe to have that specific pending change applied, or discard it themselves. This is a genuinely new small piece of Phase 21B client work, named explicitly here rather than left implicit.

## 17. iOS → Android entitlement behaviour, and vice versa

**Recommended: entitlement follows the Lilica account, not the platform or device - a subscription purchased on iOS is recognised when the same account logs into Lilica on Android, and vice versa**, once the server has verified it (via RevenueCat, which already unifies cross-platform entitlement per Lilica account under one App User ID). This matches the actual commercial proposition (a Lilica account subscription, not "one purchase per device"), and neither Apple's nor Google's own policies prohibit an app recognising entitlement across platforms for the same logical account - restore/entitlement recognition is explicitly an app-level, not a platform-enforced, concept once the purchase itself has been made through that platform's own store. The one genuine constraint: the purchase itself always happens through whichever store the purchasing device used (Apple cannot be asked to refund/cancel a Google Play purchase or vice versa) - cross-platform recognition is about entitlement *state*, never about moving the underlying store transaction itself.

## 18. Restore behaviour

Restore must succeed identically for: reinstall, new iPhone, new Android, logout/login, and app data cleared - all of these are cases where the LOCAL cache is gone but the SERVER's own entitlement row (keyed to the account, resolved via section 27's stable identity, never local storage) is untouched. "Restore" in this architecture is therefore mostly just "log in, then re-fetch the server's own entitlement state" - the store-level "Restore Purchases" button exists specifically for the case where RevenueCat's own record has not yet been associated with the correct account (e.g., a fresh app install that has not logged in yet, or a genuinely new RevenueCat App User ID) and needs to re-associate the device's own store receipt.

## 19. Refund/revocation behaviour

Apple's/Google's own server notifications (relayed via RevenueCat's unified webhook) update the account's `entitlement` row to `REVOKED`/`REFUNDED` - the care space(s) that account commercially owns move to read-only on the next entitlement check, exactly like any other expiry. No special-case logic beyond the state machine already covering it. Existing care information remains readable under the same safety principle as any other non-mutating state (section 13).

## 20. Account deletion behaviour

`delete_my_account()` (Phase 18B, unchanged) is never gated by entitlement - deleting your account must always work regardless of subscription state. What Phase 21B must add: **Lilica does NOT and cannot cancel an Apple/Google subscription on the user's behalf** - neither store provides an API for a third-party server to cancel a user's own subscription (this is a deliberate platform design; only the user, through the store's own subscription-management surface, or the store itself can do that). Deleting a Lilica account therefore must **disclose this clearly** ("Deleting your Lilica account does not cancel an active App Store/Google Play subscription - manage or cancel it directly in [Settings → Subscriptions / Play Store → Subscriptions] to stop future charges") before the user confirms deletion, exactly the kind of disclosure Apple's own April 2026 guideline update already expects apps to be explicit about. Server-side, `delete_my_account()`'s own detachment logic (unchanged) still runs; a care space that account commercially owned needs its own resolution (see below) rather than being left with a dangling `commercial_owner_id` pointing at a deleted user.

**Care-space continuity on billing-owner account deletion (Scenario G)**: `commercial_owner_id` should become nullable (mirroring `care_spaces.bootstrap_owner_id`'s own established Phase 18B pattern exactly) and be set to null on account deletion, moving every care space that account commercially owned into an unowned, effectively-expired state (no owner to check entitlement against) unless another active organiser uses the transfer mechanism from section 8 to claim it - the same continuity path Scenario H already needs, reused rather than building a second mechanism. Surviving shared data (records, links, attachments, assignments) is entirely unaffected, exactly as Phase 18B already established for security membership.

## 21. Subscription/care-space ownership separation

Fully separated per sections 2-8 above: `commercial_owner_id` (commercial fact, one per care space) is structurally independent of `care_space_memberships.role` (security fact, many per care space) and of `entitlement` (a fact about a user account, not about a care space at all). No table mixes commercial fields into `records` or into `care_space_memberships` - a new, small, dedicated commercial schema is proposed below instead.

## 22. Proposed schema

All in a new, dedicated area - never mixed into `records`, per the brief's own explicit instruction.

- **`care_spaces.commercial_owner_id uuid references auth.users(id) on delete set null`** (new nullable column on the existing table - the one place a commercial concept touches an existing table, and only as a plain reference, mirroring `bootstrap_owner_id`'s own existing nullable-on-delete pattern exactly). *Purpose*: which account is commercially responsible for this care space. *Source of truth*: server, set at creation, changed only via the transfer RPC. *Read*: any active member of the care space (needed to explain read-only state accurately). *Write*: only via `bootstrap_supported_people()` (initial set) and `transfer_care_space_commercial_ownership()` (change) - never direct client writes. *RLS*: covered by the existing `care_spaces` row's own policies; no new policy needed since it is just a column, not a new access surface. *Retention/deletion*: `on delete set null`, exactly like `bootstrap_owner_id`.
- **`public.entitlements`** (one row per `auth.users.id`): `user_id` (PK, references `auth.users`), `entitlement_status` (the state-machine value from section 12), `trial_started_at`, `trial_expires_at` (generated/computed as `trial_started_at + interval '60 days'`, never stored redundantly-mutable), `provider` (`'revenuecat'`), `provider_app_user_id` (RevenueCat's own stable identifier for this account - see section 27), `entitlement_expires_at` (the current period's end, from the provider), `last_verified_at`, `updated_at`. *Purpose*: the one authoritative commercial-state row per account. *Source of truth*: server, written only by a `security definer` function invoked from the RevenueCat webhook handler (an Edge Function) and by the trial-start logic inside `bootstrap_supported_people()`. *Read*: the row's own owner (`auth.uid() = user_id`) only - no other user, including a fellow Care Circle member, ever reads another account's own entitlement row directly (they only ever see the DERIVED "is this care space active" boolean via `care_space_has_active_entitlement()`, never the raw entitlement detail of an account that is not their own). *Write*: never directly by any client - only by the two security-definer paths named above. *RLS*: `select` only, `auth.uid() = user_id`; no `insert`/`update`/`delete` grant to `authenticated` at all. *Deletion*: removed (or anonymised, TBD in Phase 21B) on account deletion, consistent with Phase 18B's own account-deletion philosophy.
- **`public.entitlement_events`** (append-only, mirroring `care_space_activity`'s own established immutable-log pattern): `id`, `user_id`, `event_type` (`trial_started`, `purchase_verified`, `renewed`, `grace_period_entered`, `expired`, `revoked`, `restored`, `ownership_transferred`), `provider_event_id` (for webhook idempotency - see below), `metadata jsonb`, `created_at`. *Purpose*: an audit trail distinct from the current-state `entitlements` row - useful for support/debugging ("why does this account show expired?") without needing to replay provider webhooks. *Read*: the row's own owner only. *Write*: only by the same two security-definer paths. *RLS*: `select` only, owner-scoped; immutable by the same before-update/delete-raises-exception trigger pattern `care_space_activity` already established.
- **`care_space_has_active_entitlement(care_space_id) returns boolean`**: the one shared decision function described in section 15.
- **`transfer_care_space_commercial_ownership(care_space_id, new_owner_membership_id)`**: the RPC described in section 8.

This is deliberately the MINIMUM durable state - no separate "subscription products" table (there is exactly one product), no per-supported-person billing row (entitlement is per account, not per care space, per section 3), no client-writable field anywhere in this schema.

## 23. Proposed RPC/server changes

New: `care_space_has_active_entitlement()`, `transfer_care_space_commercial_ownership()`, an Edge Function receiving RevenueCat's webhook and calling a new `security definer` `apply_entitlement_update(...)` function that writes `entitlements`/`entitlement_events`. Redefined (same signature, one added check each, exactly as Phase 15/20B already established this pattern): `apply_record_mutation()`, `upsert_record_attachment()`, `mark_attachment_upload_status()`, `remove_record_attachment()`, `create_record_link()`/`remove_record_link()`, `invite_member()`, `revoke_invitation()`, `change_member_role()`, `remove_member()`, `bootstrap_supported_people()` (for a second-or-later person only). Explicitly NOT redefined: `accept_invitation()`, `decline_invitation()`, `leave_care_space()`, `delete_my_account()`, `export_my_data()`, `account_deletion_precheck()`, every `list_*` read RPC.

## 24. Store-verification architecture

RevenueCat's SDK on-device initiates the actual StoreKit 2 / Google Play Billing purchase flow (the native purchase sheet remains exactly what Apple/Google require - RevenueCat does not replace this, it wraps it). RevenueCat itself performs the authoritative server-to-server verification against Apple's/Google's own APIs (Lilica's own server never talks to Apple/Google directly). RevenueCat then calls Lilica's own Supabase Edge Function webhook with a verified, unified event; that function verifies RevenueCat's own webhook signature (a much simpler, single format, compared to independently verifying two different platforms' own signature schemes) and calls `apply_entitlement_update()`. A client-side purchase-completion callback is never trusted alone - the client only ever OPTIMISTICALLY shows "activating your subscription…" and then re-fetches the server's own `entitlements` row once the webhook has actually landed (typically near-instant, with a bounded client-side wait/poll before falling back to "we're confirming this - check back shortly").

## 25. Server-notification/webhook architecture

One Supabase Edge Function, `entitlement-webhook`, receiving RevenueCat's own unified webhook (which itself aggregates Apple's App Store Server Notifications V2 and Google's Real-time Developer Notifications - Lilica's own code never needs to parse either platform's native notification format directly). Idempotency: RevenueCat's webhook payload carries its own event id; `apply_entitlement_update()` checks `entitlement_events.provider_event_id` before applying (the exact same idempotency-ledger pattern `record_mutation_receipts`/`operation_id` already established) - a redelivered webhook (both RevenueCat's own retry behaviour and a defensive re-processing on Lilica's own side) can never double-apply a state change. Webhook authenticity: verified via RevenueCat's own provided webhook-signing-secret/shared-authorization-header mechanism (the specific current mechanism to be confirmed against RevenueCat's own current webhook documentation at Phase 21B implementation time, not guessed here) - an unsigned or wrongly-signed request is rejected outright, never trusted.

## 26. Security threat model

| Threat | Mitigation |
|---|---|
| Modified client claims premium | Server never trusts a client-asserted entitlement value for any mutation - every gated RPC calls `care_space_has_active_entitlement()` itself, reading only the server's own `entitlements` row |
| Replayed purchase receipt/token | RevenueCat's own server-side verification against Apple/Google rejects a replayed/already-consumed receipt; Lilica's own webhook idempotency (`provider_event_id`) additionally prevents a replayed WEBHOOK from double-applying even a legitimate event |
| Expired cached entitlement (client-side) | Server is always re-checked for every mutation; the client cache (section 16) is advisory-only for local UX, never authoritative |
| Another user's purchase token | RevenueCat's App User ID is tied to Lilica's own stable `auth.users.id` at association time (section 27) - a purchase cannot be silently attributed to a different account without that account's own authenticated session performing the association |
| Revoked subscription | Reflected via the same webhook path as any other state change; no separate code path to go stale |
| Cross-care-space commercial leakage | `care_space_has_active_entitlement()` only ever resolves through that specific care space's own `commercial_owner_id` - there is no query shape that could accidentally check the wrong care space's owner |
| Collaborator trying to mutate an expired space | Both the domain-grant check AND the entitlement check must pass independently - an organiser's own personal entitlement never leaks eligibility to a DIFFERENT care space they do not commercially own |
| Client clock manipulation | All expiry comparisons (`trial_expires_at`, `entitlement_expires_at`) are evaluated server-side using `now()`/`statement_timestamp()`, never a client-supplied timestamp |
| Offline replay after expiry | Covered explicitly in section 16 - the server re-checks at the moment the offline mutation actually reaches it, not at the moment it was created |
| Webhook/server-notification spoofing | Webhook signature verification (section 25) rejects an unsigned/wrongly-signed request before it ever reaches `apply_entitlement_update()` |

## 27. Privacy/data implications

New billing-adjacent data Lilica would process: RevenueCat's own App User ID (a stable, non-financial identifier), the provider's own subscription/transaction identifiers (never a raw payment card number or bank detail - Lilica/RevenueCat never see or store those; Apple/Google themselves hold all actual payment-instrument data), and the entitlement state/timestamps described in section 22. **Lilica must never store a card number or any other raw payment credential - nothing in this proposal requires it, and RevenueCat's own architecture never exposes one to Lilica's server either.** Retention: `entitlements`/`entitlement_events` should be included in a future `export_my_data()` extension (not built this phase) and removed/anonymised on account deletion, consistent with the Phase 18B philosophy already established for every other personal data category.

## 28. Account identity (section 27 of the brief)

**Association is keyed by `auth.users.id` (Supabase's own stable UUID), never by email address.** RevenueCat's own "App User ID" is set explicitly to Lilica's own `auth.users.id` at the moment RevenueCat's SDK is first configured for a signed-in session (RevenueCat's SDK supports exactly this "identify with your own app's user id" pattern) - this prevents: a purchase attaching to the wrong Lilica account (RevenueCat always resolves against the App User ID Lilica itself supplied, not against anything derivable from the store account or email); a restore accidentally granting another user's entitlement (restore is scoped to the currently signed-in Lilica session's own App User ID); account switching on a shared device (logging out must explicitly "log out" of RevenueCat's own SDK identity too, so a second Lilica account signing in on the same device never inherits the first account's cached RevenueCat state); and stale cached entitlement crossing accounts (the client-side cache described in section 16 must be keyed by, and cleared alongside, the signed-in `auth.users.id` - reusing the exact same per-owner-id cache-clearing discipline `src/localData.ts`'s `clearLocalDataForOwner()` already established for every other local cache).

## 29. Store-verification/App Store & Google Play compliance findings

Researched via current (September 2026) authoritative sources, not remembered policy, per the brief's own instruction:

- **Apple**: an auto-renewable subscription must provide ongoing value, last at least 7 days, and be available across the user's own devices under the same account. As of an April 2026 App Store Review Guidelines update, apps with auto-renewing subscriptions must clearly disclose what the user gets, what it costs, how long it lasts, and how to cancel - **before** sign-up, not after. A visible "Restore Purchases" affordance is expected (automatic restore-on-sign-in can also satisfy this, but an explicit control is the safer, unambiguous choice). Source: Apple's own App Store Review Guidelines (developer.apple.com/app-store/review/guidelines/) and Apple's own Auto-Renewable Subscriptions documentation (developer.apple.com/app-store/subscriptions/).
- **Google**: by 31 August 2026 (extendable to 1 November 2026), all apps must use Play Billing Library v8+ - this is a real, dated compliance deadline Phase 21B must observe when choosing a billing-library version, not an arbitrary implementation detail. Google now requires subscription cancellation to be reachable from within the app itself in no more than two taps from the subscription-management screen, and explicitly prohibits design patterns that obscure or discourage cancellation (e.g., burying it behind a retention offer). Google is also introducing (2026) a requirement that any app allowing account creation must allow account deletion both in-app and via a web resource - Lilica already satisfies the in-app half (Phase 18B's `delete_my_account()`); **a web-based account-deletion resource does not yet exist and is flagged as a launch dependency** (section 30). Source: Google's own Play Billing developer documentation (developer.android.com/google/play/billing) and Play Console policy announcements (support.google.com/googleplay/android-developer/announcements).
- Both platforms require a "Manage Subscription" path (Apple: Settings → [Account] → Subscriptions, or an in-app deep link; Google: the Play Store's own subscription-management surface) - Lilica's own subscription screen (section 20 of the brief) should link out to the platform's own management surface rather than attempt to reimplement cancellation itself, which neither platform's guidelines expect or require of the app.

## 30. Terms/Privacy launch dependencies

Per `docs/PROJECT_BRIEF.md`'s own existing instruction, no Privacy Policy or Terms of Service URL exists and none is invented here. **This is now a hard launch dependency, not merely a documentation nicety**: Apple's own April 2026 disclosure requirement and Google's own subscription-disclosure expectations both presuppose the app can link to real Terms/Privacy documents from the purchase surface. Also newly identified in this phase's research: Google's forthcoming web-based account-deletion resource requirement (section 29) is a second, previously-unflagged launch dependency, distinct from Terms/Privacy - both are recorded here for product-owner/legal action before Phase 21B's subscription UI (section 20) can be considered store-submission-ready, though building that UI itself does not require them to exist yet.

## 31. £8.99/year cost sanity check (not a business-plan exercise)

- **Apple/Google commission**: standard is 30% in year one of a subscription, dropping to 15% from the subscriber's second year onward under both platforms' own long-standing subscription-commission structures (both platforms have run this exact "year two onward" reduced-rate model for several years; this is standard, well-established policy, not new research). On £8.99, that is roughly £3.00 in year one, ~£1.50 thereafter, per renewing subscriber.
- **RevenueCat**: £0 until $2,500/month tracked revenue (a large number of subscribers away at £8.99 each), 1% of tracked revenue above that (~£0.10/subscriber/year even at scale) - negligible relative to the store commission above.
- **Backend cost**: Supabase's own existing hosted-database/Edge-Function cost is already incurred for the rest of the app; the incremental cost of a handful of new small tables and one lightweight webhook Edge Function is immaterial next to Lilica's existing infrastructure footprint.
- **VAT/tax**: both Apple and Google already act as the merchant of record for in-app purchases in the large majority of relevant jurisdictions (including the UK), meaning VAT/sales-tax collection and remittance is already handled by the platform, not something Lilica's own backend needs to calculate or remit itself for store-sold subscriptions.
- **Conclusion**: at £8.99/year, the store commission is by far the dominant cost (≈30%/15%), everything else in this proposed architecture (RevenueCat, backend) is a small single-digit-percent addition at most, and nothing in this architecture consumes an unreasonable share of the price. This does not change the approved £8.99 figure - it only confirms the proposed architecture does not undermine it.

## 32. Full entitlement decision table

| State | Can read | Can search | Can export | Can add | Can edit | Can complete | Can assign | Can upload | Can invite | Can change permissions | Can leave care space | Can delete account | Can purchase/restore |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `TRIAL_ACTIVE` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `TRIAL_EXPIRED` | Yes | Yes | Yes | No | No | No | No | No | No | No | Yes | Yes | Yes |
| `SUBSCRIPTION_ACTIVE` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `GRACE_PERIOD` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `BILLING_RETRY`/`ACCOUNT_HOLD` | Yes | Yes | Yes | No | No | No | No | No | No | No | Yes | Yes | Yes |
| `SUBSCRIPTION_EXPIRED` | Yes | Yes | Yes | No | No | No | No | No | No | No | Yes | Yes | Yes |
| `REVOKED`/`REFUNDED` | Yes | Yes | Yes | No | No | No | No | No | No | No | Yes | Yes | Yes |
| `UNKNOWN`/`VERIFICATION_REQUIRED` | Yes | Yes | Yes | No | No | No | No | No | No | No | Yes | Yes | Yes |

"Can leave care space" and "Can delete account" are Yes in every row - these are the safety/account-control actions the brief itself flags as needing to remain possible regardless of commercial state (section 32 of the brief).

## 33. Full scenario matrix (brief section 38)

1. **Brand-new user**: no `entitlements` row yet; `bootstrap_supported_people()`'s first call creates it as `TRIAL_ACTIVE` with `trial_started_at = now()`. Full access from the first moment.
2. **Day 1 trial**: `TRIAL_ACTIVE`, full access, no communication beyond a quiet "60 days left" note near Account (section 21 of the brief - not a full-screen interruption).
3. **Final trial day**: still `TRIAL_ACTIVE`, full access; a restrained "your free two months end tomorrow" note.
4. **Trial expired**: `TRIAL_EXPIRED`, read-only per section 32's table, restrained explanation shown once (not repeated on every screen).
5. **Purchase successful**: RevenueCat verifies → webhook → `SUBSCRIPTION_ACTIVE`; client re-fetches and immediately regains mutation ability.
6. **Purchase pending**: client shows "confirming your subscription…"; state remains whatever it was until the webhook lands (typically seconds); never optimistically flips to active on the client alone.
7. **Subscription active**: full access, as `SUBSCRIPTION_ACTIVE`/table above.
8. **Renewal successful**: webhook updates `entitlement_expires_at`/`last_verified_at`; no user-visible interruption at all if renewal succeeds silently, matching normal subscription expectations.
9. **Billing failure**: → `GRACE_PERIOD` if the store itself is still retrying (full access preserved, per section 12's own reasoning); a gentle "there was a problem with your last payment" note, not an immediate lockout.
10. **Grace period**: as above - deliberately generous, matching platform intent.
11. **Subscription expired** (grace exhausted): → `SUBSCRIPTION_EXPIRED`, read-only, same restrained explanation as trial expiry.
12. **Refund/revocation**: → `REVOKED`/`REFUNDED` via webhook, read-only; existing data still fully readable.
13. **Reinstall**: local cache gone; login re-fetches the server's own `entitlements` row - state resumes exactly where it left off.
14. **New device**: same as reinstall - entitlement follows the account, not the device.
15. **Offline**: cached last-verified state used within the 72-hour grace window (section 16); mutation attempts proceed locally and queue in the existing outbox as normal.
16. **Prolonged offline** (beyond the grace window): client shows "reconnect to confirm your subscription" rather than either silently blocking or silently allowing.
17. **iOS purchase → Android login**: recognised, per section 17 - same account, same RevenueCat App User ID, same server-verified entitlement.
18. **Android purchase → iOS login**: symmetric to the above.
19. **Collaborator in entitled space**: full mutation ability, gated only by their own Care Circle domain grant (section 5) - their own personal entitlement state is irrelevant.
20. **Collaborator in expired space**: read-only regardless of their own personal entitlement state, per section 5's two-independent-conditions model.
21. **Two organisers, one subscribed**: per section 6's recommended Policy 1 - the space's state follows its specific `commercial_owner_id`, not "any organiser."
22. **Two organisers, neither subscribed**: `TRIAL_EXPIRED`/`SUBSCRIPTION_EXPIRED` per whichever applies to the actual `commercial_owner_id`; read-only for both, regardless of which one is "the organiser who happens to be looking at it."
23. **One subscriber with two supported people**: both care spaces active under the one entitlement, per section 4 - no extra purchase, no extra schema.
24. **Billing owner leaves**: commercial ownership does not silently transfer; the space becomes effectively unowned/expired unless another active organiser explicitly claims it via the transfer RPC (section 8/20).
25. **Billing owner deletes account**: `commercial_owner_id` set to null (mirroring `bootstrap_owner_id`'s own pattern), same continuity path as scenario 24 applies; the user is disclosed that their store subscription is not itself cancelled by Lilica (section 20).

## 34. UX flow map (information architecture only - no Phase 22 visual work)

- **A. First two months**: no interruption beyond a quiet, discoverable "X days left in your free two months" note near Account/Settings - never dominating Home, never a countdown badge on every screen.
- **B. Approaching expiry**: one restrained reminder (e.g., inside the same Account-area note, or a single one-time gentle prompt in the last few days) - not a growing barrage.
- **C. Expired/read-only**: a calm, honest one-time explanation ("Your free two months have ended. Your information is still here. Subscribe for £8.99/year to continue adding and managing care.") shown when a gated mutation is actually attempted (not pre-emptively on every screen load), plus the same quiet Account-area note now reading "Subscribe to continue managing care."
- **D. Purchase**: a single subscription screen (section 20 of the brief) reached from the expired-state explanation or from Account/Settings directly, at any time (even during an active trial, for an eager early subscriber).
- **E. Successful activation**: immediate, quiet confirmation; mutation ability returns without requiring an app restart.
- **F. Restore purchases**: a clearly labelled "Restore purchases" action on the same subscription screen, for the reinstall/new-device case.
- **G. Billing problem**: a gentle, specific note distinct from full expiry ("there was a problem with your last payment - [platform] will try again shortly"), matching the Grace Period state's own deliberately non-alarming tone.
- **H. Cancellation**: Lilica's own subscription screen links out to the platform's own subscription-management surface (Apple/Google, not reimplemented in-app) - after cancellation, the user simply rides out their current paid period as `SUBSCRIPTION_ACTIVE` until it actually lapses, then transitions to `SUBSCRIPTION_EXPIRED` normally.
- **I. Expired subscription**: same as C.
- **J. Subscription management**: reachable from Account/Settings at any time, regardless of current state - shows current state in plain language ("Free period - 12 days left" / "Subscribed, renews 14 September 2027" / "Your subscription has ended") plus Restore and a link to platform management.

## 35. Phase 21B proposed implementation sequence (derived from the architecture above, not the brief's own illustrative example verbatim)

1. **21B.1 - Entitlement data model** (`entitlements`, `entitlement_events`, `care_spaces.commercial_owner_id`, migration + pgTAP).
2. **21B.2 - Trial lifecycle** (trial-start-on-first-bootstrap logic, `care_space_has_active_entitlement()`).
3. **21B.3 - Server enforcement** (redefine the mutation RPCs from section 23, with full regression coverage against existing domain/permission pgTAP).
4. **21B.4 - RevenueCat integration & webhook** (SDK install, Edge Function, `apply_entitlement_update()`, idempotency).
5. **21B.5 - Client entitlement state + offline cache** (section 16's design, the outbox-rejection holding-area behaviour).
6. **21B.6 - Read-only UX** (gated-mutation explanations, per-screen affordance changes, section 34's flow map).
7. **21B.7 - Subscription/paywall screen + restore/manage** (section 20/34, information architecture only, no Phase 22 visual pass).
8. **21B.8 - Commercial ownership transfer RPC** (section 8/20).
9. **21B.9 - Migration/dev-testing strategy** (section 23 of the brief - sandbox accounts, environment flags, safe test fixtures, explicitly no `if email == David` bypasses).
10. **21B.10 - Existing-user grandfathering policy execution** (apply the migration policy from the brief's section 22 - flagged as an explicit open decision below, to be resolved before this step).
11. **21B.11 - Store sandbox QA** (Apple sandbox + Google licence-testing accounts, full scenario-matrix walkthrough).

Sequenced so server-side correctness (data model → enforcement) is proven with pgTAP before any client UI is built on top of it, matching this codebase's own established phase-implementation discipline.

## 36. Test plan (design only, brief section 42)

- **Entitlement state machine**: one pgTAP assertion per state-transition in section 12's table, including that no transition ever silently produces an undefined/ambiguous state.
- **Trial**: `trial_started_at` set exactly once on first bootstrap, never on a second; `trial_expires_at` computed correctly; not restarted by reinstall/logout-login/new-device/local-storage-clear (simulated by re-running bootstrap-adjacent flows without a fresh account).
- **Expiry**: `care_space_has_active_entitlement()` returns false at exactly `trial_expires_at`/`entitlement_expires_at`, using `now()` fixtures, not client time.
- **Server write denial**: every mutation RPC in section 14's "YES" column rejected with a clear error when entitlement is inactive; every "NO" column RPC still succeeds.
- **Collaborator entitlement inheritance**: a contributor with full domain grants still blocked when the space's owner is expired; a contributor with minimal grants still allowed when the space's owner is entitled (two independent axes, tested independently and combined).
- **Multi-person coverage**: one entitled owner, two care spaces, both remain active; verify no second entitlement row was created.
- **Cross-space isolation**: entitlement check for space A never reads space B's `commercial_owner_id`.
- **Restore**: a fresh session (simulating reinstall) correctly re-resolves an existing `entitlements` row with no data loss.
- **Refund/revocation**: webhook-driven transition to `REVOKED` correctly blocks subsequent mutation attempts.
- **Offline**: client-cache-based UI gating tested separately from server enforcement (both must independently agree once online).
- **Account switching**: RevenueCat identity/cache correctly cleared and re-established across a logout/different-account-login on the same device (section 28).
- **Account deletion**: `delete_my_account()` still succeeds regardless of entitlement state; `commercial_owner_id` nulled correctly on the care spaces that account owned; a store-subscription-not-cancelled disclosure is shown.
- **Export while expired**: `export_my_data()` succeeds identically in every entitlement state.
- **Read-only access**: every read path (records, Calendar, To Do, People, Care Summary, Recent Activity, Search) proven unaffected by entitlement state at the RLS level (none of them should ever gain an entitlement check).
- **Store verification**: a mocked/sandboxed RevenueCat webhook payload correctly updates `entitlements`.
- **Webhook/server notifications**: an unsigned or wrongly-signed webhook request rejected outright; a redelivered (duplicate `provider_event_id`) webhook applied exactly once.
- **Idempotency**: repeating any of the above webhook/RPC calls with the same identifier never double-applies a state change.
- **Race conditions**: two near-simultaneous mutation attempts against a space transitioning from active to expired mid-request - the server's own row-level locking (the same `for update` pattern `apply_record_mutation()` already uses) must resolve deterministically, never allow a mutation to slip through a closing window.

## 37. Open decisions requiring GPT/product-owner approval before Phase 21B

1. **Scenario D policy** (section 6): confirm Policy 1 (entitlement tied to the specific `commercial_owner_id`, not "any active organiser") is the intended behaviour.
2. **Profile display-name/avatar changes while expired** (section 14's table): confirm these should remain ungated (proposed), rather than being treated as care-space management.
3. **Offline grace window length** (section 16): 72 hours is a proposed starting point, not a value with special significance - confirm or adjust.
4. **`entitlements`/`entitlement_events` retention on account deletion** (section 27): removed outright vs. anonymised-but-retained for financial/audit record-keeping - a real question with potential accounting/legal-retention implications neither this document nor the product owner has resolved yet.
5. **RevenueCat as the recommended provider** (section 11): a real, named vendor dependency - needs explicit product-owner sign-off, not just an architectural recommendation.
6. **Existing dev/test-account migration policy** (brief section 22): this document recommends that no pre-Phase-21 account should be silently treated as expired (`trial_started_at IS NULL` must never be interpreted as "trial already used up") - the safe default for every account that exists before this migration ships is `entitlement_status = TRIAL_ACTIVE` with `trial_started_at` set to the migration's own run time (a fresh, generous starting point, not a fabricated historical date) - but the exact grandfathering policy for genuine future production users at the moment billing goes live is a product decision, not an engineering default, and is flagged here rather than decided unilaterally.
7. **Development/test-account strategy specifics** (brief section 23): sandbox Apple/Google test accounts plus a server-side test-fixture mechanism (e.g., a Supabase-only, non-production function to force an account's `entitlement_status` for testing, gated to the `lilica-development` project only and never shippable to production) is proposed in outline - the exact mechanism should be confirmed before 21B.9.
8. **Web-based account-deletion resource** (section 29/30): a genuine new launch dependency this research surfaced (Google's 2026 policy) - needs a decision on where/how this is built, separate from Phase 21 itself.
