# Phase 19 - Production Hardening And Release Readiness

Implemented from the approved brief `Downloads\phase19.txt`. This is an audit/hardening phase, not feature development: its own explicit scope boundary excludes Ask Lilica, OCR, messaging, new record types, new Care Circle concepts, new People/document features, a new reminders architecture, subscription/billing, StoreKit, trial logic, AI, search, whole-care-space deletion, and unrelated visual redesign. Nothing in that excluded list was touched. Every finding below is classified A (release blocker) / B (hardening defect, fixed in-phase) / C (non-blocking polish) / D (future enhancement) / E (legal decision required) per the brief's own instruction - only A and justified B items were fixed; C/D/E are recorded, not acted on.

`PRE_PHASE_19_BASELINE` (13 September 2026, before any Phase 19 work): HEAD in sync with `origin/master` at `e9e1874`, TypeScript clean, Jest 48 suites/482 tests passing with zero warnings, `npm run secrets:check` clean (226 files), local `db:reset`/pgTAP/lint clean (279 assertions/10 files), linked (`lilica-development`) pgTAP/lint clean (279/10), migration history parity confirmed through `20260912180000`, `git diff --check` clean.

## 1. Repository/roadmap-state reconciliation

Confirmed the true current state matches documentation before auditing further: Phases 1-18B implemented/validated/committed/pushed as recorded in `docs/LUMEN_HANDOFF.md`/`AGENTS.md`; Phase 15/18A/18B two-account/device physical QA outstanding; Phase 16/17/Settings-drawer/People-visual/To-Do-background physical QA confirmed. No drift found between docs and `git log` at the point Phase 19 began.

## 2. Real two-account collaboration and account-deletion rehearsal (section 8 evidence)

Rather than repeat what pgTAP already proves transactionally, a real, committed (non-rolled-back) rehearsal was run directly against `lilica-development` via `npx supabase db query --linked`, with explicit product-owner approval (this is genuinely irreversible for the throwaway data involved, unlike a pgTAP transaction). Three throwaway `auth.users` accounts were created, one care space with a genuine second collaborator (Contributor, `general`-domain-only), five records across every domain, one link, one attachment, one assignment. Verified for real, as committed state (not inside a rolled-back transaction):

- Sarah (general-only) attempting `create_assignment` on a financial record failed with a real server error (`42501: Assignment target is outside care space`) - the record was invisible to her at the RLS/SELECT layer before the domain check even ran.
- David (sole target of deletion, after promoting Sarah to organiser) called `delete_my_account()` - succeeded. Verified afterward: `auth.users`/`profiles` rows gone; his membership `status = 'former'` with a `former_display_name` snapshot; `user_id` and `bootstrap_owner_id` both null; all 5 records/1 link/1 attachment/1 assignment survive, still attributed to the same (now-former) membership row; Sarah, from her own JWT context, still sees all 5 records/1 link/1 attachment and resolves David's name via `resolve_membership_identities()` as `"Phase19 David"` with `is_former = true`; forcing David's old JWT subject afterward returns zero visible records and zero active memberships.
- Retrying `delete_my_account()` as the same (now-deleted) David again succeeded as a safe no-op - no duplicate former-membership row created.
- Solo (sole organiser of an unrelated second care space) attempting `delete_my_account()` failed with the real, correct server error (`P0001: ... still depends on you as its only organiser ...`) - zero partial deletion (auth row and membership both untouched).

All throwaway data was then fully removed (auth users, care spaces, supported people, and their dependent records/occurrences/receipts/assignments/links/attachments) and `lilica-development`'s pgTAP (279/10) and lint were re-confirmed clean afterward - the hosted database was left in exactly its prior state.

**Classification: this closes out Phase 18B's own outstanding "two-account physical QA" item for the server/database layer specifically** - the account-deletion and cross-membership-domain-enforcement mechanics are now proven against the real hosted database with real commits, not only inside pgTAP's transactional sandbox. Physical on-device UI QA (the client screens themselves, on real hardware) remains separately outstanding and is not superseded by this - see the QA matrix.

## 3. RLS/permission adversarial coverage (section 16)

Audited existing pgTAP coverage across all 10 files in `supabase/tests/database/` for negative/adversarial permission proof (`throws_ok` counts, explicit `anon`-role checks, cross-tenant `is_empty`/`results_eq` assertions):

| File | throws_ok | anon-role checks | cross-tenant isolation checks |
|---|---|---|---|
| care_spaces_rls.test.sql | 9 | yes | yes |
| occurrences_rls.test.sql | 7 | yes | - |
| phase15_care_circle.test.sql | 7 | - | - |
| phase16_document_maturity.test.sql | 7 | yes | - |
| phase18_privacy_export.test.sql | 0 | - | cross-user JWT-switch scoping (see below) |
| phase18b_account_deletion.test.sql | 3 | yes | - |
| profiles_rls.test.sql | 5 | yes | yes |
| records_rls.test.sql | 13 | yes | - |
| myself_relationship.test.sql | 1 | - | yes |
| profile_avatars.test.sql | 1 | - | - |

