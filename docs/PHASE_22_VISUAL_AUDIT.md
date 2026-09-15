# Phase 22A - Premium Visual Quality, UX Polish and Typography Audit

**Status: AUDIT COMPLETE. No application implementation has started. After this audit, the product owner and Codex completed a step-by-step mock review and approved the visual direction recorded in `docs/PHASE_22_APPROVED_VISUAL_DIRECTION.md`. GPT review and a separate product-owner implementation prompt are still mandatory before any Phase 22 application code, theme, dependency or component change.**

Audit baseline: branch `prephase22-remove-supported-person-faq-help`, commit `dd7cf6a`. This supersedes the older Phase 22 audit written against `a67c40f`. It reflects the current source after Phase 21 and the Care Circle closure work.

Method: direct review of every active screen family, route composition in `App.tsx`, shared visual primitives, tokens, modal/sheet surfaces, and the current production JSX/styles, followed by visual reconciliation against all 14 current captures in `C:\Users\DavidPC\Downloads\visualPolish`. Scores now combine source and current-device evidence. Judgements that still cannot be established from this set are marked **PHYSICAL/VISUAL REVIEW REQUIRED**. Dormant legacy routes are identified separately rather than treated as current user journeys.

Screenshot-set note: every capture contains a second blue cog floating near the lower-left edge, including Welcome and account creation where the current app source renders no settings control. It is therefore treated as an external device/capture overlay and excluded from app scoring. The normal top-right blue cog on Home, Calendar, To Do and People is app UI and remains in scope.

## A. Executive assessment

Lilica is recognisably one product. Its warm cream canvas, burgundy action colour, restrained section accents, rounded white cards, plain-language copy and selective Fraunces wordmark already create a calm and credible identity. Welcome, Home, Calendar and People show that the product can feel commercially polished without becoming decorative.

Current visual quality is approximately **6.9/10 overall**: credible and thoughtful, but not uniformly premium. The screenshots confirm that the main weakness is not the core identity. It is the gap between the strongest primary surfaces and the plainer administrative, loading, empty and error surfaces, plus several visible clipping and content-ownership problems. Several secondary screens look assembled from correct controls rather than composed as finished moments.

The five largest issues are:

1. Care Circle's primary `Invite someone` CTA is visibly occluded by the persistent bottom navigation.
2. Search does not currently match the protected architecture stated in the approved brief.
3. To Do is currently olive/sage, while the Phase 22 brief explicitly protects a richer blue direction; populated tiles also visibly truncate category and date text.
4. The bright blue glowing Settings cog is visually disconnected from the rest of Lilica and competes with page actions.
5. Drawer subsections and several nested `Screen` plus `ScrollView` layouts duplicate padding/chrome, while loading, empty and error states remain visually unfinished.

The first two are specification-fidelity questions. They must be resolved against the approved reference before implementation. The audit does not guess at a replacement design.

## B. Current visual/design-system summary

### Existing strengths

- `theme.ts` provides a real shared system: colour roles, four radii, eight spacing steps, one soft shadow and named typography variants.
- `AppText`, `Button`, `TextField`, `Screen`, `Header` and `ScreenBackdrop` give most screens a shared baseline.
- The four main areas retain distinct identities without collapsing into one colour.
- Form language is warm and consumer-facing. Record fields generally ask human questions rather than expose data-model terms.
- `RecordSheet`, `RecordDetail` and `RecordEditor` provide a consistent view/edit/add model across entry points.
- Core touch targets are generally 44px or larger, and primary controls normally expose accessibility roles and labels.

### Current visual modes

1. **Intro/onboarding:** centred, spacious, cream or full-colour, low-density.
2. **Daily-use tabs:** stronger colour fields, white or tinted content surfaces, richer hierarchy.
3. **Administrative/settings:** cream canvas, outlined sections, denser rows and longer explanatory copy.

Those modes are defensible. Phase 22 should improve continuity between them, not flatten them into one template.

### Minimum system gaps

- No compact button API; screens override width, height and padding individually.
- No shared status-state treatment for loading, empty, error and success moments.
- No shared directional icon/chevron primitive; similar shapes are redrawn repeatedly.
- No explicit content-shell variant for a screen that already owns a child scroller.
- Flat outlined rows/cards are repeated across many files without a shared role.
- Header utilities use separate local sizing and colour decisions.

## C. Screen-by-screen scores

Scores use the brief's 10-point standard. They assess the current implementation, not the quality of its product logic.

