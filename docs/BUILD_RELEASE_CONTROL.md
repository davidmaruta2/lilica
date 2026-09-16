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

The existing TestFlight build 3 was produced before `expo-updates` was configured. OTA cannot be retrofitted into an installed native binary. The next expressly approved native build will be the first OTA-capable Lilica binary.

## Current blockers before build approval

- The checked-in application icon assets are still Expo placeholder artwork and must be replaced with approved Lilica artwork.
- The returning-account duplicate-person prevention change has focused test coverage, but the full validation run was stopped at David's instruction and must be completed before requesting build approval.

Neither blocker authorizes a build once resolved; the absolute approval rule still applies.
