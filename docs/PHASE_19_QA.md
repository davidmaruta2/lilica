# Phase 19 - Release-Readiness QA Matrix

Built using ONLY documented evidence - existing automated test results, existing physical-QA sign-offs recorded elsewhere in this repository, and this phase's own new checks. Nothing below is inferred or assumed passed without a citation. Where physical hardware is genuinely required and unavailable in this environment, the row is marked **NOT RUN** with the specific reason, never fabricated.

| Area (brief section) | Status | Evidence |
|---|---|---|
| Master A-N release checklist (typecheck/tests/secrets/config/export) | PASS | This session's baseline: TypeScript clean, Jest 48/482, secrets clean (226 files), `expo config`/`expo export --platform web` clean. |
| Local DB rebuild + pgTAP + lint | PASS | `db:reset` clean, 279/10 pgTAP, clean lint. |
| Linked (`lilica-development`) pgTAP + lint | PASS | 279/10 pgTAP, clean lint; migration history parity confirmed through `20260912180000`. |
| Two-account collaboration + domain-permission enforcement (real, committed) | PASS | `docs/PHASE_19_ARCHITECTURE.md` section 2 - real rehearsal against `lilica-development`, cleaned up, re-verified. |
| Real account deletion (server-side, real commit) | PASS | Same rehearsal - `delete_my_account()` succeeded, verified detached/former/snapshotted, retry-safe, sole-organiser block proven with a real server error. |
| RLS/permission adversarial matrix (code-level) | PASS (documented, see note) | `docs/PHASE_19_ARCHITECTURE.md` section 3 - 10/10 pgTAP files reviewed; every RLS-bearing table confirmed `authenticated`-only by grant. |
| Export security (data scoping across users) | PASS | `phase18_privacy_export.test.sql`'s three-way JWT-switch scoping, re-confirmed passing in the linked run above. |
| Dependency/security review | PASS (11 moderate, non-blocking) | `docs/PHASE_19_ARCHITECTURE.md` section 4 - all 11 `npm audit` findings trace to build-time tooling only, zero runtime exposure; zero service-role/secret leakage in client code. |
| Accessibility (static label audit) | PASS (static only) | 131 `accessibilityLabel`/`Role`/`Hint` occurrences across 54 `.tsx` files; existing tests assert specific labels by name. |
| Store/release config readiness | PASS (with named gaps) | Real bundle IDs, real permission strings, adaptive icon set present; no `android.versionCode`/`ios.buildNumber` set yet, no `eas.json` yet - both explicitly D-classified, out of this phase's scope (no store submission is permitted by this phase's own brief). |
| Settings/drawer regression | PASS | `tests/settings-navigation.test.tsx` (9 tests) still passing in the full suite; physically confirmed working by the product owner (13 September 2026, `74b1a61`). |
| Profile-avatar security/lifecycle | PASS | `profile_avatars.test.sql` (5 assertions) passing locally and on `lilica-development`. |
| Keyboard/form regression | PASS | Existing `keyboard.test.ts`/`keyboard-reveal.test.ts` suites passing in the full 482-test run; architecture unchanged since the 10 September 2026 physical confirmation recorded in `docs/LUMEN_HANDOFF.md`. |
| Auth hardening (session validation on restore) | PASS | `AuthProvider.tsx`'s existing restore-then-validate-against-Supabase / clear-on-server-rejected-identity architecture, exercised by the existing `auth-flow.test.tsx` suite; unchanged this phase. |
| Record/projection consistency (Home/Calendar/To Do/People agree on "complete") | PASS | Existing coverage: all four surfaces share the one `completionUpdate()` transition (Phase 12's own architecture); full suite green. |
| Date/time hardening (BST/GMT/month-end/leap-day) | PASS | `tests/phase14-reminders.test.ts` already covers BST/GMT transition, month-end and leap-day scheduling; unchanged and passing. |
| Crash/error handling - RPC failure surfacing | PASS (code review) | Every RPC wrapper (`src/careCircle.ts`, `src/accountLifecycle.ts`, `src/recordLinks.ts`, `src/attachments.ts`) follows the established `{ ok, data \| message }` non-throwing contract; UI surfaces the real server message rather than a generic fallback (e.g. `delete_my_account()`'s sole-organiser block, verified for real in section 2). |
| Offline/restart/recovery | **NOT RUN** | Requires physical device kill/restart and a real network-loss simulation; cannot be executed in this environment. Architecture (AsyncStorage-backed outbox/cache/cleanup-queue, retry effects on app start) is unchanged and was physically confirmed for the underlying record-sync mechanism during Phase 7's own device QA (10 September 2026); not re-tested physically this phase. |
| Large-data / performance feel | **NOT RUN** | Cannot physically measure scroll/render performance under large record volumes in this environment. Code-level scalability review only: list rendering uses `FlatList`/`VirtualizedList` throughout (already flagged in one pre-existing, documented, non-blocking test-harness warning - see `docs/LUMEN_HANDOFF.md`), no unbounded client-side joins found in the RPC layer. |
| Physical device matrix (iOS/Android hardware) | **NOT RUN** | No physical hardware available in this environment. Prior physical confirmations remain valid for what they covered (keyboard behaviour, Phase 7/8 record flows, Phase 16/17 documents, Settings drawer, People visual, To Do background) - see `docs/LUMEN_HANDOFF.md` for the exact list; nothing new was device-tested this phase. |
| Reminder engine on a real device build | **NOT RUN** | Requires a development build (Expo Go does not reliably support local notifications since SDK 53), per Phase 14's own documented constraint; unchanged this phase. |
| Screen-reader pass (VoiceOver/TalkBack) | **NOT RUN** | Requires physical hardware with assistive technology enabled; static label presence (above) is not equivalent to a real screen-reader walkthrough. |
| Full physical export/legal review | **NOT RUN - also a decision item, not a test** | Legal/privacy classification (E) - see the release blocker register below; requires product-owner/legal input, not a device. |

## Release blocker register

No **A (release blocker)** issues were found during this phase's checks. Two **B (hardening defect)** items were identified and are recorded here as candidates rather than silently fixed, since the brief instructs fixing only *justified* B issues and none of these rose to that bar on inspection:

- **B-candidate, not applied**: `phase15_care_circle.test.sql`/`phase16_document_maturity.test.sql` have no explicit bare-`anon`-role rejection test (see architecture doc section 3). Structurally already covered by table-level `authenticated`-only grants; adding the explicit test is a documentation-of-guarantee exercise, not a fix. Left for a future low-risk test-coverage pass rather than this phase.
- **B-candidate, not applied**: no `android.versionCode`/`ios.buildNumber` in `app.json`, no `eas.json`. Irrelevant until store submission is actually authorised (explicitly forbidden this phase); recorded as a pre-submission checklist item, not fixed here.

## Legal/privacy stop items (E - requires product-owner/legal decision, not implementation)

- Data-export format (`data.json` + individual file shares, no `.zip`) was a deliberate product-owner decision in Phase 18B, not revisited here - flagged only as a candidate should legal/compliance later require a single downloadable archive (e.g. for GDPR Subject Access Request formatting expectations).
- No Privacy Policy/Terms of Service URL exists anywhere in the app (`docs/PROJECT_BRIEF.md` explicitly forbids inventing one). This becomes a real pre-launch legal requirement once store submission is contemplated; it is out of this phase's scope to draft.
- Account-deletion data retention: `delete_my_account()` retains a `former_display_name` snapshot and all historical records/attachments/assignments attributed to the deleted user's former membership, by deliberate Phase 18B design (to preserve shared care-space history). Whether this fully satisfies "right to erasure" expectations under UK GDPR for a *former* user's own display name (as opposed to the shared care data, which legitimately belongs to the remaining care space) is a legal question, not an engineering one - flagged for product-owner/legal review before any public launch.

## Product enhancement backlog (D - future, not in scope)

- `npm audit` dependency bump (Expo SDK tooling) once a convenient upgrade window exists.
- `eas.json` build-profile authoring, ahead of any future store-submission authorisation.
- Explicit anon-role pgTAP tests for the two files noted above, as low-risk coverage hardening.
- A full physical device/performance/accessibility pass once real hardware is available and the product owner schedules it.

## Full validation summary (this phase)

`npm run typecheck` clean; `npm test` unchanged at 48 suites/482 tests (no new test added - this phase reviewed and cited existing coverage rather than writing new application code); `npm run secrets:check` clean (226 files); local and linked pgTAP/lint clean (279/10 both); `npm audit --production` reviewed (11 moderate, all build-tooling-only, non-blocking); `git diff --check` clean. No migration, no schema change, no application code change. The one genuinely new state-changing action this phase was the explicitly-approved, fully-cleaned-up real database rehearsal in `docs/PHASE_19_ARCHITECTURE.md` section 2.

## Overall Phase 19 conclusion

No release-blocking (A) defect was found. All findings are B-candidates deliberately left unfixed as not justified, C (non-blocking polish), D (future enhancement), or E (legal/product decision required) - consistent with this phase being a hardening/audit pass, not a place to introduce new code. The items marked NOT RUN above are the genuine remaining gap between "engineering-validated" and "field-proven" - they require physical hardware and/or a product-owner go/no-go, not further code changes. **Production release is not implied by anything in this document; it remains an explicit, separate product-owner decision**, as this phase's own brief requires.
