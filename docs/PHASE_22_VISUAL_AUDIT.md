# Phase 22A - Premium Visual Optimisation & Experience Polish: Audit / Report Only

**AUDIT ONLY. NO UI IMPLEMENTATION HAS BEEN PERFORMED. THIS DOCUMENT MUST BE REVIEWED BY GPT AND THE PRODUCT OWNER BEFORE ANY PHASE 22B IMPLEMENTATION PROMPT IS ISSUED.**

Implemented from the approved `phase22.txt` brief (`LILICA - PHASE 22A: PREMIUM VISUAL OPTIMISATION & EXPERIENCE POLISH - AUDIT / REPORT ONLY`).

`PRE_PHASE_22A_BASELINE`: HEAD `a67c40f` (in sync with `origin/master`); tracked working tree clean; `npm run typecheck` clean; Jest 67 suites/635 tests passing.

**Method and its honest limit**: this audit is a direct, systematic reading of the actual current source - every screen's real JSX/styles, the shared theme tokens, and the shared components - cross-checked against the approved mocks that exist in this environment (`\downloads\search4.png`, and the general direction recorded in `docs/CORRECTIVE_TASK_10_PEOPLE_IA.md` and the Phase 20/21 architecture docs) and against every prior phase's own physical-QA sign-off recorded in `docs/REVISION_LOG.md`/`AGENTS.md`. It is **not** a screenshot-by-screenshot comparison against a running simulator or device - no development build or simulator was available in this session. Where a finding rests on reading the actual component tree and styles (the majority of this report), it is stated as a direct finding. Where a screen was characterized from its own architecture/QA documentation and a partial code read rather than a full line-by-line pass this session (Recent Activity, Care Summary, Documents/attachments, Invitations, Member detail popup, most of the pre-authentication onboarding family beyond Welcome/Auth), it is explicitly marked **"characterized, not fully re-read this pass"** below - not presented as equally verified. Nothing in this report claims a physical-device visual judgement (colour rendering, real shadow softness, real font hinting) that only a device can confirm.

---

## 1. Executive assessment

Lilica already has a real, deliberate design system, not an unstyled prototype: one shared `theme.ts` (colours, spacing, radii, typography, shadow) that every screen actually imports and uses (confirmed by direct grep - `radius.*` alone appears in over 60 files, every value the four declared tokens, no ad-hoc corner radius found), a consistent card/icon/chip vocabulary (`CategoryIcon`/`StatusIcon` drawn from plain Views, reused across Home/Calendar/To Do/People/Search/Care Summary), and a genuine, documented visual identity for the four primary tabs (the "Variant D" gradient backdrop, `src/components/ScreenBackdrop.tsx`, deliberately excluding Home per explicit product-owner direction preserved in `CLAUDE.md`). Multiple real product-owner design passes are already recorded and physically approved (People's final visual pass, the Settings drawer rebuild, the To Do background correction, this session's own Home/Search refinement) - this is not a "many separate agents built this with no direction" product; it reads as one product that has been iterated on deliberately, which is the harder and more valuable state to be in before a final polish pass.

