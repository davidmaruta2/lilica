# Lilica Next Native Build Manifest

Status: historical build manifest, reconciled 3 November 2026. The original build request and delta below are retained as dated evidence; they are not the current release plan or binary baseline.

Date: 17 September 2026 (original); reconciled 3 November 2026

## 3 November 2026 current-state reconciliation

Both stores are publicly live. The current native binaries are iOS `1.0.0 (8)` from commit `207cc24` and Android `1.0.0 (6)` from commit `195d186`, both production-profile builds. The app is a free download; the backend-controlled free period is 60 days, followed by Lilica Annual at GBP 8.99/year, with no Apple introductory offer. Build 8's intro-carousel scroll fix remains unconfirmed on a real device, and physical billing/entitlement QA remains outstanding.

This document does not authorise another build, submission, distribution, or OTA. The absolute authority rule below remains current. Any future proposal must use the live binaries above as its starting baseline, calculate the exact delta at that time, run the mandatory checks, and obtain David's express approval for each release action.

## NATIVE BUILD QUEUE (opened 4 November 2026) - HELD, NOT AUTHORISED

David asked on 4 November 2026 for items that need a native binary to be queued here while he decides whether and when to build. **Queueing is not approval.** No `eas build`, `eas submit` or `eas update` may be run for any of this without David's direct yes for that specific action, and the absolute authority rule below still applies in full.

Baseline to calculate the delta from: iOS `1.0.0 (8)` (commit `207cc24`), Android `1.0.0 (6)` (commit `195d186`). Re-verify both live before any proposal.

### Items that REQUIRE a native build

| # | Item | Why it needs a binary | State |
| --- | --- | --- | --- |
| 1 | In-app review prompt (`src/reviewPrompt.ts`, new dependency `expo-store-review ~57.0.3` in `package.json`) | Native module on both iOS (StoreKit) and Android (Play In-App Review). Neither live binary contains it. | Committed (`cce5f0c`, wired in `9abc9e0`) and tested (5 tests incl. a binary-without-the-module case). Its JavaScript already reached users in the 4 November OTA, where it does nothing because the module is absent; the prompt only becomes active on a binary that includes the module. |
| 2 | Android: `updates.fallbackToCacheTimeout: 3000` in `app.json` | Native-affecting config. iOS builds 7 and 8 have it (commit `a92fee3`); Android `1.0.0 (6)` was built before it. Without it, OTA fixes may miss a fresh Android install's first launch. | Already committed. |
| 3 | Apple store listing update: new app name `Lilica: Family Care Organiser`, subtitle, keywords, description, screenshots | Apple only allows these to change on a new app version going through review (promotional text is the only field editable on a live version, and is already updated). | Copy drafted in `lilica-growth-execution/01-ASO-METADATA-PACK.md`; final screenshots (8 frames, no `21` notification badge, no delete screen) not yet captured or approved. Google Play listing text is already live and needs no build. |

### Version and review prompt rules for the next build (added 5 November 2026)

- **Do not build as version 1.0.0.** The hotfix OTA published on 5 November 2026 (group `22eede74-eb07-4c81-803a-98a6c1dae352`, commit `1279012`, branch `hotfix-disable-review-prompt`) targets runtime `1.0.0` and switches the review prompt OFF. A new binary still on 1.0.0 would receive it and the prompt would be off. Apple also needs a version higher than the live 1.0.0, so use `1.0.1` on both stores (runtime follows the app version).
- A build from `growth-activation-events` includes `expo-store-review` and the review prompt switched ON (the `reviewPromptSwitch` exists only on the hotfix branch). Do not merge the hotfix branch into the build commit without setting `reviewPromptSwitch.enabled` back to true.
- Also in this build, not yet on phones: invite form feedback and layout fixes, records load on joining (F7), Unassigned label fix, Care Circle sub screens with breadcrumb, no setup card for joiners (F6), and the `invitation_accepted` event (G1; its migration `20261105100000` is already applied to production).
- Full plan: `lilica-growth-execution/14-NATIVE-BUILD-PLAN-2026-11-05.md`.

### Items that did NOT need a build (SHIPPED by OTA group `543c1ac0-6934-4051-9cb8-84ae8fa301d7` on 4 November 2026, commit `9abc9e0`, on David's yes)

