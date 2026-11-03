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

## Current binary and OTA boundary (reconciled 3 November 2026)

The publicly live binaries are iOS `1.0.0 (8)` from commit `207cc24` and Android `1.0.0 (6)` from commit `195d186`; both include EAS Update support. The old TestFlight build 3 / Google Play internal build 2 limitation was historical and is no longer the current baseline. OTA remains limited to compatible JavaScript/assets: native dependency or native configuration changes still require a newly approved native build and an appropriate runtime/version decision.

## Current readiness and approval boundary (reconciled 3 November 2026)

- Both stores are publicly live: iOS `1.0.0 (8)` / commit `207cc24`; Android `1.0.0 (6)` / commit `195d186`.
- The app download is free. The commercial contract remains 60 backend-controlled free days, then GBP 8.99/year; no Apple introductory offer is configured.
- Production Supabase/EAS, RevenueCat's production webhook, production Auth, durable submission credentials, Apple ASN V2, and Google RTDN are configured. These are established infrastructure, not authority for another release action.
- Physical billing lifecycle and cross-platform entitlement QA remain outstanding, as does real-device confirmation of build 8's intro-carousel scroll fix. Store approval must not be represented as completion of those checks.
- Validation counts recorded in older manifests are historical snapshots. Re-run the required checks against the exact future commit rather than quoting them as current evidence.
- Expo SDK patch-level drift was previously reported. Re-check it deliberately and do not upgrade dependencies incidentally.

Technical preparation or public availability never authorizes another build, submission, distribution, or OTA. The absolute approval rule still applies. Use `docs/NEXT_NATIVE_BUILD_MANIFEST.md` for the current binary baseline and mandatory checklist, then calculate the exact proposed delta.
