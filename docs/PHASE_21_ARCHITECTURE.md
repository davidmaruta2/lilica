# Phase 21B — Billing, Subscription & Entitlement: Architecture

Implemented from the approved `Downloads\phase21b.txt` brief, itself building on the reviewed `docs/PHASE_21_ARCHITECTURE_PROPOSAL.md` (preserved unchanged as historical proposal evidence — this document is the final, as-implemented record, not a replacement of it). The approved commercial model, as finally corrected by the product owner: **60 days completely free, then £8.99/year**, one subscription per Lilica account covering every care space that account commercially owns.

`PRE_PHASE_21B_BASELINE`: HEAD `6e9d7f5` (in sync with `origin/master`); TypeScript clean; Jest 60 suites/589 tests; secrets clean; local pgTAP 305 assertions/11 files, linked matching.

## 0. Price/free-period correction sweep

Before any implementation, the repository was searched for every remaining reference to `£9.99`, `9.99`, `one month`, `1 month`, `30 days`, `30-day`, `30 × 24` in a CURRENT/FUTURE commercial-model context. None were found — the two prior documentation-only corrections (£9.99→£8.99, one-month→two-months/60-days) had already been applied consistently across `docs/PHASE_21_ARCHITECTURE_PROPOSAL.md`, `docs/CORE_SYSTEM_CONTRACT.md`, `docs/PROJECT_BRIEF.md`, `docs/PHASE_18_ARCHITECTURE.md`, and `docs/REVISION_LOG.md` in the prior turn. The only "30 day"/"one month" matches remaining anywhere in the repository are genuinely unrelated existing product concepts (To Do's own 30-day Upcoming horizon; Calendar's "Month forward/back" navigation test) — confirmed by direct inspection, not assumed, and correctly left untouched.

## 1. Commercial ownership: implemented as proposed

`care_spaces.commercial_owner_id` (nullable, `references auth.users(id) on delete set null`) — added exactly as the proposal recommended, deliberately distinct from `bootstrap_owner_id` (which keeps its own documented "idempotency metadata only" meaning, unchanged) and from `care_space_memberships.role`. Every pre-existing care space was backfilled to `commercial_owner_id = bootstrap_owner_id` as a one-time structural default (not an invented commercial/trial history — no entitlement row was created or backdated by this backfill).

## 2. Entitlement data model: implemented as proposed, with one refinement

`public.entitlements` (one row per account: `status`, `trial_started_at`, `trial_expires_at`, `provider`, `provider_app_user_id`, `entitlement_expires_at`, `last_verified_at`) and `public.entitlement_events` (append-only audit trail, immutable by trigger, idempotent via a partial-unique index on `provider_event_id`) — both exactly as proposed.

**A real bug was found and fixed during implementation, not merely anticipated**: the first version of `entitlement_events`'s immutability trigger blocked ALL updates unconditionally, including the `on delete set null` FK cascade that fires when `auth.users` is deleted (`entitlement_events.user_id references auth.users(id) on delete set null`). This meant `delete_my_account()` would itself fail with "Entitlement events are immutable" the moment it tried to delete the `auth.users` row, breaking account deletion entirely — caught by running the *existing* Phase 18B pgTAP suite against the new schema (14 of that file's 29 assertions failed) before writing a single new test of Phase 21B's own. Fixed by narrowing the trigger to permit exactly one transition (`user_id` becoming null, every other column unchanged) and reject everything else — proven correct by both the existing Phase 18B suite (now passing unchanged) and a new dedicated assertion that no other mutation is ever permitted, even as the `postgres` role.

## 3. Trial lifecycle: implemented as proposed

