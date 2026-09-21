# Lilica Current Session Handoff

Despite its legacy filename, this is the canonical current handoff for every incoming agent.

Last updated: 21 September 2026 (both stores now submitted).

## Read this first

Lilica is a calm personal and family care organiser built with Expo SDK 57, React Native, TypeScript, Supabase, RevenueCat, EAS, App Store Connect, and Google Play. It is not a clinical system, emergency monitor, surveillance product, or generic family calendar.

**Nothing is urgent or broken right now.** The one real incident this session (production signup completely broken) is fixed and David confirmed it working on-device. **Both stores are now formally submitted.** Apple: `WAITING_FOR_REVIEW`. Google Play: production track rollout `completed` (release `1.0.0`, versionCode `5`), awaiting Google's own review before going publicly live. Nothing further to do on either submission unless a review outcome changes something -- check both at the start of a new session (Apple: `GET /v1/apps/6812822327/appStoreVersions`; Google: `edits.tracks` for `production`).

An incoming agent must not assume a new phase or release action is authorised. Read this file, `AGENTS.md`, `docs/NEXT_NATIVE_BUILD_MANIFEST.md`, `docs/BUILD_RELEASE_CONTROL.md`, and `docs/REVENUECAT_BILLING_SETUP_REPORT.md` before acting.

## Repository state

- Repository: `https://github.com/davidmaruta2/lilica`
- Active branch: `prephase22-remove-supported-person-faq-help`
- `master` is stale and behind. Do not merge to or restart from `master` without explicit product-owner instruction.
- Last pushed commit as of this handoff: `cd8ca91` (20 September 2026, docs-only). Do not trust this line alone -- confirm with a fresh `git log -1`/`git status --short` per the line below.
- Run `git log -1`, `git status --short`, and compare local HEAD with the remote branch at the beginning of every session. Shared-machine/concurrent-agent changes have occurred before.
- The handoff task is complete only when local HEAD equals the remote branch and the working tree is empty. As of this entry that is already true.

## Critical release authority

No EAS/native build, and no `eas update` (OTA publish), may ever be started without David Maruta's express approval for that specific action.

This is absolute. A phase prompt, implementation request, request to validate, request to prepare a build, previous build/OTA approval, or general instruction to continue is not authority to run a build or OTA publish.

Before any `eas build`, the agent must state: platform, EAS profile and environment, purpose, exact commit, included delta since the last native binary, validation completed, known limitations, whether submission/distribution is included -- then stop and wait for David's direct approval.

