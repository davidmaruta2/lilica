# Lilica Agent Instructions

This repository is the Lilica React Native care-organising app for Luxford Interactive.

## Required reading before any work

Read these files in this order:

1. `docs/LUMEN_HANDOFF.md` - canonical current session handoff despite the legacy filename.
2. `docs/NEXT_NATIVE_BUILD_MANIFEST.md` - exact last-build boundary and changes awaiting new binaries.
3. `docs/BUILD_RELEASE_CONTROL.md` - mandatory build, submission, distribution, and OTA authority rules.
4. `docs/REVENUECAT_BILLING_SETUP_REPORT.md` - real external billing/store state and remaining steps.
5. `docs/REVISION_LOG.md` - newest product and implementation changes.
6. `docs/PROJECT_BRIEF.md` and `docs/CORE_SYSTEM_CONTRACT.md` - product and architecture contract.
7. `docs/SUPABASE_OPERATIONS.md` before any backend/authentication operation.

Always run `git status --short`, `git log --oneline -10`, and `git branch --show-current` before editing. The current branch is `prephase22-remove-supported-person-faq-help`; `master` is stale and must not be merged or used as the implementation baseline without explicit instruction.

## Critical release authority

No EAS/native build may ever be started without David Maruta's express approval for that specific build. Never treat implementation approval, a phase prompt, a request to validate, or a previous build approval as authority for a new build.

This rule covers iOS and Android builds, rebuilds, auto-submit, manual submission, TestFlight/Play distribution, production release, and configuration-only rebuilds. `eas update` also requires separate express approval for the exact channel and change set.

Before requesting approval, state the platform, profile/environment, purpose, exact commit, included changes, validation results, limitations, and whether submission/distribution is proposed. Then stop and wait for an explicit yes.

Do not run `eas build`, `eas submit`, or `eas update` merely because configuration is ready.

## Current release state

- iOS TestFlight baseline: `1.0.0 (4)`, EAS build `6d89e118-ab7b-4065-a279-03ef1b581b66` (superseding `1.0.0 (3)`). Submitted 19 September 2026.
- Android internal-track baseline: `1.0.0 (4)`, EAS build `56cb08fe-f5a7-4b16-b101-ce6fe5a63ae1` (superseding `1.0.0 (2)`). Submitted 19 September 2026.
- Both new builds include the returning-account duplicate-person fix, the approved Lilica icon, the `expo-updates`/OTA foundation, the notification bell/Care Summary PDF/RevenueCat webhook hardening batch, and the 17 September post-build batch (intro copy, biometric app lock, structured Medical Log). These are the first OTA-capable Lilica binaries. No OTA update has actually been published yet.
- iOS remains iPhone-only. Preserve `app.json` -> `ios.supportsTablet: false`.
- A production Supabase project (`lilica-production`, `luyoyupghbxjftqwzcfn`) and EAS `production` environment now exist (created 19 September 2026) -- see "Backend and secrets" below. This does not itself authorise a production build; none has been requested.

The full binary delta and pre/post-build checklists are authoritative in `docs/NEXT_NATIVE_BUILD_MANIFEST.md`.

## CRITICAL: durable release credentials exist -- never ask David for these again

David has stated explicitly, more than once, that re-asking him for these credentials every session is unacceptable. Permanent App Store Connect and Google Play submission credentials are already configured and wired into `eas.json` (`submit.store-test` and `submit.production` blocks, both platforms):

- Apple API key: `C:\Users\DavidPC\.lilica-credentials\AuthKey_5LPXC77JFN.p8` (Key ID `5LPXC77JFN`, Issuer ID `67953a69-92f8-4cce-931b-8543e12844dd`).
- Google service-account key: `C:\Users\DavidPC\.lilica-credentials\google-service-account.json` (`revenuecat-service-account@lilica-6gy1l5.iam.gserviceaccount.com`).

`eas submit --non-interactive` already works with these as configured. Do not ask David for an Apple or Google key again -- if a submission errors on credentials, check these exact paths/`eas.json` fields first. Full detail: `docs/REVISION_LOG.md`'s 19 September "Production Supabase/EAS and durable submission credentials" entry.

## Post-build implementation batch (17 September 2026)

Intro copy correction, opt-in biometric app lock (new native dependency, `expo-local-authentication`), and a structured Medical Log (new `condition`/`medicine` record types, health-domain) are implemented and validated. Committed and pushed (`55d4fc1`), on David's explicit instruction. The Medical Log migration was applied to `lilica-development` and database-proven on 19 September 2026 (local + linked pgTAP both 496/496). Biometric protection still requires a new native build to reach any real device -- Expo Go cannot load it. See `docs/REVISION_LOG.md`, `docs/NEXT_NATIVE_BUILD_MANIFEST.md` section 5, and `LILBATCH_COMPLETION_REPORT.txt` (repository root, untracked).

## Current product and roadmap state

- Phases 1 through 22 have been implemented in separately approved passes. Phase 20's carer-focused features, Phase 21's subscription/entitlement architecture, and Phase 22's approved visual migration are in the current source.
- Care Circle multi-person invitation/acceptance physical QA passed with two genuine accounts. Do not redesign or reopen it without a specific defect report.
- Phase 22's typography, icons, four primary tabs, secondary pages, Settings drawer, list/grid controls, gradients, and To Do corrections are implemented. Preserve the approved visual contract in `docs/PHASE_22_APPROVED_VISUAL_DIRECTION.md`.
- Ask Lilica remains a placeholder. Do not implement AI or remove the placeholder without explicit approval.
- The task domain key remains `task`; only its user-facing label is `Errand or activity`.
- Care Summary PDF export, notification centre, feature-request email, key-contact grouping, and primary-tab override from secondary pages are implemented.
- The approved app icon is `assets/lilica-app-icon.png` and active in `app.json`. Do not substitute earlier generated variants.
- The returning-account reconnect fix prevents duplicate supported people/care spaces. Do not weaken the server-authoritative reconciliation or pre-provision recheck.

