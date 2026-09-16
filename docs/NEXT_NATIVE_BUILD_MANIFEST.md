# Lilica Next Native Build Manifest

Status: ready for review, but not authorised to build

Date: 16 September 2026

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
7. State the build request to David in the format required by `docs/BUILD_RELEASE_CONTROL.md` and wait for explicit approval.

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
- Local backend validation requires Docker Desktop. The latest checkpoint could not run local pgTAP because Docker was off; hosted backend state was not modified by the post-build changes above.
