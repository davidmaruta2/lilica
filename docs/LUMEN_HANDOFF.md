# Lumen Handoff: Lilica Phase 1 Visual Revision

## Purpose Of This Handoff

This file is a direct debrief for Lumen, the incoming AI OpenClaw agent.

The current Lilica app has a working Phase 1 skeleton, but the visual execution is rejected.

A follow-up revision separated email entry into its own CTA moment, reduced the Welcome scale, changed How Lilica Works into a numbered explanation, removed progress dots, and made Home less paragraph-led. The user has still rejected the result as cluttered and below the Yuka benchmark.

Lumen should not continue polishing the current visual system as though it is almost right. The app needs a more intelligent composition and information-design pass.

Do not assume the current UI is acceptable. It needs a serious design revision.

Latest user feedback:

> It's still very cluttered and i need an AI agent intelligent enout to present this cleanly and in a premium way.
>
> App home screen should not be showing text as paragraphs like this.
>
> This is wasting so much time, you're failing to get a professional premium look to how you are presenting this text.

## Latest 2026-09-09 Correction

The current intro is a three-slide Welcome / How Lilica Works journey. The final slide no longer repeats the preceding "Know what they need" slide. It is now dedicated to controlled collaboration:

- Heading: `Share care, with clarity`
- Direction: `Update and share responsibilities in a controlled way:`
- It explains bringing in family or other helpers, sharing updates and responsibilities, seeing who is doing what, and inviting others when ready.
- It explicitly preserves solo-user value: `Lilica works from day one, even when it’s just you.`
- Its visual now represents two helpers connected through a shared, confirmed responsibility rather than another generic "what needs doing" path.

The Create your account screen has also been corrected:

- Removed `Save your place and come back anytime.` with no replacement supporting sentence.
- Moved the three authentication buttons and Log in action into the same centred, responsive content group as the heading.
- Reduced the decorative wordmark disc and set a deliberate 32px heading-to-action gap, eliminating the disproportionate separation caused by the shared fixed footer.
- Authentication behaviour is unchanged and remains the Phase 1 local placeholder described below.

This section is the current truth where older failure notes or the embedded historical Lumen prompt below conflict with it.

The privacy screen now follows the same plain-English standard:

- Three numbered points cover getting permission or having the right authority, keeping the supported person involved, and Lilica's UK GDPR-aligned privacy commitment.
- The privacy commitment does not make an absolute promise that would conflict with user-directed sharing or legal obligations.
- The declaration follows the three points and uses direct language rather than `appropriate basis`.
- The stored declaration version is now `privacy-basis-v2`.

## Current State

App path:

`C:\Users\DavidPC\Downloads\DAVID\Lilica\lilica-app`

Product/document paths:

`C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica.docx`

`C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica_Framework_and_Design_Plan.docx`

Visual references:

`C:\Users\DavidPC\Downloads\DAVID\Lilica\yuka`

`C:\Users\DavidPC\Downloads\DAVID\Lilica\kinlog`

Typography references:

`C:\Users\DavidPC\Downloads\ryeli`

Current failure screenshots:

`C:\Users\DavidPC\Downloads\i1.png`

`C:\Users\DavidPC\Downloads\i2.png`

Technical stack:

- Expo SDK 57
- React 19
- React Native 0.86
- TypeScript 6
- React Native Web
- AsyncStorage
- Fraunces font package

Important scripts:

- `npm run web`
- `npm run start`
- `npm run typecheck`
- `npx expo install --check`
- `npx expo export --platform web`

There is no configured lint script and no test suite at the time of this handoff.

Latest local development server observed in this session:

- Web: `http://localhost:8082`
- Expo Go: `exp://192.168.1.178:8082`

## What Was Asked

The user asked for a React Native app called Lilica for Luxford Interactive.

Phase 1 only:

- Product foundation
- Navigation shell
- Welcome
- How Lilica works
- Authentication integration
- Who are you helping?
- What's their name?
- Privacy and consent
- What do you help with?
- Add your first thing
- Minimal first-item creation
- Initial Home
- Onboarding state persistence

The app should be a premium consumer-quality personal and family care organiser. It should help someone organise the everyday life, care, information and responsibilities of another person.

The app must not become an elderly-only app, a medical system, an emergency system, an eMAR, a surveillance product or a generic family calendar.

