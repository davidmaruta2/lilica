# Lilica Build and Release Control

**Authority:** Product-owner instruction from David Maruta, 16 September 2026.
**Status:** Mandatory release gate.

## Absolute approval rule

No person or automation may start, submit, distribute, or publish an EAS/native build without David's express approval for that specific build.

This prohibition includes:

- `eas build` for iOS or Android;
- `eas build --auto-submit`;
- `eas submit` or retrying a submission;
- TestFlight distribution;
- Google Play internal, closed, open, or production-track distribution;
- production App Store submission;
- rebuilds intended only to fix configuration, icons, OTA, or metadata.

Prior approval for another build, a phase, a plan, or general implementation work is not approval for a new build. Before any build command, the implementation agent must state the platform, profile, purpose, included changes, validation state, and known limitations, then wait for David to explicitly approve that build.

## iOS device family

Lilica is an iPhone-only application. `app.json` must retain:

```json
"ios": {
  "supportsTablet": false
}
```

Every pre-build inspection must verify the resolved public Expo configuration still reports `ios.supportsTablet: false`. No iPad support may be enabled without a separate product-owner decision. This configuration is baked into the native binary and is intended to prevent App Store Connect from treating Lilica as an iPad app requiring iPad screenshots.

## OTA foundation

Every future approved native build must include EAS Update support:

- SDK-compatible `expo-updates` installed;
- `updates.url` bound to Lilica's EAS project;
- `runtimeVersion.policy` set to `appVersion`;
- build-specific EAS channels:
  - `preview` -> `preview`;
  - `store-test` -> `store-test`;
  - `production` -> `production`.

OTA publication is a separate release operation. Do not run `eas update` without David's express approval for that specific update, channel, environment, message, and included change set.

Native dependency/configuration changes remain incompatible with OTA and require a newly approved native build plus an appropriate app/runtime version decision.

## Current-build limitation

The existing TestFlight build 3 and Google Play internal build 2 were produced before `expo-updates` was configured. OTA cannot be retrofitted into an installed native binary. The next expressly approved iOS and Android builds must retain the checked-in OTA configuration and will be the first OTA-capable Lilica binaries.

## Current readiness and approval boundary

- The approved icon is checked in at `assets/lilica-app-icon.png` and active in `app.json`.
- The returning-account duplicate-person prevention change is implemented and covered by focused tests.
- Full TypeScript and Jest validation passes (100 suites, 880 tests), as do secret scan, resolved Expo config, web export, and diff checks.
- Expo's compatibility check still reports known SDK 57 patch-level drift. Do not upgrade dependencies incidentally; review that as a separate task.
- Local backend validation most recently could not run because Docker Desktop was off. The post-build icon/OTA/reconnect changes do not include a schema migration.
- Production Supabase/EAS environment values are not configured, so production builds are not ready.

Technical preparation never authorizes a build. The absolute approval rule still applies. The exact current binary delta and checklist are in `docs/NEXT_NATIVE_BUILD_MANIFEST.md`.