Trial starts on the **first genuinely new care space** created by an account via `bootstrap_supported_people()` — checked once via `exists(select 1 from entitlements where user_id = caller_id)` before the loop, and only acted on inside the loop at the exact point a NEW space is about to be inserted (never for a retry of an already-processed `draft_id`, which the function's own pre-existing lookup already skips past entirely). A multi-person first roster call (e.g. bootstrapping Beauty and Jackie in the same onboarding session) starts the trial exactly once, proven by a dedicated pgTAP assertion. `trial_expires_at = trial_started_at + interval '60 days'` — a fixed 60×24-hour duration, not "two calendar months" (the proposal's own reasoning against calendar-month ambiguity, reconfirmed by the product owner's own explicit "60 DAYS. Do not use 'two calendar months'" instruction).

## 4. Commercial ownership implementation

A second-or-later new care space is gated on the account's own current entitlement (`user_has_active_entitlement()`) — proven blocked while expired, and proven to succeed again once entitlement is restored. Multiple care spaces under one account share the one entitlement row with zero extra schema, proven directly (two care spaces created in one bootstrap call, one entitlement row, both spaces independently checked and both active).

## 5. Multi-person behaviour

Confirmed by pgTAP: David's `commercial_owner_id` covers both Beauty and Jackie Home simultaneously; transferring Beauty's commercial ownership away to Jackie leaves David's OTHER care space (Jackie Home) completely unaffected — entitlement genuinely resolves per care space via its own `commercial_owner_id`, never as one account-wide cached flag that could leak across spaces.

## 6. Collaborator behaviour

A collaborator's mutation ability requires both their own Care Circle domain grant (unchanged) AND the care space's own commercial entitlement (`care_space_has_active_entitlement()`) — proven as two independently-required, both-must-pass conditions: Marion (a contributor with only `general` access, no entitlement row of her own) successfully mutates Beauty while David is entitled, and is blocked the moment David's entitlement expires, with her own Care Circle permission completely unchanged throughout.

## 7. Ownership transfer

`transfer_care_space_commercial_ownership(care_space_id, new_owner_membership_id)` implemented exactly as proposed: callable by the current owner (self-transfer) or, once the current owner's own membership is no longer active, by any remaining active organiser. Proven: a transfer to a membership that is not an active organiser of that specific care space is rejected; a valid transfer changes `commercial_owner_id`, logs an `ownership_transferred` entitlement event, and leaves Care Circle roles completely untouched (David remains an organiser of Beauty after commercially transferring it to Jackie).

## 8. Entitlement state machine — unchanged from the proposal

`TRIAL_ACTIVE`, `TRIAL_EXPIRED`, `SUBSCRIPTION_ACTIVE`, `GRACE_PERIOD`, `BILLING_RETRY`, `SUBSCRIPTION_EXPIRED`, `REVOKED`, `UNKNOWN` — the exact check constraint on `entitlements.status`. `TRIAL_ACTIVE` is evaluated against `trial_expires_at > now()` **at query time** inside `user_has_active_entitlement()`, never a stored boolean — so no cron job is needed for a trial to correctly stop being active the instant 60 days elapse.

## 9. Server enforcement design

One shared function, `care_space_has_active_entitlement(care_space_id)`, called consistently from every gated RPC — never duplicated bespoke logic. Redefined (same signature, one added check each, based on the CURRENT body of each function, verified by direct inspection immediately before writing the migration): `apply_record_mutation()`, `upsert_record_attachment()`, `mark_attachment_upload_status()`, `remove_record_attachment()`, `create_record_link()`, `remove_record_link()`, `invite_member()`, `revoke_invitation()`, `change_member_role()`, `bootstrap_supported_people()` (second-or-later space only), `delete_my_account()` (extended for cleanup, never gated).

### A real interpretation conflict in the brief, resolved and documented rather than silently picked

Brief section 11's mutation inventory lists "remove member" under ENTITLEMENT REQUIRED. Brief section 14 separately states: "An organiser must retain enough safety/account-control capability to remove a member where appropriate even if entitlement has expired... Do not trap users inside a data-sharing relationship because payment lapsed." These two instructions genuinely conflict for `remove_member()` specifically. **Resolution: `remove_member()` and `leave_care_space()` are both deliberately NOT entitlement-gated** — the more specific, safety-framed instruction (section 14) governs, since gating removal would mean an organiser cannot eject a problematic collaborator from an expired-but-still-shared space, which is a worse outcome than the section 11 inventory's blanket categorisation anticipated. `invite_member()`, `revoke_invitation()`, and `change_member_role()` — genuine active collaborative-management actions with no countervailing safety concern named anywhere in the brief — remain gated exactly as section 11 lists them. This resolution is recorded here explicitly so a future reader does not assume the wrong one.

## 10. Complete mutation inventory (final)

| Mutation path | Entitlement required? |
|---|---|
| `apply_record_mutation()` (create/import/update/delete, and by extension completion/reopen/mark-paid/assignment/date-change/reminder-toggle, all riding inside its one `record_data` payload) | **YES** |
| `upsert_record_attachment()` / `mark_attachment_upload_status()` / `remove_record_attachment()` | **YES** |
| `create_record_link()` / `remove_record_link()` | **YES** |
| `invite_member()` / `revoke_invitation()` / `change_member_role()` | **YES** |
| `bootstrap_supported_people()` — first-ever call for an account | NO (starts the trial) |
| `bootstrap_supported_people()` — second-or-later new care space | **YES** |
| `remove_member()` / `leave_care_space()` | **NO** (safety/exit actions — see section 9's resolution above) |
| `accept_invitation()` / `decline_invitation()` | **NO** (brief section 13 — accepting an already-issued relationship is account/collaboration lifecycle, not new care-information creation) |
| `delete_my_account()` | **NO** — never gated, any entitlement state |
| `export_my_data()` / `account_deletion_precheck()` | **NO** — never gated |
| Every `list_*` read RPC, and every table's own `select` RLS policy | **NO** — reads are never gated anywhere |
| Profile display-name/avatar changes (`AuthProvider.saveProfile`, `uploadProfilePhoto`) | **NO** — account-identity actions, not care-space management (an open decision in the proposal, now resolved this way; not contradicted anywhere in the approved 21B brief) |

## 11. Offline entitlement design

Client-side (`src/entitlement.ts`): `cacheCommercialStatus()`/`readCachedCommercialStatus()` cache the last server-verified `{isActive, isCommercialOwner}` per (owner, care space) in AsyncStorage with a `verifiedAt` timestamp, reporting `'fresh'` within a 72-hour window and `'stale'` beyond it — purely advisory, never trusted as the actual mutation gate (the server always re-checks). The cache is cleared alongside every other per-owner local cache on "clear this device"/account deletion (`clearCommercialStatusCacheForOwner()`, wired into `src/localData.ts`'s existing `clearLocalDataForOwner()`).

## 12. Offline mutation-rejection recovery — the "held mutation" behaviour

Rather than building a new, parallel held-mutation store, this reuses `src/recordSync.ts`'s own existing outbox `'rejected'` status and `lastError` message. A mutation rejected specifically because entitlement expired (`error.code === '42501'` and `error.message === ENTITLEMENT_REQUIRED_MESSAGE`, the exact literal text `apply_record_mutation()` raises) is distinguished from a genuine permission denial via a new `isEntitlementHeldMutation()` predicate: the sync loop's own blocking logic was changed by exactly one line — a `'rejected'` mutation is skipped on every future sync pass **unless** it is an entitlement-held one, in which case it is retried on every subsequent pass, using the same `operation_id` (idempotency-safe — a retried attempt against an already-applied mutation would simply return `'duplicate'`, never a double-write). Proven directly: an entitlement-rejected mutation is retried on a second sync pass while still expired (no duplicate write), and succeeds automatically on the pass after entitlement is restored — while a genuine (non-entitlement) permission rejection is proven to stay permanently blocked and never automatically retried, exactly as before this phase.

## 13. Cross-platform entitlement

RevenueCat's own App User ID is set to the exact same value used for every other Lilica account identity: `auth.uid()`, never an email address (`src/billing.ts`'s `configureBilling(userId)`). This is what makes an iOS purchase recognised on a subsequent Android login for the same account, and vice versa, once RevenueCat's own server-side verification has run — Lilica's own server never needs separate iOS/Android identity logic.

## 14. Account switching / entitlement-leakage prevention

`logOutBilling()` is called whenever `storageOwnerId` becomes null (sign-out) — proven by a dedicated test that RevenueCat's own logOut is invoked, and that configuring a *different* subsequent user is never treated as a no-op (the module's own "already configured for this user" memory is genuinely per-identity, not sticky across accounts on the same device).

## 15. RevenueCat client integration

`react-native-purchases@10.9.1` — the current published version, verified compatible against its own published `peerDependencies` (`react-native >= 0.73.0`; Lilica is on 0.86) before installing, per the brief's explicit "do not guess package compatibility" instruction. `react-native-purchases-ui` (RevenueCat's own prebuilt paywall component) was deliberately NOT installed — it renders its own full-screen paywall UI, which would conflict with the brief's own instruction to add the subscription surface inside the *existing* Settings drawer rather than a parallel architecture, and with "no Phase 22 visual polish." `src/billing.ts` wraps `configure`/`logOut`/`getOfferings`/`purchasePackage`/`restorePurchases`, each returning the same `{ok, data|message}` shape every other RPC wrapper in this codebase already uses.