Before any `eas update`, state: channel, environment, exact commit, exact change set, and confirm (via `git diff` against the prior OTA's commit) that nothing native-affecting (`app.json`/`package.json`/`eas.json`/a new native dependency) is included -- then stop and wait for approval.

Authoritative policy: `docs/BUILD_RELEASE_CONTROL.md`.

## Existing native binary (unchanged since 19 September 2026)

| Platform | Version | EAS build ID | State |
| --- | --- | --- | --- |
| iOS | `1.0.0 (5)` | `22860bae-49bb-46de-9ccb-0e4cb5a51ca8` | **Submitted to Apple for review** (`appStoreState: WAITING_FOR_REVIEW`, submitted 21 September 2026). No further action needed until Apple responds. |
| Android | `1.0.0 (5)` | `a7ed9204-270b-482e-a329-2f72f863ceef` | **Submitted to Google Play production track** (21 September 2026, on David's explicit approval). `edits.tracks` for `production` shows release `1.0.0`/versionCode `5`, status `completed`. Awaiting Google's own review before becoming publicly downloadable -- check `edits.tracks` for status changes at the start of a new session. |

Built from commit `313d064`, the first build genuinely wired to `lilica-production` (not `lilica-development`). No new native build has been run since -- everything below this point has reached the installed app via OTA (JS/asset-only, no native change), not a new binary. **This means the version currently under Apple review does not include any of the OTA fixes from 19-21 September** (password toggle, Medical Log Add-flow fix, supported-person rename, ToDo contrast fix, tile rename) -- those exist only as OTA updates for already-installed copies, not baked into the submitted binary. A fresh install from the App Store (once approved) will get them automatically on second launch, same as the Android tester did.

**Not yet done, and not resolved by any build or OTA:** Android's `eas.json` submit track is still `internal` (David's choice, changeable to `production` with no rebuild needed when ready); iOS still needs a manual "submit for App Store review" and release action in App Store Connect to go public.

## OTA state -- two updates published to `production`, both confirmed working

The installed `1.0.0 (5)` binary is OTA-capable (`expo-updates`, update URL, `runtimeVersion.policy: appVersion`, `production` channel all configured and built in). Three OTA updates have been published since, all on David's explicit approval:

1. **Update group `c9ff772b-2a9c-4d03-880d-f6cf103028e6`** (commit `656a98d`, 19 September 2026): fixed a **critical production outage** (see next section) + added a password show/hide eye toggle to Create Account/Log In/Reset Password.
2. **Update group `0c587d88-d63a-4c81-ad36-8020227beca5`** (commit `68f6247`, 20 September 2026): Medical Log Add-flow tile, Care Summary now includes active conditions/medicines, Settings drawer regrouped (new "Care Circle" group split out of "Account"), notification bell/settings cog spacing tightened.
3. **Update group `1fb7917f-2682-40d0-b0c5-2d0418889ab5`** (commit `f7753a8`, 20 September 2026): renamed the Add-flow/onboarding tile from "Medical Log" to "Medical issues" (the destination screen's own header is unchanged, still "Medical Log" -- only the entry-point tile wording changed).

All on the `production` channel, runtime `1.0.0`, so they apply automatically to the installed binary. **David confirmed device state after update 1 (signup works); has not yet explicitly confirmed device state after updates 2 or 3** -- validated by full test suite (104 suites/916 tests) and typecheck only, not yet physically confirmed on David's device. Worth asking if not yet mentioned.

Full detail on each OTA and everything it fixed: `docs/REVISION_LOG.md`'s 20 September entries (read top-down, most recent first).

## RESOLVED 19 September 2026: production signup was completely broken

David could not create any account on the installed `1.0.0 (5)` build -- every Supabase request from the app was returning `401 Invalid API key`, for any email, any network, because the EAS `production` environment's `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` was stale and didn't match `lilica-production`'s actual current key. Fixed by correcting the EAS env var (`eas env:set`) and shipping the fix via the OTA above (since `EXPO_PUBLIC_*` values resolve at JS-bundle time, not compile time -- no native build was needed). **David confirmed signup now works on-device.** Full diagnosis: `docs/REVISION_LOG.md`'s 19 September "CRITICAL" entry. Closed -- do not reopen without a new, specific defect report.

## RESOLVED 19 September 2026: Apple ASN V2 / Google RTDN

Both confirmed configured, not just assumed. Apple: RevenueCat's one-click "Apply to App Store Connect" button succeeded. Google: required granting the RevenueCat service account (`revenuecat-service-account@lilica-6gy1l5.iam.gserviceaccount.com`) the Pub/Sub Editor IAM role on Google Cloud project `lilica-6gy1l5` first, then RevenueCat's "Connect to Google" button succeeded. See `docs/REVENUECAT_BILLING_SETUP_REPORT.md` remaining-launch-gates item 7 and `docs/REVISION_LOG.md`'s 19 September entry.

## RESOLVED 20 September 2026: Apple subscription review screenshot

Uploaded directly via the App Store Connect API (`subscriptionAppStoreReviewScreenshots`, subscription `6812831899`), using David's Lilica subscription-screen image padded to Apple's required 1242x2208px canvas (first attempt failed on dimensions; fixed and re-uploaded). Confirmed `COMPLETE`. Closes `docs/REVENUECAT_BILLING_SETUP_REPORT.md` remaining-launch-gates item 3. See `docs/REVISION_LOG.md`'s 20 September entry.

## Product change this session: Medical Log now reachable from the Add flow

Previously Medical Log (care needs/diagnosed conditions/prescribed medicines) was reachable ONLY via Settings -> Medical Log. David explicitly asked for it to be part of the everyday Add flow too. Implemented as a new card in both `FirstThingScreen` (the Add gateway) and `InterestsScreen` (onboarding's "What do you help X with?" carousel) -- tapping it opens the existing `MedicalLogScreen` directly (all three sections together, screen header still reads "Medical Log"), unlike every other card, which maps to exactly one record type. The card's own title was later changed to **"Medical issues"** (not "Medical Log") per direct product-owner request -- `src/data/options.ts`'s `firstItemOptions` entry. This required widening the shared category-option id type (`CategoryOptionId` in `src/types.ts` = `LilicaRecordType | 'medicalLog'`) since Medical Log isn't a record type of its own.

**This is a deliberate reopening of the previously-protected "eight-category record stack" constraint, now nine categories, per David's explicit instruction.** Do not treat "eight categories" as protected any more -- it's nine, and Medical Log is the ninth. Tests updated accordingly (`tests/phase1-ui.characterization.test.tsx`, `tests/onboarding-setup-categories.test.tsx`).

Also as part of the same request: Care Summary (in-app and the exported PDF) now shows an active conditions/medicines section; Care Circle's "Care & health" domain permission description now explicitly names Medical Log (the underlying server-side enforcement already covered it -- this was a copy fix, not a permissions change).

## Product change this session: Settings drawer regrouped

David asked why "Join a Care Circle" wasn't nested under "Care Circle" -- investigation led to a broader finding: the "Account" group was mixing "manage myself" (Account/Privacy & data/Subscription) with "manage who else has access" (Care Circle/Join a Care Circle/Archived care), the same anti-pattern serious multi-user apps (Notion, 1Password, Slack, Dropbox) explicitly avoid. Fixed by splitting Care Circle/Join a Care Circle/Archived care into their own "Care Circle" group, separate from "Account". Per explicit product-owner decision, the "Care Circle" group heading stays visible even for someone with no care space of their own yet, showing only "Join a Care Circle" underneath. See `src/components/SettingsMenu.tsx`.

## Product change this session: header icon spacing

The notification bell and settings cog (both 44px touch targets with a small icon centred inside) previously inherited the general actions-row gap, which read as an oversized gap between the two icon graphics. They now sit in their own tighter icon group (`PrimaryTabHeader.tsx`) while keeping full touch-target size.

## iOS device-family rule

Lilica is iPhone-only. `app.json` must retain `ios.supportsTablet: false`. Check the resolved Expo public config before every future build. Do not enable iPad support without a separate product-owner decision.

## RevenueCat, Apple, Google, and Supabase

### Commercial contract

- 60 days fully free, controlled by Lilica's backend entitlement state.
- GBP 8.99/year afterward.
- No Apple/Google introductory free trial or duplicate store trial.
- One subscription per Lilica account covers every care space that account commercially owns.
- Care Circle role/permissions remain separate from commercial ownership and entitlement.

### RevenueCat

- Project: `Lilica` (`projf734d172`).
- Entitlement: `lilica_active` (`entl0fc7f87e90`).
- Current offering: `default` (`ofrng20b64f2958`).
- Annual package: `$rc_annual` (`pkgeaf002a6e28`).
- iOS app: `appe58361f9ab`. Android app: `app7b15628a27`.
- Apple product: `com.luxfordinteractive.lilica.annual`. Google product/base plan: `com.luxfordinteractive.lilica.annual:annual-autorenewing`.
- Uses RevenueCat's native store-formatted `priceString`. A US Apple storefront showing USD 9.99 is expected localisation, not a code defect; UK remains GBP 8.99.

### Webhooks (two, correctly environment-scoped)

- `lilica-development` webhook (`whintgr4d880b6211`, "Lilica entitlement sync") scoped to `sandbox` events only.
- `lilica-production` webhook (`whintgr9b96a2d848`, "Lilica production entitlement sync") scoped to `production` events only.
- Both verified via the RevenueCat v2 API, both HMAC-signed (`REVENUECAT_WEBHOOK_SECRET` Supabase secret per project, never in Git).

### Store state

- App Store Connect app: **Lilica: Care & Support**, ID `6812822327`. Apple annual subscription resource ID: `6812831899`; UK anchor GBP 8.99.
- Google Play package: `com.luxfordinteractive.lilica`; developer account `8290450229567893119`. Google Cloud project: `lilica-6gy1l5` (lowercase "L").
- Production Supabase project (`lilica-production`, `luyoyupghbxjftqwzcfn`) and EAS `production` environment exist, fully configured and independently verified: schema, edge functions, secrets, correctly-scoped webhook, production Auth (SMTP/URLs/OTP length). See `docs/SUPABASE_OPERATIONS.md`.
- Durable submission credentials configured -- see "CRITICAL: durable release credentials" in `CLAUDE.md`. Never ask David to re-supply these.

### RevenueCat/store work still outstanding (unrelated to any build/OTA)

1. **Both stores: awaiting review outcome, nothing to do unless it changes.** Apple: `1.0.0 (5)` submitted 21 September 2026 (`appStoreState: WAITING_FOR_REVIEW`) -- check `GET /v1/apps/6812822327/appStoreVersions`. Google Play: production track rollout `completed` (release `1.0.0`, versionCode `5`) submitted the same day on David's explicit approval -- check `edits.tracks` for `production` for a status change.
2. Run physical iPhone sandbox purchase, restore, renewal, cancellation, expiry, and refund/revocation checks.
3. Add/confirm licensed Google Play testers and run equivalent Android internal-track checks.
4. Confirm a real store event reaches RevenueCat, passes the signed webhook, updates Supabase entitlement state, and changes Lilica's access gates correctly end-to-end (plumbing itself is verified; a real-purchase proof is still outstanding).
5. Verify purchase on one platform and login on the other for the same Lilica account (cross-platform entitlement).

Full details: `docs/REVENUECAT_BILLING_SETUP_REPORT.md`.

## Product state

The current app includes everything from Phases 3-22 (safety harness through billing/entitlement, approved visuals), plus: returning-account duplicate-person prevention, the approved Lilica app icon, the OTA foundation, a notification bell/centre, Exportable Care Summary PDF (now including Medical Log), an opt-in biometric app lock (Account -> Security, only shown when the device has biometric hardware), a structured Medical Log (now reachable from both Settings and the everyday Add flow / onboarding), and the regrouped Settings drawer described above.

Ask Lilica remains a placeholder. Do not remove it or implement AI without explicit approval.

## Protected visual state

The product owner approved the Phase 22 direction through iterative mock review. Preserve: Fraunces only for the Lilica wordmark; Inter Tight for headings; Inter for body/control text; zero tracking; Lucide for common UI icons; Home's warm light canvas; Calendar's terracotta gradient; To Do's matte blue-teal gradient/section-specific tiles/spacing/shadow separation/joined list-grid control; People's teal gradient/Key contacts panel/Care Circle panel/Ask Lilica placeholder; the warm-neutral secondary-page system and coherent drawer; responsive safe-area/keyboard behaviour and bottom navigation override.

Authority: `docs/PHASE_22_APPROVED_VISUAL_DIRECTION.md` and completion reports. Do not reinterpret the approved mock or launch an unsolicited visual pass. (Note: the Settings-drawer grouping and header icon spacing changes above are content/structure changes David explicitly requested, not a visual-direction reinterpretation -- the approved Phase 22 visual language itself is unchanged.)

## Protected system contracts

- Organiser, supported person, care space, membership, and commercial owner are distinct identities.
- Record facts are stored once and projected deterministically. Due/overdue is derived, not duplicated state.
- Occurrence history is immutable/versioned and recurrence changes do not rewrite history.
- Assignment never grants permission; permissions and assignment eligibility remain server-enforced.
- Every mutation is idempotent and scoped by care space.
- Sign-out stops sync but does not discard pending work.
- Entitlement is server-authoritative and separate from Care Circle access.
- Expired care spaces remain readable; only approved mutation paths are gated.
- Account deletion preserves minimum historical attribution while removing live account identity under the implemented contract.
- All text-entry screens must remain keyboard-aware and safe-area-correct.
- Never infer medical, legal, emergency, or monitoring conclusions.

## Validation status at handoff

- `npm run typecheck`: clean (last run: this session, after every change below).
- Jest: **104 suites, 916 tests, all passing** (last full run: this session).
- `npx expo config --type public`: not re-run this session (no native config changed) -- last confirmed clean 19 September.
- Local backend validation: not touched this session (no schema/backend change made).

## Immediate continuation instructions

Both stores are submitted and awaiting review -- there is no automatically authorised next phase or pending urgent issue. On a new instruction:

1. re-read current git status/log and this handoff;
2. if David hasn't yet confirmed the second OTA (Medical Log tile / Settings regrouping / Care Summary) looks right on his device, ask;
3. identify whether the request is code, store metadata, QA, build preparation, build execution, submission, or OTA;
4. preserve all protected product and visual behaviour (note the two intentional exceptions above: nine categories, not eight; Settings drawer regrouped);
5. for build/release work, follow the explicit authority gate and `docs/NEXT_NATIVE_BUILD_MANIFEST.md`;
6. for RevenueCat/store work, resume from the "still outstanding" list above;
7. update docs to actual behaviour, validate, inspect the full diff, and report limitations honestly;
8. commit/push only when requested and verify the working tree is clean.

An incoming agent should be able to begin immediately from this file and its linked release/billing documents without asking David to reconstruct prior context.