| Screen or surface | Score | Biggest current opportunities |
|---|---:|---|
| Welcome carousel | 8.7 | Physical check of compact-height scaling; consolidate its locally drawn icon geometry only if later work already touches it. |
| Auth choice | 8.2 | Slightly generic centre mark; otherwise leave the composition alone. |
| Create account / Login | 7.3 | Current capture has a large inactive middle/lower area and widely separated form/CTA; verify keyboard-open balance and error wrapping on small Android. |
| Verification / Recovery code | 8.0 | Check six-cell fit at large text; add a coherent verifying/success state rather than text-only feedback. |
| Recovery request / email sent / new password | 7.8 | The sent screen is strong; request/password states need matching hierarchy and physical keyboard QA. |
| About You | 7.6 | Top spacing is intentionally generous but should be checked on short phones; mark styling is less distinctive than Welcome. |
| Join or Set Up / Care fork | 7.2 | Two-up choice tiles can become cramped with large text; visually simple but clear. |
| Who are you helping carousel / summary | 8.0 | Strong CTA moment; verify multi-line relationships and wheel focus with large text. |
| Name / People review / active-person choice | 7.4 | Review rows have crowded Edit/Remove text actions; long names and 3+ people need physical review. |
| Privacy consent | 7.5 | Dense legal/ethical copy on small heights; checkbox alignment and scroll-to-footer at large text. |
| Interests carousel | 7.9 | Good affordances; verify partial-card framing and arrow occlusion on narrow Android. |
| First Thing / records gateway | 8.1 | Strong stack and sheet handoff; count badge, long labels and compact-height balance need physical review. |
| Home | 8.0 | Strong hierarchy, but current populated capture visibly truncates category labels and uses a clipped status carousel; protect architecture while fixing information fit. |
| Calendar | 8.0 | Strong month card, but the legend visibly clips its last label and the card consumes substantial height before agenda content. |
| To Do | 6.0 | Approved colour-direction conflict; populated tiles visibly truncate category labels and dates, while sparse states leave a large fading field. |
| People | 7.8 | Strong composition, but contact/member names and roles visibly truncate; half-width cards need responsive text review. |
| Person switcher / active-person switching | 7.9 | Clear and consistent; verify long-name truncation and sheet height with many people. |
| Search | 6.0 | Current screen lacks the protected avatar/name and horizontal scope/category composition; reference reconciliation required. |
| Documents | 6.1 | Raw loading/error/empty states; document rows lack useful expiry/status emphasis. |
| Contacts list | 6.8 | Functional flat rows; needs consistent list/action hierarchy, especially empty state. |
| Wellbeing updates | 6.2 | Double horizontal padding; plain empty state; visually much quieter than People. |
| Care Circle management | 4.8 | Primary Invite CTA is visibly covered by the bottom navigation; double padding and long administrative sections make the surface cramped. |
| Invitations | 6.0 | Double padding; side-by-side actions can crowd; no considered zero-invitation moment. |
| Join a Care Circle | 6.2 | Double padding; functional code/review cards need tighter hierarchy and state treatment. |
| Care Summary | 6.2 | Current drawer capture confirms stacked Close/back/header chrome and very tall repetitive rows; populated sections become long quickly. |
| Recent Activity | 6.1 | Bare spinner and plain empty/error copy; rows need stronger scanning cues. |
| Settings drawer | 7.2 | Main menu cards are attractive and clear, but long menus run below the viewport and subsection captures confirm excessive stacked chrome. |
| Account | 6.7 | Profile header is clear; custom checkbox-switch treatment and inline edit actions need alignment. |
| Privacy & Data | 6.5 | Accordions are the right density control, but the drawer capture has Close plus a separate back row and a large title gap before content. |
| Subscription | 5.9 | Trust-critical purchase surface reads as generic cards and raw state text; mock required before changes. |
| Archived care / Manage care | 6.6 | Clear hierarchy of reversible versus permanent actions; empty/success states remain visually plain. |
| Record category list | 7.6 | Clear repeated rows; text `>` differs from other chevrons and empty category state is plain. |
| Record detail | 7.8 | Good semantic grouping; long titles, attachments and related records need populated physical review. |
| Record editor / Add flows | 7.5 | Consistent controls; long forms, paired attachment actions and inline task creation need large-text/keyboard QA. |
| Date/time wheels | 8.0 | Dedicated, non-calendar-picker interaction is coherent; verify wheel alignment and modal height on both platforms. |
| Record sheet | 8.1 | Strong presentation and dismissal model; confirm modal focus and 88% height with large text/keyboard. |
| Read-only and archived gates | 7.8 | Calm and correctly distinct; modal focus and very long translated/dynamic text remain to verify. |
| Member detail / remove-care confirmation | 7.6 | Clear hierarchy and purposeful motion; destructive confirmation is text-dense on small phones. |
| FAQ / How to use / Contact | 6.1 | How to use is visibly text-heavy with very tall repeated cards; retain clarity but improve scanning and density without decoration. |
| Global startup/profile failure | 6.2 | Bare spinner plus copy is functional but visibly less finished than the app it opens into. |
| Bottom navigation | 7.1 | Clear labels and selected state; dot/line-only iconography feels less resolved than the rich tab content. |