**Genuine, stated limitation**: purchases cannot be exercised in Expo Go (RevenueCat's own documentation is explicit about this) and no development build, RevenueCat project, or store product exists yet. Every function in `src/billing.ts` is written against the SDK's own current, verified TypeScript API surface and is unit-tested for its own logic (identity handling, package selection, error mapping) with the native SDK mocked — but the actual purchase/restore/webhook round trip is unverified end-to-end in this environment. See section 20 for exactly what remains to be configured outside this repository.

## 16. Webhook / server-notification architecture

One Supabase Edge Function, `supabase/functions/entitlement-webhook/index.ts`, receiving RevenueCat's own unified webhook (itself aggregating Apple App Store Server Notifications V2 and Google Real-time Developer Notifications — this function never parses either platform's native format directly). Field names, event types, and the `x-revenuecat-signature` HMAC-SHA256 signing mechanism were taken directly from RevenueCat's own current "Event Types and Fields" and webhook documentation, consulted while writing this file — not remembered or guessed. The pure event-mapping and signature-verification logic is split into `supabase/functions/entitlement-webhook/mapping.ts` specifically so it could be unit-tested under Jest (12 tests, `tests/phase21b-webhook-mapping.test.ts`) despite `index.ts` itself using Deno-only globals (`Deno.serve`, `Deno.env`) that cannot run in this environment. `apply_entitlement_update()` (the sole write path, no execute grant to `authenticated` at all — only callable via the service role this Edge Function uses) is idempotent on `provider_event_id`, proven by pgTAP.

