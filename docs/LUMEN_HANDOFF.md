# Lilica Current Session Handoff

Despite its legacy filename, this is the canonical current handoff for every incoming agent.

Last updated: 3 November 2026 (Apple and Google Play both live; verified via API).

## Read this first

Lilica is a calm personal and family care organiser built with Expo SDK 57, React Native, TypeScript, Supabase, RevenueCat, EAS, App Store Connect, and Google Play. It is not a clinical system, emergency monitor, surveillance product, or generic family calendar.

**Google Play: Lilica is now publicly live** -- production track release `versionCode 6`, status `completed`. This is the real native binary `1.0.0 (6)` (commit `195d186`, built 22 September), confirmed correct -- not a discrepancy (an earlier pass this session wrongly flagged "build 6" as unreconciled, before this repo's local checkout was caught up with `origin`'s 22-23 September Phase 23 work and CLAUDE.md's corrected build history).

**Apple: Lilica `1.0` is LIVE on the App Store** -- confirmed 3 November 2026 via `GET /v1/apps/6812822327/appStoreVersions` (`appStoreState` `READY_FOR_SALE`, `appVersionState` `READY_FOR_DISTRIBUTION`). The approved review submission is `729cf1c5-e4b2-42ce-bec1-4adaac451cc1` (build 8, state `COMPLETE`; the API reports its submittedDate as 14 October 2026, which differs from the 4 October date in `docs/REVISION_LOG.md` and was not investigated). The Lilica Annual subscription (`6812831899`) is `APPROVED`. The earlier rejections (builds 6 and 7: Guideline 3.2 info request, Guideline 4 iPad clipping, Guideline 2.1(b) subscription not submitted) are resolved. Still unconfirmed on a real device: the build 8 iPad intro-carousel scroll fix.

**Pricing (corrected 3 November 2026):** the app is a FREE download (app price schedule set to GBP 0.00; it had mistakenly been GBP 8.99). Customers get 60 days free via the in-app entitlement trial, then Lilica Annual at GBP 8.99/year. No Apple introductory offer is configured. See `docs/REVISION_LOG.md`.

**Growth work (3 November 2026):** a growth plan is in progress, driven by the Lumen agent from `C:\Users\DavidPC\.openclaw\workspace\lilica-growth-execution`. Google Play listing copy, Apple promotional text and the lilica.co.uk resource site are already live. The new Apple name, subtitle, keywords and screenshots wait on a new iOS version, which needs David's explicit build approval. No in-app activation/invite analytics exists yet. Full detail and open gaps: `docs/REVISION_LOG.md` (3 November entry).

An incoming agent must not assume a new phase or release action is authorised. Read this file, `AGENTS.md`, `docs/NEXT_NATIVE_BUILD_MANIFEST.md`, `docs/BUILD_RELEASE_CONTROL.md`, and `docs/REVENUECAT_BILLING_SETUP_REPORT.md` before acting.

## Repository state

- Repository: `https://github.com/davidmaruta2/lilica`
- Active branch: `prephase22-remove-supported-person-faq-help`
- `master` is stale and behind. Do not merge to or restart from `master` without explicit product-owner instruction.
- Latest verified local commit as of this handoff: `469b984` (3 November 2026, docs-only). At that check, `origin/prephase22-remove-supported-person-faq-help` was still at `5e7551f`; do not infer that the local commit has been pushed.
- Run `git log -1`, `git status --short`, and compare local HEAD with the remote branch at the beginning of every session. Shared-machine/concurrent-agent changes have occurred before.
- As of 3 November 2026 the working tree also contains pre-existing untracked `LILBATCH_COMPLETION_REPORT.txt` and `expo-dev.log`. Preserve and inspect them; do not claim the tree is clean or delete/commit them without instruction.

## Native build queue (4 November 2026, held, not authorised)

Items that need a new binary are queued in `docs/NEXT_NATIVE_BUILD_MANIFEST.md` ("NATIVE BUILD QUEUE"): the in-app review prompt (new native dependency `expo-store-review`), Android's missing `fallbackToCacheTimeout` config, and the Apple name/subtitle/keywords/screenshots update. David is deciding whether and when to build. Queueing is not approval. JS-only fixes (invitation landing fix, purchase message, trial prompt, activation events) can ship by OTA with separate approval, and the activation events migration was applied to production on 4 November 2026 (on David's yes); the app code that sends the events has not shipped.

## Critical release authority

No EAS/native build, and no `eas update` (OTA publish), may ever be started without David Maruta's express approval for that specific action.

This is absolute. A phase prompt, implementation request, request to validate, request to prepare a build, previous build/OTA approval, or general instruction to continue is not authority to run a build or OTA publish.

Before any `eas build`, the agent must state: platform, EAS profile and environment, purpose, exact commit, included delta since the last native binary, validation completed, known limitations, whether submission/distribution is included -- then stop and wait for David's direct approval.

