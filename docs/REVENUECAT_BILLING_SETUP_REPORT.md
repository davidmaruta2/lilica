# Lilica RevenueCat and Store Billing Implementation Report

**Report date:** 16 September 2026 (see "Remaining launch gates" below for 19 September 2026 updates -- new `1.0.0 (4)` binaries submitted, durable Apple/Google submission credentials configured, and a full production Supabase/EAS environment created and independently verified, including a correctly-scoped RevenueCat production webhook and production Auth config. Full detail: `docs/REVISION_LOG.md`'s 19 September entries.)
**Scope:** RevenueCat catalogue, Apple and Google subscription configuration, signed entitlement webhook, EAS store builds, test-store submissions, and current next steps.

## Executive status

Lilica's annual subscription foundation is now configured across RevenueCat, App Store Connect, Google Play, Supabase, and the native app build environments.

- Commercial contract: GBP 8.99 per year after Lilica's app/backend-controlled 60-day free period.
- No additional Apple or Google introductory trial is configured.
- One RevenueCat entitlement (`lilica_active`) and one annual package (`$rc_annual`) cover both stores.
- RevenueCat public SDK keys are configured for both native platforms in the ignored local environment and the EAS preview environment.
- The signed RevenueCat-to-Supabase webhook is live and has passed valid/invalid signature checks.
- Store-distribution Android and iOS builds both completed successfully.
- The iOS build was successfully submitted for TestFlight delivery.
- The Android build was successfully submitted to Google Play's internal testing track.

No public production release was performed. The billing implementation was subsequently included in repository checkpoint `2942a25`; later handoff documentation sits on top of that checkpoint.

## Commercial and RevenueCat contract

| Resource | Value |
| --- | --- |
| RevenueCat project | `Lilica` (`projf734d172`) |
| Entitlement | `lilica_active` (`entl0fc7f87e90`) |
| Current offering | `default` (`ofrng20b64f2958`) |
| Annual package | `$rc_annual` (`pkgeaf002a6e28`) |
| iOS app | `appe58361f9ab` |
| Android app | `app7b15628a27` |
| Apple product | `com.luxfordinteractive.lilica.annual` (`prod624c678885`) |
| Google product | `com.luxfordinteractive.lilica.annual:annual-autorenewing` (`prod70c3f2ccbc`) |

Both store products are attached to the annual package and grant the same entitlement. Lilica continues to use its own approved subscription screen; no RevenueCat hosted paywall was introduced.

## Apple configuration

- App name: **Lilica: Care & Support**.
- App Store Connect app ID: `6812822327`.
- Bundle ID: `com.luxfordinteractive.lilica`.
- Subscription group: `Lilica` (`22390236`).
- Annual subscription resource ID: `6812831899`.
- Duration: one year, paid upfront.
- UK anchor price: GBP 8.99; equivalent prices exist for 175 storefronts.
- English UK product name: `Lilica Annual`.
- English UK description: `One year of full Lilica access.`
- Family Sharing is disabled and no introductory offer is configured.
- App Store Connect credentials are connected to RevenueCat.
- The app declares standard HTTPS-only encryption usage via `ITSAppUsesNonExemptEncryption: false`.
- `ios.supportsTablet` remains `false`: this build targets iPhone, not iPad.

### iOS build and submission

- EAS build ID: `ea54ffa7-f4c3-4386-b5d1-7d2060cfeb17`.
- App version/build: `1.0.0` / `3`.
- Build profile: `store-test`.
- Build status: **FINISHED**.
- IPA: `https://expo.dev/artifacts/eas/OQfT9btscawr6bjV1FjERUC4Veov7SWzv10bW0g8UgM.ipa`.
- TestFlight submission ID: `8aea4863-f501-4481-aadd-fb6ab37d38cf`.
- Submission status: **FINISHED** through EAS/Apple.
- Internal testing group: `Lilica Internal Testers` (`f0cc3cf4-b69b-4dd8-b46e-a5eb06e81384`).
- Automatic access to all builds is enabled for that group.
- Build 3 is attached and `admin@luxfordinteractive.com` is registered as an internal tester.

Apple still requires the subscription review screenshot/final review metadata before the subscription can be approved for public sale. TestFlight purchase and restore QA must be completed on a physical iPhone with an Apple sandbox tester.

## Google Play configuration

- Play package: `com.luxfordinteractive.lilica`.
- Play developer account ID: `8290450229567893119`.
- Google Cloud project: `lilica-6gy1l5` (a lowercase "L" -- this and other docs previously mistyped it as `lilica-6gy115`).
- RevenueCat service account: `revenuecat-service-account@lilica-6gy1l5.iam.gserviceaccount.com`.
- Product/base plan: `com.luxfordinteractive.lilica.annual` / `annual-autorenewing`.
- Product state: **READY**.
- UK price: GBP 8.99.
- English UK product name: `Lilica Annual`.
- No introductory offer or Google store trial is configured.
- RevenueCat's Google Play credential validation passes.

### Android build and submission

- EAS build ID: `f0f85941-405b-4f24-a457-6ce6660f5077`.
- App version/version code: `1.0.0` / `2`.
- Build profile: `store-test`.
- Build status: **FINISHED**.
- AAB: `https://expo.dev/artifacts/eas/DosHBiqIpi33l0Fhj2wuJF48rfFSnA_qfKLyXAYwKjM.aab`.
- A cloud Android keystore was generated and retained by EAS.
- The intended submission track is `internal`.
- EAS submission ID: `89cf1058-af74-4261-8353-25a4ab07398c`.
- Submission status: **FINISHED** on the Google Play internal track.

A fresh JSON key for the existing Lilica RevenueCat service account was used only to authenticate this EAS submission. The local JSON and its temporary `eas.json` path were removed after Google Play accepted the upload; no private key was added to the repository. Future automated submissions will require an EAS-managed credential or another securely supplied key.

Google availability is currently UK-only. Wider territories and prices should be deliberately configured before international release.

## Supabase entitlement webhook

- Development project: `lilica-development` (`ldocquqbcabdbscghojc`).
- Edge Function: `entitlement-webhook`, active with external JWT verification disabled as required for RevenueCat callbacks.
- Endpoint: `https://ldocquqbcabdbscghojc.supabase.co/functions/v1/entitlement-webhook`.
- RevenueCat webhook integration: `Lilica entitlement sync` (`whintgr4d880b6211`).
- The RevenueCat HMAC signing secret is stored as the Supabase secret `REVENUECAT_WEBHOOK_SECRET`.
- A correctly signed no-op cancellation event returned HTTP 200.
- An invalid signature returned HTTP 401.
- The no-op test did not alter a user's entitlement record.
- No webhook secret or temporary HMAC material remains in the repository.

Apple Server Notifications V2 and Google Real-time Developer Notifications are now configured and confirmed (see "Remaining launch gates" item 7 below).

## EAS configuration

- Expo owner/project: `@davidmaruta2/lilica`.
- EAS project ID: `13d12e42-4800-440f-9f38-9c93f5403c6f`.
- Added build profiles for internal preview, store testing, and production.
- Store-test builds use the EAS `preview` environment.
- The preview environment contains the two RevenueCat public SDK keys and development Supabase public configuration.
- The production environment was intentionally not populated because a production Supabase project does not yet exist.
- The private Apple API key remains outside the repository; its temporary local path was removed from `eas.json` after the submission was created.

### OTA status

EAS Update/OTA is **not enabled in the existing iOS build 3 or Android build 2**. After those builds completed, the repository added `expo-updates@~57.0.22`, the EAS update URL, `runtimeVersion.policy: appVersion`, and explicit `preview`, `store-test`, and `production` channels. The next expressly approved native builds must retain that configuration and will be the first OTA-capable binaries. No OTA has been published.

The exact post-build delta also includes the returning-account duplicate-person prevention fix and the approved Lilica app icon. See `docs/NEXT_NATIVE_BUILD_MANIFEST.md`.

## Validation completed

- `npm run typecheck`: passed.
- Focused Phase 21 billing suites: **4 suites, 62 tests passed**.
- `npm run secrets:check`: passed; 410 repository files inspected.
- `npx expo config --type public`: passed and confirms both native identifiers plus `supportsTablet: false`.
- `git diff --check`: passed; only existing CRLF conversion warnings were reported.
- RevenueCat signed webhook check: HTTP 200.
- RevenueCat invalid-signature check: HTTP 401.
- Android store build: finished.
- iOS store build: finished.

## Remaining launch gates

1. ~~Obtain express product-owner approval before starting any new iOS or Android build~~ -- obtained and executed 19 September 2026: `1.0.0 (4)` both platforms, submitted to TestFlight and Google Play internal. See `docs/REVISION_LOG.md`.
2. ~~Build/install new `store-test` binaries containing the approved icon, duplicate-person fix, and OTA foundation~~ -- done, per above.
3. ~~Supply Apple's subscription review screenshot~~ -- done 19 September 2026, via the App Store Connect API directly (`subscriptionAppStoreReviewScreenshots`), using David's Lilica in-app subscription screen padded to Apple's required 1242x2208px canvas. State confirmed `COMPLETE`. Final subscription review metadata (beyond the screenshot) remains outstanding.
4. Run physical iPhone sandbox purchase, restore, renewal, cancellation, expiry, and refund/revocation checks.
5. Add/confirm licensed Google Play testers and run equivalent Android internal-track checks.
6. ~~Configure a durable EAS-managed Google Play submission credential~~ -- done 19 September 2026; a permanent Apple key was also configured at the same time. Both are wired into `eas.json` outside the repo. Never ask David to re-supply these.
7. ~~Configure/verify Apple Server Notifications V2 and Google RTDN through RevenueCat~~ -- done 19 September 2026. Apple: RevenueCat's one-click "Apply to App Store Connect" button on the Lilica iOS app page succeeded. Google: required granting the RevenueCat service account (`revenuecat-service-account@lilica-6gy1l5.iam.gserviceaccount.com`) the Pub/Sub Editor IAM role on Google Cloud project `lilica-6gy1l5` first (initial attempt failed with a Pub/Sub topic permission error); after that fix, RevenueCat's "Connect to Google" button (topic `Play-Store-Notifications`) succeeded. See `docs/REVISION_LOG.md`'s 19 September entry.
8. Confirm a real store event reaches RevenueCat, passes the signed webhook, updates Supabase entitlement state, and changes Lilica's access gates correctly. (The webhook plumbing itself -- a correctly environment-scoped production integration -- is now independently verified via the RevenueCat API as of 19 September 2026; an end-to-end real-purchase proof is still outstanding.)
9. Verify purchase on one platform and login on the other for the same Lilica account.
10. ~~Create production Supabase/EAS environment values before any production build~~ -- done and independently verified 19 September 2026: `lilica-production` (`luyoyupghbxjftqwzcfn`), fully migrated, pgTAP-proven, edge functions deployed, RevenueCat production webhook correctly scoped, Auth SMTP/URLs/OTP length all confirmed correct. See `docs/REVISION_LOG.md` and `docs/SUPABASE_OPERATIONS.md`. This does not itself authorise a production build.
11. Complete store listings, privacy/policy declarations, review assets, and explicit production release approval.

Expo Go cannot test RevenueCat native purchases. Real billing QA must use the TestFlight and Play-distributed builds.

## Repository impact

- `app.json`: linked the EAS project and added the standard encryption declaration; iPhone-only support remains explicit.
- `eas.json`: added controlled preview/store-test/production build and submit profiles plus the App Store Connect app ID.
- Ignored `.env.local`: added the iOS RevenueCat public SDK key alongside the Android key and Supabase public values.
- EAS preview environment: added both RevenueCat public SDK keys and development Supabase public values.
- This report was updated to reflect actual implementation and build state.
- `docs/NEXT_NATIVE_BUILD_MANIFEST.md`: records the exact binary delta and protected pre/post-build checks.
- No application UX, domain behavior, database schema, or Phase 22 visual work was changed by this billing deployment setup.
