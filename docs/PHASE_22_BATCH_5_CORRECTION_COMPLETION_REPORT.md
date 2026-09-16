# Phase 22 Batch 5 Correction Completion Report

## 1. Why Batch 5 diverged

The failed implementation treated the earlier two-column wording as the primary layout authority. That produced oversized vertical cards and let the Overdue colour become a page-wide band. This contradicted the approved visual reference, which clearly shows compact full-width rows inside shallow coloured section panels. The approved reference now governs the implementation directly.

## 2. Exact correction

- Restored the approved compact hierarchy: header, care-space context, List/Grid controls, filters, then grouped section panels.
- Made List the default presentation.
- Replaced the default two-column cards with compact horizontal rows.
- Kept Grid only as an alternate session-local presentation.
- Changed the visible group title from `Today / Needs doing` to the approved `Today`.

## 3. Agreed blue/background treatment

The product owner and implementation agent reviewed the background together through successive visual mocks and agreed the final matte steel-blue treatment. To Do begins at `#4B6285`, transitions through `#617898`, `#7E93AE`, and `#A6B7CA`, and resolves to `#D6E0E9`. The gradient remains continuous behind all groups and through the bottom clearance above the tab bar; it does not cut off into a flat cream block.

## 4. List design

List is the default. Each task is a compact full-width row with a small semantic category icon, quiet category label, strong title, compact due/assignment metadata, and restrained disclosure chevron. Long titles wrap rather than truncate.

## 5. Agreed section-panel system

- Overdue: very pale neutral cool-grey `#ECEFF2` panel with plum heading and restrained red overdue metadata; every record tile is pure white `#FFFFFF`.
- Today: shallow warm ivory panel.
- Upcoming: shallow pale-blue panel with blue heading.
- Completed: the same grouped system with deliberately subdued styling.

Each record is a distinct compact rounded tile. List rows use the same 8px separation and shared soft elevation as Home's tiles; Grid retains its 12px gap and now uses the same elevation. The containing section still provides the agreed status colour and heading.

## 6. Task-row design

List rows use a 64px minimum height with compact vertical padding. The approved asset colours were sampled directly: selected `All` is `#C71742`; task, bill, and home-matter icon circles use `#9B71CA`, `#E46E77`, and `#8A935D` with white glyphs. The rejected left rails and giant icon circles are gone. Typography remains Fraunces for the wordmark, Inter Tight for headings/titles, and Inter for controls/metadata.

Opening a To Do record now measures the tapped tile and passes that exact screen rectangle to the existing shared record editor. The editor softly expands from that tile's position and retracts toward it on dismissal. Other projections omit the optional origin and retain their existing sheet behaviour.

## 7. List/Grid implementation

The controls use Lucide List and Grid icons, expose button roles and selected state, and retain 44px touch targets. They form one joined segmented control consistent with Home, with the selected half shown in white. State is component-local and defaults to List on every new screen session.

## 8. Grid decision

The earlier tile work was retained only as the alternate Grid presentation. It uses the same filtered and grouped arrays, the same record press callback, and the same section panels. Grid falls back to one column on narrow screens or at font scale 1.3 and above.

## 9. Responsive/accessibility behaviour

- List remains full-width on narrow phones.
- Titles wrap and all app text continues to allow device font scaling.
- Filters and view controls expose selected accessibility state.
- Grid falls back to one column for narrow/enlarged-text layouts.
- The scroll content retains bottom-navigation clearance without a large fixed footer.

## 10. Tests and validation

- Final approved-colour closure rerun: PASS, 28/28 focused To Do visual, background and behaviour tests.
- `npm run typecheck`: PASS.
- Focused To Do, record-editor and responsive suites: PASS, 61/61 tests.
- Phase 22 foundation plus Home/Calendar regression suites: PASS, 56/56 relevant tests; the existing People test in `tab-header-titles.test.tsx` still times out.
- Isolated shared Settings suite: To Do Settings test PASS; 13/16 total pass, with the three known asynchronous People/Home timeouts unchanged.
- `npm run secrets:check`: PASS, 395 files inspected.
- `npx expo config --type public`: PASS.
- `npx expo export --platform web`: PASS, 696 modules.
- `git diff --check`: PASS (line-ending warnings only).

## 11. Files changed by this correction

- `src/screens/ToDoScreen.tsx`
- `src/components/foundationIcons.ts`
- `src/components/RecordSheet.tsx`
- `src/components/RecordQuickEditor.tsx`
- `App.tsx`
- `src/theme.ts`
- `tests/phase22-todo-visual.test.tsx`
- `tests/todo-background-fix.test.tsx`
- `tests/phase12-todo.test.tsx`
- `tests/home-strip-navigation.test.tsx`
- `docs/PHASE_22_BATCH_5_CORRECTION_COMPLETION_REPORT.md`

## 12. Task logic

Task queries, eligibility, filtering semantics, grouping calculations, sorting, assignment, completion, creation, editing, and record opening were not changed. List and Grid consume the same existing grouped data.

## 13. Other primary tabs

Home, Calendar, and People production files were not modified by this correction. Their corresponding designs in `approved-theme-overview.png` remain the authority for their authorised batches.

## 14. Backend

No database, Supabase, authentication, permissions, billing, Care Circle, or persistence work was performed.

## 15. Physical QA

The approved reference was opened and inspected directly, including pixel sampling of its To Do blue family. The implementation was compared against the reference for hierarchy, density, section ownership, icon scale, typography, spacing, and controls. Metro remains available on port 8088 for real-device review. No device was connected at final verification time, so final product-owner physical acceptance on iOS/Android is intentionally not claimed in this report.

## 16. Git status and stop gate

The Phase 22 working tree remains intentionally uncommitted and unpushed. Existing cumulative Phase 22 changes and pre-existing untracked reports/logs remain present and untouched. People has not started.

## 17. Product-owner agreement and closure

The final To Do treatment was reached collaboratively through step-by-step mock review and explicit product-owner approval. The agreed result now implemented is:

- the continuous matte `#4B6285` steel-blue gradient;
- the joined List/Grid segmented control;
- compact, individually separated task rows;
- category-specific full-colour icon circles;
- the very pale neutral-grey Overdue panel;
- pure-white Overdue record tiles; and
- tile-origin record-editor expansion.

Subject to the successful validation recorded above, the Phase 22 To Do visual correction is sorted and closed. No task, filter, assignment, record, or persistence behaviour was changed to achieve the visual result.

## 18. Final tile separation correction - 16 September 2026

Physical review found that To Do tiles still read too much like a joined block compared with Home. The final approved correction changes list-row spacing from 4px to 8px and applies the existing `shadow.soft` token to both List and Grid tiles. All approved To Do colours, section panels, text, filters, List/Grid behavior, tile-origin editor animation and domain logic remain unchanged.

Validation after this correction: `npm run typecheck` passed; the focused To Do visual, hierarchy and background suites passed 22/22; `git diff --check` passed with line-ending warnings only.