Before any `eas update`, state: channel, environment, exact commit, exact change set, and confirm (via `git diff` against the prior OTA's commit) that nothing native-affecting (`app.json`/`package.json`/`eas.json`/a new native dependency) is included -- then stop and wait for approval.

Authoritative policy: `docs/BUILD_RELEASE_CONTROL.md`.

## Existing native binary (unchanged since 22 September 2026)

| Platform | Version | Commit | State |
| --- | --- | --- | --- |
| iOS | `1.0.0 (8)` | `207cc24` | **Approved and LIVE on the App Store** (`READY_FOR_SALE`, confirmed via API 3 November 2026). Builds 6 and 7 were rejected earlier; see `docs/REVISION_LOG.md`. |
| Android | `1.0.0 (6)` | `195d186` | **Approved and publicly live on Google Play production**, `versionCode 6`, status `completed`. Re-confirmed via `edits.tracks` 3 November 2026 (production, beta, alpha and internal all on versionCode 6). |

Android remains the production-profile `1.0.0 (6)` binary from commit `195d186`. iOS was subsequently rebuilt twice and the publicly live binary is production-profile `1.0.0 (8)` from commit `207cc24`; see `docs/REVISION_LOG.md` for the build 7/build 8 sequence. Both binaries include EAS Update support. OTA-only changes published after a binary's source commit are not baked into that binary, but compatible installed copies can receive them through the production channel.

**Public-release status is resolved:** Android's production track is live and iOS build 8 is live. Remaining work is QA, not a release blocker: physical purchase/restore/renewal/cancellation/expiry/refund-revocation and cross-platform entitlement checks, plus real-device confirmation of build 8's intro-carousel scroll fix.

## OTA state

**This section (originally written 21 September, describing three early OTAs on the now-superseded `1.0.0 (5)` binary) is historical only.** The binary was superseded by `1.0.0 (6)` (commit `195d186`) on 22 September, and a long chain of further OTA updates has shipped since -- the entire Phase 23 Lilica Chat feature (22-23 September, each step David-approved) plus a returning-account crash fix, recurring care needs, and a To Do view-mode fix (22 September). **`docs/REVISION_LOG.md` is the accurate, up-to-date OTA history -- read it top-down rather than trusting the three-update list originally here.** The 19-20 September detail below is kept only because it documents the real critical-outage incident, not because its "current OTA state" framing is still accurate.

1. **Update group `c9ff772b-2a9c-4d03-880d-f6cf103028e6`** (commit `656a98d`, 19 September 2026): fixed a **critical production outage** (see next section) + added a password show/hide eye toggle to Create Account/Log In/Reset Password.
2. **Update group `0c587d88-d63a-4c81-ad36-8020227beca5`** (commit `68f6247`, 20 September 2026): Medical Log Add-flow tile, Care Summary now includes active conditions/medicines, Settings drawer regrouped (new "Care Circle" group split out of "Account"), notification bell/settings cog spacing tightened.
3. **Update group `1fb7917f-2682-40d0-b0c5-2d0418889ab5`** (commit `f7753a8`, 20 September 2026): renamed the Add-flow/onboarding tile from "Medical Log" to "Medical issues" (the destination screen's own header is unchanged, still "Medical Log" -- only the entry-point tile wording changed).

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

1. **Apple review: RESOLVED.** Lilica is live on the App Store as of the 3 November 2026 check (history in `docs/REVISION_LOG.md`).
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

The 3 November reconciliation was documentation/store-state work only; no app build, OTA, or physical QA was run. The latest recorded app validation is build 8's 4 October checkpoint: TypeScript clean, **113 suites / 1008 tests passing**, and secrets scan clean. Resolved Expo config and backend checks were not re-run for this documentation reconciliation. Treat all counts as dated evidence and re-run the required checks against any future code/release commit.

## Immediate continuation instructions

Both stores are publicly live. Do not invent another release action: the clearest remaining operational work is the physical billing/entitlement QA listed above and real-device confirmation of build 8's intro-carousel scroll fix, only when David directs it. On a new instruction:

1. re-read current git status/log and this handoff; preserve the pre-existing untracked `LILBATCH_COMPLETION_REPORT.txt` and `expo-dev.log` unless David directs otherwise;
2. identify whether the request is code, store metadata, QA, build preparation, build execution, submission, or OTA;
3. preserve all protected product and visual behaviour (note the two intentional exceptions above: nine categories, not eight; Settings drawer regrouped);
4. for build/release work, follow the explicit authority gate and `docs/NEXT_NATIVE_BUILD_MANIFEST.md`; public availability does not grant standing authority for another build, submission, distribution, or OTA;
5. for RevenueCat/store work, resume from the "still outstanding" list above without treating live-store approval as proof of physical purchase or webhook QA;
6. update docs to actual behaviour, validate, inspect the full diff, and report limitations honestly;
7. commit/push only when requested; never claim a clean tree while the preserved untracked files remain.

An incoming agent should be able to begin immediately from this file and its linked release/billing documents without asking David to reconstruct prior context.
