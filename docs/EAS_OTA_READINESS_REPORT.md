# Lilica EAS Build and OTA Readiness Report

**Date:** 16 September 2026
**Action taken:** Configuration and documentation only. No build, submission, or OTA publication was started.

## Critical product-owner instruction

David's instruction is now recorded as an absolute release gate: **no EAS/native build may ever be started, submitted, or distributed without his express approval for that specific build**. The authoritative policy is `docs/BUILD_RELEASE_CONTROL.md`.

## iPhone-only status

- `app.json` explicitly retains `ios.supportsTablet: false`.
- Lilica remains configured for iPhone only, not iPad.
- Every future pre-build check must verify this value in the resolved Expo public configuration.
- This is the native device-family setting intended to prevent App Store Connect from requesting iPad screenshots for Lilica.

## OTA configuration completed

- Installed Expo SDK 57-compatible `expo-updates` (`~57.0.22`).
- Added Lilica's EAS Update URL:
  `https://u.expo.dev/13d12e42-4800-440f-9f38-9c93f5403c6f`.
- Added `runtimeVersion.policy: appVersion` so updates are accepted only by a compatible native runtime.
- Added explicit EAS Update channels:
  - preview builds -> `preview`;
  - store-test/TestFlight/internal Play builds -> `store-test`;
  - production builds -> `production`.
- No update was published.

## Important limitation

TestFlight build 3 and Google Play internal build 2 cannot receive EAS OTA updates because they were built before `expo-updates` existed in Lilica's native binaries. OTA cannot be added to an already-installed build. The next iOS and Android builds, if and only if David explicitly approves them, must retain the checked-in OTA configuration and will be the first OTA-capable binaries.

OTA is suitable for compatible JavaScript and bundled-asset changes. Native dependency or native configuration changes still require a newly approved native build. Publishing an OTA update also requires David's separate explicit approval.

## Build readiness update

- The product owner approved a Lilica icon and it is checked in as `assets/lilica-app-icon.png`; active Expo icon/adaptive-icon/favicon references no longer use the Expo placeholder.
- The returning-account duplicate-person prevention fix now has focused coverage and the repository-wide Jest run passes: 100 suites, 880 tests.
- TypeScript, secret scan, Expo public config, web export, and diff checks pass.
- `npx expo install --check` reports known Expo SDK 57 patch-level drift. No upgrade has been authorised.
- Local backend validation was blocked because Docker Desktop was off. No schema/backend change was made by the icon/OTA/reconnect checkpoint.
- Production Supabase/EAS configuration still does not exist; a production build is not ready.

This readiness evidence is not build approval. See `docs/NEXT_NATIVE_BUILD_MANIFEST.md` and obtain express approval before any build command.

## Files changed for this task

- `package.json` and `package-lock.json`: added `expo-updates`.
- `app.json`: added the update URL and app-version runtime policy; retained iPhone-only configuration.
- `eas.json`: added preview, store-test, and production update channels.
- `docs/BUILD_RELEASE_CONTROL.md`: added the mandatory approval and release-control contract.
- `docs/EAS_OTA_READINESS_REPORT.md`: this report.

## Explicit confirmation

- No `eas build` command was run.
- No `eas submit` command was run.
- No `eas update` command was run.
- No TestFlight or Google Play build was created or distributed.
- No commit or push was performed.

## Subsequent repository checkpoint

The configuration described above, the approved icon, and the reconnect fix were later committed and pushed. This report's action statement remains accurate for the OTA configuration task itself: it did not run a build or publish an update. Use git history and `docs/LUMEN_HANDOFF.md` for the final handoff commit.