The user wants the design quality closer to Yuka, with typography closer to Ryeli, and flow logic informed by Kinlog.

## Reference Interpretation

### Yuka

Use Yuka as the quality benchmark:

- Confident composition
- Strong colour
- Generous whitespace
- Focused visual moments
- Clear CTAs
- Strong typographic hierarchy
- Simple screens that still feel designed
- Premium consumer-app polish

Do not copy:

- Yuka branding
- Carrot mascot
- Exact colours
- Proprietary illustrations
- Distinctive layouts

### Kinlog

Use Kinlog for care/family flow logic only:

- Introducing the supported person
- Gradual information capture
- Calm onboarding sequence
- Family/care organiser mental model

Do not copy:

- Clinical visual styling
- Profile completion percentages
- Medication-first onboarding
- Long setup forms
- Care dossier feel

### Ryeli

Use Ryeli for typography:

- Clean premium type
- Deliberate headline/body contrast
- High-end hierarchy
- Elegant form presentation
- Less generic React Native feel

Do not copy unrelated product logic.

## Where The Current Implementation Failed

The current implementation has not achieved the requested visual standard.

Main failures:

- The Welcome headline appears too large and heavy in the rendered app.
- The approved long Welcome headline is being treated like a large block of text instead of a composed hero message.
- The Lilica wordmark is not good enough. It may use Fraunces now, but it still needs proper design judgement and visual treatment.
- The How Lilica Works screen was previously a text wall and needs a clear, numbered explanation.
- The Home screen currently uses too much text and displays it as paragraphs.
- Home does not yet feel like a calm command centre.
- Home does not communicate product value through useful compact modules.
- The visual system still risks looking like a generic React Native template with a palette applied.
- The app lacks sufficient Yuka-level polish, rhythm and confidence.
- The layout has had clipping issues in browser/Expo, especially around long text and fixed bottom CTAs.
- Actual rendered QA has been limited because the browser automation connector was unavailable. The user saw the app manually and supplied screenshots showing the problems.
- Even after removing progress dots and moving some text, the Welcome screen still feels cluttered.
- The current implementation still does not understand the Yuka pattern deeply enough: Yuka Welcome is essentially a visual, the word "Welcome", one statement, and one action.
- The Lilica Welcome tries to carry too much product proposition at once.
- The Home screen still requires a stronger information architecture. It should not explain Lilica in paragraphs.

Changes made after that failure:

- Added an explicit `emailAuth` onboarding stage.
- Added `src/screens/EmailAuthScreen.tsx`.
- Changed email auth from an embedded form inside Create Account to a focused `What's your email?` screen.
- Changed How Lilica Works to a numbered three-part explanation.
- Reduced Welcome headline scale and hero image size.
- Revised Home to use a compact header, a real saved item row, a small first-arrival message, and a compact Ask Lilica entry instead of paragraph-heavy explainer copy.
- Fixed first-item preservation when returning to Home after skipping a later add flow.
- Removed progress dots from onboarding screens after user objected to the slider/progress treatment.
- Moved the "Keep appointments, care..." text from Welcome into How Lilica Works.
- Added a Reset onboarding button on Home for repeated testing.

These changes did not solve the core problem. The rendered result is still rejected.

Specific screenshots to inspect:

- `C:\Users\DavidPC\Downloads\i1.png`: shows How Lilica Works with poor text scale/composition and clipped content.
- `C:\Users\DavidPC\Downloads\i2.png`: shows Welcome with headline/support copy scale and layout problems.

## What Can Be Retained

Do not rebuild from scratch.

Retain where useful:

- Expo SDK 57 setup
- File structure under `src`
- AsyncStorage onboarding persistence
- The explicit onboarding stage model
- Basic navigation state in `App.tsx`
- The Phase 1 screen list
- The privacy consent stage and stored timestamp/version
- Minimal first-item creation model
- First saved item appearing on Home
- Brand string centralisation in `src/brand.ts`
- TypeScript model structure in `src/types.ts`

Revise further if the rendered result still misses the Yuka benchmark:

- `src/theme.ts`
- `src/components/Wordmark.tsx`
- `src/components/BrandVisual.tsx`
- `src/screens/WelcomeScreen.tsx`
- `src/screens/HowItWorksScreen.tsx`
- `src/screens/HomeScreen.tsx`
- Potentially `src/components/Screen.tsx`, `Button.tsx`, `OptionRow.tsx`, `Text.tsx`

