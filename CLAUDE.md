# Claude Handoff Entry Point

Last updated 23 September 2026, late evening -- read this fully before doing anything.

**This file goes stale the moment a build, submission, migration or OTA happens without updating it back -- exactly what caused a real mistake earlier today (an agent told David the installed binary was build 5, sourced from this file's own previous "Last updated 21 September" snapshot, when the real installed binary was already build 6). Never state a build number, store review state, or migration state from this file's prose alone when it's about to inform something you tell David or act on -- re-verify it live first (commands below), every time, even if this file was "just updated." Treat every fact below as a snapshot, not a live value.**

## Where things stand right now (last verified live 26 September 2026)

- Installed native binary: iOS/Android **`1.0.0 (6)`**, built from commit `195d186`, `buildProfile: production` on both platforms. Verified via `eas build:list --limit 3 --json` (grep `appBuildVersion`) -- do not trust a build number from prose in this or any doc; always re-check this way. No new native build since 22 September. (David's own "build 6" reference on 26 September is this exact binary -- not a discrepancy, confirmed.)
- **Store status, superseding the 23 September snapshot below: Apple REJECTED** version `1.0` / build `1.0.0 (6)` (confirmed via API 26 September, `appStoreState`/`appVersionState` both `REJECTED`; review submission `d9d53c6e-d2bb-4ca7-9304-a3afc274d542` shows `state: UNRESOLVED_ISSUES`). Apple's message asks for more information (screen recording, written answers, demo-account/IAP/screenshot checks) rather than stating confirmed defects -- full text and analysis in `docs/REVISION_LOG.md`'s 26 September entry. No response drafted yet -- this is the next real task. **Google Play: production track release `versionCode 6`, status `completed`, publicly live** (unchanged since 22 September, reconfirmed by David 26 September). Re-verify both live before repeating either fact (JWT-signed API calls, patterns in `docs/REVISION_LOG.md`).
- **Phase 23 (Lilica Chat) is still under active, same-day iteration -- do not treat any single day's OTA as final.** Chronological chain, all client-side except where a migration is named, every step OTA'd separately with David's explicit per-action approval:
  1. 22 September: shared thread, direct messages, record-linked chat, subject tagging, multi-conversation model, conversation-level subject -- 9 migrations, OTA commit `d6b4984` then several more same day.
  2. 23 September, morning: conversation-level subject editable retrospectively (migrations `180000`/`190000`), OTA commit `7588351`.
  3. 23 September: **the keyboard-reveal fix went through three real iterations before it actually worked** -- (a) a genuine React-context resolution bug fixed, OTA `0edd93f`; (b) real-device screenshot proved Android's native `softwareKeyboardLayoutMode: resize` was NOT reliable enough to depend on alone, switched Android to the same JS-driven `KeyboardAvoidingView` behaviour iOS already used, OTA `2f24d96`; (c) still "partially" covered -- root cause was `KeyboardAvoidingView`'s own padding/height animation still running after the second fix landed; fixed by reacting to the container's own `onLayout` height changes instead of a guessed delay, OTA `ccee640`. **If a keyboard-hiding report ever recurs, read all three commits' own comments in `src/components/KeyboardAwareScrollView.tsx` and `src/keyboard.ts` before attempting a fourth fix.**
  4. 23 September: a combined "Lilica Chat" overview was shipped (migration `20260923100000_phase23_lilica_chat_overview.sql`, OTA `172d24f`), then **redesigned the same day** after direct product-owner screenshots showed it was a flat, confusing dump (every individual topic-thread as its own top-level row). Redesigned into a real three-level structure -- Level 1 (`ChatOverviewScreen`, grouped: one row per DM partner, one summary row for Care Circle), Level 2 (`ChatConversationListScreen`, named topic-threads, "General" pinned first), Level 3 (`ChatThreadScreen`, the actual conversation) -- OTA `384e756`, no new migration (the same `list_my_chat_overview` RPC from step 4 already returned everything needed; only how the client groups/presents it changed). This also fixed a real bug at its root: a screen was passing a display-fallback label (e.g. a person's own name, or the old date-based "Conversation started X" text) to the thread screen as if it were a genuine, editable subject, offering to "open"/"change" a subject that never existed. `conversationHasOwnSubject()` in `src/chat.ts` is now the one explicit way anything decides whether a real subject exists -- never inferred from "is the label non-empty".
  - **Read `lilica_chat_redesign_proposal.txt`** (`C:\Users\DavidPC\Downloads\DAVID\`, outside the repo -- David's own machine, not committed) for the full reasoning behind the current three-level structure and what was explicitly rejected, before changing this area's shape again.
  - **Zero on-device QA has happened on any of Phase 23** beyond what David has personally reported back on screenshots -- Expo Go cannot run this app at all (RevenueCat native module + unreliable local notifications since SDK 53), no development-build profile exists in `eas.json`. Everything is verified by typecheck/jest/schema-lint plus David's own real-device testing and screenshot reports -- say this plainly rather than implying anything is "fully QA'd".
- **26 September 2026, new work on top of all the above -- migrated to production and OTA'd, on David's explicit instruction:** subscribing is now allowed during the 60-day free trial; a sole active organiser can now delete their own account directly (previously hard-blocked); a contributor can now leave every care space they belong to, not only the active one. Two further real-device bugs found and fixed the same day: account deletion was failing outright with a foreign-key violation for any account that had created a multi-person invitation group (schema gap since 17 September, unrelated to today's other changes -- fixed and applied to both databases), and the Subscription screen showed USD instead of GBP (real root cause: StoreKit2's documented sandbox currency-resolution bug -- fixed by forcing `storeKitVersion: STOREKIT_1` in `src/billing.ts`, not an App Store Connect config issue as first suspected). **Both confirmed fixed by David on-device the same day.** Full detail: `docs/REVISION_LOG.md`'s 26 September entries (read top-down -- several entries superseded earlier same-day theories that turned out to be incomplete, worth reading the full chain).
- Local `HEAD` and `origin/prephase22-remove-supported-person-faq-help` should be in sync, working tree clean. Confirm this is still true with a fresh `git log -1`/`git status --short` -- do not trust this line alone.
- Full detail on everything through 21 September: `docs/LUMEN_HANDOFF.md` (last rewritten 21 September -- itself subject to the same staleness warning above; cross-check anything build/store/migration-related against live commands, not its prose either). Full detail on 22-23 September's Phase 23 work: `docs/REVISION_LOG.md`, read top-down.

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

**Before telling David a build number, store review state, or a migration/OTA state as current fact** (not just when he asks directly -- also before any status summary that includes it), re-verify live rather than quoting this file:

```text
npx eas-cli build:list --limit 6 --non-interactive --json     # grep appBuildVersion -- the real installed binary version
npx eas-cli update:list --branch production --limit 3 --non-interactive   # real latest OTA on the production channel
npx supabase migration list --linked                          # real applied-migration state of whichever project is currently linked
```

For store review state, App Store Connect and Android Publisher API credentials already exist (see below) -- sign the requests by hand with Node's `crypto` (JWT for Apple, OAuth2 service-account JWT for Google) rather than installing a new package; both patterns are demonstrated in `docs/REVISION_LOG.md`'s recent entries.

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
