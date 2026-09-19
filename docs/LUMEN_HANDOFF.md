# Lilica Current Session Handoff

Despite its legacy filename, this is the canonical current handoff for every incoming agent.

Last updated: 17 September 2026

## Read this first

Lilica is a calm personal and family care organiser built with Expo SDK 57, React Native, TypeScript, Supabase, RevenueCat, EAS, App Store Connect, and Google Play. It is not a clinical system, emergency monitor, surveillance product, or generic family calendar.

The current source includes all separately approved implementation work through Phase 22, subsequent product-owner corrections, RevenueCat/store setup, returning-account duplicate prevention, the approved Lilica app icon, the EAS Update foundation, and (17 September 2026, committed and pushed as `55d4fc1`) a post-build batch adding intro copy correction, opt-in biometric app lock, and a structured Medical Log -- see `docs/REVISION_LOG.md`'s 17 September entry, `docs/NEXT_NATIVE_BUILD_MANIFEST.md` section 5, and `LILBATCH_COMPLETION_REPORT.txt` (repository root, untracked) for full detail. The biometric lock's native dependency means a new native build is required before either new feature reaches a real device. The Medical Log migration was applied to `lilica-development` and database-proven on 19 September 2026 (`docs/REVISION_LOG.md`'s 19 September entry) -- that no longer blocks the next build.

An incoming agent must not assume a new phase or release action is authorised. Read this file, `AGENTS.md`, `docs/NEXT_NATIVE_BUILD_MANIFEST.md`, `docs/BUILD_RELEASE_CONTROL.md`, and `docs/REVENUECAT_BILLING_SETUP_REPORT.md` before acting.

## Repository state

- Repository: `https://github.com/davidmaruta2/lilica`
- Active branch: `prephase22-remove-supported-person-faq-help`
- `master` is stale and behind. Do not merge to or restart from `master` without explicit product-owner instruction.
- Last pushed implementation checkpoint: `55d4fc1` (17 September 2026, the lilbatch.txt post-build batch). Do not trust this line alone -- confirm with a fresh `git log -1`/`git status --short` per the line below.
- Run `git log -1`, `git status --short`, and compare local HEAD with the remote branch at the beginning of every session. Shared-machine/concurrent-agent changes have occurred before.
- The handoff task is complete only when local HEAD equals the remote branch and the working tree is empty.

## Critical release authority

No EAS/native build may ever be started without David Maruta's express approval for that specific build.

This is absolute. A phase prompt, implementation request, request to validate, request to prepare a build, previous build approval, or general instruction to continue is not authority to run a build.

Before any `eas build`, the agent must state:

- platform;
- EAS profile and environment;
- purpose;
- exact commit;
- included delta since the last native binary;
- validation completed;
- known limitations;
- whether submission/distribution is included.

Then stop and wait for David's direct approval.

`eas submit`, TestFlight/Play distribution, and `eas update` are also protected release operations. Obtain express approval for the exact operation; do not infer it from build approval.

Authoritative policy: `docs/BUILD_RELEASE_CONTROL.md`.

## Existing native binaries

The latest native binaries, built and submitted 19 September 2026 on the `production` EAS profile -- **the first build genuinely wired to `lilica-production`, not `lilica-development`:**

| Platform | Version | EAS build ID | State |
| --- | --- | --- | --- |
| iOS | `1.0.0 (5)` | `22860bae-49bb-46de-9ccb-0e4cb5a51ca8` | Submitted to TestFlight |
| Android | `1.0.0 (5)` | `a7ed9204-270b-482e-a329-2f72f863ceef` | Submitted to Google Play **internal** track (David's explicit choice -- not public), status `COMPLETED` |

Built from commit `313d064`. Contains everything `1.0.0 (4)` (the `store-test`/dev-backed predecessor) contained, plus real production backend wiring: `lilica-production` Supabase, the correctly-scoped RevenueCat production webhook, and verified production Auth (SMTP/URLs/OTP length). Full detail: `docs/REVISION_LOG.md`'s 19 September "First production-profile build" entry.

**Not yet done, and not resolved by this build:** Android's `eas.json` submit track is still `internal` (David's choice, changeable to `production` with no rebuild needed when ready); iOS still needs a manual "submit for App Store review" and release action in App Store Connect to go public. Neither is a build-content gap.

## RESOLVED: production signup was completely broken (19 September 2026)

David could not create any account on the installed `1.0.0 (5)` build -- traced to a stale `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the EAS `production` environment that didn't match `lilica-production`'s actual current key, causing every Supabase request from the app to fail with `401 Invalid API key`. Fixed by correcting the EAS env var and shipping it via OTA (update group `c9ff772b-2a9c-4d03-880d-f6cf103028e6`) rather than a new native build, since `EXPO_PUBLIC_*` values resolve at JS-bundle time. Full diagnosis and fix detail: `docs/REVISION_LOG.md`'s 19 September "CRITICAL" entry. **Confirm with David that signup now works on-device -- do not assume the OTA fixed it without his confirmation.**

## Apple ASN V2 / Google RTDN: now CONFIRMED CONFIGURED (19 September 2026)

Both sides confirmed directly by David, not just "looks fine":

- **Apple Server Notifications V2:** RevenueCat's own one-click "Apply to App Store Connect" integration button was used (Lilica iOS app page) and returned success/"done" -- a stronger confirmation than manual copy/paste, since RevenueCat's own integration performed and verified the App Store Connect write itself.
- **Google RTDN:** first attempt failed with "Your Google service account credentials do not have permission to create a Google Cloud Pub/Sub topic" (the `revenuecat-service-account@lilica-6gy1l5.iam.gserviceaccount.com` account lacked the Pub/Sub Editor IAM role on Google Cloud project `lilica-6gy1l5`). Fixed by granting that service account the **Pub/Sub Editor** role via Google Cloud Console -> IAM & Admin -> IAM. After the fix, RevenueCat's Lilica Android page "Connect to Google" button (topic ID `Play-Store-Notifications`) was clicked again and succeeded.

Both are now genuinely wired, not merely assumed. See `docs/REVENUECAT_BILLING_SETUP_REPORT.md` remaining-launch-gates item 7 (now struck through) for the corresponding update.

**Submission credentials are now durable and permanent** -- an Apple App Store Connect API key and a Google Play service-account key are stored outside the repo at `C:\Users\DavidPC\.lilica-credentials\` and wired into `eas.json`. Never ask David to re-supply these; see `AGENTS.md`/`docs/BUILD_RELEASE_CONTROL.md`'s CRITICAL sections.

## OTA state

The source is now configured for OTA, but the installed binaries are not OTA-capable.

Current source includes:

- `expo-updates@~57.0.22`;
- update URL `https://u.expo.dev/13d12e42-4800-440f-9f38-9c93f5403c6f`;
- `runtimeVersion.policy: appVersion`;
- `preview`, `store-test`, and `production` channels in `eas.json`.

No OTA update has ever been published. OTA cannot be retrofitted into iOS build 3 or Android build 2. iOS `1.0.0 (4)`/Android `1.0.0 (4)` (submitted 19 September 2026) are the first OTA-capable binaries.

Publishing an update with `eas update` requires separate express product-owner approval for the exact channel, environment, commit/change set, and message.

## iOS device-family rule

Lilica is iPhone-only. `app.json` must retain `ios.supportsTablet: false`. Check the resolved Expo public config before every future build. Do not enable iPad support without a separate product-owner decision.

## Post-build changes awaiting new binaries

### Returning-account reconciliation

A physical TestFlight sign-in exposed duplicate Maggie and Ben entries. The current source waits for the signed-in account's server care spaces before resolving onboarding, reconciles setup state against that server state, and performs another server check before provisioning a roster.

The empty duplicate care spaces created during the test were inspected and removed through the authenticated deletion RPC. The original populated Maggie and Ben spaces remain.

Files: `App.tsx`, `src/careSpaceState.ts`, `tests/returning-account-reconnect.test.ts`.

### Approved app icon

The product owner approved `assets/lilica-app-icon.png`: a rounded deep-terracotta `L`, separate muted-olive leaf, and near-ink deep blue-teal field. `app.json` points shared icon, Android adaptive foreground, and web favicon to it; Android adaptive background is `#062B33`.

The TestFlight app still shows the Expo placeholder because icon changes require a new native binary. Do not replace the approved asset with any earlier mock variant.

### OTA native foundation

`expo-updates`, update URL, app-version runtime policy, and profile-specific channels are configured and committed. This is native configuration and requires a new binary before OTA can function.

## RevenueCat, Apple, Google, and Supabase

### Commercial contract

- 60 days fully free, controlled by Lilica's backend entitlement state.
- GBP 8.99/year afterward.
- No Apple/Google introductory free trial or duplicate store trial.
- One subscription per Lilica account covers every care space that account commercially owns.
- Care Circle role/permissions remain separate from commercial ownership and entitlement.

### RevenueCat

- Project: `Lilica` (`projf734d172`).
- Entitlement: `lilica_active` (`entl0fc7f87e90`).
- Current offering: `default` (`ofrng20b64f2958`).
- Annual package: `$rc_annual` (`pkgeaf002a6e28`).
- iOS app: `appe58361f9ab`.
- Android app: `app7b15628a27`.
- Apple product: `com.luxfordinteractive.lilica.annual`.
- Google product/base plan: `com.luxfordinteractive.lilica.annual:annual-autorenewing`.

The app uses RevenueCat's native store-formatted `priceString`. A US Apple storefront showing USD 9.99 is expected localisation, not a code defect; UK remains GBP 8.99. Do not hard-code GBP in place of the store value.

### Webhook

- Supabase project: `lilica-development` (`ldocquqbcabdbscghojc`).
- Function: `entitlement-webhook`.
- RevenueCat integration: `Lilica entitlement sync` (`whintgr4d880b6211`).
- HMAC secret is stored as Supabase secret `REVENUECAT_WEBHOOK_SECRET`, never in Git.
- A correctly signed no-op event returned HTTP 200.
- An invalid signature returned HTTP 401.

### Store state

- App Store Connect app: **Lilica: Care & Support**, ID `6812822327`.
- Apple annual subscription resource ID: `6812831899`; UK anchor GBP 8.99; 175 storefront equivalents.
- Google Play package: `com.luxfordinteractive.lilica`; developer account `8290450229567893119`.
- Google Cloud project: `lilica-6gy1l5` (a lowercase "L" -- earlier docs mistyped this as `lilica-6gy115`).
- Google product/base plan is READY and UK price is GBP 8.99.
- EAS preview environment contains development Supabase public configuration and both RevenueCat public SDK keys. EAS `production` environment now exists too, pointing at `lilica-production`.
- **Production Supabase project (`lilica-production`, `luyoyupghbxjftqwzcfn`) and EAS production environment now exist and are fully configured and independently verified (19 September 2026)** -- schema, edge functions, secrets, a correctly-scoped second RevenueCat webhook integration, and production Auth (SMTP/URLs/OTP length) all confirmed. See `docs/REVISION_LOG.md`'s 19 September entries and `docs/SUPABASE_OPERATIONS.md`.
- **Durable submission credentials are configured** -- Apple App Store Connect API key and Google Play service-account key, both outside the repo, wired into `eas.json`. Never ask David to re-supply these.

### RevenueCat/store work still outstanding

1. ~~Build and install new store-test binaries~~ -- done 19 September 2026 (`1.0.0 (4)` both platforms, see "Existing native binaries" above).
2. Complete physical iPhone sandbox purchase/restore/renewal/cancellation/expiry/refund tests.
3. Complete equivalent Google Play internal-track tests on Android.
4. Verify one real store event traverses store -> RevenueCat -> signed Supabase webhook -> entitlement row -> app read-only gate (the webhook plumbing itself is now confirmed correctly wired for both environments; an end-to-end real-event proof is still outstanding).
5. Verify cross-platform entitlement by purchasing on one platform and signing into the same Lilica account on the other.
6. Supply Apple's subscription review screenshot and final review metadata.
7. ~~Configure a durable EAS-managed Google Play submission credential~~ -- done 19 September 2026.
8. Finalise/verify Apple Server Notifications V2 and Google RTDN through RevenueCat.
9. ~~Create production Supabase and EAS environment configuration~~ -- done and verified 19 September 2026.
10. Complete store listings, policy/privacy declarations, review assets, and a separate production release go/no-go.

Full details: `docs/REVENUECAT_BILLING_SETUP_REPORT.md` and `docs/PHASE_21_QA.md`.

## Product state

The current app includes:

- protected Welcome/onboarding introduction;
- Supabase account creation/login, six-digit signup verification, password recovery, organiser profile, and session restoration;
- multi-person supported-person onboarding and one care space per supported person;
- server-backed care spaces, memberships, records, occurrences, recurrence/history, assignments, contacts, links, attachments, cache/outbox, and reconciliation;
- Home, Calendar, To Do, and People projections over shared data;
- list/grid controls on Home and To Do;
- local reminder scheduling and notification settings;
- Care Circle invitations, codes, email/share delivery, multi-person scope, roles, domain permissions, acceptance, removal, leaving, organiser handoff, archive/restore, and deletion consent;
- Documents collection, record linking, cloud attachment metadata/storage, upload retry, and cleanup queue;
- Search, Recent Activity, Exportable Care Summary PDF, notification centre, feature request, FAQ/how-to/contact, privacy/export/device-data/account-deletion flows;
- Phase 21 entitlement/read-only gates and RevenueCat subscription screen;
- Phase 22 typography, Lucide icon foundation, approved primary-tab themes, neutral secondary pages, Settings drawer, gradients, and responsive layout corrections;
- approved Lilica app icon configured in source.

Ask Lilica remains a placeholder. Do not remove it or implement AI without explicit approval.

## Protected visual state

The product owner approved the Phase 22 direction through iterative mock review. Preserve:

- Fraunces only for the Lilica wordmark;
- Inter Tight for headings;
- Inter for body/control text;
- zero tracking;
- Lucide for common UI icons;
- Home's warm light canvas;
- Calendar's terracotta gradient;
- To Do's matte blue-teal gradient, section-specific tiles, spacing/shadow separation, and joined list/grid control;
- People's teal gradient, Key contacts panel, Care Circle panel, and Ask Lilica placeholder;
- the warm-neutral secondary-page system and coherent drawer;
- responsive safe-area/keyboard behaviour and bottom navigation override.

Authority: `docs/PHASE_22_APPROVED_VISUAL_DIRECTION.md` and completion reports. Do not reinterpret the approved mock or launch an unsolicited visual pass.

## Protected system contracts

- Organiser, supported person, care space, membership, and commercial owner are distinct identities.
- Record facts are stored once and projected deterministically. Due/overdue is derived, not duplicated state.
- Occurrence history is immutable/versioned and recurrence changes do not rewrite history.
- Assignment never grants permission; permissions and assignment eligibility remain server-enforced.
- Every mutation is idempotent and scoped by care space.
- Sign-out stops sync but does not discard pending work.
- Entitlement is server-authoritative and separate from Care Circle access.
- Expired care spaces remain readable; only approved mutation paths are gated.
- Account deletion preserves minimum historical attribution while removing live account identity under the implemented contract.
- All text-entry screens must remain keyboard-aware and safe-area-correct.
- Never infer medical, legal, emergency, or monitoring conclusions.

## Validation status at handoff

Latest checkpoint validation:

- `npm run typecheck`: passed.
- Jest: 100 suites, 880 tests passed.
- `npm run secrets:check`: passed.
- `npx expo config --type public`: passed and reports approved icon, iPhone-only support, update URL/runtime, and Android adaptive config.
- `npx expo export --platform web`: passed.
- `git diff --check`: passed after documentation cleanup.
- `npx expo install --check`: reports known SDK 57 patch-level drift. No dependency upgrade was authorised.
- Local backend validation was blocked because Docker Desktop was off. No post-build schema/backend change requires deployment, and the hosted backend was not modified during the icon/OTA/reconnect checkpoint.

Do not convert a blocked backend check into a pass. Do not start Docker merely to tidy a report unless the task genuinely requires backend validation.

## Immediate continuation instructions

There is no automatically authorised next phase. On a new instruction:

1. re-read current git status/log and this handoff;
2. identify whether the request is code, store metadata, QA, build preparation, build execution, submission, or OTA;
3. preserve all protected product and visual behaviour;
4. for build/release work, follow the explicit authority gate and `docs/NEXT_NATIVE_BUILD_MANIFEST.md`;
5. for RevenueCat work, resume from the remaining steps above, not from the obsolete pre-configuration assumptions in older Phase 21 narrative;
6. update docs to actual behaviour, validate, inspect the full diff, and report limitations honestly;
7. commit/push only when requested and verify the working tree is clean.

An incoming agent should be able to begin immediately from this file and its four linked release/billing documents without asking David to reconstruct prior context.