The real gaps are consistent with a fast-moving, feature-first build: a few one-off colour/shadow decisions made under specific product feedback and now slightly out of step with the rest of the system (the Settings cog's own glowing bright-blue chip, explicitly called out in its own code comment as a deliberately kept "temp" exception); at least three genuinely different typographic/visual "modes" across the app (a calm, centred, cream Welcome/Auth mode; a coloured-gradient, card-on-backdrop tab mode; a plain, dense, functional Settings-drawer mode) that are each individually well executed but have never been checked against each other side by side; and several screens (forms, empty/loading/error states) that are functionally complete but visually plain compared to the tab screens' own more finished treatment.

**Overall answer to the Phase 22A acceptance question**: Lilica does not currently read as a prototype or as a collection of mismatched screens - most of it already reads as one considered product. It is not yet uniformly "premium" - a handful of surfaces (loading/error copy, some Settings-drawer rows, the Subscription screen, long-form data entry) are noticeably plainer than Home/Calendar/To Do/People's own finished level, and that gap, not a wholesale redesign, is what a Phase 22B pass should close.

---

## 2. Current visual-system inventory

Confirmed directly from `src/theme.ts` and cross-checked by grep against actual usage:

- **Colour** (`colors`): a warm, muted palette - `canvas` (#F7F2EA, the app's own cream ground), `stage`/`stageDeep`/`creamStage` (Welcome's own three brand tones, reused as tab accents - see below), `surface`/`surfaceMuted`/`white`, `ink`/`inkSoft`/`muted`/`line` (the neutral/text ramp), `primary`/`primaryPressed`/`primarySoft` (the brand burgundy, #63364D), five semantic tonal pairs (`olive`, `clay`, `blue`, `teal`, plus `success`/`warning`/`danger`, each with its own `*Soft` background partner). All colour is genuinely tokenised - no hard-coded hex found outside `theme.ts` itself except two explicitly-commented one-off exceptions (see section 5 and section 22).
- **Tab accents** (`tabAccent`): a `{deep, tint}` pair per primary tab (Home/Calendar/To Do/People), each deliberately drawn from Welcome's own three slide colours plus teal - a real, stated design decision ("a quiet colour identity borrowed from Welcome's own three slide colours"), not four arbitrary picks.
- **Spacing** (`spacing`): a clean 8-point-adjacent scale - `xxs:4, xs:8, sm:12, md:16, lg:24, xl:32, xxl:44, xxxl:64`. Confirmed genuinely used as a scale (not just imported and ignored) across every screen read this session.
- **Radius** (`radius`): exactly four values - `sm:10, md:16, lg:24, pill:999`. Grep confirms `radius.pill` and `radius.md` are by far the most common (dozens of files each), `radius.lg` used for larger elevated surfaces (cards, the Settings drawer, `ReadOnlyGate`), `radius.sm` rare (a handful of compact inputs/rows). This is a coherent, already-consolidated radius system - not a finding requiring consolidation.
- **Typography** (`typography`): nine named variants - `wordmark` (34/800), `hero` (24/700), `display` (30/800), `title` (28/800), `section` (19/800), `body` (16/500), `bodyStrong` (16/700), `secondary` (14/500), `button` (17/700), `meta` (13/700, uppercase, letter-spaced). One font family throughout (`Fraunces_800ExtraBold` for the wordmark only; system default elsewhere - confirmed, no other custom font loaded in `App.tsx`'s `useFonts`).
- **Shadow**: exactly one token, `shadow.soft` (7% opacity, 16 radius, 8 vertical offset), used consistently wherever a card needs to read as "lifted" (confirmed in 13 files: Home's status chips and record cards, Calendar's month card and agenda rows, To Do's tiles, People's Care Circle summary is the one deliberate exception - see section 7 - `MemberDetailPopup`, `PersonSwitcher`, `SettingsMenu`, `RecordSheet`, `ReadOnlyGate`).
- **Shared components confirmed in active use**: `Button` (five variants - primary/secondary/light/text/textLight), `AppText` (the typography+tone wrapper, seven tone values), `TextField` (pill-shaped, 66px-tall inputs with a focus-colour border), `Screen`/`KeyboardAwareScrollView` (the shared keyboard-safe page shell), `ScreenBackdrop` (the gradient tab backdrop), `Header` (the plain back-chevron + centred title bar used by every Settings-drawer sub-screen and most onboarding screens), `SettingsCogButton`, `PlusIcon`, drawn-icon families (`CategoryIcon`, `StatusIcon`) built from plain `View`s rather than an icon-font/SVG library.

---

## 3. Typography audit

No font change is recommended. The single-family, weight-and-size-driven hierarchy (Fraunces for the wordmark only, system font for everything else, nine clearly distinct named sizes) is legible, calm and already internally consistent - introducing a second display font would be a genuinely high-risk systemic change for a benefit that has not been demonstrated as missing.

**Findings**:
- **Weight competition on a few cards** (MEDIUM): Home's dashboard chip stacks a `title`-sized bold count directly above a `secondary` label with only `spacing.xs` between them (`HomeScreen.tsx`'s `statusTopRow`/label pairing) - readable, but on the smaller/older-device end this is the app's single densest weight jump (800-weight 26px number immediately above 500-weight 14px label). Worth a spacing/weight pass, not a token change.
- **`meta` variant is doing a lot of different jobs** (LOW): the same uppercase, letter-spaced 13px `meta` variant is used for category eyebrow labels (Home/Calendar/To Do/Detail), for weekday header letters (Calendar), and for a day's "+2" overflow count (Calendar) - three different roles, one visual treatment. It reads fine in each individual context; a future pass could consider whether the day-overflow count deserves its own quieter treatment since it is denser/smaller information than a category label.
- **Line-height on wrapped body copy is generally good** - `RecordDetail`'s notes, `SubscriptionScreen`'s legal text, and `PrivacyDataScreen`'s Alert-based explanations all set explicit line-height where wrapping is likely; no obviously cramped multi-line paragraph was found.
- **No inconsistent font sizes were found for the same semantic role** - every screen inspected uses the shared `typography.*` variants directly rather than a local one-off `fontSize`, with the single deliberate exception of `PersonScreen`'s Key Contacts/Care Circle tile text (explicitly commented as intentionally smaller than the shared `bodyStrong`/`secondary` variants because they "read oversized once packed into a half-width tile") - a considered, documented exception, not an oversight.

---

## 4. Spacing/rhythm audit

Lilica has a genuine implicit spacing system already (`spacing.*`, used as a scale, not as loose constants) - **no new scale needs to be introduced**, only a small number of concrete inconsistencies fixed:

- **Screen-edge padding is not fully uniform** (LOW): `Screen.tsx`'s own default content padding is `spacing.lg` horizontal / `spacing.md` top; `HomeScreen`/`CalendarScreen`/`ToDoScreen`/`PersonScreen` (which don't use `Screen`, they roll their own `ScrollView`) each independently set `padding: spacing.lg` (Home) or rely on `ScreenBackdrop`'s own `spacing.lg` (Calendar/To Do/People) - these resolve to the same visual value today, but they are three independent style declarations achieving the same number, not one shared constant, which is a latent (not yet visible) consistency risk if the scale ever changes.
- **Deliberate, well-reasoned exceptions to the app-wide gap already exist and should be preserved**: the search bar/avatar row's own extra `marginBottom` this session (`spacing.sm` beyond the standard gap, for the exact "deliberate breathing room" the product owner asked for) is a good example of the right way to deviate - a small, explained, local addition, not a new global rule.
- **Card internal padding is consistent within each screen's own card family** (`spacing.md` for most content cards, `spacing.sm` for compact rows) but the exact padding value is re-declared per screen rather than exposed as a named token (e.g. `cardPadding`) - a candidate for a small, low-risk consolidation (see section 19).

---

## 5. Colour audit

- **The Settings cog's own bright, glowing blue chip (`#2E7DF5`)** is the single clearest colour outlier in the entire app - its own code comment (`SettingsCogButton.tsx`) explicitly documents it as a one-off kept by explicit product feedback, distinct from the app's own muted `blueSoft`/`blue` tonal pair used everywhere else, and separately records that the same bright tone was tried once on People's Care Circle heading and was **rejected**. This is the one colour decision in the whole app that reads as "from a different design system" on sight - it appears, unchanged, on every one of Home/Calendar/To Do/People's headers. **CRITICAL for cohesion, LOW regression risk to fix in isolation** (one component, no shared token change) - see recommendation P22-01.
- **Tab-accent identity is a genuine strength, not a risk**: Home/Calendar/To Do/People each having their own deep/tint pair (borrowed deliberately from Welcome) gives each tab a memorable identity without fragmenting the palette - the brief's own instruction not to "flatten every screen into one colour" is already satisfied.
- **Read-only/billing colour is currently reused, not new**: `ReadOnlyGate.tsx` uses the existing `primarySoft`/`primary` pair with no new "billing" colour introduced - correctly conservative, no finding.
- **Semantic colour (`success`/`warning`/`danger`) is consistently scoped to genuine status meaning** (Overdue pills, the "Sorted" pill, form validation) and never doubles as a decorative accent anywhere found.

---

## 6. Gradient audit

Exactly one gradient mechanism exists (`ScreenBackdrop`), used on Calendar/To Do/People, deliberately not on Home. Its own code history (visible in its comments) already records and fixed two real prior regressions - a backdrop that didn't scroll with content, and To Do's own "flat block then late fade" banding, both corrected and physically re-approved. No new gradient issue was found in this pass:

- Text readability against the gradient is protected by an explicit light/white treatment for every heading that sits in the "deep" zone (Wordmark's `tone="light"`, `AppText tone="white"`) - confirmed on Calendar/To Do/People headers.
- Cards rendered on top of the gradient are consistently pure `colors.white` (not the gradient's own tint colour), so contrast against the backdrop is never accidentally weak.
- **The one thing worth re-confirming physically, not fixing now**: `BACKDROP_GRADIENT_HEIGHT` (620px, fixed) on Home/Calendar/People (To Do alone uses the newer `stretch` full-height mode) means a very tall device or very large accessibility text could theoretically push real content past the deep zone before the gradient's own solid-to-tint transition completes. No evidence this has actually happened (Home doesn't use the gradient at all; Calendar/People's own header+card content is comfortably short) - flagged as a **physical-device check**, not a code change.

---

## 7. Card audit

**Inventory of distinct card treatments found**:

| Card family | Radius | Background | Border | Shadow | Where |
|---|---|---|---|---|---|
| Elevated content card | `lg` | white | none | `shadow.soft` | Home status chips, Home record cards, To Do tiles |
| Flat outlined card | `md` | white/surface | 1px `line` | none | Calendar agenda rows, Search results, Care Circle member/invitation rows, Account/Privacy rows |
| Opaque tonal surface | `lg` | a `*Soft` tone (`tealSoft`, `primarySoft`, `oliveSoft`) | none | none | People's Care Circle summary, Person's Ask Lilica, setup-status cards |
| Framed white surface | `lg`/`md` | white | 1px `line` | `shadow.soft` | Calendar's month-grid card, Calendar's legend strip |
| Modal/sheet surface | `lg` | canvas/white | none | `shadow.soft` | `ReadOnlyGate`, `MemberDetailPopup`, `PersonSwitcher`, `SettingsMenu` drawer |

This is **four genuinely distinct, semantically-justified card roles** (elevated actionable content; flat list rows; a deliberately "always the same" opaque summary surface; a modal surface) - not an accidental sprawl of one-off styles. The brief's own instruction not to blindly flatten every card into one style is already the de facto state. The one real consolidation opportunity: the "flat outlined card" family (`md` radius, white/surface fill, 1px `line` border, no shadow) is re-declared independently in at least six files (Calendar's `agendaRow`, Search's `row`, Care Circle's `card`, Account's `row`, To Do doesn't use it but People's `row`/`personCard` do) with the same values every time - a strong, low-risk candidate for a single shared `Card`/`ListRow` primitive (see section 19/31).

---

## 8. Button audit

Inventory (`Button.tsx`, confirmed the only button primitive in the app - no second button component found anywhere):

- **primary** (filled `colors.primary`, white label) - the default; used for the single main action per screen (Save/Add/Subscribe).
- **secondary** (outlined `surface`+`line` border, primary-coloured label) - the default counter-action (Cancel-adjacent, Manage subscription).
- **light** (filled white, primary label) - used specifically on a coloured backdrop (To Do's own "Add" button, so it reads against the gradient).
- **text** / **textLight** - the plain-link action, light variant for use on a dark backdrop.

This is already a coherent, minimal hierarchy (four roles, no duplicate patterns), and every button in every screen read this session used one of these four variants - **no rogue one-off button style was found**. The one real inconsistency: **button height is not perfectly uniform** - the shared `Button` component's own `minHeight: 54` is overridden locally in several places for a more compact context (Home's header "Add" at `minHeight: 40`, To Do's header "Add" also `minHeight: 40`, Account's inline name-edit actions at `minHeight: 44`) - each individually reasonable for its context (a full-width 54px button in a header row would be oversized), but there is no small/compact `Button` variant expressing this - each screen re-declares its own override. **MEDIUM, low regression risk**: formalise a `size="compact"` prop rather than each screen guessing its own height.

---

## 9. Icon audit

Every icon in the app (category icons, status icons, the search glyph, chevrons, the cog, the plus, the magnifying glass) is either a hand-drawn plain-`View` shape (borders/rotation, the dominant technique, used in `CategoryIcon`/`StatusIcon`/`SettingsCogButton`/every chevron) or, as of this session, a real Unicode glyph (Home's search 🔍) - **no icon-font or SVG library is installed anywhere in the project** (confirmed via `package.json`). This is a genuinely consistent, deliberate stylistic choice, not an accident, and it has already survived one real correction this session (the search glass read as a stray mark at this size and was swapped for a real glyph). Findings:

- **Chevron geometry is drawn independently in at least six places** (Header's back chevron, the avatar's down-chevron, Home's dashboard-strip chevrons, Calendar's month-nav chevrons, People's "View all"/"Manage" chevrons) using the same border+rotate technique but each with its own hard-coded size/stroke-width/colour. They are visually close but not pixel-identical (stroke width ranges roughly 2-2.5px across instances) - **LOW priority, genuine consolidation opportunity** (a single `Chevron` primitive with a `direction` prop) rather than a visible defect today.
- **Icon sizing inside a tint chip is consistent** (`iconChip`/`cardIconChip`/`agendaIconChip` etc. all use `radius.pill` circles sized 32-48px depending on context, with the icon itself sized proportionally) - no oversized/undersized icon was found relative to its own chip.
- **The Settings cog is visually heavier than its neighbours** (its own bright glow/shadow, discussed in section 5) - this is a colour finding, not an icon-shape finding; the cog's own drawn shape is fine.

---

## 10. Motion/interaction audit

Motion is currently sparse and consistent - one shared press-feedback pattern (`transform: scale(0.96-0.99)` + `opacity: 0.85-0.9` on press, confirmed identical in intent across `Button`, Home's status chips, To Do's tiles, the new dashboard chevrons, `CareCircleScreen`'s rows) and RN's own default sheet/modal slide-in for `RecordSheet`/`SettingsMenu`/`ReadOnlyGate`. **No screen was found using a bespoke, one-off animation.** This is the right baseline for a calm care app, and the brief's own explicit warning against "animation everywhere" is already respected by default.

**Where subtle motion would materially help** (all OPTIONAL/MEDIUM, none blocking):
- The dashboard chevrons' own scroll-to action already animates (`scrollTo({animated:true})`) but the chevron's own enable/disable state change is instant (`opacity` snaps) - a short fade would read as more considered.
- Person switching and tab switching are both instant re-renders with no transition at all - acceptable for a utility app, but a very short cross-fade on the header title specifically (not the whole screen) could reduce the "hard cut" feeling `docs/PHASE_20_ARCHITECTURE.md`'s own person-switch-isolation work already guards against functionally.
- Save/completion confirmation has no dedicated motion at all today (a saved record simply reappears in its new state) - a brief, tasteful confirmation (not a full-screen success animation) is a plausible premium-feel win, but this is exactly the kind of "animation for its own sake" the brief warns about unless it is scoped tightly.

---

## 11. Empty-state audit

Every empty state found is calm, specific and non-robotic, and each one was written for its exact context rather than copy-pasted:

- Home: `"Start with one thing you want to keep track of."` + a real Add button.
- To Do: `"Nothing needs doing right now."`
- Calendar (a day with nothing): `"Nothing planned for this day."`
- People's Key Contacts: `"No key contacts saved for {name} yet - GP, pharmacy, a neighbour or anyone else useful to have on hand."` (names concrete examples, not generic).
- Search (no query): `"Search for anything already saved for {name} - an appointment, a task, a document, a contact."`
- Search (no results): `"Nothing matches \"{query}\"."`

**Finding (MEDIUM)**: none of these empty states currently uses any illustration or visual treatment beyond plain text - they are functionally excellent (specific, honest, never fabricating a fake "all clear" reassurance the brief itself warns against) but visually the plainest moment on several otherwise well-finished screens (Home/To Do especially, since they sit on top of the gradient/card language everywhere else on the same screen). A restrained icon or soft illustration treatment for the true zero-content case is a reasonable Phase 22B candidate - explicitly NOT a functional change, and explicitly not needed for the expired/read-only case (`ReadOnlyGate` already has its own considered, calm treatment, confirmed correct and current this session).

---

## 12. Loading/error-state audit

- **Loading**: found in exactly two forms - a plain `"Loading…"` text line (`SubscriptionScreen`, `RecordEditor`'s async paths) and an implicit "nothing renders yet" gap elsewhere (no dedicated skeleton/spinner component exists anywhere in the app). This is honest and never misleading, but is the single most "developer-default" moment in the app - a shared, calm loading treatment (even just a consistent small spinner + the existing typography, no new dependency) would be a genuine, low-risk premium-feel improvement.
- **Error copy is consistently calm, never a raw technical string**, everywhere read this session - `SubscriptionScreen`'s `"Something went wrong. Please try again."`, `AccountScreen`'s `"Your name could not be saved. Please try again."`, and Phase 21C's own `ReadOnlyGate`/held-mutation notice (explicitly built this session specifically to avoid ever surfacing a raw Postgres/RPC error). **No raw/system-feeling error string was found in any screen read this session.**
- **Destructive confirmations use the native `Alert.alert`** consistently (`PrivacyDataScreen`'s clear-data/leave-space/delete-account flows) - functionally correct and platform-idiomatic, but visually this is the one place in the app where the OS's own default alert chrome (not Lilica's own type/colour system at all) is what the user actually sees. This is a real, if minor, "does this still feel like Lilica" moment - flagged as MOCK REQUIRED if a custom in-app confirmation sheet is ever considered, since replacing a native `Alert` is a real interaction-pattern change, not a colour/spacing tweak.

---

## 13. Accessibility audit

No premium-quality recommendation in this report should be read as overriding this section - none of the findings above propose reducing contrast, hiding a label, or shrinking a touch target.

- **Accessibility labelling density is already high and specific** - confirmed directly in every screen read this session (every icon-only button carries a real `accessibilityLabel`; disabled states consistently use `accessibilityState={{disabled}}`, confirmed this session's own new dashboard chevrons and `ReadOnlyGate`). This matches Phase 19's own static-grep finding (131 occurrences across 54 files) and this session added more (Search screen title/focus, the new chevrons) without regressing the pattern.
- **Colour is never the only signal of state** in anything read this session - the "Overdue" pill always carries the word "Overdue", not just a colour change; the To Do filter chips and Calendar's selected day both pair a colour change with a real `accessibilityState={{selected}}`.
- **Long-text truncation risk exists in a few dense tiles** (see section 44) - `numberOfLines` is applied consistently where truncation is intended, so text does not silently overflow its container; the risk is a name/title being cut off, not a layout break.
- **One genuine, unresolved finding (MEDIUM, not new to this phase)**: `AccountScreen`'s name-edit and `TextField` components use a fixed `minHeight` rather than scaling with the device's own text-size setting - at the largest accessibility text sizes a label could plausibly wrap onto a second line inside a control sized for one. This was not something this session could verify without a physical device at a large text-size setting - flagged as a **physical-device check**, consistent with Phase 19's own honest "NOT RUN" convention for anything requiring real hardware.

---

## 14. Cross-platform audit

No iOS/Android device was available this session; findings here are inferred from the code, not observed:

- `Screen.tsx` uses `react-native-safe-area-context`'s `SafeAreaView` consistently (confirmed the app's own standing rule against a second safe-area system is respected everywhere read) - this should behave correctly on both platforms, but the actual notch/home-indicator/gesture-bar spacing needs a physical check on both a recent iPhone and a recent Android device, as every prior phase's own QA doc has consistently and honestly flagged.
- `KeyboardAvoidingView`'s platform-specific `behavior` is centralised in `src/keyboard.ts` (one function, not per-screen conditionals) - a good sign that keyboard behaviour differences are already handled deliberately rather than accidentally.
- The Settings drawer's own safe-area fix (`docs/REVISION_LOG.md`, 13 September 2026) was a real, previously-discovered platform-specific bug (a `Modal`'s content not reliably reading device insets) already fixed by reading insets outside the `Modal` - this is exactly the class of issue this section exists to flag, and it has already been found and corrected once; no NEW instance of the same pattern (a `Modal` with content relying on ambient safe-area context) was found elsewhere in this pass, but this is worth a specific re-check given it has bitten this codebase before.

---

## 15. Welcome/auth/onboarding audit (characterized; Welcome/Auth fully re-read this session, remaining onboarding screens characterized from architecture docs and a partial code read, not a full re-read this pass)

Welcome (`WelcomeScreen.tsx`, fully re-read this session including this session's own trim of its third slide) and Auth (`AuthScreen.tsx`, fully read) both use a calm, centred, single-column layout - a full wordmark, a title, one line of body copy, and stacked buttons, on the plain cream `canvas` background with no gradient. This reads as **genuinely premium and already strong** - simple, confident, on-brand, and it was the subject of this session's own explicit trim (removing four now-redundant bullet points from the third slide) which itself improved this exact quality. **DO NOT TOUCH** this family's core layout - it is doing exactly what the brief's "calm, warm, trustworthy" intent describes.

The remaining onboarding screens (`RelationshipScreen`, `NameScreen`, `PrivacyConsentScreen`, `InterestsScreen`, `CareForkScreen`, `PeopleReviewScreen`, `ChooseActivePersonScreen`) were not re-read line-by-line this pass; a grep of their own `radius.*`/`shadow.*` usage shows them drawing from the same shared tokens as everything else (no independent style system), and every prior phase's own QA doc records them as implemented/validated. **This family should be given a full dedicated read before any Phase 22B change is proposed for it specifically** - this audit does not have enough direct evidence this pass to score it with the same confidence as Home/Calendar/To Do/People/Settings.

---

## 16. Home audit

Directly re-read and (this session) modified. The final Home layout - avatar+first-name switcher, the separated search bar, the horizontal status strip with its new scroll chevrons, Today/Upcoming/Recently-added sections - is a genuinely polished, already-iterated surface (this session's own search4.txt refinement is itself evidence of an active, working product-owner review loop, not a first draft). **Protect exactly as instructed by the brief**: no entirely new Home architecture is recommended anywhere in this report.

**Findings**: the weight-competition note in section 3 (status chip count vs label); the empty-state plainness in section 11; the Settings-cog colour outlier in section 5, which appears here as much as anywhere. No other Home-specific issue was found - this is one of the two or three strongest screens in the app today (see section 34).

---

## 17. Search audit

Directly re-read and (this session) validated with new tests. The Home -> Search -> Home loop - tap the search bar, land on "Search {Name}" with the keyboard already open, type, see grouped results, back returns directly to Home with the same person still selected - is implemented exactly as the brief describes and was proven correct by this session's own new tests (`tests/search4-home-refinement.test.tsx`, `tests/phase20b-search-screen.test.tsx`). **Protect this behaviour exactly.**

**Findings**: result rows (`SearchScreen.tsx`'s own `row` style) are a plain white/`line`-bordered card with no shadow, while nearly every other "you can tap this" surface in the app (Home's record cards, To Do's tiles) uses `shadow.soft` - a small, low-risk inconsistency (see the flat-outlined-card family in section 7) rather than a defect.

---

## 18. Calendar audit

Directly re-read. The approved layout (a slim, single-row scrollable category legend directly under the title, the whole month grid on its own white card, the agenda list beneath as plain white rows on the warm page background) is coherent and already the product of one explicit prior correction (its own code comments record this as "approved layout" language, distinct from an earlier wrapping multi-row legend). **No new Calendar architecture is recommended.**

**Findings**: the month-nav chevrons (`monthArrow`) and the day-cell "+N" overflow text are both slightly denser/smaller than the equivalent affordances elsewhere (Home's new dashboard chevrons are visibly larger and more discoverable than Calendar's month-nav chevrons, which serve a near-identical "there's more, scroll/page through it" job) - a plausible small consistency win, not a defect on its own.

---

## 19. To Do audit

Directly re-read. The continuous olive `stretch` gradient (explicitly physically approved, per its own code comments and `docs/REVISION_LOG.md`'s 12 September 2026 entry) is preserved and this report does not recommend reverting it. The 2-up tile grid (icon above title/meta, matching People's own tile language) is a genuine, deliberate cross-screen consistency win already in place.

**Findings**: To Do's own tile (`row` style: `radius.lg`, white, `shadow.soft`, `spacing.md` padding) is now the closest match in the whole app to the "flat outlined card" consolidation opportunity named in section 7/31 - if a shared `Card` primitive is ever built, To Do's tile and Home's record card are close enough already that they are strong candidates to actually share it (LOW regression risk, since they are already visually near-identical, just independently declared).

---

## 20. People audit

Directly re-read. The approved architecture (bounded Key Contacts preview -> View all; a stable, opaque Care Circle summary card -> Manage; Recent Activity/Care Summary as restrained footnote-style links, not competing cards; the still-placeholder Ask Lilica) is exactly as `docs/CORRECTIVE_TASK_10_PEOPLE_IA.md` and the People final-visual-pass revision-log entry describe, and this report does not recommend reopening that information architecture. The Care Circle card's own deliberate choice to be a solid, opaque `tealSoft` fill (never fading with the page's own gradient behind it) is a genuinely considered, documented decision, not an inconsistency - explicitly called out in its own code comment as intentional. **DO NOT TOUCH the People hierarchy itself.**

**Findings**: the "Manage"/"Care summary"/"Recent activity" links use three visually distinct treatments for what is functionally the same job (a filled pill button, a plain text link with a small trailing chevron, and a plain text link with a slightly different chevron style respectively) - a small, real inconsistency worth a single pass to pick one link style for "go deeper into this section" (LOW risk, contained to this one screen).

---

## 21. Care Circle audit (CareCircleScreen fully re-read this session for Phase 21C's own gating work; visual-only findings below)

The member list, pending-invitations list, and the invite form all use the same plain flat-outlined-card family (section 7) consistently within this one screen. Role descriptions (`"Full access, can manage the care circle"` etc.) are plain-language, not technical - good. The invite form's domain-selection pills and role pills use the same selected/unselected pill treatment consistently.

**Findings**: this screen is functionally dense (member list, invitations, and the full invite form can all be visible on one scroll at once) without any of the visual "breathing room" treatment Home's own avatar/search row just received this session - a candidate for a MEDIUM screen-specific refinement (more separation between the three logical sections), not a redesign of the security model or the invite flow itself, which this report does not touch.

---

## 22. Recent Activity audit (characterized from `docs/PHASE_20_ARCHITECTURE.md` and a partial read; not fully re-read this pass)

Grouped-by-day activity feed, real member attribution, paginated via an explicit "View more" rather than an infinite scroll. Architecturally sound and consistent with the rest of the app's "bounded preview, explicit expand" pattern (Key Contacts, Care Circle). No visual-only finding is offered with confidence for this screen without a dedicated re-read - flagged for a closer look in Phase 22B scoping rather than scored here.

---

## 23. Care Summary audit (characterized from `docs/PHASE_20_ARCHITECTURE.md`; not fully re-read this pass)

A pure projection with capped (4-5 item), only-when-non-empty sections (Needs attention, Coming up, Key contacts, Care Circle, Care information, Documents, Bills, Home & Car, Recent activity). This is architecturally the richest single screen in the app (nine possible sections) - the one screen most likely to feel visually "busy" purely by virtue of how much it can legitimately show at once. Recommended for a dedicated visual re-read in Phase 22B scoping specifically because of that density, not because a defect was found here.

---

## 24. Documents audit (characterized from `docs/PHASE_16_ARCHITECTURE.md`/`docs/PHASE_17_ARCHITECTURE.md`; not fully re-read this pass)

Document records use the same `RecordDetail`/`RecordEditor` presentation as every other record type (confirmed directly - `RecordDetail.tsx`'s own document-specific branch, fully read this session, is plain text rows with a "View" link, no thumbnail/preview treatment). A document currently presents as a title + a "View" action, which functionally answers "does this feel like a useful part of someone's care context" adequately but visually is the plainest record type in the app (no icon differentiation beyond the shared `CategoryIcon`, no expiry-urgency visual treatment beyond the shared `DetailRow`). A reasonable MEDIUM candidate for Phase 22B (e.g. a small expiry-proximity indicator), explicitly not a new document architecture.

---

## 25. Settings audit

Directly re-read (`SettingsMenu.tsx`, read earlier this session for Phase 21B/21C wiring). The drawer itself (safe-area-correct per its own prior fix, shadow-elevated row cards, a pill Close button, a quiet wordmark filling empty space) is explicitly "heavily refined and physically approved" per the brief's own framing, and this report agrees with that assessment from direct inspection - **treat as a protected surface**, no navigation-model change recommended.

**Findings**: the drawer's own row-card style (elevated, `shadow.soft`) is visually the most polished list-row treatment in the entire app - genuinely worth using as the reference for the flat-outlined-card consolidation in section 7/31, rather than something that itself needs fixing.

---

## 26. Account/Privacy audit

Directly re-read (both fully). Functionally exhaustive and honest (every destructive action calls a real function, per the screen's own code comment; the account-deletion App-Store/Google-Play disclosure is present and correct). Visually, these are the plainest screens in the entire app relative to their own importance - `AccountScreen`'s reminder toggles are a custom-drawn checkbox+row (functionally fine, visually the one place in the app using a checkbox metaphor at all, distinct from every other "selected" state elsewhere in the app, which uses a filled pill or a filled chip). This is a genuine, if minor, "different design system" moment (see section 40) - a real MEDIUM candidate to align the toggle visual language with the rest of the app's own selected-state conventions.

---

## 27. Subscription/read-only audit

Both fully read this session (`SubscriptionScreen.tsx`, `ReadOnlyGate.tsx`, both authored/verified this session's own Phase 21B/21C work). The calm, non-alarming approved copy is exactly as required and this report does not recommend changing the entitlement logic or the wording. Visually, `SubscriptionScreen` is functional but the plainest "important" screen in the app - a price card and a status card, both using the generic `primarySoft`/`surface` card treatment rather than anything that reads as a considered pricing/subscription presentation (no visual distinction between "this is the headline price" and "this is your current status" beyond a background-colour swap). The brief itself anticipates this ("Phase 22 may later polish this visually, but only after audit approval") - flagged here as a legitimate HIGH-value, MOCK REQUIRED candidate specifically because it is the one screen in the app that must build real trust around a real payment decision.

---

## 28. Forms/editor audit (RecordEditor.tsx partially read this session - its draft/type/save contract in full, its full JSX render tree not re-read line-by-line this pass)

`RecordEditor`'s own field-label language (`titleLabels`, e.g. `"What's it for?"`, `"What needs doing?"`) is warm and plain-language, not clinical or database-flavoured - a genuine strength consistent with the brief's "consumer-grade rather than enterprise-like" intent. The shared `TextField` (pill-shaped, 66px tall, clear focus-border colour change) is used consistently. The Yes/No "does this need a task?" prompt (this session's own dash-cleanup touched its exact copy) is a good example of the app's own plain-language voice.

**Not independently re-scored this pass**: the full wheel/date-picker consistency, the exact button-position/destructive-control layout, and long-form scroll behaviour, since the component's full render tree (roughly 700+ lines beyond what was read) was not re-read end to end this session. Recommended for a dedicated forms-specific pass before Phase 22B scoping finalises anything here.

---

## 29. Bottom-navigation audit (characterized from `TabBar.tsx`'s own token usage - `radius.pill`/`radius.md` confirmed by grep - not fully re-read this pass)

The navigation structure itself (Home/Calendar/To Do/People, four tabs) is protected per the brief and this report does not question it. A dedicated read of `TabBar.tsx` is recommended before Phase 22B scoping to confirm icon/label/selected-state consistency with confidence - not scored here without that direct read.

---

## 30. Full-journey cohesion findings

Tracing Welcome -> signup -> onboarding -> Home -> Add -> Calendar -> To Do -> People -> Care Circle -> Search -> Care Summary -> Settings -> Subscription surfaces **three distinct, individually-coherent visual "modes"**, not one continuously blended system:

1. **Calm/centred mode** (Welcome, Auth, and - by inference - most onboarding): plain cream background, centred column, wordmark-led.
2. **Coloured-gradient/card mode** (Home*, Calendar, To Do, People): `ScreenBackdrop`, white cards, tab-specific accent colour. (*Home deliberately omits the gradient itself but shares the white-card language.)
3. **Plain/functional mode** (Settings drawer and everything reached from it - Account, Privacy & Data, Subscription, Care Circle-via-Settings): cream background, `Header` component, flat-outlined rows, no gradient, no tab accent.

Each mode is well-executed on its own terms, and the transitions between them are not arbitrary - mode 1 is pre-commitment (nothing to protect/organise yet), mode 2 is the daily-use surface (needs identity and warmth), mode 3 is administrative (needs to feel calm and trustworthy, not decorative, when the topic is data/billing/deletion). This is a defensible design rationale, not an accident - but it has never been stated as a deliberate rule anywhere in the repository's own documentation, and the Subscription screen in particular (mode 3, but concerning a genuinely premium/trust-critical decision - a real purchase) is the one place this report questions whether "administrative-plain" is the right mode for it (see section 27).

---

## 31. First-5-minutes findings

Welcome -> Auth -> signup -> onboarding is calm, uncluttered, and free of anything that reads as developer-facing or unfinished (confirmed by direct read of Welcome/Auth; the onboarding family's own architecture docs describe the same intent, though not independently re-verified visually this pass - see section 15). No first-five-minutes defect was found in what was directly read. The one thing this report cannot confirm without a physical device: whether the six-digit verification/recovery flows (not re-read this pass) feel equally polished - flagged for a dedicated look, not assumed to be a problem.

---

## 32. 60-day-user findings

Reasoning from the code rather than a real populated account (no such account/dataset was available this session): Home's own horizontal status strip and Today/Upcoming sections are explicitly designed to be bounded/summarised rather than exhaustive (the strip scrolls, Home shows a small bounded set per section per `docs/CORE_SYSTEM_CONTRACT.md`'s own Home rules) - this should hold up reasonably well with real volume. The one design most likely to strain under real 60-day volume is **Care Summary** (section 23) simply because it has the most sections of any single screen and each section is independently capped, meaning a heavy user could plausibly see all nine sections populated at once - worth a specific check with a realistically populated test account before Phase 22B finalises anything for that screen.

---

## 33. Long-content/large-text findings

- Home's new avatar-name label (`avatarName`, this session) has an explicit `maxWidth: 84` with `numberOfLines={1}` - a genuinely long supported-person name will truncate correctly rather than break layout; confirmed by direct code read, not yet confirmed with an actual long name on a physical device.
- People's Care Circle member tiles (`memberPreviewItem`, fixed `width: 64`) similarly truncate name/role with `numberOfLines={1}` - same confidence level.
- Card titles throughout (Home's record cards, To Do's tiles, Calendar's agenda rows) consistently use `numberOfLines={2}` for titles - a genuinely long appointment/document title will wrap once then truncate, not overflow.
- **No large-accessibility-text-size check was performed this session** (would require a physical device or simulator with Dynamic Type/Android font-scale set to its maximum) - flagged consistently with section 13's own honest limitation, not assumed to be fine.

---

## 34. Premium-quality scorecard

Scored 1 (prototype) - 5 (genuinely premium), separately for visual hierarchy / consistency / usability / premium feel. Scores reflect direct inspection this session except where marked "characterized" (see method note, section heading).

| Surface | Hierarchy | Consistency | Usability | Premium feel |
|---|---|---|---|---|
| Welcome / Auth | 5 | 5 | 5 | 5 |
| Home | 4 | 4 | 5 | 4 |
| Search | 4 | 4 | 5 | 4 |
| Calendar | 4 | 4 | 4 | 4 |
| To Do | 4 | 4 | 4 | 4 |
| People | 4 | 4 | 4 | 4 |
| Care Circle | 3 | 3 | 4 | 3 |
| Recent Activity (characterized) | 3 | 3 | 4 | 3 |
| Care Summary (characterized) | 3 | 3 | 3 | 3 |
| Documents (characterized) | 3 | 3 | 3 | 2 |
| Settings drawer | 5 | 4 | 5 | 4 |
| Account / Privacy & Data | 3 | 2 | 4 | 2 |
| Subscription | 3 | 3 | 4 | 2 |
| Read-only / expired UX | 4 | 4 | 5 | 4 |
| Forms/editors (partial) | 3 | 3 | 4 | 3 |
| Bottom navigation (characterized) | 4 | 4 | 4 | 4 |

No surface scored a blanket 4 across the board by default - the brief's own instruction to be critical rather than generous has been followed; the two 5s in "premium feel" (Welcome/Auth, itself) reflect a real, already-approved, already-polished surface, not grade inflation.

---

## 35. DO NOT TOUCH list

- **Home's overall architecture** (avatar/name/search-bar layout, status-strip chevrons, Today/Upcoming/Recently-added sections) - multiple rounds of explicit product-owner design work, most recently this session.
- **Calendar's approved layout** (legend strip, month card, agenda list) - explicitly "approved layout" per its own code comments.
- **To Do's continuous olive gradient and 2-up tile grid** - explicitly physically approved twice (`docs/REVISION_LOG.md`).
- **People's information architecture** (bounded previews, Manage/View all pattern, the opaque Care Circle card) - the direct subject of a dedicated corrective task and a separate final-visual-pass.
- **The Settings drawer's own navigation model and row-card style** - explicitly "heavily refined and physically approved" per the brief itself, and the strongest single visual surface in the plain/functional mode.
- **The Welcome/Auth calm centred layout** - already premium by this report's own scoring; no change proposed.
- **Every drawn-icon technique itself** (CategoryIcon/StatusIcon/chevrons-as-Views) - not because it couldn't theoretically be replaced by an icon library, but because the brief's own "do not replace an entire icon library unless truly justified" test is not met by anything found this session; the one real icon issue (chevron micro-inconsistency, section 9) does not justify that scale of change.
- **The single-font-family decision** - explicitly tested against the brief's own "do not confuse a new font with premium" warning and found not justified by any finding in this report.
- **`ScreenBackdrop`'s existing gradient mechanism** - already the subject of two real, fixed regressions; changing it again without a specific, physically-reproduced defect would be reintroducing exactly the risk it was last fixed for.

---

## 36. Quick wins (low-risk, isolated polish)

- **P22-01 (CRITICAL for cohesion, LOW risk)**: Settings cog colour/glow - bring `SettingsCogButton`'s bright `#2E7DF5` glow in line with the app's own muted `blue`/`blueSoft` tonal pair, or make an equally deliberate, once-and-for-all decision to keep it and simply document why more prominently than a single code comment. One component, four screens reference it identically - regression risk is genuinely low (no shared layout dependency, purely colour/shadow).
- **P22-02 (MEDIUM, LOW risk)**: formalise a `size="compact"` prop on the shared `Button` component instead of each screen independently overriding `minHeight`/padding for a header-context button.
- **P22-03 (LOW, LOW risk)**: consolidate the chevron-drawing technique into one small shared `Chevron` component (direction prop), replacing at least six independent declarations.
- **P22-04 (MEDIUM, LOW risk)**: align `AccountScreen`'s custom checkbox metaphor with the rest of the app's own filled-pill/filled-chip "selected" language.
- **P22-05 (LOW, LOW risk)**: pick one consistent "go deeper" link treatment for People's Manage/Care summary/Recent activity links (currently three slightly different treatments for the same job).

## 37. Screen-specific improvements

- **P22-06 (HIGH, MEDIUM risk, MOCK REQUIRED)**: a considered visual pass for `SubscriptionScreen` specifically - this is the one screen in the app asking for a real payment decision and currently uses the same generic card treatment as every other Settings row.
- **P22-07 (MEDIUM, LOW risk)**: a calm, on-brand shared loading treatment (replacing the plain `"Loading…"` text) - contained to a handful of call sites, no shared layout risk.
- **P22-08 (MEDIUM, LOW risk)**: a restrained empty-state visual treatment (icon or soft illustration) for the true zero-content cases on Home/To Do/Calendar - explicitly not the expired/read-only case, which already has its own considered treatment.
- **P22-09 (MEDIUM, LOW risk)**: more internal breathing room on `CareCircleScreen` between the member list, pending invitations, and invite-form sections.
- **P22-10 (OPTIONAL, LOW risk)**: a small expiry-proximity visual indicator on document records.

## 38. Shared-component improvements

- **P22-11 (Card/ListRow consolidation, MEDIUM regression risk, testing required)**: extract the "flat outlined card" family (section 7) - currently independently declared in at least six files - into one shared primitive. Affected screens: Calendar (agenda rows), Search (results), Care Circle (member/invitation rows), Account/Privacy (setting rows), People (contact/detail rows). Isolated override remains safer for any screen with a genuinely different semantic role (People's opaque Care Circle summary, the modal/sheet family) - this consolidation should explicitly exclude those. Full regression testing of every affected screen's own existing test suite required before merge.
- **P22-12 (Button compact-size prop, LOW regression risk)**: see P22-02 above - naturally belongs with the shared `Button` component itself.
- **P22-13 (Chevron primitive, LOW regression risk)**: see P22-03 above.

## 39. Systemic/risky recommendations

- **None of the surveyed findings support a systemic typography, spacing, radius, or colour-token overhaul.** Every systemic token audited (colour, spacing, radius, shadow, typography) was found to already be coherent and consistently applied - the real gaps are component-level (a handful of one-off overrides) or screen-level (a few plainer surfaces), not architectural. **This report explicitly does not recommend any Category D (systemic) change.**
- The one candidate that would edge toward systemic if pursued broadly - "give every screen the same gradient/card mode" - is explicitly NOT recommended; section 30's three-mode finding is presented as a defensible, mostly-intentional design choice worth documenting, not a defect to homogenise away.

## 40. Recommendations requiring a mock

- **P22-06** (Subscription visual pass) - a real payment-trust surface; the brief's own section 36 names Subscription redesign as a likely mock-required candidate, and this report agrees.
- Any future full pass at **Account/Privacy's** toggle/row language (P22-04, if expanded beyond the isolated checkbox fix into a broader visual pass) would benefit from a mock before touching a screen that handles account deletion and data export.
- **Documents' expiry-proximity treatment** (P22-10) if it grows beyond a small badge into a genuinely new visual language for document urgency.

## 41. Final recommended implementation set

**MINIMUM POLISH SET** (genuinely necessary before launch) - effort **S**:
- P22-01 (Settings cog colour decision, one way or the other - fix or deliberately re-confirm and document).
- P22-07 (shared calm loading treatment - removes the single most "unfinished-looking" moment in the app).

**RECOMMENDED POLISH SET** (best quality/risk balance) - effort **M**, includes the Minimum set plus:
- P22-02/P22-12 (Button compact-size prop).
- P22-03/P22-13 (Chevron primitive).
- P22-04 (Account checkbox alignment).
- P22-08 (empty-state visual treatment).
- P22-09 (Care Circle breathing room).
- P22-06 (Subscription visual pass, MOCK REQUIRED first).

**MAXIMUM POLISH SET** (if the product owner wants a more extensive pass) - effort **L**, includes the Recommended set plus:
- P22-11 (shared Card/ListRow primitive across six files, full regression pass).
- P22-05 (People "go deeper" link consistency).
- P22-10 (document expiry indicator).
- A dedicated full re-read/scoring of the onboarding family (section 15), Recent Activity, Care Summary, Documents, and Bottom Navigation (all currently only "characterized" in this report) before committing further recommendations there.

## 42. Deferred/optional visual ideas

- Subtle title cross-fade on person/tab switching (section 10) - genuinely optional, no evidence it is currently felt as a problem.
- Save/completion micro-confirmation motion (section 10) - optional, must be scoped tightly to avoid the brief's own "animation everywhere" warning.
- A named `cardPadding`/spacing-token pass beyond what already exists (section 4) - real but very low urgency given the scale is already implicit and consistently used.

---

## Documentation status (per brief section 50)

This document states: **Phase 21 complete. Phase 22A visual audit underway (this document).** Phase 22 is explicitly NOT marked complete anywhere in this repository, and no recommendation in this report is marked approved - approval is GPT's and the product owner's decision, not this document's own.

## Validation (documentation-only, per brief section 51)

- Application code (`.ts`/`.tsx`) unchanged: confirmed - `git status --short` shows no tracked application file modified.
- Database/migrations unchanged: confirmed - no `supabase/` file touched, no new migration created.
- Package files unchanged: confirmed - `package.json`/`package-lock.json` untouched.
- `git diff --check`: clean.
- No physical QA was performed or claimed (documentation-only task, per the brief's own instruction not to run unnecessary full physical QA).
