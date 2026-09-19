# Claude Handoff Entry Point

Claude is taking over Lilica after the 16 September 2026 Codex session. Do not rely on earlier chat context. The repository documentation is the authority.

## STOP -- READ THIS FIRST: there is an immediate pending task

As of 19 September 2026, David was mid-way through checking Apple Server Notifications V2 / Google RTDN configuration in the RevenueCat dashboard when his computer froze and needed a restart. **This is the very next thing to pick up with David, before anything else, unless he says otherwise.** Full context, exact repeat-instructions, and why it matters (and why it is not urgent) are in `docs/LUMEN_HANDOFF.md`'s "IMMEDIATE NEXT TASK ON RESUME" section -- read that section in full before saying anything to David about this topic. Do not assume it is done. Do not re-explain from scratch either -- David already has the instructions once; ask what the RevenueCat pages showed, don't restart the explanation unless he asks for it again.

**17 September 2026 update:** a post-build implementation batch (`\downloads\lilbatch.txt`) implemented and validated three scope-bounded changes on top of checkpoint `240708c`: the third Welcome intro screen's corrected copy, a new opt-in biometric app lock (native dependency, requires a new build), and a structured Medical Log (care needs/conditions/medicines, new `condition`/`medicine` record types). Committed and pushed (`55d4fc1`), on David's explicit instruction after the batch itself was implemented. Full detail: `docs/REVISION_LOG.md`'s 17 September entry, `docs/NEXT_NATIVE_BUILD_MANIFEST.md`'s section 5, and `LILBATCH_COMPLETION_REPORT.txt` (repository root, untracked). No new native build was started -- one is still required before either new feature can reach a real device.

**19 September 2026 update:** the Medical Log migration (`supabase/migrations/20260917130000_medical_log.sql`) was applied to `lilica-development` and proven with pgTAP, both locally and against the linked database (496/496 assertions, both times), on David's explicit instruction. Full detail: `docs/REVISION_LOG.md`'s 19 September entry. This was the one outstanding technical gap before the next build; it is now closed.

**19 September 2026 update (release infrastructure):** on David's explicit instruction, a `store-test` build was requested, approved, built, and submitted for both platforms (iOS `1.0.0 (4)`, EAS `6d89e118-ab7b-4065-a279-03ef1b581b66`; Android `1.0.0 (4)`, EAS `56cb08fe-f5a7-4b16-b101-ce6fe5a63ae1`); a full production Supabase project and EAS production environment were also created and wired; and durable, permanent App Store Connect and Google Play submission credentials were configured. **See "CRITICAL: durable release credentials" below before ever asking David for a submission credential again.**

**19 September 2026 update (first production-profile build):** David then stated explicitly he is done with dev-phase work and everything now targets real public go-live. The RevenueCat production webhook and production Auth config were verified/fixed (a cross-environment webhook bug was found and fixed via the RevenueCat API), then David explicitly authorised the first `production`-profile build: iOS `1.0.0 (5)` (EAS `22860bae-49bb-46de-9ccb-0e4cb5a51ca8`) and Android `1.0.0 (5)` (EAS `a7ed9204-270b-482e-a329-2f72f863ceef`), both submitted (iOS to TestFlight, Android to Google Play's **internal** track by David's explicit choice, not `production`). This is the first binary genuinely wired to `lilica-production`. Treat `production` as the default profile for any future build discussion. Full detail: `docs/REVISION_LOG.md`'s 19 September entries, `docs/BUILD_RELEASE_CONTROL.md`, and `docs/NEXT_NATIVE_BUILD_MANIFEST.md`.

## CRITICAL: durable release credentials -- never ask David for these again

Permanent, reusable submission credentials now exist and are already wired into `eas.json`. **An incoming agent must never ask David for an Apple API key, a Google service-account key, or any of the values below -- they already exist.** If a submission fails with a credentials error, first check whether `eas.json` still contains the fields below and whether the referenced files still exist at these exact paths; only escalate to David if a file is genuinely missing or a key has been intentionally rotated (which would itself be recorded here and in `docs/REVISION_LOG.md`).