A `CANCELLATION` event deliberately does not itself change status (brief section 31: cancelling auto-renewal is not the same as immediately expiring) — the actual access change happens at the later `EXPIRATION` event, or immediately for a `BILLING_ISSUE` mapped to `GRACE_PERIOD`/`BILLING_RETRY` depending on whether RevenueCat itself reports an active provider grace window.

**Genuine, stated limitation**: this function has not been deployed to `lilica-development` or exercised against a real webhook delivery — no RevenueCat project/webhook exists yet. Its logic is unit-tested; its actual HTTP round trip, signature verification against a real RevenueCat-signed request, and `apply_entitlement_update()` integration are unverified end-to-end.

## 17. Purchase/restore flow

`SubscriptionScreen` → `handleSubscribe()` (`App.tsx`) → `getAnnualPackage()` → `purchaseAnnualSubscription()` → an optimistic "Subscribing…" state → `refreshMyEntitlement()` (re-fetches the server's own `entitlements` row). The client purchase callback alone is never trusted as authoritative — the real confirmation is the webhook having already updated the server row by the time this refetch runs (typically near-instant; a slower webhook simply means the refetched status has not changed yet, which the UI shows honestly rather than fabricating success).

## 18. Subscription Settings surface

Added as a new `'subscription'` section inside the **existing** `SettingsMenu` drawer (`onOpenSubscription`/`subscriptionSummary` props) — never a parallel Settings architecture, per the brief's own explicit instruction. The row's own description shows a live, calm one-line status (`describeEntitlement()`) sourced from the account's real entitlement, refreshed whenever it changes. `SubscriptionScreen.tsx` shows the price, current status, Subscribe/Restore actions, a link to the platform's own real subscription-management surface (`itms-apps://apps.apple.com/account/subscriptions` / the Google Play subscriptions URL — Lilica never reimplements cancellation itself), and the store-required renewal/cancellation disclosure text.

## 19. Read-only UX

No separate "read-only mode" UI state was built this phase beyond the Subscription surface itself and the existing "held mutation" recovery path (section 12) — the brief's own acceptance standard requires active mutation to be "consistently blocked by BOTH client UX and authoritative server enforcement," and the server half is now fully proven. The client half (proactively disabling Add/Save affordances when a care space is already known to be expired, rather than only reacting after a rejected attempt) is a genuinely separate, larger UI-wiring task across every mutation entry point in the app (RecordEditor's Save, the Add button, Care Circle management screens, etc.) — **named here as explicitly NOT completed in this pass**, rather than silently left out. The server-side gate is fully authoritative regardless (a modified or un-updated client can never bypass it), and the held-mutation recovery path (section 12) already ensures no work is lost even without proactive client-side disabling. This is recorded as the primary open follow-up item for a scoped Phase 21B.1 client-UX pass, not claimed as done.

