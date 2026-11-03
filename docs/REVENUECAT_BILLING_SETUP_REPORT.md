# Lilica RevenueCat and Store Billing Implementation Report

**Report date:** 16 September 2026; current-state reconciliation added 3 November 2026.
**Scope:** RevenueCat catalogue, Apple and Google subscription configuration, signed entitlement webhook, EAS store builds, test-store submissions, and remaining QA.

## Executive status (reconciled 3 November 2026)

Lilica's annual subscription foundation is configured across RevenueCat, App Store Connect, Google Play, Supabase, and the native production environments.

- Both stores are publicly live: iOS `1.0.0 (8)` from commit `207cc24`; Android `1.0.0 (6)` from commit `195d186`.
- The app itself is a free download. Customers receive an app/backend-controlled 60-day free period, then Lilica Annual costs GBP 8.99/year.
- No Apple or Google introductory offer/store trial is configured.
- One RevenueCat entitlement (`lilica_active`) and one annual package (`$rc_annual`) cover both stores.
- The signed, environment-scoped RevenueCat-to-Supabase webhooks are configured; Apple ASN V2 and Google RTDN are connected.
- Apple approved the Lilica Annual subscription (`6812831899`).
- Physical purchase, restore, renewal, cancellation, expiry, refund/revocation, real-event webhook propagation, and cross-platform entitlement QA remain outstanding. Store approval is not evidence that those checks passed.

The build/submission details below are retained as dated implementation history unless a section explicitly says it is current.

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

**Current outcome:** the subscription review screenshot and metadata were completed, the subscription was submitted with build 8, and Apple now reports Lilica Annual as `APPROVED`. Physical iPhone purchase and restore/lifecycle QA remains outstanding.

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
- Build profiles exist for internal preview, store testing, and production.
- Store-test builds use the EAS `preview` environment, which contains RevenueCat public SDK keys and development Supabase public configuration.
- **Historical correction:** production was intentionally unpopulated at this report's original date, but a production Supabase project and populated EAS production environment were created and independently verified on 19 September 2026 and have since supported the live production binaries.
- Durable Apple and Google submission credentials now exist outside the repository and are wired into `eas.json`; see `docs/BUILD_RELEASE_CONTROL.md`. Never expose or commit them.

### OTA status

Build 3/build 2 predated EAS Update and could not receive OTAs; that was the historical limitation at this report's original date. The live iOS build 8 and Android build 6 include `expo-updates`, the EAS update URL, `runtimeVersion.policy: appVersion`, and the production channel, and production OTAs were subsequently published with David's per-action approvals. OTA publication remains separately gated; native dependency/configuration changes remain ineligible for OTA.

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
3. ~~Supply Apple's subscription review screenshot and complete first subscription review submission~~ -- screenshot completed 20 September 2026; the subscription version and group version were later attached to build 8's review submission, and Lilica Annual is now `APPROVED`.
4. Run physical iPhone sandbox purchase, restore, renewal, cancellation, expiry, and refund/revocation checks.
5. Add/confirm licensed Google Play testers and run equivalent Android internal-track checks.
6. ~~Configure a durable EAS-managed Google Play submission credential~~ -- done 19 September 2026; a permanent Apple key was also configured at the same time. Both are wired into `eas.json` outside the repo. Never ask David to re-supply these.
7. ~~Configure/verify Apple Server Notifications V2 and Google RTDN through RevenueCat~~ -- done 19 September 2026. Apple: RevenueCat's one-click "Apply to App Store Connect" button on the Lilica iOS app page succeeded. Google: required granting the RevenueCat service account (`revenuecat-service-account@lilica-6gy1l5.iam.gserviceaccount.com`) the Pub/Sub Editor IAM role on Google Cloud project `lilica-6gy1l5` first (initial attempt failed with a Pub/Sub topic permission error); after that fix, RevenueCat's "Connect to Google" button (topic `Play-Store-Notifications`) succeeded. See `docs/REVISION_LOG.md`'s 19 September entry.
8. Confirm a real store event reaches RevenueCat, passes the signed webhook, updates Supabase entitlement state, and changes Lilica's access gates correctly. (The webhook plumbing itself -- a correctly environment-scoped production integration -- is now independently verified via the RevenueCat API as of 19 September 2026; an end-to-end real-purchase proof is still outstanding.)
9. Verify purchase on one platform and login on the other for the same Lilica account.
10. ~~Create production Supabase/EAS environment values before any production build~~ -- done and independently verified 19 September 2026: `lilica-production` (`luyoyupghbxjftqwzcfn`), fully migrated, pgTAP-proven, edge functions deployed, RevenueCat production webhook correctly scoped, Auth SMTP/URLs/OTP length all confirmed correct. See `docs/REVISION_LOG.md` and `docs/SUPABASE_OPERATIONS.md`. This does not itself authorise a production build.
11. ~~Complete store listings, privacy/policy declarations, review assets, and explicit production release approval~~ -- resolved. Google Play is publicly live on production `versionCode 6`; Apple is publicly live with iOS build 8. Apple's earlier build 6/build 7 rejections and their fixes remain documented chronologically in `docs/REVISION_LOG.md`.

Expo Go cannot test RevenueCat native purchases. Real billing QA must use store-distributed native builds. Items 4, 5, 8, and 9 remain outstanding despite both stores being live.

## Repository impact

- `app.json`: linked the EAS project and added the standard encryption declaration; iPhone-only support remains explicit.
- `eas.json`: added controlled preview/store-test/production build and submit profiles plus the App Store Connect app ID.
- Ignored `.env.local`: added the iOS RevenueCat public SDK key alongside the Android key and Supabase public values.
- EAS preview environment: added both RevenueCat public SDK keys and development Supabase public values.
- This report was updated to reflect actual implementation and build state.
- `docs/NEXT_NATIVE_BUILD_MANIFEST.md`: records the exact binary delta and protected pre/post-build checks.
- No application UX, domain behavior, database schema, or Phase 22 visual work was changed by this billing deployment setup.