### Dormant or legacy surfaces

`FoundationScreen`, `HowItWorksScreen` and the legacy `ItemFormScreen` remain in source, but the current route composition does not present them as normal production journeys. Do not spend Phase 22 polish effort on them until their intended lifecycle is confirmed. Removing or rewiring them would be non-visual scope.

## D. Cross-app typography findings

- The hierarchy is coherent, but nine named variants are near the upper limit for a deliberately small system. Do not add more variants casually.
- `wordmark`, `hero`, `display`, `title` and `section` use negative letter spacing while several screens add local sizes. A premium pass should test zero tracking on device and retain only differences that materially improve legibility.
- `PersonScreen` uses 13px and 11.5px local text to make half-width cards fit; `HowToUseScreen` and count badges add other local sizes. This indicates layout pressure, not a need for many new typography tokens.
- `meta` combines uppercase category labels, dates, counters and legal/supporting roles. It is visually over-assigned.
- Heavy title and section weights can compete when a card contains several levels. Subscription, Care Circle and record detail should be checked for emphasis hierarchy.
- System font body copy is appropriate. A broad font replacement is not justified.

Recommended target: keep one wordmark style plus a compact display/title/section/body/supporting/meta/button set, with zero or carefully justified tracking and no text made smaller merely to preserve a rigid layout.

## E. Spacing/layout findings

- `Screen` already supplies horizontal padding and scrolling. `CareCircleScreen`, `InvitationsScreen`, `JoinCareCircleScreen` and `WellbeingUpdatesScreen` add a child `ScrollView` whose content also has `padding: spacing.lg`. This effectively doubles side padding and duplicates scroll ownership. The Care Circle capture confirms the result is narrow and that its bottom CTA can fall behind the persistent tab bar.
- Settings drawer subsections render full `Screen` shells inside a drawer that already handles safe areas and top controls. The Care Summary and Privacy captures confirm a persistent Close row followed by a separate back/header row, reducing useful vertical space and weakening hierarchy.
- `ScreenBackdrop` uses a fixed 620px gradient height for non-stretch screens. The relationship between colour transition and content can move on tall devices or with large text.
- Two-column layouts in Home, To Do and People depend on percentages/fixed card widths. Current captures already show ellipsised category labels, dates, member roles and contact names at ordinary text size.
- Footer-owning forms generally use the shared keyboard-aware shell, a strength. Physical verification is still required for short Android devices and large text.
- Many screens independently restate 24px page padding, 16px card padding and 52-76px row heights. The values are mostly coherent, but ownership is unclear.

## F. Colour findings

- The warm neutral and burgundy foundation is strong and should remain.
- The bright `#2E7DF5` cog plus glow is the clearest one-off colour. It attracts more attention than Add, titles and content on every tab.
- The Phase 22 brief protects a richer blue To Do direction, but `tabAccent.todo` is currently `#62764F` with `#DCE2C8`. The screenshots confirm a strongly sage/olive surface. **APPROVED-REFERENCE REVIEW REQUIRED:** compare it with the approved To Do reference before changing any token.
- Semantic success, warning and danger colours are generally used honestly. Success messages often use soft/default text rather than the success token, which weakens state recognition.
- Disabled primary buttons are understandable but can become low-contrast; check both platforms physically.
- Modal backdrop opacities vary from 0.28 to 0.40. A small role-based overlay token could make depth more consistent.

## G. Card/tile findings

