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

## CRITICAL: durable submission credentials already exist -- never ask David for these again

David has said explicitly and repeatedly that re-finding/re-supplying these credentials for every session is unacceptable. As of 19 September 2026, permanent, reusable submission credentials exist and are already wired into `eas.json`:

- **Apple App Store Connect API key:** `C:\Users\DavidPC\.lilica-credentials\AuthKey_5LPXC77JFN.p8`, Key ID `5LPXC77JFN`, Issuer ID `67953a69-92f8-4cce-931b-8543e12844dd`.
- **Google Play service-account key:** `C:\Users\DavidPC\.lilica-credentials\google-service-account.json` (`revenuecat-service-account@lilica-6gy1l5.iam.gserviceaccount.com`).
- **RevenueCat Secret API key:** `C:\Users\DavidPC\.lilica-credentials\revenuecat_secret_api_key.txt` (`sk_...`).
- **Resend API key (production):** `C:\Users\DavidPC\.lilica-credentials\resend_api_key_production.txt`.

The Apple/Google keys are referenced by absolute path in `eas.json`'s `submit.store-test` and `submit.production` blocks and work non-interactively (`eas submit --non-interactive`) exactly as-is. **David has said explicitly, more than once, that being asked to re-supply any of these four credentials in a future session is unacceptable. If a submission fails with a credentials error, or RevenueCat/Resend access is needed, check these exact paths first -- never ask David to regenerate or re-supply anything before confirming the file is genuinely missing.** These files are permanent and outside the repository by design (never commit them; see `AGENTS.md`). Full context: `docs/REVISION_LOG.md`'s 19 September entries.

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
- A production Supabase project (`lilica-production`, `luyoyupghbxjftqwzcfn`) and EAS `production` environment now exist (created 19 September 2026), fully migrated and pgTAP-proven. The RevenueCat production webhook integration and production Auth (SMTP, redirect URLs, OTP length) are now also configured and independently verified (19 September 2026, see `docs/REVISION_LOG.md`). A `production`-profile build is technically ready, but no production build has ever been requested or approved, and the separate store-readiness gates (Apple subscription review, real purchase QA, store listings, Google Play production-track eligibility) remain outstanding regardless. Do not infer approval for a production build from this readiness.
- `store-test` builds `1.0.0 (4)` (iOS EAS `6d89e118-ab7b-4065-a279-03ef1b581b66`, Android EAS `56cb08fe-f5a7-4b16-b101-ce6fe5a63ae1`) were approved, built, and submitted 19 September 2026 to TestFlight and Google Play internal respectively. See `docs/NEXT_NATIVE_BUILD_MANIFEST.md` for the exact included delta.

Technical preparation never authorizes a build. The absolute approval rule still applies. The exact current binary delta and checklist are in `docs/NEXT_NATIVE_BUILD_MANIFEST.md`.
