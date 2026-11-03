# Lilica EAS Build and OTA Readiness Report

**Date:** 16 September 2026; current-state reconciliation added 3 November 2026
**Original action taken:** Configuration and documentation only. No build, submission, or OTA publication was started during that task.

## 3 November 2026 reconciliation

This is a historical readiness report, not a current release plan. Both stores are publicly live: iOS `1.0.0 (8)` from commit `207cc24` and Android `1.0.0 (6)` from commit `195d186`. Both current binaries include EAS Update support, and production OTAs have subsequently been published under David's per-action approvals. The app is a free download; customers receive 60 backend-controlled free days and can then buy Lilica Annual for GBP 8.99/year; no Apple introductory offer is configured.

Remaining limitations are physical QA, not store-readiness claims: billing lifecycle and cross-platform entitlement checks, plus real-device confirmation of build 8's intro-carousel scroll fix. No future build, submission, distribution, or OTA is authorised by this report.

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

## Important limitation at the time (historical)

TestFlight build 3 and Google Play internal build 2 could not receive EAS OTA updates because they predated `expo-updates`. They were later superseded by OTA-capable production binaries; this statement no longer describes the current live baseline.

OTA is suitable for compatible JavaScript and bundled-asset changes. Native dependency or native configuration changes still require a newly approved native build. Publishing an OTA update also requires David's separate explicit approval.

## Build readiness snapshot (historical, 16 September 2026)

- The product owner approved a Lilica icon and it was checked in as `assets/lilica-app-icon.png`; active Expo icon/adaptive-icon/favicon references no longer used the Expo placeholder.
- The returning-account duplicate-person prevention fix had focused coverage and that task's repository-wide Jest run passed: 100 suites, 880 tests.
- TypeScript, secret scan, Expo public config, web export, and diff checks passed for that snapshot.
- `npx expo install --check` reported known Expo SDK 57 patch-level drift. No upgrade had been authorised.
- Local backend validation was blocked because Docker Desktop was off. No schema/backend change was made by that checkpoint.
- Production Supabase/EAS did not yet exist on 16 September; it was created and verified later and has since supported the live production binaries.

Historical readiness evidence is not current validation and never constitutes build approval. See `docs/NEXT_NATIVE_BUILD_MANIFEST.md`, re-run checks against the exact proposed commit, and obtain express approval before any release command.

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
