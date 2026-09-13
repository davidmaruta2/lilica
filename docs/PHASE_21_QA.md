# Phase 21B — Billing/Entitlement QA

## Automated validation completed

- `npm run typecheck`: clean.
- `npm test`: 61 suites/601 tests passing (up from 56/541 pre-phase; zero regressions in the full pre-existing suite, including the Phase 15/18B account-lifecycle and Phase 20B suites this phase's schema/RPC changes touch most directly).
- `npm run secrets:check`: clean (268 files).
- `npx expo install --check`: 7 pre-existing patch-level outdated Expo packages, unchanged, not introduced by this phase.
- `npx expo config --type public` / `npx expo export --platform web`: both clean.
- Local `db:reset` → `db:test` → `db:lint`: clean (341 pgTAP assertions/12 files, up from 305/11 — the new `phase21b_entitlement.test.sql` file added 36).
- `npx supabase db push --linked --dry-run`: confirmed exactly one pending migration before applying.
- Applied to `lilica-development`; `npx supabase migration list --linked`: local and remote histories match exactly through `20260914090000`.
- `npx supabase test db --linked`: 341/12 pass on the hosted database too.
- `npx supabase db lint --linked --level warning`: clean.
- `git diff --check`: clean.

## Server-enforcement coverage proven directly (not merely claimed)

Every row below is a real, passing pgTAP assertion in `supabase/tests/database/phase21b_entitlement.test.sql` — not an inference from reading the code:

- First bootstrap starts the trial exactly once, even across a multi-person first roster call; `trial_expires_at` is exactly 60 days after `trial_started_at`.
- A retry of an already-processed bootstrap payload never creates a second entitlement row or restarts the trial.
- A mutation succeeds while the commercial owner is `TRIAL_ACTIVE`; the identical mutation shape is rejected once `TRIAL_EXPIRED`.
- Ordinary reads, `export_my_data()`, and `account_deletion_precheck()` all remain available while expired.
- Bootstrapping a genuinely new second care space is blocked once the account's own entitlement has expired.
- A collaborator (no entitlement row of her own) can mutate an entitled care space she has Care Circle permission for, and is blocked the moment the SAME care space's commercial owner expires — her own Care Circle permission is unaffected throughout.
- `invite_member()` and `change_member_role()` are blocked while expired; `accept_invitation()`, `leave_care_space()`, and organiser-initiated `remove_member()` all succeed even while expired.
- Commercial ownership transfer: rejected when the target is not an active organiser of that specific care space; succeeds when valid, is recorded as an audited entitlement event, and leaves Care Circle roles completely untouched.
- After a transfer, the new owner's own lack of entitlement correctly makes the space read-only; the FORMER owner's own separate, still-self-owned care space is completely unaffected — entitlement is genuinely per-care-space, never a single cached account-wide flag.
- Cross-space isolation: an unrelated account's revoked entitlement never affects a different care space's own gate.
- No authenticated client (including the row's own owner) can directly write `entitlements`, `entitlement_events`, or call `apply_entitlement_update()` — all rejected with `permission denied`.
- `apply_entitlement_update()` (simulating the webhook's own service-role call) is idempotent on `provider_event_id` — a redelivered event never duplicates or reapplies.
- Account deletion: the deleted account's own entitlement row is removed; `commercial_owner_id` on a care space it owned is detached (set null), exactly mirroring `bootstrap_owner_id`'s own established pattern; the full pre-existing Phase 18B account-deletion suite (29 assertions) still passes unchanged against the new schema.

## Client-side coverage proven directly

- `src/entitlement.ts` (20 tests): active-state computation matches the server's own logic exactly for display purposes; day-count/copy formatting is calm and non-alarmist (explicitly asserted never to contain urgency language, and never to imply data was removed); the 72-hour offline-grace cache is correctly scoped per (owner, care space) and cleared only for the intended owner.
- `src/billing.ts` (16 tests): RevenueCat identity uses the Lilica account id, never an email; re-configuring the same user is a safe no-op; logging out and configuring a different user is never treated as a no-op (prevents entitlement leakage across accounts on a shared device); package selection, purchase, and restore all map errors to calm messages.
- `SubscriptionScreen` (10 tests): shows the real price/status; offers Subscribe XOR Manage depending on real subscriber state; explains expiry without ever implying data was removed; surfaces real success/failure messages from Subscribe/Restore actions.
- Held-mutation recovery (2 tests): an entitlement-rejected mutation is retried automatically on every subsequent sync pass and succeeds once entitlement is restored, using the same operation id (no duplicate write); a genuine, non-entitlement permission rejection is proven to remain permanently blocked, unaffected by this change.
- Webhook mapping (12 tests): every RevenueCat event type this integration acts on is mapped correctly; signature verification correctly accepts a genuinely valid signature and rejects a missing, wrongly-keyed, tampered-body, or subtly-altered signature.

## What remains genuinely outstanding — honestly marked, not fabricated

- **Physical device / store sandbox QA**: NOT RUN. Requires a development build (Expo Go cannot run native purchases at all — RevenueCat's own documentation is explicit about this), a real RevenueCat project, and sandbox Apple/Google test accounts, none of which exist yet.
- **Webhook end-to-end delivery**: NOT RUN. The Edge Function has not been deployed; its pure logic (event mapping, signature verification) is unit-tested, but no real RevenueCat-signed HTTP request has ever reached it.
- **Proactive client-side read-only UX** (disabling Add/Save affordances ahead of an attempt, rather than only reacting to a rejected one): NOT built this pass — named explicitly in `docs/PHASE_21_ARCHITECTURE.md` section 19 as the primary follow-up item. The server-side gate is fully authoritative regardless, and the held-mutation recovery path already prevents data loss without it.
- **A real two-device/two-platform purchase-then-cross-login test** (buy on iOS, log in on Android): NOT RUN — requires two real devices/platforms and a real store account, none available in this environment.
- **A real refund/revocation drill against a genuine sandbox purchase**: NOT RUN — requires a real, cancellable sandbox subscription.

## Physical QA checklist (prepared, not executed)

**Free period**: first supported person starts the 60-day period; app restart does not reset it; adding a second supported person does not reset or extend it; the Subscription screen shows the correct number of days remaining.

**Active purchase (sandbox)**: a sandbox annual purchase completes; the app shows "activating…" then reflects the real subscribed state once the webhook has landed; mutations work immediately afterward.

**Expired**: existing data remains visible; Search/Care Summary/Recent Activity (Phase 20B) all remain fully usable; attempting a mutation surfaces a calm, clear explanation rather than a generic error.

**Collaborator**: an invited contributor does not need their own subscription to mutate an entitled space; the same contributor is blocked the moment the space's own commercial owner's entitlement expires.

**Transfer**: commercial ownership can be transferred to another active organiser; the new owner's own entitlement (or lack of it) immediately governs active use.

**Restore**: reinstalling, restoring, and logging in on a new device all correctly recover the real server-side entitlement state with no manual reconstruction needed.

**Offline**: the app remains usable under the 72-hour cached grace window; beyond it, a "reconnect to confirm your subscription" state appears rather than either silently blocking or silently allowing; a mutation made offline that is later rejected by the server for having expired is retained and retried automatically once entitlement is restored, never silently lost.

**Account switching**: signing out of one Lilica account and into another on the same device never carries the first account's entitlement state across.

**Account deletion**: the "this does not cancel your App Store/Google Play subscription" disclosure is shown before confirmation; deletion still succeeds; no false claim of having cancelled a store subscription is ever made.

## Phase 21C — Expired Trial / Read-Only UX

### Automated validation completed

- `npm run typecheck`: clean.
- `npm test`: 66 suites/621 tests passing (up from 61/602 pre-phase; zero regressions in the full pre-existing suite).
- `npm run secrets:check`: clean.
- `npx expo install --check` / `npx expo config --type public` / `npx expo export --platform web`: all clean (the same 7 pre-existing patch-level Expo package drifts noted in Phase 21B's own QA remain, unchanged, not introduced by this phase).
- `npx supabase db diff --linked`: **no schema changes** — confirms this phase is genuinely client-only, as the brief required. No new migration file was created.
- `npx supabase db lint --linked`: clean.
- `git diff --check`: clean.
- Repository-wide re-check for stale commercial references (`£9.99`, `9.99`, `£2.99`, `30 days`/`30-day`, `one month`/`1 month`) in every file this phase touched: none found.

### Client-side coverage proven directly (16 new Jest tests)

- `ReadOnlyGate` (6 tests): the owner variant shows the approved calm copy and a real Subscribe route, distinguishes a lapsed trial from a genuine subscription expiry, and contains no alarming/urgency language; the collaborator variant never shows a Subscribe action, never mentions "your subscription," and never exposes the owner's raw entitlement status; hidden entirely when not visible.
- `RecordQuickEditor` read-only gating (3 tests): an existing record's Edit button stays visible but blocked when read-only; works exactly as before when not read-only; a viewer with no edit capability at all still sees no Edit button regardless of read-only state (no regression of the underlying Phase 15 capability check).
- `FirstThingScreen` read-only gating (4 tests): creating a new record in an empty category is blocked; the category list's own "Add" button is blocked; an existing record's Edit stays visible but blocked; everything works exactly as before when not read-only.
- `CareCircleScreen` read-only gating (3 tests): "Invite someone" stays visible but blocked when read-only and works normally otherwise; Remove (an ungated safety action) is confirmed unaffected by read-only state either way.
- `hasEntitlementHeldMutations()` (3 tests, `src/recordSync.ts`): false with no cache; false while syncing normally; true once a mutation is genuinely held for exceeding entitlement, false again once it resolves — reusing Phase 21B's own existing `isEntitlementHeldMutation()` predicate, no new state.

### What remains genuinely outstanding — honestly marked, not fabricated

Unchanged from Phase 21B: no RevenueCat project, App Store/Google Play subscription product, development build, or deployed webhook exist yet. Real store purchase/renewal/cancellation/refund/restore QA remains NOT RUN, for the same reasons recorded above. Additionally, this phase's own read-only UX has NOT yet been physically exercised on a real device — the checklist below is prepared, not executed.

### Physical QA checklist for the read-only UX specifically (prepared, not executed)

**Owner, trial active**: no read-only banner or gate appears anywhere; Home/To Do/Person Add, editing an existing record, and Care Circle's "Invite someone" all work exactly as before.

**Owner, trial expired**: tapping Home's `+Add`, To Do's `+Add`, a Person section's Add link, an existing record's Edit button, or Care Circle's "Invite someone" each shows the owner-facing gate ("Your free period has ended…") before any form opens; the Edit button itself is still visible, never hidden; "Subscribe for £8.99/year" opens the real, unmodified Subscription screen; "Not now" dismisses cleanly with no repeated pop-up on the very next tap of something unrelated.

**Owner, subscription active**: identical to trial-active — no banner, no gate, mutation controls fully normal, no paywall prompts of any kind.

**Collaborator, care space read-only**: the same five entry points show the collaborator-facing gate ("This care space is currently read-only…") with no Subscribe action and no mention of the collaborator's own subscription; the collaborator is never shown the owner's real entitlement status or billing detail.

**Care-space switching**: switching from an active care space to an expired one (or vice versa) updates `isReadOnly` correctly on the very next Add/Edit attempt, with no stale gate/no-gate state carried over from the previously active space.

**Offline**: with no network reachable, the app falls back to the last server-verified commercial status within the existing 72-hour grace window rather than assuming either expired or active forever; beyond that window, the existing Phase 21B "reconnect to confirm" behaviour is unchanged by this phase.

**Server-rejection race**: a mutation queued while still entitled, which the server then rejects because entitlement expired before it actually synced, shows the calm "couldn't be saved… nothing is lost" notice rather than a raw error, and clears automatically once entitlement is restored and the mutation resyncs.

**No regression of ungated actions**: while read-only, confirm Account/Privacy & data/Export, accepting or declining an invitation, leaving a care space, and an organiser removing a member all remain fully available exactly as before this phase.