Consider removing or replacing:

- Any unused component such as `ChoiceTile.tsx`, if still unused
- Overly generic repeated card layouts
- Paragraph-heavy marketing surfaces

## Immediate Design Priorities

1. Fix Welcome

The Yuka benchmark should be followed more directly in structure:

- Brand / wordmark
- One strong visual
- One short welcome moment
- One concise statement
- One primary CTA
- No progress slider
- No feature paragraph
- No dense centred block

The approved long headline below has been difficult to present cleanly as Welcome copy:

`Helping the people you love stay independent and age well, with the family organised around them.`

If it remains on Welcome, Lumen must make it feel like a composed statement, not a paragraph. If the product owner allows a restructure, consider using a shorter Welcome statement and moving the full proposition into How Lilica Works.

The supporting text below should not be on Welcome in the rejected design:

`Keep appointments, care, household matters, important paperwork and everyday to-dos organised for someone you care about.`

It should live on the next explanation screen or be broken into scannable points.

Needed:

- Better wordmark
- Better visual composition
- Controlled headline scale
- More editorial line breaks
- Stronger visual hierarchy
- No clipping behind CTAs
- Yuka-level first impression
- Responsive treatment for web and mobile

2. Fix How Lilica Works

The user specifically said:

`Get started should display how Lilica works, but all that text should be clearly outlined (numbered), see downloads\i1.png to see how bad it currently looks. clicking continue should start the onboarding with CTA style questions, just like Yuka`

Interpretation:

- Get Started from Welcome goes to How Lilica Works.
- How Lilica Works should explain the product in numbered, clearly outlined steps.
- It must not look like one huge title plus a clipped paragraph.
- Continue should then start the question-based onboarding.
- The relationship/name/interests screens should feel like focused CTA questions, closer to Yuka pacing and confidence.

3. Fix Home

The user specifically said:

`App home screen should not be showing text as paragraphs like this.`

Needed:

- No paragraph-led product explanation.
- Use compact, useful modules and rows.
- Put saved real item high and visible.
- Make purpose clear through structure, labels and useful content.
- Move towards the broader dashboard concept:
  - `[Name]'s Home` or `[Name]'s Week`
  - Today
  - Coming up
  - Things to sort
  - Latest update
  - Add something
  - Ask Lilica
- In Phase 1, only show sections backed by real user-created records or clearly separated development fixtures.
- Do not fake a populated dashboard.

4. Fix Wordmark

The user said:

`The Lilica wordmark is not good enough`

Needed:

- Make wordmark feel deliberate and premium.
- Avoid merely typing "Lilica" in a default font.
- Consider a refined text mark using available fonts, spacing, colour and a small original mark if it helps.
- Do not create a mascot.
- Do not copy Yuka.

## Approved Product Flow To Preserve

1. Welcome
2. How Lilica works
3. Create account / log in
4. Who are you helping?
5. What's their name?
6. Privacy and consent
7. What do you help with?
8. Add your first thing
9. First-item creation
10. Home

Do not proceed into Phase 2.

## Functional Requirements To Preserve Or Fix

- Back navigation works.
- Onboarding persists after refresh/app close.
- Auth state is preserved through onboarding.
- Privacy checkbox must be selected before Continue.
- Declaration version and timestamp are stored.
- Interest selection can be skipped.
- First thing can be skipped.
- No fake records are created.
- A real first item appears on Home after creation.
- Returning users who completed onboarding bypass onboarding and go to Home.
- Keyboard must not obscure the name input or first-item inputs.
- Long supported-person names must not break tabs, headings or Home.

## Known Technical Issues To Check

- `completeOnboarding(firstItem?: FirstItem)` may clear an existing first item when called without an item from a later Home add flow. Check before relying on it.
- Auth is currently a local placeholder, not production auth.
- No backend or database exists.
- No real Privacy Policy or Terms URL has been found. Do not invent links.
- Browser automation was unavailable in the previous session, so visual QA needs manual or alternate tooling.
- The Expo QR may need to be restarted with `npx expo start --host lan`.
- Project must remain Expo SDK 57 for the user's Expo Go.

## Lumen Prompt