`phase18_privacy_export.test.sql` has no `throws_ok` calls because `export_my_data()`/`account_deletion_precheck()` are inherently self-scoped (`auth.uid()`-only, no target parameter to reject) - its adversarial proof is instead structural: it switches `request.jwt.claim.sub` between three distinct users and asserts each only ever receives their own scoped data, which is the correct adversarial shape for a self-scoped RPC. `phase15_care_circle.test.sql` and `phase16_document_maturity.test.sql` lack an explicit bare-`anon`-role test but do exercise unauthorized/insufficiently-permissioned *authenticated* actors extensively (pending invitee, viewer, contributor-without-grant, revoked member, cross-care-space member) via `throws_ok`/direct SELECT-count assertions - the gap, if any, is only the specific case of a wholly unauthenticated (`anon`) request against these two migrations' own new tables. **Classification: C (non-blocking polish)** - every RLS-bearing table in these two migrations inherits `authenticated`-only grants from the base schema (`revoke ... from public/anon` is standard across every migration in this repository, confirmed by grep), so an anon-role rejection is already structurally guaranteed by the grant, not merely by a policy that could silently degrade; an explicit test would be a proof of an existing guarantee, not a fix for a gap. No new test was written given this phase's own instruction to fix only A/justified-B issues.

## 4. Dependency and security review (section 22)

- `npx expo install --check`: 7 pre-existing patch-level outdated Expo packages, present before Phase 19, not introduced by it (documented previously in Phase 16/17/18 revision-log entries).
- `npm audit --production`: 11 moderate-severity advisories, all rooted in one transitive `uuid` dependency (missing buffer bounds check when a caller supplies its own buffer) pulled in only by Expo's own build-time tooling (`@expo/config-plugins`'s `xcode` dependency, `@expo/cli`, `@expo/prebuild-config`, `expo-sharing`'s config plugin). None of this code runs inside the shipped app bundle or touches user data at runtime - it is CLI/prebuild tooling only. **Classification: D (future enhancement)** - track for a future `npm audit fix`/Expo SDK bump, not a release blocker.
- Grepped `src/` and `App.tsx` for `service_role`/`SERVICE_ROLE`: zero matches - no service-role key or equivalent ever appears in client code.
- Grepped for `console.log`/`console.warn`/`console.error` calls mentioning password/token/secret/session: zero matches - no sensitive value is ever logged.
- `npm run secrets:check`: clean (226 files, matches the pre-Phase-19 baseline).

## 5. Accessibility (section 13)

Static grep across all 54 `.tsx` files in `src/`: 131 occurrences of `accessibilityLabel`/`accessibilityRole`/`accessibilityHint`, consistent with the density already exercised by name in existing tests (e.g. `tests/settings-cog.test.tsx`'s "Close"/"Dismiss settings" labels, `tests/phase13-person.test.tsx`'s avatar labels). A full physical screen-reader (VoiceOver/TalkBack) pass requires real hardware and is marked **NOT RUN** below - a static grep proves labels exist, not that they read correctly in context or that focus order is sound.

## 6. Store/release readiness (section 26)

`app.json`: real bundle identifiers for both platforms (`com.luxfordinteractive.lilica`, not a placeholder), real permission-usage strings for camera/photo-library access (image-picker plugin), microphone explicitly declared `false` (correctly, since Lilica never records audio), adaptive Android icon set (foreground/background/monochrome), version `1.0.0` with no `ios.buildNumber`/`android.versionCode` set yet (fine for EAS auto-increment, but worth naming as a pre-submission task). **No `eas.json` exists yet** - no build profiles are configured. **Classification: D (future enhancement)**, not a blocker: Phase 19's own brief explicitly forbids submitting to app stores or creating billing products, so build-profile configuration is out of this phase's scope by design, not an oversight.

**Product-owner standing requirements ahead of the first real EAS build (14 September 2026, recorded here since this is the store/release-readiness section, not yet actioned as a build):**
1. **No `eas build` is ever run without the product owner's explicit, express consent for that specific build** - this applies beyond Phase 19's own general "no builds without consent" convention; state it again here because it governs the very first real build specifically.
2. **iOS is phone-only - no iPad support.** `app.json`'s `ios.supportsTablet` has been set to `false` (previously `true`) so the generated app only declares the iPhone device family - this is what prevents App Store Connect/TestFlight from requiring iPad screenshots at submission. Do not revert this without the product owner's explicit direction.
3. **OTA (`expo-updates`) must be enabled from the very first build**, not added later - so that subsequent JS-only changes can ship over the air rather than requiring a new store build/TestFlight review each time. This still needs, at first-build time: an EAS project (`eas init`, which registers a project under the product owner's own Expo account - a real, consent-requiring action, not yet run), a `runtimeVersion` policy and `updates.url` added to `app.json`/`eas.json`, and `expo-updates` installed. None of this has been run yet; it is recorded here as a hard precondition for whenever the first build is actually authorised.

## 7. Migration/production-environment readiness

Confirmed (see baseline above and section 2): local `db:reset` replays all 10 migrations cleanly from empty; linked `lilica-development` migration history matches local exactly through `20260912180000`; linked pgTAP (279/10) and lint both clean, both before and after the real rehearsal in section 2. No production Supabase project exists; none was touched.

## 8. What remains NOT RUN (requires physical hardware/devices, honestly marked rather than fabricated)

Per the brief's own instruction not to fabricate device results: physical-device matrix (offline/restart/recovery, keyboard/reveal on real hardware, screen-reader passes, large-data/performance feel, reminders on a development build, camera/document-picker on-device) could not be executed in this environment. Each is marked NOT RUN in `docs/PHASE_19_QA.md` with the specific reason, rather than represented as passed.

## Diff audit

Documentation only for this consolidation pass: `docs/PHASE_19_ARCHITECTURE.md` (new), `docs/PHASE_19_QA.md` (new), `docs/REVISION_LOG.md`, `AGENTS.md`, `CLAUDE.md`, `docs/LUMEN_HANDOFF.md`. No application code, schema, migration, or dependency changed during Phase 19 itself - every finding above was either already-passing evidence being cited, a read-only audit/grep, or the one explicitly-approved real (and fully cleaned-up) database rehearsal in section 2. No `.ts`/`.tsx`/`package.json`/migration file appears in this phase's diff.