- **Apple App Store Connect API key:** file `C:\Users\DavidPC\.lilica-credentials\AuthKey_5LPXC77JFN.p8`, Key ID `5LPXC77JFN`, Issuer ID `67953a69-92f8-4cce-931b-8543e12844dd`. Referenced in `eas.json` as `submit.store-test.ios.ascApiKeyPath`/`ascApiKeyId`/`ascApiKeyIssuerId` and the equivalent `submit.production.ios` fields.
- **Google Play service-account key:** file `C:\Users\DavidPC\.lilica-credentials\google-service-account.json` (account `revenuecat-service-account@lilica-6gy1l5.iam.gserviceaccount.com` -- note the real Google Cloud project id is `lilica-6gy1l5`, a lowercase "L", not `lilica-6gy115` as some earlier docs mistyped it). Referenced in `eas.json` as `submit.store-test.android.serviceAccountKeyPath` and the equivalent `submit.production.android` field.
- **RevenueCat Secret API key:** file `C:\Users\DavidPC\.lilica-credentials\revenuecat_secret_api_key.txt` (starts `sk_`). Not referenced by any config file, but usable directly for RevenueCat's v2 REST API (`https://api.revenuecat.com/v2/projects/projf734d172/...`) to inspect or manage webhooks, apps, products, entitlements, etc. without needing dashboard access. This is how the two webhook integrations were verified and fixed on 19 September 2026 -- see `docs/REVISION_LOG.md`.
- **Resend API key (production):** file `C:\Users\DavidPC\.lilica-credentials\resend_api_key_production.txt`. Already set as the `RESEND_API_KEY` Supabase secret on `lilica-production` and used as the SMTP password for that project's custom Auth email. Saved locally too so a future agent can re-verify or reconfigure without asking David to re-supply it.
- All four files live outside the repository (never committed, matching the existing "never commit Apple `.p8` keys, Google service-account JSON, or API keys" rule in `AGENTS.md`) and are permanent, reusable credentials -- **an incoming agent must never ask David to re-supply any of them.**
- Two more secrets generated during this same session are saved locally, outside the repo, for any future production backend work: the `lilica-production` Supabase database password (`C:\Users\DavidPC\.lilica_production_db_password.txt`) and the production RevenueCat webhook HMAC secret (`C:\Users\DavidPC\.lilica_production_revenuecat_webhook_secret.txt`, already set as the `REVENUECAT_WEBHOOK_SECRET` Supabase secret on the production project). Do not ask David to regenerate these either -- reuse the saved values, or if regeneration is genuinely needed, generate and save a new value in the same location and update the corresponding Supabase secret.

## Read first

1. `docs/LUMEN_HANDOFF.md`
2. `AGENTS.md`
3. `docs/NEXT_NATIVE_BUILD_MANIFEST.md`
4. `docs/BUILD_RELEASE_CONTROL.md`
5. `docs/REVENUECAT_BILLING_SETUP_REPORT.md`
6. `docs/REVISION_LOG.md`
7. `docs/PROJECT_BRIEF.md`
8. `docs/CORE_SYSTEM_CONTRACT.md`
9. `docs/SUPABASE_OPERATIONS.md` before backend work

At session start run:

```text
git status --short
git branch --show-current
git log --oneline -10
git rev-parse HEAD
git rev-parse origin/prephase22-remove-supported-person-faq-help
```

Work on `prephase22-remove-supported-person-faq-help`. `master` is stale. Do not merge or switch baselines without David's explicit instruction.

## Non-negotiable release rule

Never start an EAS/native build without David Maruta's express approval for that specific build. Never run `eas build`, `eas submit`, TestFlight/Play distribution, or `eas update` from a general instruction to continue.

Before any proposed build, give David the platform, profile/environment, exact commit, purpose, included changes, validation state, and limitations, then wait for a direct yes. OTA publication requires its own explicit approval.

The next native build must retain OTA support. Existing iOS build 3 and Android build 2 were created before `expo-updates` and can never receive OTA. Preserve `ios.supportsTablet: false`; Lilica is iPhone-only.

## Resume state

- Current iOS binary: TestFlight `1.0.0 (3)`, EAS build `ea54ffa7-f4c3-4386-b5d1-7d2060cfeb17`.
- Current Android binary: internal track `1.0.0 (2)`, EAS build `f0f85941-405b-4f24-a457-6ce6660f5077`.
- Both contain RevenueCat/store integration.
- Awaiting the next approved binaries: returning-account duplicate-person prevention, approved Lilica icon, and the OTA native foundation.
- No OTA has been published.
- No production Supabase/EAS environment exists; do not run a production build.
- Phase 22 visuals and secondary pages are implemented. Preserve the approved direction.
- Care Circle multi-person invitation flow is complete and physically approved.
- The signed RevenueCat webhook is deployed and signature-tested, but real store purchase lifecycle QA remains outstanding.

The exact next-build delta, checklists, external resource IDs, and remaining store tasks are in `docs/NEXT_NATIVE_BUILD_MANIFEST.md` and `docs/REVENUECAT_BILLING_SETUP_REPORT.md`.

## Immediate next work

Do not invent a new feature phase. Resume only from a new instruction from David. Likely release work is:

1. review the documented next-build manifest;
2. finish any specifically requested pre-build QA or store metadata;
3. request explicit build authority with a complete build statement;
4. only after approval, create controlled `store-test` binaries;
5. physically verify icon, duplicate prevention, OTA runtime/channel, and RevenueCat purchase/restore paths;
6. obtain separate approval before submission, distribution, OTA publication, or production release.

## Guardrails

- No silent dependency upgrades, redesigns, refactors, concept renames, schema changes, cloud changes, builds, submissions, or OTA updates.
- Never commit credentials or print secrets.
- Treat native store pricing as storefront-localised. USD on a US Apple storefront is correct; UK remains GBP 8.99.
- Automated tests do not equal device QA.
- Preserve all product, security, data, and visual contracts listed in `AGENTS.md`.
- Finish each task with validation, exact limitations, documentation, commit/push only when requested, and a clean-tree check.