- Returning user accepting an invitation now lands in the newly joined care space (`App.tsx`, `src/careSpaceState.ts`).
- Purchase confirmation message on the Subscription screen (`src/screens/SubscriptionScreen.tsx`).
- Trial prompt (`src/trialPrompt.ts`) and privacy-safe activation events (`src/activationEvents.ts`). The additive migration `supabase/migrations/20261104090000_activation_events.sql` was applied to `lilica-production` on 4 November 2026 on David's yes. pgTAP for it passed 9 of 9 locally. The build 8 intro-carousel scroll fix also reached older installs through this OTA.

### Open items that would join the queue if David chooses

- Retry-safe invitation acceptance after a lost response (needs a reviewed migration plus pgTAP; high priority per the audit).
- Deep link to a specific invitation; first-collaboration prompt after acceptance; bounded entitlement refresh after purchase.

### Before this queue can become a build request

1. David decides to build, and which platforms.
2. Commit the working tree (David asks for commits), then re-run typecheck, the full test suite, `secrets:check`, resolved Expo config (`ios.supportsTablet` must stay `false`), web export and `git diff --check`.
3. Resolve or explain the two failing local pgTAP files (`delete_care_space`, `phase18b_account_deletion`) noted in `docs/NEW_USER_JOURNEY_ACTIVATION_AUDIT_2026-11-03.md`; they were not yet confirmed as pre-existing.
4. Final screenshots approved and Apple metadata ready, so one Apple review carries the listing change and the binary together.
5. Present the standard approval statement (platform, profile, exact commit, purpose, delta, validation, limitations, submission) and wait for a direct yes.

Both stores review a new binary (Apple App Review, Google Play review); OTA updates do not need store review but must stay inside the stores' rules for interpreted code.

## 19 September 2026 update: first production-profile build (historical baseline)

David stated explicitly he is done with dev-phase work; everything now targets real public go-live. After the RevenueCat production webhook and production Auth config were verified/fixed (a cross-environment webhook bug found and fixed via the RevenueCat API -- see `docs/REVISION_LOG.md`), David explicitly authorised the first `production`-profile build, following the full mandatory pre-build checklist below (all passed): commit `313d064`.