No new roadmap phase has been authorised after the current closure/handoff. The immediate work is release-readiness and physical QA only when separately directed.

## RevenueCat and stores

- Commercial model: Lilica-controlled 60-day free period, then GBP 8.99/year.
- RevenueCat project: `Lilica` (`projf734d172`).
- Entitlement: `lilica_active`; current offering: `default`; package: `$rc_annual`.
- Apple and Google annual products are configured and attached to the same entitlement.
- The signed RevenueCat -> Supabase webhook is deployed and passed valid-signature HTTP 200 and invalid-signature HTTP 401 checks.
- RevenueCat public SDK keys exist in ignored local/EAS preview configuration; secrets are server-side and must never be committed or printed.
- The subscription page uses native store-localised `priceString`. A US Apple storefront correctly displayed USD 9.99 while the UK price remains GBP 8.99. Do not hard-code a currency to hide storefront behaviour.
- Real end-to-end sandbox purchase/restore/renewal/cancellation/refund/expiry/cross-platform QA remains outstanding.

Follow `docs/REVENUECAT_BILLING_SETUP_REPORT.md` for exact resource IDs, build IDs, completed work, and next steps.

## Protected engineering contracts

- Keep organiser identity, supported-person identity, care-space membership, and commercial ownership separate.
- One active care space is viewed at a time; records are scoped by care space.
- Persist facts and derive display state. Do not persist duplicate due/overdue projections.
- Preserve Record -> Occurrence, recurrence/history, stable assignment identity, offline outbox, and idempotent server mutation contracts.
- Care Circle permissions and assignment eligibility are server-enforced. UI visibility is not security authority.
- Keep billing entitlement separate from Care Circle roles. A collaborator's access depends on the care space owner's entitlement, not the collaborator buying a second subscription.
- Never auto-create a supported-person account.
- All text-entry surfaces must remain keyboard-aware and safe-area-correct.
- Do not introduce AI, OCR, banking, clinical advice, monitoring, emergency escalation, or new permission models without explicit approval.
- Do not casually redesign approved UX, typography, colours, copy, flows, or the app icon.

## Backend and secrets

- Development hosted environment: `lilica-development` (`ldocquqbcabdbscghojc`). The CLI's default link (`supabase/.temp/project-ref`) should normally point here for day-to-day work -- always re-link to `ldocquqbcabdbscghojc` after any production operation.
- Production hosted environment: `lilica-production` (`luyoyupghbxjftqwzcfn`), eu-west-2, created 19 September 2026. All 22 migrations through `20260917130000_medical_log.sql` are applied and pgTAP-proven (23 files/496 assertions). `entitlement-webhook` and `send-invitation-email` edge functions are deployed. `REVENUECAT_WEBHOOK_SECRET` and `RESEND_API_KEY` are set as Supabase secrets on this project. The production database password is saved at `C:\Users\DavidPC\.lilica_production_db_password.txt` and the RevenueCat webhook secret at `C:\Users\DavidPC\.lilica_production_revenuecat_webhook_secret.txt` -- both outside the repo, never commit them, reuse them rather than regenerating.
- **Production backend is now fully configured and independently verified (19 September 2026):** a RevenueCat production webhook integration exists and is correctly scoped to production-only events (confirmed via the RevenueCat v2 API; a cross-environment bug where both webhooks lacked an `environment` filter was found and fixed in the same session -- see `docs/REVISION_LOG.md`). Production Auth is configured: custom SMTP (Resend, verified live), `site_url`/`additional_redirect_urls` pointing at the app's own scheme, and `otp_length` set to 6 to match the app's UI -- all confirmed via a scoped `supabase config diff`, not merely assumed. A RevenueCat Secret API key (`sk_...`) is saved at `C:\Users\DavidPC\.lilica-credentials\revenuecat_secret_api_key.txt` for any future verification/automation. **No production EAS build has ever been run** -- this readiness does not authorise one.
- Never commit `.env.local`, `lilica-development.txt`, personal tokens, service-role keys, HMAC secrets, Apple `.p8` keys, Google service-account JSON, database passwords, or SMTP credentials.
- Preview migrations with `npx supabase db push --linked --dry-run`.
- Never run `supabase db reset --linked`.
- Do not run a broad config push. Inspect and apply only explicitly approved properties.
- Docker is resource-heavy on this machine. Do not start it without a clear need; report when backend validation is blocked because Docker Desktop is off.

## Validation and handoff

For app/config changes run:

```text
npm run typecheck
npm test
npm run secrets:check
npx expo config --type public
npx expo export --platform web
git diff --check
```

`npx expo install --check` currently reports known SDK 57 patch-level drift. Do not silently upgrade dependencies to clear it.

For database changes, also run the backend validation path with Docker or the approved hosted checks. Never claim backend checks passed when Docker was unavailable.

Physical-device claims require real physical testing. Automated tests are not physical proof. Update the canonical handoff and revision log with actual behaviour, validation, remaining limitations, exact commit, push result, and a clean-tree check.

## Current checkpoint

The last pushed implementation checkpoint is `55d4fc1` (17 September 2026, the lilbatch.txt post-build batch). Always run `git log -1`/`git status --short` fresh rather than trusting this line -- it is updated by hand and can lag a real push. The working tree should be empty except `LILBATCH_COMPLETION_REPORT.txt`, an intentionally untracked loose report file.