Paste the following to Lumen:

```
You are taking over the Lilica React Native app for Luxford Interactive.

Work in:
C:\Users\DavidPC\Downloads\DAVID\Lilica\lilica-app

This is Expo SDK 57. Do not downgrade. Read:
- docs/PROJECT_BRIEF.md
- docs/LUMEN_HANDOFF.md
- C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica.docx
- C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica_Framework_and_Design_Plan.docx

Inspect visual references:
- C:\Users\DavidPC\Downloads\DAVID\Lilica\yuka
- C:\Users\DavidPC\Downloads\DAVID\Lilica\kinlog
- C:\Users\DavidPC\Downloads\ryeli

Inspect current failure screenshots:
- C:\Users\DavidPC\Downloads\i1.png
- C:\Users\DavidPC\Downloads\i2.png

Your task is a controlled Phase 1 visual and onboarding revision. Do not rebuild from scratch. Do not build Phase 2.

The current functionality should mostly be preserved:
- Onboarding stages
- AsyncStorage persistence
- Privacy consent checkbox and timestamp/version
- First-item creation
- First saved item appearing on Home
- Basic bottom navigation shell

The current visual execution is rejected. Fix it.

Reference direction:
- Yuka is the visual quality benchmark: confident, polished, simple, strong colour, excellent whitespace, clear hierarchy and focused CTAs.
- Ryeli is the typography benchmark: clean, premium type hierarchy.
- Kinlog is only for flow logic: supported-person concept and calm progressive onboarding. Do not copy its visual design.

Critical user feedback:
- The Welcome headline is still too big.
- The Lilica wordmark is not good enough.
- How Lilica Works must be clearly outlined and numbered.
- Clicking Get started should show How Lilica Works.
- Clicking Continue should begin the onboarding with focused CTA-style questions like Yuka.
- The Home screen must not show text as big paragraphs.
- Home should feel like a useful command centre, not a marketing explainer.
- The latest visual pass is still too cluttered.
- The app needs an AI/design agent intelligent enough to present the copy cleanly and in a premium way.
- Follow the Yuka Welcome structure much more closely: visual, "Welcome", one statement, one action. Do not add progress dots/sliders.

Approved Welcome headline, exact:
"Helping the people you love stay independent and age well, with the family organised around them."

Approved Welcome supporting text, exact:
"Keep appointments, care, household matters, important paperwork and everyday to-dos organised for someone you care about."

Do not silently rewrite approved copy.

Make the long headline work through layout, rhythm, line breaks, colour, scale and composition, or move the full explanatory proposition to the How Lilica Works screen if the product owner approves that restructure.

Revise especially:
- src/theme.ts
- src/components/Wordmark.tsx
- src/components/BrandVisual.tsx
- src/screens/WelcomeScreen.tsx
- src/screens/HowItWorksScreen.tsx
- src/screens/HomeScreen.tsx
- Related shared components if needed

After implementation:
- Run npm run typecheck
- Run npx expo install --check
- Run npx expo export --platform web
- Start the app with npm run web or npx expo start --host lan
- Inspect the actual rendered screens on mobile-sized web and Expo Go if possible
- Verify Back navigation, onboarding persistence, privacy consent, first item creation and item visibility on Home

Do not stop at a palette change. This needs a genuine composition, typography, copy staging and hierarchy revision. If a screen still looks cluttered, reduce and stage the information rather than shrinking text until it fits.
```

## Acceptance Bar

The revised app should feel like a premium consumer product, not a prototype.

Minimum acceptance criteria:

- Welcome looks designed and balanced on a mobile viewport.
- Wordmark feels intentional.
- How Lilica Works is numbered, scannable and not clipped.
- The onboarding questions feel focused and confident.
- Home is compact, useful and not paragraph-led.
- First saved item is immediately visible.
- No fake dashboard content appears.
- The app still typechecks.
- Expo SDK remains 57.

## Intentionally Deferred

Do not build these in this handoff:

- Production AI or Ask Lilica responses
- Real OAuth unless existing infrastructure is found and can be integrated safely
- Backend/database migrations
- OCR
- Payment/banking features
- Family permission model
- Subscriptions/paywalls
- Full Calendar, To Do or Person feature sets

These belong to later phases after Phase 1 is visually and functionally approved.