**Update, Phase 21C (14 September 2026): this follow-up is now built.** See section 23 below. This paragraph is left unchanged as the historical record of what Phase 21B itself shipped.

## 23. Phase 21C — Expired Trial / Read-Only UX (client-only, closing the section 19 follow-up)

Implemented from the approved `phase21c.txt` brief. Builds a proactive, centralised client-side read-only layer on top of Phase 21B's unchanged server architecture — **no schema change, no new migration, no new RPC**; confirmed by `npx supabase db diff --linked` reporting no schema changes before this task began and again after it. The commercial model is unchanged: 60 days free, then £8.99/year.

**Central mechanism** (`App.tsx`): a `careSpaceCommercialStatus` state, fetched via the already-existing, minimal-disclosure `getCareSpaceCommercialStatus()` RPC (Phase 21B) for the active care space, refetched on care-space switch, with the existing 72-hour offline cache (`cacheCommercialStatus`/`readCachedCommercialStatus`) as a fallback when the RPC is unreachable. A local-only care space (never synced) is never read-only. Undefined (not yet loaded) deliberately means "not read-only" — never assume expired. Derives one `isReadOnly` boolean and one `guardMutation(action)` gate function, the single place every entry point below calls through.

**One reusable notice component** (`src/components/ReadOnlyGate.tsx`): two variants, driven by `isCommercialOwner` (from the same RPC, so a collaborator's own account never contaminates this decision with anyone else's billing detail). Owner: "Your free period has ended" / "Your information is safe and you can still view everything you've saved." / "Subscribe for £8.99/year to continue adding or making changes." with a real route to the existing, unmodified `SubscriptionScreen`. Collaborator: "This care space is currently read-only." / "Existing information is still available, but new information and changes are paused until the subscription for this care space is active again." — no Subscribe action, no mention of the collaborator's own subscription, no exposure of the owner's raw entitlement status. Calm styling throughout: no red/alarm colours, no countdown, shown only in direct response to an explicit tap (never proactively popped).

