# Phase 3 Safety Harness And QA Baseline

Date: 9 September 2026
Scope: Phase 1 characterization and the unwired future domain contract
Application behaviour changed: Responsive composition only; product behaviour remains unchanged

Historical baseline note, 10 September 2026: this document records the Phase 3 baseline. The current suite is 8 Jest suites/98 passing tests, Welcome now uses `react-native-safe-area-context`, and current authentication/multi-person device checks live in `docs/PHASE_5_QA.md` and `docs/PHASE_6_QA.md`.

## Automated Baseline

Final local result: **Passed on 9 September 2026.** `npm run validate` completed TypeScript, 62 Jest tests, Expo dependency compatibility, public Expo configuration, and web export successfully. The test output includes the existing `SafeAreaView` deprecation warning described below.

Run all local gates with:

```bash
npm run validate
```

The command runs TypeScript, Jest, Expo dependency compatibility, public Expo configuration, and a web export. Use `npm test` for the test suite alone and `npm run test:watch` while developing tests.

Automated coverage includes:

- Current UK input parsing and existing due/overdue/upcoming/recently-updated behaviour.
- Current known treatment of passed and due-today appointments.
- Current recurrence calculation limitation.
- Empty state, `records[]`, legacy `firstItem`, completion, recurrence, attachment, optional-field, and partially malformed storage fixtures.
- Three-screen Welcome content and entry actions.
- Account choice, email validation, relationship, name, privacy gate/version, interests, skip, and interest ordering.
- Structured record heading, all eight entry categories, draft retention, Done and backdrop dismissal, and document picker/camera entry points.
- Home's real-record-only empty state and current section classification.
- Future contract examples for lifecycle/derived state, past appointments, completion/cancellation/reopening, confirmation, reminders, recurrence, links, responsibility, activity, view eligibility, duplicate bill actions, semantic conflicts, and UK calendar edges.
- Completed, cancelled, and missed recurrence history is protected against in-place schedule edits.
- Responsive layout contracts for Android/iOS safe-area edges, elastic onboarding content regions, full-width Interests composition, and First Thing stack spacing derived from its measured height.

## Android Responsive QA Correction

Physical-device screenshots at 924 x 2048 pixels showed that fixed screen spacing and a separately anchored footer left excessive dead space on Email and Interests, crowded Privacy, clipped the Interests presentation, and vertically centred the first fixed-height record card too far down the First Thing screen. The legacy React Native `SafeAreaView` also did not provide a dependable Android navigation-inset boundary.

The shared screen shell now uses `react-native-safe-area-context` for top and bottom system insets. Email, Relationship, and Interests allocate their available content height with flex layout while retaining the existing scroll fallback. Interests uses the full screen gutters for its existing carousel. First Thing starts the record stack directly below the intro and derives trailing snap space from the measured list height instead of centring the first card.

The product owner rechecked the live build after the correction with both Android and iPhone connected through Expo Go and confirmed the composition was "much better". The supplied Android device is the captured physical baseline; device model, OS version, exact logical viewport, increased-text-scale result, and post-correction screenshot filenames were not recorded. Smaller-height and increased-text conditions remain explicit manual checks rather than claimed physical evidence.

## Current Behaviour Deliberately Characterized

The following tests describe Phase 1 and are not endorsements of its future behaviour:

- Passed appointments currently derive as overdue.
- A due-today appointment currently enters Needs attention before Home can classify it as Today.
- Monthly recurrence currently uses JavaScript date mutation, so 31 January 2026 advances to 3 March 2026.
- Malformed stored JSON currently rejects loading rather than repairing it.
- `records[]` takes precedence over the legacy `firstItem` fallback.

The approved future behaviour is encoded only in `src/domain`. Nothing in the running app imports that module.

## Physical-Device Checklist

Status: **Partially run by the product owner.** Android baseline screenshots identified and drove the responsive correction above; the corrected Expo Go build was then checked with Android and iPhone connected. Cases not explicitly exercised below remain pending and must not be inferred as passed from the layout check.

Use a fresh install first, then repeat the resume cases with existing local data.

1. **Welcome and account choice**
   Swipe all three Welcome pages; use the visible next cue; verify Log in and Get started; inspect text fit at default and large system text; confirm account-choice presentation is unchanged.
2. **Email, relationship, and name**
   Confirm invalid email cannot continue; enter a valid email; go back and forward; select each relationship; enter and edit the supported person's preferred name; verify the keyboard does not cover the action.
3. **Privacy gate**
   Confirm Continue is disabled initially; select and deselect the declaration; continue only when selected; relaunch after acceptance and confirm the gate/version/timestamp resume correctly.
4. **Interests**
   Swipe the horizontal carousel; use both arrow controls; select/deselect several areas; verify selected count; verify Continue and Skip; confirm selected interests only reorder and never remove record categories.
5. **Record stack**
   Verify “Let's get [Name] organised”; vertically scroll and snap through all eight categories; confirm adjacent cards remain visible and no text overlaps at supported screen sizes/text scales.
6. **Sheet opening and form layout**
   Open every category; verify smooth expansion, compact proportional fields, keyboard avoidance, form scrolling, date validation, and no clipped footer or content.
7. **Every dismissal path and draft retention**
   Enter unsaved text, then separately dismiss with Done, backdrop, Android/system back, and downward swipe while at scroll top. Reopen after each and confirm the draft remains. Confirm a downward form scroll does not dismiss the sheet and a drag below scroll top retains form control.
8. **Save and edit**
   Save a valid record in each category; confirm Added/Edit state and next-card focus; edit the saved record; confirm the footer changes from “I'll add things later” to “Go to [Name]'s Home”.
9. **Document picker**
   Choose one and multiple files; cancel the picker; remove an attachment; relaunch the app after save; verify filenames and durable local access. Test an unavailable/invalid source and confirm the visible error.
10. **Camera capture**
    Deny, then grant camera permission; cancel capture; capture a page with the rear camera; verify preview metadata/save/relaunch; repeat in a standalone native build because Expo Go is not final permission evidence.
11. **Home and tabs**
    Complete onboarding with no record and with real records; confirm no fabricated cards or empty sections; verify Add returns to the record stack; verify Calendar, To Do, and Person remain placeholders.
12. **Resume, back, and legacy data**
    Terminate/relaunch at each onboarding stage; verify unaccepted privacy cannot be bypassed; test old `how`, `itemForm`, and legacy `firstItem` states using a disposable install; confirm no record or attachment metadata is lost.

Record device model, OS version, Expo Go or build identifier, pass/fail, notes, and screenshot filenames alongside each case when executed.

## Automated-Test Limitations

- React Native Testing Library does not prove native layout, animation smoothness, keyboard behaviour, camera/picker integration, file durability, Android system-back dispatch, or pan-gesture thresholds.
- Done and backdrop are automated; platform back and swipe-down remain physical-device checks.
- The render suite reports React Native's existing `SafeAreaView` deprecation warning from `WelcomeScreen`. Phase 3 does not refactor that protected screen.
- No screenshot diff system or E2E framework was introduced in this deliberately small harness.
- There is no backend, Supabase, authentication, sync, notification, Calendar, To Do, Person, or care-circle implementation to test.

## Dependency Audit Note

The Phase 3 install reported moderate transitive advisories in the Expo 57 dependency graph and no high or critical findings. No automatic audit fix was run because that could upgrade the protected SDK/toolchain outside Phase 3. Reassess through Expo-compatible updates in an explicitly approved maintenance phase.