- The app has sensible card roles: elevated daily-use tiles, flat outlined administrative rows, tonal callouts and modal surfaces. Do not turn every section into a card.
- Radius usage is mostly consistent, but `ChoiceTile` uses a local 30px radius and several screen-specific controls override shared values.
- Care Circle cards lack enough visual grouping for the amount of content they contain, while the screenshot shows the primary CTA disappearing under bottom navigation. Settings menu cards are individually polished, but their repeated elevation and height create a long, heavy drawer.
- Subscription's price and status cards do not establish enough difference between offer, entitlement and legal detail.
- Calendar's white month card and event rows are a strong reference for clean hierarchy.

## H. Header/navigation findings

- Primary tab headers are structurally similar but utility controls are not governed by one explicit compact action pattern.
- The Settings cog is oversized and visually dominant relative to nearby actions.
- Drawer subsection screens visibly show a drawer Close bar and their own back/header composition, creating excess chrome and inset depth.
- The bottom navigation is usable, but its minimal dots/line feel less intentional than the content above.
- Preserve the four-tab model and current destinations. No navigation redesign is supported by this audit.

## I. Icon findings

- Plain-View icons are a consistent technique, but there are many independent implementations and stroke widths.
- Chevrons are repeatedly redrawn and sometimes replaced by the text character `>`.
- Category icons are distinctive and broadly consistent; do not replace them wholesale.
- The cog's problem is visual weight/colour more than its recognisability.

## J. Button/CTA findings

- The primary/secondary/light/text hierarchy is good and should be protected.
- Header actions, inline actions and paired actions repeatedly override the full-width 54px button locally. A compact size is needed.
- Side-by-side full buttons in invitation and attachment contexts are vulnerable to longer text and large font scaling.
- Destructive actions alternate between custom outlined rows and native alerts. Their hierarchy is honest but visually inconsistent.
- Text actions such as Edit, Remove, Restore, Share and Manage need a single compact treatment and spacing rule.

## K. Form findings

- `TextField` and `DateTimeWheelField` provide a coherent baseline.
- Record editors can become long administrative stacks. Progressive disclosure is already used in places and should remain selective.
- Account reminder controls use checkbox visuals for switch semantics; this is a conceptual and visual mismatch.
- Validation appears inline but lacks a shared message container or iconography, causing reflow and inconsistent emphasis.
- Paired upload/scan actions and narrow drawer forms require wrap/stack behavior at larger text sizes.
- Keyboard behavior is intentionally engineered through `KeyboardAwareScrollView`; Phase 22 changes must not replace it casually.

## L. Motion/interaction opportunities

- Keep existing restrained press feedback, record-sheet spring, drawer transition and member-card scale-in.
- A subtle state transition for accordion expansion and selected filters could improve comprehension.
- Loading-to-content and successful save/restore states would benefit from a short shared acknowledgement.
- Do not add decorative screen-entry animation or motion to every card.

## M. Empty/loading/error findings

- Startup, Documents, Recent Activity and Subscription expose bare spinners or raw status text.
- Documents, Invitations, Archived Care, Contacts and Wellbeing Updates use plain one-line empty copy without a shared hierarchy or useful next action.
- Errors vary between centred text, inline text, native alerts and quiet messages. Severity is not always visually obvious.
- Home/Calendar/To Do first-use states are better integrated and should guide the shared treatment without being cloned mechanically.
- Read-only and archived states are comparatively strong and should remain distinct from errors.

## N. Accessibility findings

- Core buttons and selection rows usually declare roles, labels and states; minimum touch targets are generally good.
- Two-column cards already truncate at ordinary sizing and will be more fragile with increased text. Six code cells, side-by-side actions and Calendar day cells still need large-text testing.
- Calendar day buttons should announce date plus event count/status, not rely on colour or tiny badges.
- Modal focus trapping/restoration cannot be confirmed from styles. **PHYSICAL/ASSISTIVE REVIEW REQUIRED.**
- Some muted text and disabled controls require physical contrast review on real displays.
- Drawn icons should not carry meaning without accessible labels; most interactive instances do, but a focused audit should verify all rendered branches.

## O. Minimum design-system consolidation opportunities

1. Add a compact size to `Button` instead of local dimensions.
2. Add one shared state block for loading, empty, success and recoverable error presentations.
3. Add one small directional chevron/icon primitive.
4. Add an explicit scroll-ownership/content-shell pattern to prevent double padding.
5. Add a narrowly scoped flat list-row/card primitive only after comparing all current variants.
6. Add overlay opacity and status-message roles to existing tokens.