| Platform | Version | EAS build ID | Distribution state |
| --- | --- | --- | --- |
| iOS | `1.0.0 (5)` | `22860bae-49bb-46de-9ccb-0e4cb5a51ca8` | Submitted to TestFlight |
| Android | `1.0.0 (5)` | `a7ed9204-270b-482e-a329-2f72f863ceef` | Submitted to Google Play **internal** track (David's explicit choice, not `production`), status `COMPLETED` |

**This was the first binary genuinely wired to `lilica-production`, not `lilica-development`.** It superseded `1.0.0 (4)` (below) as the baseline at that time and contained everything that build contained, plus real production backend wiring. Production remains the default profile for any future build discussion, but use the 3 November reconciliation above for the current binary baseline. The absolute build-approval gate is unchanged.

**Historical limitations at 19 September 2026:** Android's submit track was then `internal`; iOS had not yet been submitted for App Store review; Apple ASN V2/Google RTDN was then unconfirmed. All three were resolved later: both stores are now live and the notification integrations were confirmed. See `docs/REVISION_LOG.md` and `docs/REVENUECAT_BILLING_SETUP_REPORT.md`.

## 26 September 2026 update: outcome of the submissions above

Both `1.0.0 (5)` binaries were subsequently submitted for review (21 September 2026). Outcome:

- **Android: APPROVED, publicly live** on Google Play production track, `versionCode 6`, status `completed` -- this is the real native binary `1.0.0 (6)` (commit `195d186`, built 22 September 2026; see `CLAUDE.md`'s corrected build history), not a discrepancy.
- **iOS: REJECTED.** Confirmed via API (`appStoreState`/`appVersionState` both `REJECTED`). Apple is asking for additional information (screen recording, written answers, demo-account/screenshot/IAP checks), not stating confirmed defects. This does not, by itself, require a new native build -- the expected path is answering Apple and resubmitting the existing `1.0.0 (6)` binary, not building a new one. Full detail: `docs/REVISION_LOG.md`'s 26 September entry.

## 19 September 2026 update (superseded by the above): store-test build 4 was approved, built, and submitted

On David's explicit approval (stated build request: both platforms, `store-test` profile, purpose superseding the `1.0.0 (3)`/`1.0.0 (2)` baseline, commit `f3d0dcb`, full delta as listed below, validation as listed below, submission included), the build described in this manifest was run:

| Platform | Version | EAS build ID | Distribution state |
| --- | --- | --- | --- |
| iOS | `1.0.0 (4)` | `6d89e118-ab7b-4065-a279-03ef1b581b66` | Submitted to TestFlight (processing on Apple's side after upload) |
| Android | `1.0.0 (4)` | `56cb08fe-f5a7-4b16-b101-ce6fe5a63ae1` | Submitted to Google Play internal testing, release status `COMPLETED` |

This was the dev-backed baseline before the production-profile build above superseded it. It contains everything listed in "Changes awaiting the next approved iOS and Android builds" below (items 1-5), and is the first OTA-capable Lilica binary. No OTA update has been published from it yet.

**Durable submission credentials were also configured during this same session** so that this manual credential-gathering step never has to repeat: an Apple App Store Connect API key (`C:\Users\DavidPC\.lilica-credentials\AuthKey_5LPXC77JFN.p8`, Key ID `5LPXC77JFN`, Issuer ID `67953a69-92f8-4cce-931b-8543e12844dd`) and a Google Play service-account key (`C:\Users\DavidPC\.lilica-credentials\google-service-account.json`), both wired into `eas.json`'s `submit.store-test` and `submit.production` blocks. **Never ask David for these again** -- see `docs/BUILD_RELEASE_CONTROL.md`'s "CRITICAL" section and `docs/REVISION_LOG.md`'s matching 19 September entry.

A production Supabase project (`lilica-production`) and EAS `production` environment were also created and fully configured in this same session -- see `docs/SUPABASE_OPERATIONS.md` and `docs/REVENUECAT_BILLING_SETUP_REPORT.md`. This does not itself authorise a production build.

## Original 17 September manifest (historical, describes the delta that is now IN the binaries above)

## Absolute authority rule

No EAS/native build may be started without David Maruta's express approval for that specific build. No prior approval, implementation request, test request, phase approval, or general request to continue is build approval.

Before any `eas build` command, the agent must state all of the following and wait for an explicit yes:

- platform: iOS, Android, or both;
- EAS profile and environment;
- purpose of the build;
- exact commit to build;
- changes included since the last native binaries;
- validation completed and limitations still open;
- whether submission/distribution is also requested.

The same rule applies separately to `eas submit`, TestFlight/Play distribution, and `eas update`. Do not infer approval for one operation from approval for another.

## Existing native baseline

The latest native binaries are store-test builds created on 16 September 2026:

| Platform | Version | EAS build ID | Distribution state |
| --- | --- | --- | --- |
| iOS | `1.0.0 (3)` | `ea54ffa7-f4c3-4386-b5d1-7d2060cfeb17` | Submitted to TestFlight; installed and opened on a physical iPhone |
| Android | `1.0.0 (2)` | `f0f85941-405b-4f24-a457-6ce6660f5077` | Submitted to Google Play internal testing |

These builds were produced from the then-current working tree before the repository checkpoint commit `2942a25`. They are not reproducibly tied to a clean git commit. Use the build IDs and version numbers above as the authoritative binary baseline.

The existing iOS and Android binaries already contain:

- the Phase 22 production visual migration present at build time;
- RevenueCat native SDK integration and per-platform public SDK configuration;
- the annual subscription screen using native store-localised product pricing;
- the Apple and Google annual products attached to RevenueCat's `lilica_active` entitlement;
- the signed RevenueCat to Supabase entitlement webhook integration;
- iPhone-only configuration (`ios.supportsTablet: false`);
- the current bundle/package identifier `com.luxfordinteractive.lilica`.

They do not contain the changes listed in the next section.

## Changes awaiting the next approved iOS and Android builds

### 1. Returning-account duplicate-person prevention

Files: `App.tsx`, `src/careSpaceState.ts`, `tests/returning-account-reconnect.test.ts`.

The TestFlight build exposed a reconnect defect: an existing authenticated account could re-enter onboarding and provision duplicate supported people/care spaces. The current source now waits for the authenticated account's care spaces to load before resolving onboarding state, reconciles setup against server-authoritative care spaces, and rechecks the server immediately before roster provisioning as defence in depth.

The duplicate empty Maggie and Ben care spaces created during the physical test were verified to contain no records, contacts, invitations, attachments, activity, or additional memberships and were removed through the authenticated `delete_care_space` RPC. The original populated Maggie and Ben spaces remain.

This fix is committed but is not in iOS build 3 or Android build 2.

### 2. Approved Lilica app icon

Files: `assets/lilica-app-icon.png`, `app.json`.

The product owner approved the current icon after iterative visual review: a rounded deep-terracotta `L`, a clearly separated muted-olive leaf, and a near-ink deep blue-teal field. Expo now references this asset for the shared app icon, Android adaptive foreground, and web favicon. Android adaptive background is `#062B33`.

The existing TestFlight build still displays Expo placeholder artwork. Icon changes are native and cannot be delivered to an installed app by OTA. The approved icon first appears only after a newly approved native build is installed.

### 3. OTA foundation

Files: `package.json`, `package-lock.json`, `app.json`, `eas.json`.

The current source includes SDK-compatible `expo-updates@~57.0.22`, EAS update URL `https://u.expo.dev/13d12e42-4800-440f-9f38-9c93f5403c6f`, `runtimeVersion.policy: appVersion`, and explicit channels:

- `preview` profile -> `preview` channel;
- `store-test` profile -> `store-test` channel;
- `production` profile -> `production` channel.

No OTA update has ever been published. iOS build 3 and Android build 2 predate this native dependency and can never receive EAS Updates. The next expressly approved native builds must retain this configuration and will be the first OTA-capable Lilica binaries.

Publishing an OTA remains a separate protected release operation and requires David's express approval for the exact channel, environment, commit/change set, and update message.

### 4. Documentation and release-control changes

The release-control, billing, handoff, roadmap, and QA documents have been corrected to reflect real builds and the current external-service state. These files do not change runtime behaviour, but they are part of the next clean source checkpoint.

### 5. Post-build implementation batch (`\downloads\lilbatch.txt`), 17 September 2026: intro copy, biometric app lock, structured Medical Log

Implemented, validated, and committed and pushed (`55d4fc1`) on David's explicit instruction given after the batch itself was implemented -- the batch's own default ("do not commit/push without separate documented authorisation") was superseded by that direct instruction, exactly as the batch's own rule anticipates.

**Intro copy correction (no build required, but bundled with this batch since it touches the same working tree):** the third Welcome intro screen's heading now reads exactly "Share and organise care, with clarity" (`src/screens/WelcomeScreen.tsx`). This is JS-only and does not by itself require a new native build.

**Biometric app lock (REQUIRES a new native build -- cannot work in Expo Go or in the existing iOS build 3/Android build 2 at all):**
- New native dependency: `expo-local-authentication@~57.0.3` (added via `npx expo install`, SDK 57-compatible).
- `app.json` gained `ios.infoPlist.NSFaceIDUsageDescription` (Face ID permission copy). No Android permission/config addition was needed -- the module autolinks its own manifest permissions.
- New `src/biometricLock.ts` (native boundary + the `useBiometricLock()` hook), `src/components/BiometricLockScreen.tsx` (the full-screen lock cover), a new "Security" section in `src/screens/AccountScreen.tsx`, and wiring in `App.tsx` (the hook, the toggle handler, and the final-render lock gate).
- Layered on top of the existing Supabase session, never a replacement for it or a second Lilica identity; opt-in; account-isolated per device (a per-account AsyncStorage key, exactly like `src/storage.ts`'s own convention); disables the OS device-passcode fallback (`disableDeviceFallback: true`) so it stays a genuine biometric check; falls back to the existing Lilica sign-out/login route, never a new PIN.
- **This is a native dependency change. It cannot be delivered by OTA to the existing iOS build 3/Android build 2, or to any future build that predates it.** The next approved native build is the first one that can contain it.

**Structured Medical Log (REQUIRES a new native build only because it ships in the same source tree as the biometric native dependency above -- the Medical Log feature itself is pure JS/SQL and would be OTA-eligible on its own once a build containing it exists):**
- Two new record types, `condition` and `medicine`, both mapped to the existing `health` permission domain (`src/types.ts`, `src/records.ts`).
- New migration `supabase/migrations/20260917130000_medical_log.sql`: widens the `records_type` CHECK constraint and `record_domain_for_type()`, and redefines `apply_record_mutation()` to accept the two new types in its own separate whitelist (a second, earlier structural defence found and documented by `supabase/tests/database/record_domain_fail_closed.test.sql`). **Applied to `lilica-development` and database-proven 19 September 2026** -- local `npm run validate:backend` (23 files/496 pgTAP assertions, warning-level lint clean of anything new) then `npx supabase db push --linked --dry-run`/`--linked` then `npx supabase test db --linked` (identical 23 files/496 assertions against the hosted database). See `docs/REVISION_LOG.md`'s 19 September 2026 entry.
- `src/components/RecordEditor.tsx` gained condition/medicine fields: an optional diagnosed date, an optional repeat-vs-duration medicine schedule with its own optional end date, and a shared active/closed lifecycle toggle (closing sets `closedAt`, reopening clears it -- never deletion).
- New `src/screens/MedicalLogScreen.tsx` (Care needs / Diagnosed conditions / Prescribed medicines, each with a Current + Past/closed grouping) reachable only from the Settings drawer's person-scoped group (`SettingsMenu.tsx`/`App.tsx`) -- deliberately NOT added to `FirstThingScreen.tsx`'s protected everyday category stack.
- Care needs reuse the existing `careNote` type and its established editor/permission/sync path exactly as-is -- no schema change for that part.
- Full detail, scope boundaries, and everything explicitly deferred: see the completion report `LILBATCH_COMPLETION_REPORT.txt` (repository root, an untracked loose report file per this repo's established convention -- see `docs/LUMEN_HANDOFF.md`'s "Working tree" note).

## Mandatory pre-build checks

Before requesting build approval:

1. Confirm `git status --short` is empty and record `git rev-parse HEAD`.
2. Run `npm run typecheck`, `npm test`, `npm run secrets:check`, `npx expo config --type public`, `npx expo export --platform web`, and `git diff --check`.
3. Confirm the resolved Expo config reports:
   - `icon: ./assets/lilica-app-icon.png`;
   - `ios.supportsTablet: false`;
   - the Lilica EAS update URL;
   - `runtimeVersion.policy: appVersion`;
   - Android adaptive background `#062B33`.
4. Confirm the selected profile has the correct EAS Update channel.
5. Confirm the selected EAS environment contains the intended Supabase public values and both RevenueCat public SDK keys. Never print secret values into logs or documentation.
6. Confirm the intended environment/profile and verify its current EAS/Supabase values without printing secrets. Production infrastructure exists and has supported the live binaries, but its existence is neither current validation nor release authority.
7. **Medical Log migration** (`supabase/migrations/20260917130000_medical_log.sql`, added 17 September 2026): applied to `lilica-development` and database-proven 19 September 2026 (local + linked pgTAP both pass, see `docs/REVISION_LOG.md`). No longer an open pre-build item, but re-confirm `supabase/tests/database/medical_log.test.sql` still passes if further backend changes land before the next build.
8. State the build request to David in the format required by `docs/BUILD_RELEASE_CONTROL.md` and wait for explicit approval.

## Mandatory checks after a future approved build

On both platforms:

- confirm the approved Lilica icon is installed and no Expo placeholder remains;
- sign into an existing account and confirm no duplicate Maggie/Ben or duplicate care spaces are created;
- verify ordinary new-account onboarding still provisions the intended people exactly once;
- verify the build reports the intended EAS Update channel/runtime;
- physically inspect Home, Calendar, To Do, People, secondary pages, keyboard behaviour, safe areas, record sheets, notifications, PDF sharing, and person switching;
- run RevenueCat purchase and restore QA using the store's licensed sandbox/internal-testing route;
- verify store-localised price strings match the native purchase sheet;
- verify a real store event reaches RevenueCat, reaches the signed Supabase webhook, updates entitlement state, and changes mutation access correctly.

An OTA smoke test may be designed only after the new binary is installed and only after separate express approval to publish that test update.

## Current limitations (reconciled 3 November 2026)

- Store purchase, renewal, cancellation, refund/revocation, expiry, restore, and iOS-to-Android cross-login flows are not yet physically signed off.
- Google Play licensed-tester/internal-track billing coverage still needs physical confirmation.
- Build 8's intro-carousel scroll fix remains unconfirmed on a real device. Do not infer that App Store approval is physical QA evidence.
- Expo's compatibility check previously reported several SDK 57 packages a few patch versions behind. Re-check before proposing changes and do not upgrade them incidentally; handle dependency work as a separately reviewed task.
- Biometric app lock has automated coverage at a mocked native boundary, but this document contains no verified real-device biometric QA result.

Resolved since the original manifest: production Supabase/EAS exists; production builds were created; durable submission credentials exist; Apple's review screenshot/metadata and first subscription submission were completed; Apple ASN V2 and Google RTDN were confirmed; and both stores are publicly live. None of those resolutions relaxes the authority gate.
