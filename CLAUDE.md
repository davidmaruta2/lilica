# Claude Handoff Entry Point

Last updated 21 September 2026, end of session -- David going to sleep, next agent picks up cold with no chat context. Nothing is currently broken or urgent; read this fully before doing anything.

## Where things stand right now

- Installed native binary: iOS/Android **`1.0.0 (5)`**, built from commit `313d064`, the first build genuinely wired to `lilica-production`. No new native build since.
- Two OTA updates have shipped on top of that binary since, both approved and both JS/asset-only (no native change): one fixed a critical production signup outage (confirmed working by David); the second added a Medical Log Add-flow tile, a Care Summary medical section, a regrouped Settings drawer, and a header spacing fix (validated by tests, not yet explicitly confirmed on David's device -- worth asking).
- **Both stores submitted 21 September 2026.** Apple: `WAITING_FOR_REVIEW`, build `1.0.0 (5)`. Google Play: production track rollout `completed` (release `1.0.0`, versionCode `5`), awaiting Google's own review before going publicly live. No action needed on either unless a review outcome changes something -- check both at session start.
- Local `HEAD` and `origin/prephase22-remove-supported-person-faq-help` should be in sync, working tree clean. Confirm this is still true with a fresh `git log -1`/`git status --short` -- do not trust this line alone.
- Full detail on everything above: `docs/LUMEN_HANDOFF.md` (updated this session -- read it in full, it is the accurate source, not a stale summary).

## CRITICAL: durable release credentials -- never ask David for these again

Permanent, reusable submission credentials now exist and are already wired into `eas.json`. **An incoming agent must never ask David for an Apple API key, a Google service-account key, or any of the values below -- they already exist.** If a submission fails with a credentials error, first check whether `eas.json` still contains the fields below and whether the referenced files still exist at these exact paths; only escalate to David if a file is genuinely missing or a key has been intentionally rotated (which would itself be recorded here and in `docs/REVISION_LOG.md`).

- **Apple App Store Connect API key:** file `C:\Users\DavidPC\.lilica-credentials\AuthKey_5LPXC77JFN.p8`, Key ID `5LPXC77JFN`, Issuer ID `67953a69-92f8-4cce-931b-8543e12844dd`. Referenced in `eas.json` as `submit.store-test.ios.ascApiKeyPath`/`ascApiKeyId`/`ascApiKeyIssuerId` and the equivalent `submit.production.ios` fields. Also directly usable for the App Store Connect REST API (`https://api.appstoreconnect.apple.com`) for tasks like uploading review screenshots -- see `docs/REVISION_LOG.md`'s 20 September entry for a worked example (JWT signing via Node's `crypto` module, ES256, `dsaEncoding: 'ieee-p1363'`).
- **Google Play service-account key:** file `C:\Users\DavidPC\.lilica-credentials\google-service-account.json` (account `revenuecat-service-account@lilica-6gy1l5.iam.gserviceaccount.com` -- note the real Google Cloud project id is `lilica-6gy1l5`, a lowercase "L", not `lilica-6gy115` as some earlier docs mistyped it). Referenced in `eas.json` as `submit.store-test.android.serviceAccountKeyPath` and the equivalent `submit.production.android` field.
- **RevenueCat Secret API key:** file `C:\Users\DavidPC\.lilica-credentials\revenuecat_secret_api_key.txt` (starts `sk_`). Usable directly for RevenueCat's v2 REST API (`https://api.revenuecat.com/v2/projects/projf734d172/...`) to inspect or manage webhooks, apps, products, entitlements, etc. without needing dashboard access.
- **Resend API key (production):** file `C:\Users\DavidPC\.lilica-credentials\resend_api_key_production.txt`. Already set as the `RESEND_API_KEY` Supabase secret on `lilica-production` and used as the SMTP password for that project's custom Auth email.
- All four files live outside the repository (never committed) and are permanent, reusable credentials -- **never ask David to re-supply any of them.**
- Two more secrets generated during an earlier session, saved locally outside the repo: the `lilica-production` Supabase database password (`C:\Users\DavidPC\.lilica_production_db_password.txt`) and the production RevenueCat webhook HMAC secret (`C:\Users\DavidPC\.lilica_production_revenuecat_webhook_secret.txt`, already set as that project's `REVENUECAT_WEBHOOK_SECRET` Supabase secret). Do not ask David to regenerate these either.
- **EAS environment variables (`eas env:list --environment production`) are a separate thing from the files above** -- these are baked into JS bundles (both native builds and OTA updates) at build/publish time. A stale value here was the exact cause of the 19 September production signup outage (see `docs/REVISION_LOG.md`) -- if a similar "everything returns 401/unauthorized" symptom recurs, cross-check `eas env:list` against the actual current key from the relevant provider's dashboard/API before assuming it's a code bug.

## Read first

1. `docs/LUMEN_HANDOFF.md` -- rewritten fresh this session, the actual current state
2. `AGENTS.md`
3. `docs/NEXT_NATIVE_BUILD_MANIFEST.md`
4. `docs/BUILD_RELEASE_CONTROL.md`
5. `docs/REVENUECAT_BILLING_SETUP_REPORT.md`
6. `docs/REVISION_LOG.md` -- read top-down, most recent entries first
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

Never start an EAS/native build, and never run `eas update` (OTA publish), without David Maruta's express approval for that specific action. Never infer OTA approval from build approval or vice versa. Never run `eas build`, `eas submit`, TestFlight/Play distribution, or `eas update` from a general instruction to continue.

Before any proposed build, give David the platform, profile/environment, exact commit, purpose, included changes, validation state, and limitations, then wait for a direct yes. Before any proposed OTA update, give David the channel, environment, exact commit, and exact change set, confirm via `git diff` against the prior OTA's commit that nothing native-affecting is included, then wait for a direct yes.

Preserve `ios.supportsTablet: false`; Lilica is iPhone-only.

## Two intentional, explicit exceptions to "don't reinterpret protected decisions"

Both from direct product-owner instruction this session -- do not treat either as a regression or accidentally revert it:

1. **The Add flow / onboarding category set is now nine categories, not eight.** A "Medical Log" card was added alongside the original eight (Appointment, Errand or activity, Bill or renewal, Home or car matter, Important document, Contact, Care information, Wellbeing update). Tests updated accordingly.
2. **The Settings drawer's "Account" group no longer contains Care Circle/Join a Care Circle/Archived care** -- those moved to their own new "Care Circle" group, separate from Account, matching how Notion/1Password/Slack/Dropbox separate personal-account settings from sharing/membership settings.

## Guardrails

- No silent dependency upgrades, redesigns, refactors, concept renames, schema changes, cloud changes, builds, submissions, or OTA updates.
- Never commit credentials or print secrets.
- Treat native store pricing as storefront-localised. USD on a US Apple storefront is correct; UK remains GBP 8.99.
- Automated tests do not equal device QA -- if David hasn't confirmed something on-device yet, say so rather than assuming it's fine.
- Preserve all product, security, data, and visual contracts listed in `AGENTS.md`, except the two explicit exceptions above.
- Finish each task with validation, exact limitations, documentation, commit/push only when requested, and a clean-tree check.
