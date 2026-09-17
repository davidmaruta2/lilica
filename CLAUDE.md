# Claude Handoff Entry Point

Claude is taking over Lilica after the 16 September 2026 Codex session. Do not rely on earlier chat context. The repository documentation is the authority.

**17 September 2026 update:** a post-build implementation batch (`\downloads\lilbatch.txt`) implemented and validated three scope-bounded changes on top of checkpoint `240708c`: the third Welcome intro screen's corrected copy, a new opt-in biometric app lock (native dependency, requires a new build), and a structured Medical Log (care needs/conditions/medicines, new `condition`/`medicine` record types, a migration not yet applied to `lilica-development`). None of it is committed yet. Full detail: `docs/REVISION_LOG.md`'s 17 September entry, `docs/NEXT_NATIVE_BUILD_MANIFEST.md`'s section 5, and `LILBATCH_COMPLETION_REPORT.txt` (repository root). No new native build was started -- one is now required before either new feature can reach a real device.

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
