# Lilica Agent Instructions

This is the Lilica React Native care-organising app for Luxford Interactive. Work in this repository and read these files before changing code:

- `docs/PROJECT_BRIEF.md`
- `docs/LUMEN_HANDOFF.md` (canonical current handoff despite its legacy name)
- `docs/REVISION_LOG.md`
- `docs/SUPABASE_OPERATIONS.md` before any backend or authentication operation
- `docs/CORE_SYSTEM_CONTRACT.md` for approved architectural direction

## Current State

- Phase 5 authentication, Phase 6 multi-person ownership, Phase 7 record persistence/cache/sync and Phase 8's core Record -> Occurrence engine are implemented, validated and physically approved (product-owner QA passed 10 September 2026).
- Phase 9 (everyday add/record management: a stable-identity Assigned-to control, and everyday-vs-onboarding copy for the already-existing category-gateway screen) is implemented and validated; physical-device QA is outstanding — see `docs/PHASE_9_QA.md`.
- Calendar (a month grid and day list projecting existing records, opening into the same established record editor) is implemented and validated; physical-device QA is outstanding — see `docs/PHASE_10_QA.md`. **Roadmap numbering note:** this work was implemented and committed under the working label "Phase 10", but the canonical roadmap in `docs/CORE_SYSTEM_CONTRACT.md` defines it as **Phase 11 — Calendar Projection** (Phase 10 there is Home Projection, effectively already delivered by the earlier Home redesign work). Historical commits and doc entries using "Phase 10" for Calendar are not rewritten; numbering resumes canonically from here.
- To Do (Phase 12 — actionable-work projection: open task/bill/home-or-car-matter records grouped into Overdue/Today/Upcoming, with Mine/Unassigned/All assignment filters on Phase 9's stable membership identity) is implemented and validated; physical-device QA is outstanding — see `docs/PHASE_12_QA.md`.
- Person (Phase 13 — durable-knowledge projection: contacts, care/health information, home information, documents and bills/renewals grouped from existing records, with no medical/legal inference) is implemented and validated; physical-device QA is outstanding — see `docs/PHASE_13_QA.md`. The tab previously showed `AccountScreen` under stale "person" copy it never delivered; `AccountScreen` is now reached from Person's own "Account" link.
- Reminders/notifications (Phase 14 — local-only reminder engine: a "Remind me" toggle on appointment/task/bill/homeMatter records, quiet hours and a master switch in Account, strict separation of notification-delivery state from record truth) is implemented and validated; physical-device QA requires a development build (Expo Go does not reliably support local notifications since SDK 53) — see `docs/PHASE_14_QA.md`. Server/push delivery and device-token registration are deliberately deferred — see `docs/PHASE_14_ARCHITECTURE.md`'s "Deferred: server/push" section.
- Care Circle (Phase 15 — real invitations to Contributor/Viewer roles, explicit per-domain permission grants reviewed before sending, an invitee-facing Invitations screen that auto-surfaces once per session, a real Assigned-to selector, server-enforced assignment-visibility, immediate-effect removal/leaving, sole-organiser safety) is implemented and validated, and its migration is deployed to `lilica-development` — see `docs/PHASE_15_ARCHITECTURE.md`. Physical two-real-account device QA is outstanding — see `docs/PHASE_15_QA.md`. Not yet built (documented, not faked): push/email delivery of the invitation itself, an "assignee no longer has access" UI treatment, and in-app role-change/organiser-handoff controls. Its server-side domain-grant enforcement was re-verified end-to-end on 12 September 2026 (see that doc's addendum) — a suspected organiser-only RLS gap was checked and found not real.
- The record-open "flash" bug (11 September 2026) was root-caused to a whole-screen navigation just to host the editor, and fixed architecturally with `src/components/RecordQuickEditor.tsx` — an overlay reusing the same `RecordSheet`/`RecordEditor`/`RecordDetail` pairing, mounted over whichever screen already shows. An existing record now opens a shared, read-only `RecordDetail` first (view/edit separation); Edit reaches the unchanged `RecordEditor`. Dismissing that sheet by Done, backdrop tap, or swipe-down now saves pending valid content through the same validated save path the Save/Add button uses, rather than discarding it.
- Corrective Task 10 (11 September 2026, `docs/CORRECTIVE_TASK_10_PEOPLE_IA.md`) renamed the fourth tab from Person/Care Circle to **People**, centred on Supported people / Key contacts / the real Care circle (Phase 15 membership list) / an Ask Lilica placeholder — no longer duplicating Home's own bills/home/documents/care-note listing. A visual pass (`tabAccent`/`ScreenBackdrop` in `src/theme.ts`/`src/components/ScreenBackdrop.tsx`) applies to Calendar/To Do/People; Home was deliberately reverted to its original plain background.
- **Phase 16 (Document Maturity — foundation): implemented and validated on 12 September 2026, migration dry-run confirmed but NOT yet applied to `lilica-development`.** Per direct product-owner instruction, only the durable foundation was built this phase — real persisted, RLS-protected typed record links (`record_links`); durable cloud-side attachment metadata (`record_attachments`) and a private Storage bucket with domain-grant RLS; the client upload/retrieval library (`src/recordLinks.ts`, `src/attachments.ts`); and a fix for a real pre-existing bug (synced attachment metadata never reached a pulled record on a second device — `src/recordSync.ts`). See `docs/PHASE_16_ARCHITECTURE.md` for full detail and exactly what is NOT yet wired up.
- **Phase 17 (next, not started): wire the Phase 16 foundation into RecordEditor/RecordDetail UI** — the "Related to" picker, "Does anything need doing?" task-creation flow, bidirectional Related-to/Documents detail sections, "View document", and calling the not-yet-wired `queuePendingAttachmentUploads`/`openAttachment` functions. Full scope list in `docs/PHASE_16_ARCHITECTURE.md`'s "What Phase 17 Still Needs". Do not begin Phase 17 without its own separate, explicit, bounded implementation prompt.
- The self/someone-else onboarding fork (`Whose wellbeing are you looking to support with Lilica?`) is implemented and validated; physical-device QA is outstanding — see `docs/CARE_FORK_QA.md`.
- Supabase provides email/password Auth, organiser profiles, supported people, care spaces and organiser memberships.
- Signup and password recovery use six-digit email OTPs. Recovery proceeds through Check your email, Enter your code and Choose a new password.
- Privacy, interests, attachment bytes and setup progress remain device-local. Records now use a care-space cache/outbox and durable Supabase rows; attachment metadata only is cloud persisted.
- Stable assignment/contact entities exist as a server-side Phase 8 foundation only. Assignment UI, invitations, collaboration, granular permission management and production infrastructure have not started.
- The approved Welcome experience, safe-area correction and shared keyboard-aware form layout are protected behavior.

## Working Rules

- Keep Expo SDK 57 unless explicitly instructed otherwise.
- Preserve user changes and inspect `git status --short` before editing. Never reset cumulative work casually.
- Never expose or commit `.env.local`, `lilica-development.txt`, Supabase personal tokens, database passwords, service-role keys or SMTP credentials.
- Use only `lilica-development` (`ldocquqbcabdbscghojc`) for current hosted work. No Lilica production project exists.
- Never run a blind full `supabase config push`. Preview with `supabase config diff`, then apply only declared, reviewed properties from a narrowly scoped config.
- Preview database migrations with `npx supabase db push --linked --dry-run`; never run `supabase db reset --linked`.
- Keep organiser identity separate from supported-person identity and membership-relative relationships.
- Persist only real user-created records. Derived due/overdue state must remain deterministic.
- Preserve the Phase 8 occurrence/recurrence/history and assignment-identity contracts, and the Phase 15 Assigned-to control's domain-eligible-active-member scope (see `docs/PHASE_15_ARCHITECTURE.md`). Do not add AI, OCR, banking, monitoring, clinical features, or further permission/role UI beyond Phase 15's Organiser/Contributor/Viewer model without explicit approval.
- All text-entry screens must use the shared keyboard-aware `Screen` or `RecordSheet` path. Do not add fixed CTAs that overlay fields or device-specific keyboard margins.
- Use `react-native-safe-area-context`; do not introduce a competing safe-area system.

## Validation And Handoff

Run `npm run validate` for app changes and `npm run validate:all` for database changes. Physical-device claims require actual device testing; automated layout tests are not physical proof.

Phase 8 is implemented, committed and physically approved. Phase 9, Calendar (canonical Phase 11, committed under the working label "Phase 10" — see the roadmap numbering note above), Phase 12 (To Do) and Phase 13 (Person) are implemented, validated and committed, awaiting physical QA. Phase 14 (reminders/notifications) is implemented, validated and committed (`b59ef1a`), awaiting a development-build physical QA pass (`docs/PHASE_14_QA.md`).

**Phase 15 (Care-Circle Invitations And Collaboration) is implemented, validated and committed, with its migration deployed to `lilica-development`.** Its Hard Start Gate (Phase 14 physical QA sign-off) was explicitly waived by the product owner on 11 September 2026 before this phase began — that decision, not automated-test success, is what authorised it. Phase 15 still requires genuine two-real-account physical testing per its own brief (section 79) — do not treat one account pretending to be two as adequate QA; see `docs/PHASE_15_QA.md`. Phase 16's foundation is implemented and validated (see above); do not begin Phase 17 without its own separate, explicit, bounded implementation prompt.
