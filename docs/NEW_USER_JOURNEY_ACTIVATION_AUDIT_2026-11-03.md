# Lilica new-user journey and activation audit

**Date:** 3 November 2026  
**Branch:** `prephase22-remove-supported-person-faq-help`  
**Release boundary:** source-only audit and fixes; no build, submission, OTA or production mutation performed.

## Executive result

Lilica's core new-user architecture is materially sound: account identity, duplicate-person protection, care-space isolation, permission enforcement, backend-controlled 60-day free access, server-authoritative entitlement and Care Summary generation all have focused automated coverage. The main activation weakness is not basic setup correctness; it is the hand-off between invitation acceptance and first collaboration, plus missing privacy-safe funnel measurement.

Two verified client defects were fixed in source and are held for the next specifically approved release:

1. A returning user accepting an invitation could remain on their previously active care space, making the successful acceptance appear to have done nothing. The accepted membership now selects the newly joined care space after authoritative reconnect.
2. A successful purchase had no confirmation message while the RevenueCat webhook/server entitlement caught up. The subscription screen now gives a calm pending-activation confirmation.

The live invitation website's stale “not publicly available” blocker was independently resolved on the production Pages branch in commit `cae9939`; both store links and the manual code are live. It is not part of this app-source delta.

## Journey findings

### 1. Signup and authentication

- Email authentication, session restoration and profile loading are account-scoped.
- RevenueCat is identified with the stable Supabase user ID, not email.
- Sign-out calls RevenueCat logout before another account can configure billing on the same device.
- Focused auth tests passed.
- Remaining physical proof: fresh-install verification-link behaviour on both stores and same-device account switching.

### 2. Setup and first records

- A genuinely new organiser chooses self/someone else, supplies identity details, provisions supported people server-side, selects an active person, accepts the privacy declaration, chooses interests and can add or skip the first item.
- Returning accounts reconnect server-authoritative care spaces before first-time provisioning and recheck immediately before provision, preventing duplicate people/care spaces after transient startup failures.
- Record creation is optimistic/offline-capable and later reconciled through the outbox; the server remains authoritative.
- No verified setup code defect was found in the bounded review. Focused onboarding/lifecycle tests passed.
- Growth gap: completing onboarding or creating one item is not sufficient activation, and the exact milestone is not currently measured.

### 3. Invitations and collaboration

Working controls:

- Invitation acceptance is bound to the authenticated account's normalised email.
- Pending invitees have no care-space access before acceptance.
- Memberships, roles and domain grants are server-created and default-deny.
- Contributor/viewer permissions, expiry, revocation, grouped invitations and manual-code throttling are covered by database/client tests.
- Delivery state distinguishes provider acceptance/native share opening from actual receipt or reading.

Verified issues:

- **Fixed in source:** after acceptance, returning users could remain on another care space. `finishAcceptance()` now carries the server-returned accepted membership IDs into state resolution and activates the matching reconnected care space. Group invitations activate the first accepted care space while keeping every joined space selectable.
- **Open, high priority:** acceptance is duplicate-safe but not retry-idempotent after a lost RPC response. A committed acceptance retried with a new operation UUID returns “no longer open” even though membership exists. Fixing this correctly requires a reviewed Supabase migration and pgTAP coverage; no production change was made here.
- **Open, medium priority:** a deep-link ID opens the generic Invitations surface rather than resolving/highlighting that exact invitation. Wrong-account, expired and revoked links can therefore feel ambiguous.
- **Open, medium priority:** no permission-aware first-collaboration prompt follows acceptance.

Full invitation evidence: `C:\Users\DavidPC\.openclaw\workspace\lilica-growth-execution\step2-invitation-audit.md`.

### 4. Care Summary

- Summary data is derived from the selected care space and respects existing record/member permissions.
- PDF generation/export has focused automated coverage.
- No verified Care Summary correctness defect was found.
- Measurement gap: successful Care Summary generation is not recorded as a privacy-safe activation milestone.
- Physical proof still required on iOS and Android for generated PDF readability, share-sheet behaviour and cancellation/error recovery.

### 5. Free access, paywall and subscription

- The free-access period starts server-side when the account first provisions its own supported person/care space; it lasts 60 days and is not a store introductory offer.
- Store-localised `priceString` is used; currency is not hard-coded in the purchase CTA.
- RevenueCat handles purchase/restore, while the webhook-updated Supabase entitlement remains the mutation authority.
- Collaborators use the commercial owner's care-space entitlement without receiving that owner's commercial details.
- Expired care spaces remain readable/exportable while new mutations are blocked server-side.
- Offline commercial status is advisory and bounded; it never replaces the server gate.
- **Fixed in source:** successful Subscribe now displays “Purchase completed. Your subscription may take a moment to activate.” rather than leaving the old status with no feedback.
- **Open physical blocker:** complete purchase/restore/renewal/cancellation/grace/expiry/refund and cross-platform entitlement testing still requires real store sandbox accounts and an approved native build/test session.
- **Open UX/technical risk:** the app refetches the server entitlement once immediately after purchase/restore. If the webhook is slower, status can remain stale until a later reload. A bounded refresh/listener should be considered after physical timing evidence.

## Activation definitions

### Primary: D7 activated organiser

An organiser is activated when, within 168 hours of account creation (or first successful care-space bootstrap for an existing/migrated account), all of the following are true:

1. at least one supported-person care space exists and is selectable;
2. at least three useful records exist across at least two canonical domains (`general`, `health`, `financial`, `home`, `documents`); and
3. at least one coordination outcome occurs: a record is completed, a Care Summary is successfully generated, or an invitation is accepted.