**Five gated entry points**, matching the mutation inventory in section 10 exactly:
1. Home's `+Add` (`onAddSomething` in `App.tsx`).
2. To Do's `+Add` (`onAddSomething` in `App.tsx`).
3. Person's per-section Add links (`onAddType` → `openNewFromProjection`) and the Key Contacts "Add contact" link — both route through the same `openNewFromProjection`.
4. The shared Edit trigger for an EXISTING record, in both places it's reached from (`RecordQuickEditor.tsx`'s `onEdit`, `FirstThingScreen.tsx`'s `onEdit`) — the Edit button stays **visible** either way (never silently hidden — the brief's explicit requirement); tapping it while read-only shows the gate instead of entering edit mode. `FirstThingScreen`'s own category-create path (`openCategory`/its list's own "Add" button) is gated the same way, as a second line of defence for the rare case it stays mounted across a read-only transition (it is normally only reached via an already-gated Add action).
5. Care Circle's "Invite someone" (`CareCircleScreen.tsx`, new `isReadOnly`/`onInviteBlocked` props) — stays visible, blocked on tap. `remove_member()`/`leave_care_space()`/`accept_invitation()`/`decline_invitation()` are untouched, exactly matching their server-side ungated status (section 9/10).

**Deliberately not independently gated**: micro-actions inside an already-open editor (attach file, remove attachment, link/unlink, individual field edits, the "completed" toggle) — entry into edit mode is itself already gated above; a read-only transition occurring mid-edit is accepted as the rare race the server-rejection fallback below exists for (brief section 22's own "server rejection remains the final safety net" allowance). Account/Privacy/Export/Profile actions are unchanged and confirmed still fully reachable regardless of entitlement state (they were never gated server-side either).

**Friendly server-rejection fallback** (`hasEntitlementHeldMutations()`, new in `src/recordSync.ts`, reusing Phase 21B's own `isEntitlementHeldMutation()` predicate with no new state): covers the rare remaining race — entitlement lapsed after a form was already open, or a queued offline mutation is replayed after expiry. `App.tsx` shows one small, dismissible, non-modal notice ("A change you made couldn't be saved because this care space's subscription isn't active. Nothing is lost -- it will save automatically once the subscription is active again.") rather than ever surfacing `recordSync`'s raw rejection or a technical error code. The server remains the actual, final authority throughout — this UI layer is a courtesy, never the security boundary.

### Diff classification (A–F, per the brief's own required audit)

- **A. Client entitlement/read-only UX**: `src/components/ReadOnlyGate.tsx` (new); `App.tsx` (`careSpaceCommercialStatus`/`isReadOnly`/`guardMutation`/`showReadOnlyGate` state and effects, held-mutation notice state).
- **B. Mutation-affordance integration**: `App.tsx` (Home/To Do `+Add`, Person `onAddType`, Contacts `onAddContact`, `RecordQuickEditor`/`FirstThingScreen`/`CareCircleScreen` mount sites); `src/components/RecordQuickEditor.tsx` (`isReadOnly`/`onBlockedEdit` props); `src/screens/FirstThingScreen.tsx` (`isReadOnly`/`onBlockedMutation` props); `src/screens/CareCircleScreen.tsx` (`isReadOnly`/`onInviteBlocked` props).
- **C. Friendly entitlement-rejection handling**: `src/recordSync.ts` (`hasEntitlementHeldMutations()`, new, read-only); `App.tsx` (held-mutation notice banner).
- **D. Tests**: `tests/phase21c-readonly-gate.test.tsx`, `tests/phase21c-record-quick-editor-readonly.test.tsx`, `tests/phase21c-first-thing-readonly.test.tsx`, `tests/phase21c-care-circle-readonly.test.tsx`, `tests/phase21c-held-mutation-notice.test.ts` (all new).
- **E. Phase 21 documentation**: this file (section 23, and the pointer added to section 19); `docs/PHASE_21_QA.md`.
- **F. Unexpected**: empty.

### What remains genuinely outstanding

Unchanged from Phase 21B section 20: no RevenueCat project, App Store/Google Play subscription product, development build, or deployed webhook exist yet. This phase does not claim any of that is now verified — it closes the proactive-UX gap identified in Phase 21B's own completion report, nothing more. Real store purchase QA (sandbox purchase/renewal/cancellation/refund/restore, and this read-only UX physically exercised on-device across the expired-owner/expired-collaborator/offline/care-space-switch scenarios) remains pending; see `docs/PHASE_21_QA.md`'s updated physical-QA checklist.

## 20. External configuration still required (cannot be created from this repository)

- A RevenueCat project, with iOS and Android apps registered, one entitlement (`lilica_active`), one offering with an annual product package.
- An App Store Connect subscription product (target: Lilica Annual, £8.99/year UK price, store-localised elsewhere) and a Google Play subscription product — **not created by this task**, per its own explicit prohibition.
- RevenueCat webhook signing enabled, with the resulting secret set as the `REVENUECAT_WEBHOOK_SECRET` Supabase Edge Function secret (`npx supabase secrets set`, never committed).
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` added to `.env.local` (and the project's real environment configuration) once the RevenueCat project exists.
- Deployment of `supabase/functions/entitlement-webhook` (`npx supabase functions deploy entitlement-webhook`) — not run this phase; requires the above to exist first.
- A development build (EAS/Expo Dev Client) — purchases cannot be tested in Expo Go at all.
- Terms of Service and Privacy Policy URLs — still do not exist (per `docs/PROJECT_BRIEF.md`'s own standing instruction not to invent them) and are a genuine launch dependency for the Subscription surface's own store-required disclosure, and for Apple's own April 2026 pre-purchase disclosure guideline.
- A public, web-based account-deletion resource — Google's own 2026 policy requirement (surfaced during Phase 21A's research), distinct from and in addition to the existing in-app deletion. Not built in this task, per its own explicit instruction not to build an unrelated website inside this repository.

## 21. Privacy/data implications

No card number, bank detail, or other raw payment credential is ever processed or stored by Lilica or by this integration — only a stable, non-financial RevenueCat App User ID (`auth.uid()`) and provider-transaction identifiers/timestamps. `entitlements` is removed outright on account deletion; `entitlement_events` survives with `user_id` set to null (its own FK), preserving minimal provider-transaction evidence without retaining it against a live, identifiable account.

## 22. Diff classification

- **Schema/RLS/enforcement**: `supabase/migrations/20260914090000_phase21b_billing_entitlement.sql` (new).
- **Webhook**: `supabase/functions/entitlement-webhook/index.ts`, `mapping.ts` (new).
- **Client entitlement/billing**: `src/entitlement.ts`, `src/billing.ts` (new); `src/recordSync.ts` (held-mutation retry logic, `RecordTransportError` exported for testability); `src/localData.ts` (cache cleanup wiring).
- **UI**: `src/screens/SubscriptionScreen.tsx` (new); `src/components/SettingsMenu.tsx` (new section); `App.tsx` (entitlement fetch/configure/handlers/render wiring).
- **Dependency**: `package.json`/`package-lock.json` (`react-native-purchases@10.9.1`); `tsconfig.json` (excludes `supabase/functions`, a Deno runtime outside the RN project's own type-checking scope).
- **Tests**: `supabase/tests/database/phase21b_entitlement.test.sql` (36 pgTAP assertions, new); `tests/phase21b-entitlement.test.ts`, `tests/phase21b-billing.test.ts`, `tests/phase21b-subscription-screen.test.tsx`, `tests/phase21b-held-mutation.test.ts`, `tests/phase21b-webhook-mapping.test.ts` (94 Jest tests, new); `tests/settings-cog.test.tsx`/`tests/settings-navigation.test.tsx` (updated for the new required `SettingsMenu` prop).
- **Documentation**: this file, `docs/PHASE_21_QA.md` (new); `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/PROJECT_BRIEF.md`, `docs/LUMEN_HANDOFF.md`, `docs/REVISION_LOG.md`, `docs/SUPABASE_OPERATIONS.md` (updated). `docs/PHASE_21_ARCHITECTURE_PROPOSAL.md` preserved unchanged.
- **Unexpected**: empty.