This is intentionally incremental. A design-system rewrite is not warranted.

## P. Areas that should NOT be touched

- Welcome's three-page architecture, copy and colour-led identity.
- Home's current person/search/header and at-a-glance information architecture.
- Calendar's white month card, thin horizontal key and detailed events below.
- People's supported-person card, Key Contacts and Care Circle hierarchy.
- Relationship multi-select wheel and collapsed selected-person summary behavior.
- Interests carousel behavior and visible directional affordances.
- First Thing's record stack, multi-entry category model and sheet transition.
- Record view-before-edit behavior, swipe/backdrop/Done dismissal and date/time wheel choice.
- The four-tab navigation model and supported-person switching behavior.
- Read-only versus archived semantic distinction.
- Existing product wording, data behavior, permissions and route logic.
- Fraunces wordmark plus system-font body strategy.

Search and To Do are protected conceptually, but the current code conflicts with the brief. Their approved references must be reconciled before they can join this no-touch list at implementation detail level.

## Q. Prioritised recommendation table

| ID | Screen/component | Problem | Recommendation | Priority | Impact | Risk |
|---|---|---|---|---|---|---|
| P22-01 | Search | Current implementation lacks the protected avatar/name, horizontal scope/category controls and scroll affordances. | Compare current build to the approved Search reference and define a fidelity-only correction; preserve focus and Back behavior. | P0 | High | Medium |
| P22-02 | To Do | Current olive/sage palette conflicts with the brief's protected richer blue direction. | Product owner/GPT must confirm the authoritative reference, then limit any correction to approved colour fidelity. | P0 | High | Low |
| P22-03 | Settings cog | Bright blue glow is visually dominant and disconnected from Lilica's palette. | Approve one quieter token-based cog treatment with the same target and behavior. | P0 | High | Low |
| P22-04 | Care Circle / screen shell | The primary Invite CTA is visibly occluded by bottom navigation; double padding and duplicate scroll ownership narrow Care Circle, Invitations, Join and Updates. | Correct bottom inset/tab-bar clearance and establish one content owner per screen without changing workflow. | P0 | High | Medium |
| P22-05 | Settings subsections | Drawer safe area/top bar plus nested Screen/Header can create excess chrome and reduced space. | Define a drawer-content shell that preserves routes and Back behavior while owning insets once. | P1 | High | Medium |
| P22-06 | Shared states | Bare spinners and raw loading/empty/error text make secondary surfaces feel unfinished. | Introduce one restrained state block with message, optional action and semantic tone. | P1 | High | Low |
| P22-07 | Subscription | Purchase and entitlement information lacks premium trust hierarchy. | Produce a mock, then restyle the existing content/actions only; no billing or copy changes. | P1 | High | Medium |
| P22-08 | Typography | Negative tracking and local small sizes reduce coherence and can hide layout pressure. | Test zero tracking and consolidate only repeated semantic roles; do not shrink text to force fit. | P1 | Medium | Medium |
| P22-09 | Home / To Do / People grids | Current captures show truncated category labels, dates, names and roles in two-column cards. | Add responsive content-fit rules using usable width/text scale while preserving approved card architecture. | P1 | High | Medium |
| P22-10 | Care Circle | Long administrative page has weak grouping and narrow content. | After P22-04, refine section spacing and action grouping without changing permissions or workflow. | P1 | High | Medium |
| P22-11 | Button | Compact actions rely on local overrides. | Add and migrate to a shared compact button size in a small controlled batch. | P2 | Medium | Low |
| P22-12 | Chevron/icon use | Repeated hand-drawn variants and text chevrons create small inconsistencies. | Add one directional primitive and migrate only matching uses. | P2 | Medium | Low |
| P22-13 | Calendar | Legend scrolling and dense day metadata can be unclear. | Preserve the approved layout; refine scroll affordance and accessible day summaries. | P2 | Medium | Medium |
| P22-14 | Documents | Plain states and weak expiry/status visibility reduce usefulness. | Apply shared states and a restrained expiry/status treatment using existing semantic colours. | P2 | Medium | Low |
| P22-15 | Account controls | Checkbox visuals represent switch behavior. | Use one accessible toggle treatment consistent with Lilica's selected-state language. | P2 | Medium | Medium |
| P22-16 | Destructive/status feedback | Custom rows, native alerts and message colours vary. | Define visual roles for destructive action, warning, success and recoverable error without changing confirmation logic. | P2 | Medium | Medium |
| P22-17 | Record forms | Paired actions and long forms can crowd under large text/keyboard. | Add responsive stacking and spacing rules around existing controls; retain keyboard infrastructure. | P2 | Medium | Medium |
| P22-18 | Modal/sheet family | Overlay opacity, focus and long-content behavior vary. | Tokenise overlay roles and physically verify focus/keyboard/large-text behavior before any layout changes. | P2 | Medium | Medium |
| P22-19 | Flat list rows/cards | Same visual role is restated in many files. | Consider a narrow `ListRow` primitive after higher-priority corrections; exclude special cards. | P3 | Low | Medium |
| P22-20 | Bottom navigation | Minimal dot/line treatment feels less resolved than tab surfaces. | Explore only a fidelity-preserving polish after primary issues; no navigation restructure. | P3 | Low | Medium |
| P22-21 | Success acknowledgement | Many successful actions resolve with text or immediate navigation only. | Add subtle, brief acknowledgement only where it improves confidence. | P3 | Low | Medium |

