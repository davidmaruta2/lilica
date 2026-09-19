# Lilica Next Native Build Manifest

Status: the build described below has been built and submitted (19 September 2026). This document's "existing native baseline" and "changes awaiting" sections are retained for history but are now superseded -- see the 19 September update immediately below for the actual current baseline.

Date: 17 September 2026 (original); updated 19 September 2026

## 19 September 2026 update: this build was approved, built, and submitted

On David's explicit approval (stated build request: both platforms, `store-test` profile, purpose superseding the `1.0.0 (3)`/`1.0.0 (2)` baseline, commit `f3d0dcb`, full delta as listed below, validation as listed below, submission included), the build described in this manifest was run:

| Platform | Version | EAS build ID | Distribution state |
| --- | --- | --- | --- |
| iOS | `1.0.0 (4)` | `6d89e118-ab7b-4065-a279-03ef1b581b66` | Submitted to TestFlight (processing on Apple's side after upload) |
| Android | `1.0.0 (4)` | `56cb08fe-f5a7-4b16-b101-ce6fe5a63ae1` | Submitted to Google Play internal testing, release status `COMPLETED` |

This is now the current native baseline, superseding `1.0.0 (3)`/`1.0.0 (2)` everywhere in this document. It contains everything listed in "Changes awaiting the next approved iOS and Android builds" below (items 1-5), and is the first OTA-capable Lilica binary. No OTA update has been published from it yet.

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
6. Decide whether the build is `store-test` against development/preview services or a true production build. Production EAS/Supabase values are not currently configured, so a production build is not ready.
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

## Current limitations

- Production Supabase and production EAS environment values do not exist/configured; do not run a production build.
- Apple subscription review screenshot/final review metadata remains outstanding.
- Google Play testing availability and tester enrolment still need physical confirmation.
- Durable EAS-managed Google Play submission credentials remain to be configured before a future automated submission.
- Apple Server Notifications V2 and Google RTDN still need final store-side verification through RevenueCat.
- Store purchase, renewal, cancellation, refund/revocation, expiry, restore, and iOS-to-Android cross-login flows are not yet physically signed off.
- Expo's compatibility check reports several SDK 57 packages a few patch versions behind. Do not upgrade them incidentally; handle them as a separately reviewed dependency task.
- Local backend validation requires Docker Desktop. It was blocked at the 17 September checkpoint (Docker off) but has since run successfully -- see the 19 September 2026 Medical Log migration deployment in `docs/REVISION_LOG.md`.
- Biometric app lock has real automated test coverage (`tests/biometric-lock.test.ts`, mocked at the `expo-local-authentication` boundary) but has NEVER been exercised against real device biometrics -- Expo Go cannot load a new native module at all, so this is entirely unverified on a physical device until a new native build exists.