Report each component separately. Exclude internal/test/deleted accounts and failed/rolled-back mutations.

### Secondary: D14 collaborative activation

A care space is collaboratively activated when, within 14 × 24 hours of the invitation's first confirmed delivery handoff:

1. the intended member accepts the invitation; and
2. that accepted member performs at least one permission-valid useful shared action in an included care space.

Useful shared actions include creating/updating a permitted record, completing/reopening an actionable item, uploading a permitted document, sending a Care Circle message, or—where read-only—opening shared detail that was intentionally provided. Acceptance alone is not collaborative activation.

## Privacy-safe measurement gaps

Derive server-side facts first. Add only allow-listed first-party events for non-derivable actions:

- `onboarding_step_completed`
- `care_summary_generated`
- `invite_landing_opened`
- `paywall_viewed`
- `purchase_started`
- `app_session_started` only if user-retention measurement is required

Never include names, emails, relationships, record titles/notes, diagnoses, medicines, filenames, invitation codes/tokens, precise location or care content. General-purpose analytics SDKs, autocapture and session replay remain unsuitable.

## Exact two-device physical test

Use synthetic data only. Record app version/build, platform, account IDs (internally), start/end times and screenshots of failures.

### Device A — organiser

1. Install/open the current approved build and create Account A.
2. Complete profile and create supported person `Robin`.
3. Add three records across two domains: an appointment, a task and one document/contact/home item.
4. Complete the task and generate/share a Care Summary PDF.
5. Confirm Subscription shows the correct remaining free-access state and store-localised annual price.
6. Invite Account B as Contributor to `Everyday things` and `Documents` only; send once by email and repeat the overall test once by native share.

### Device B — new invitee

7. Start without Lilica installed. Open the web invitation, verify both store links and preserve the displayed manual code.
8. Install from the appropriate public store; create Account B using the invited email.
9. Open the invitation link or enter the code, review the organiser/role/domains and accept.
10. Verify the accepted `Robin` care space becomes active immediately. (Current public builds may still exhibit the pre-fix background-space behaviour; the source fix requires the next approved release.)
11. Verify Account B can read/write permitted domains, cannot read health/financial/home domains, and can complete one permitted shared action.
12. Verify Device A sees the collaboration after refresh/reconnect.

### Returning/wrong-account variants

13. Give Account B an existing separate care space, then accept a second invitation; verify the accepted care space becomes active.
14. Open B's link while signed in as a different Account C; confirm no access is granted and record the recovery copy/behaviour.
15. Revoke a fresh invitation on A, then try its link/code on B; confirm acceptance is blocked without revealing the invited email.
16. Simulate a lost acceptance response where feasible; retry and record the current false-failure behaviour for the idempotency migration.
17. Sign out B and sign into another account on the same device; confirm no RevenueCat identity or entitlement leaks across accounts.

### Subscription sandbox variants — separately approved native test

18. With an approved sandbox/test build, test early purchase during free access, purchase after expiry, restore, cancellation, billing retry/grace, expiry/revocation and refund.
19. Verify the purchase success message, webhook delay behaviour and eventual server-authoritative status.
20. Verify Android purchase followed by iOS sign-in (and the reverse) preserves the same Lilica entitlement semantics without duplicate ownership.

## Code changes held for review

- `App.tsx` — carries accepted membership IDs through reconnect.
- `src/careSpaceState.ts` — activates the newly accepted care space safely.
- `src/screens/SubscriptionScreen.tsx` — confirms successful purchase while activation catches up.
- `tests/resolve-onboarding-after-accept-invitation.test.ts` — covers returning-account activation and safe fallback.
- `tests/phase21b-subscription-screen.test.tsx` — covers successful-purchase confirmation.

No build, submission, OTA, distribution or production migration has been run.

## Validation completed so far

- Focused journey suite: **9 suites / 80 tests passed**.
- Changed-code focused suite: **2 suites / 17 tests passed**.
- `npm run typecheck`: passed.
- `git diff --check`: passed (line-ending warnings only).

The full repository suite, secrets scan, public Expo config and web export remain to be run before any commit/build approval request.

## Validation update, 4 November 2026

- `npm run typecheck`: passed.
- Full suite with 2 workers on a low-memory machine: 115 of 116 suites passed, 1026 of 1027 tests. The one failure, `tests/phase17-record-editor.test.tsx`, passed 8 of 8 when rerun alone, so it looks like a timing flake under load, not a defect. Not yet re-run in a full pass.
- Review prompt, activation events and trial prompt tests: passed (`review-prompt`, `activation-events`, `trial-prompt`).
- `npm run secrets:check`: passed (464 files).
- `git diff --check`: no whitespace errors (line-ending warnings only).
- Not run: resolved Expo config, web export, pgTAP for the new activation events migration (needs Docker), and any device test.
- Note: `expo-store-review` was added to `package.json`, a new native dependency. The review prompt and anything using it needs a new native build, not an OTA.

## Event wiring update, 4 November 2026

All eight allow-listed activation events are now called from the app (names only, no data, failures swallowed): `account_ready` and `first_record_added` (when onboarding completes), `person_added` (after supported people are provisioned), `first_record_added` also on any newly saved record, `invite_created`, `care_summary_created`, `paywall_viewed` (Subscription screen opens), `trial_notice_viewed` (Home shows the free period notice), and `review_prompt_shown` (the native prompt was actually requested). A completed task now also feeds the review prompt (`task_completed`). The server keeps one row per user per event, so repeats are harmless. Events only record once the activation events migration is applied to production, which has not happened. Not committed at the time of writing.