## R. Proposed Phase 22B implementation batches

Each batch should be separately approved, implemented, validated and physically checked before the next begins.

### Batch 1 - Authority and high-impact visual corrections

- Correct P22-04 Care Circle CTA occlusion and verify tab-bar clearance across every shell-pushed secondary screen.
- Resolve P22-01 Search reference fidelity.
- Resolve P22-02 To Do colour authority.
- Implement P22-03 Settings cog treatment.
- Requires approved screenshots/mock for Search and To Do before code changes.

### Batch 2 - Layout ownership and responsive foundations

- P22-04 duplicate padding/scroll ownership.
- P22-05 drawer subsection shell.
- P22-09 responsive grids.
- Test small Android, smaller-height iPhone, tall iPhone, keyboard-open and increased text.

### Batch 3 - Shared states and compact actions

- P22-06 state block.
- P22-11 compact button.
- P22-12 chevron primitive.
- Apply to a deliberately limited first set, then expand only after visual approval.

### Batch 4 - Trust and administration surfaces

- P22-07 Subscription, mock required.
- P22-10 Care Circle hierarchy.
- P22-15 Account toggle treatment.
- P22-16 destructive/status roles.

### Batch 5 - Content and form polish

- P22-13 Calendar detail polish.
- P22-14 Documents state/expiry treatment.
- P22-17 record-form responsiveness.
- P22-18 modal/sheet consistency.

### Batch 6 - Optional finishing work

- P22-19 shared list row only if duplication still causes drift.
- P22-20 bottom navigation only with an approved reference.
- P22-21 selective success acknowledgement.

## Required physical review before approval

- Search against the approved Search reference.
- To Do against the approved richer-blue reference; truncation is already visually confirmed.
- Calendar with dense days and a long legend.
- Care Circle and Invitations inside the Settings drawer and when opened above persistent tabs; CTA occlusion is already visually confirmed.
- To Do and People at increased text size.
- Auth and record forms with keyboards open on small Android and iPhone.
- Record sheets/date-time wheels at large text.
- All modal focus/Back behavior with VoiceOver/TalkBack where practical.
- Disabled, muted and gradient text contrast on real displays.

## Screenshot-confirmed observations

- Welcome's hierarchy, imagery, colour and CTA balance are genuinely strong and deserve protection.
- Home is attractive and clear at first glance, but its two-column content cards and horizontal summary strip lose complete labels in a normal populated state.
- Calendar retains the approved white-card hierarchy; the horizontal key visibly clips content and the month card delays the agenda on shorter screens.
- To Do's current implementation is unmistakably sage/olive, not blue, and the fixed two-column cards visibly ellipsise dates and category names.
- People has strong colour and grouping, but fixed-width contact/member elements truncate ordinary real data.
- The Settings menu itself is polished; the weaker experience begins after entering a subsection, where Close/back/title layers stack.
- Care Circle has the most serious observed defect: its primary Invite CTA sits beneath the persistent bottom navigation.
- How to use is readable but behaves like a long wall of large cards and copy rather than a quickly scannable help surface.
- The lower-left cog in all supplied images is excluded as an external overlay because it appears on routes where no such app control exists in source.

## Audit boundary confirmation

- Application code changed: **NO**.
- Navigation, data, migrations, RPCs or product behavior changed: **NO**.
- Commit or push performed: **NO**.
- Phase 22B started: **NO**.
- Recommendations approved by this document: **NO**.
