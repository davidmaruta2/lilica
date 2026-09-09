# Revision Log

## 2026-09-09: Structured Record Onboarding And Document Capture

Reason:

The post-interest `What would help today?` screen repeated a question the user had already answered and did not collect enough structured information to power Lilica's Home experience. Its initial inline forms were also disproportionately large and clipped awkwardly around the keyboard.

Changes:

- Replaced the old category-choice screen with `Let's get [Name] organised`.
- Added an interest-prioritised vertical snapping stack for Appointment, Something to do, Bill or renewal, Home matter, Important document, Contact, Care information and Update.
- Added reusable structured records with event dates, due dates, expiry dates, status, responsibility, recurrence, completion, confirmations and audit timestamps.
- Added deterministic date parsing and derived due-today, overdue, upcoming, unresolved, completed, recently-updated and next-recurring-date state.
- Migrated legacy `firstItem` storage into a records array without creating fake content.
- Updated Home to group real records into populated Needs attention, Today, Coming up and Latest sections.
- Moved record forms from inline expanded cards into a compact animated bottom sheet.
- Added dismissal through Done, backdrop, system back and downward swipe from anywhere on the sheet while content is at the top.
- Kept unsaved draft values in the parent screen when the sheet is temporarily dismissed.
- Added file upload and rear-camera capture to Important document.
- Added local durable attachment copies and attachment metadata using Expo Document Picker, Image Picker and File System.
- Added native permission configuration for document and camera access.

Known limits:

- Unsaved drafts are retained only while the record-onboarding screen remains mounted.
- Camera capture does not provide document edge detection, PDF assembly or OCR.
- Attachments are local and do not synchronise without future backend storage.
- Authentication remains a local placeholder and no organiser profile/care-circle membership model exists yet.
- Physical-device gesture, keyboard and camera QA remains manual because browser automation was unavailable.

Verification:

- `npm run typecheck` passed.
- `npx expo config --type public` passed.
- `npx expo export --platform web` passed.
- The local preview returned HTTP 200 at `http://localhost:8084`.

## 2026-09-09: Interest Selection Carousel

Changes:

- Replaced the tall interest option list with a compact horizontal chip carousel.
- Added touch scrolling and accessible previous/next arrow controls.
- Added clear selected styling and a live selected-count message.
- Preserved multi-selection, skipping and later interest-based record ordering.

## 2026-09-09: Premium Onboarding Redesign

Reason:

The previous onboarding was visually crowded and presented too much copy at once. The new direction uses Yuka as a benchmark for calm pacing, strong colour, restrained typography and one clear idea at a time.

Changes:

- Replaced the separate Welcome and How Lilica Works presentation with one three-page horizontal swipe journey.
- Added a small three-position indicator used only within the intro and a tappable swipe cue for people who do not swipe.
- Reduced intro copy to short, natural sentences and moved Get started to the final page.
- Refocused the final intro slide from the repetitive `Know what needs doing` message to controlled collaboration: bringing in family or helpers, sharing updates and responsibilities, clear ownership, optional later invitations and explicit solo-user value.
- Replaced the final slide's generic progress-path visual with two helpers connected through a shared, confirmed responsibility.
- Refined the Lilica wordmark and created a distinct visual composition for each intro page.
- Reduced heading and body sizes across the shared type system.
- Restyled buttons, option rows, headers and screen spacing for a quieter, more consistent flow.
- Simplified the account, email, relationship, name, interests and first-item screens.
- Removed `Save your place and come back anytime.` from Create your account and grouped the heading with its three authentication buttons and Log in action using responsive in-content spacing rather than a detached fixed footer.
- Reworked privacy information into three numbered, plain-English points covering permission, involvement and UK GDPR-aligned privacy; simplified the declaration and advanced its stored version to `privacy-basis-v2` while preserving the active checkbox gate and acceptance time.
- Removed technical and development wording from user-facing first-item and foundation screens.
- Removed the development reset action from Home.
- Preserved onboarding resume, back navigation, skip paths, saved selections and the first real item on Home.

Verification:

- `npm run typecheck` passed.
- `npx expo install --check` reported that dependencies are up to date.
- `npx expo export --platform web` passed and exported `dist`.
- Static flow checks confirmed the three-page deck, paging, tap fallback, old `how` stage recovery, privacy gate/version/time, onboarding resume and first-item preservation.
- Metro started successfully at `http://localhost:8083`.

Rendered QA limitation:

The managed browser was available, but its navigation policy blocked both `localhost` and `127.0.0.1`, so an automated rendered screenshot could not be captured. The app remains runnable for manual mobile-size and Expo Go inspection.

## 2026-09-08: Controlled Phase 1 Visual And Flow Pass

Reason:

The previous rendered app did not meet the requested Yuka-level visual benchmark. The Welcome headline was too large, How Lilica Works read like a text page, the email auth flow lacked a focused CTA step, and Home used too much paragraph copy.

Changes:

- Added a recoverable `emailAuth` onboarding stage.
- Added `src/screens/EmailAuthScreen.tsx`.
- Changed `AuthScreen` so it is only the account-method choice screen.
- Changed Continue with email to lead to `What's your email?`.
- Reduced the Welcome hero image and headline scale.
- Kept the approved Welcome headline and supporting copy intact.
- Changed How Lilica Works into a numbered explanation screen.
- Adjusted progress dots from 8 to 9 onboarding moments.
- Centred and simplified the main onboarding question screens.
- Revised Home so it leads with a compact supported-person header and visible real item content rather than large product paragraphs.
- Preserved the first item when users return to add something and then skip.

Verification:

- `npm run typecheck` passed.
- `npx expo export --platform web` passed.
- Expo web server was started on `http://localhost:8082`.
- Expo Go URL shown by Metro: `exp://192.168.1.178:8082`.

Known limitation:

Browser automation was unavailable, so no automated rendered screenshot could be captured from this environment. The user should inspect the revised screens manually in browser or Expo Go.

Outcome:

The user manually inspected the revised app and rejected the visual result. The UI is still too cluttered, still does not follow the Yuka benchmark closely enough, and still does not present text with a professional premium feel.

Additional feedback:

- Welcome should follow the Yuka structure more exactly.
- The supporting paragraph beginning "Keep appointments, care..." should not live on Welcome.
- The progress dots/slider at the bottom of onboarding screens should be removed.
- Home should not show paragraph-led explanation.
- A more capable visual design pass is required.

## 2026-09-08: Documentation Handoff Update

Reason:

The user asked for all project docs to be updated with a full debrief, project context, failure analysis, reference material and a prompt for Lumen, the incoming AI OpenClaw agent.

Changes:

- Updated `README.md` to state that the current visual design is rejected.
- Updated `docs/PROJECT_BRIEF.md` with a current design status section.
- Updated `docs/LUMEN_HANDOFF.md` with the latest rejection, failure analysis and stronger Lumen instructions.
- Updated this revision log with the outcome of the failed visual pass.

Status:

No further visual implementation should be attempted from the existing composition without first rethinking the screen structure against the Yuka references.
