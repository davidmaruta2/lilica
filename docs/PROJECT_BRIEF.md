# Lilica Project Brief

## Product

Lilica is a personal and family care organiser for Luxford Interactive. It helps an organiser keep the everyday life, care, information and responsibilities of another person in one calm place.

The supported person may be an ageing parent, a disabled child, a partner, a grandparent, another relative or someone else. One organiser must receive value without requiring the supported person, wider family or professional carers to join first.

Lilica is not primarily a medical app, eMAR system, care-home management product, surveillance product, emergency monitor, fall-detection app, elderly companion chatbot or generic family calendar.

The core problem is:

> I am the person carrying all of this in my head.

Lilica should help answer:

- What needs attention?
- What is happening today?
- What is coming up?
- What is overdue or unresolved?
- Who is dealing with it?
- Where is the important information?
- What has changed or already been confirmed?

## Current Scope

The repository contains the Phase 1 product foundation plus Phase 3-9 safety, authentication, multi-person ownership, persistence, core occurrence and everyday record-management foundations. It includes:

- Core visual system and navigation shell
- Welcome / How Lilica Works introduction
- Verified Supabase email/password accounts, six-digit signup verification and six-digit-code recovery
- A separate organiser display-name profile
- Multi-person relationship selection, supported-person profiles, care spaces and organiser memberships
- Privacy declaration and persistence
- Interest selection
- Structured record capture during onboarding
- First-arrival Home populated from real records
- Local persistence and legacy first-item migration
- Care-space-scoped cloud records with an offline local cache, semantic outbox and resumable safe migration
- Stable care-space-owned occurrences, versioned recurrence rules and immutable prior occurrence snapshots
- Everyday record management from Home using the same category-gateway/list/add/edit screen as onboarding, plus a stable-identity Assigned to: Unassigned/You control

Do not build production AI, bank integrations, payment initiation, emergency monitoring, fall detection, eMAR, diagnosis, subscriptions, complex family permissions, provider integrations or a full OCR pipeline without explicit approval.

## Current Onboarding Flow

1. Three-slide Welcome / How Lilica Works introduction
2. Create an email/password account or log in
3. Verify a new email account
4. Enter the organiser's display name on `About you`
5. `Whose wellbeing are you looking to support with Lilica?` — choose Myself or Someone else (first-time setup only; see Self/Someone-Else Fork below)
6. Select one or more relationships and enter each supported person's preferred name
7. Review the roster and choose the first person to set up
8. Accept that person's privacy declaration
9. Choose areas the organiser commonly helps with for that person
10. Add real information on `Let's get [Name] organised`
11. Continue to Home, switch people, or resume another person's setup

## Self/Someone-Else Fork

The first time an organiser sets up a person, `CareForkScreen` asks `Whose wellbeing are you looking to support with Lilica?` with two choices, Myself and Someone else. This governs only the *initial* setup path — it is not a permanent account mode. An organiser can end up managing only themselves, only other people, or themselves plus others; the existing Add Person / `PersonSwitcher` / care-space architecture is unchanged and already supports every combination.

Choosing **Myself** uses the organiser's own `About you` display name (never re-asked) and provisions a care space through the exact same `bootstrap_supported_people` path, `care_space_memberships` row and multi-person draft pipeline as any other supported person — with `relationship_type = 'Myself'`, the one new value added to the existing closed set (`Myself, Mum, Dad, Partner, Child, Grandparent, Other relative, Someone else`), enforced by the same database `CHECK` constraint plus a unique partial index limiting a user to one `Myself` membership. There is no separate identity system, no name-matching inference, and no reduced "personal mode" — a Myself care space behaves like any other for records, cache, sync and switching.

Choosing **Someone else** continues into the existing relationship wheel and supported-person flow unchanged. `Myself` also appears as a normal (single-use) option in that wheel, so a person who started with someone else can add themselves later via the existing `+ Add another person` path, and vice versa.

Interests copy adapts for a Myself care space: `InterestsScreen`'s `isSelf` prop (driven by the same `relationshipType === 'Myself'` semantic, not name matching) swaps `What do you help [Name] with?` for `What would you like help staying on top of?`. The privacy declaration's wording (`Get permission from the person you support`) was deliberately left unchanged — it is a protected, versioned legal declaration (`privacy-basis-v2`), and its existing generic phrasing ("the person you support", "them") already parses correctly, if slightly redundant, when that person is the organiser; editing it would require a version bump and is a legal/product decision outside this task's scope.

The introduction and account-choice presentation were revised by Lumen and should not be casually redesigned. The active product workflow begins after the interest-selection screen.

## Authentication And Identity Boundary

Phase 5 implements verified Supabase email/password authentication, session restoration, OTP recovery and sign-out. It also establishes the organiser as a separate person with a required display name. Phase 6 implements the first ownership kernel:

- **Supported-person profile:** the person receiving support, kept separate from the organiser.
- **Care space:** one current security/data partition per supported person.
- **Organiser membership:** the authenticated organiser's relationship and role for that care space.

Supported-person identity, memberships and record data are cloud-backed. Privacy, interests, setup progress and attachment bytes remain device-local per authenticated account and care space. Cached records and pending outbox work are preserved at sign-out; authenticated sync pauses. Invitations, additional member roles/permissions, cloud attachment bytes and profile photos are deferred; date of birth is intentionally not collected.

Responsibility and visibility are separate concepts. The existing free-text responsibility value is legacy/display data and is never inferred to be an authenticated person. Phase 8's server-side assignment foundation targets a stable active care-space membership or explicit external contact. It has no UI and grants no access; server-enforced permissions independently decide what each member can access.

## Privacy And Consent

The privacy screen must:

1. Ask the organiser to get permission or hold the right authority.
2. Ask them to keep the supported person involved.
3. Explain Lilica's privacy commitment without making an absolute promise that conflicts with user-directed sharing or legal duties.

The declaration must be actively selected before continuing. Store its version and acceptance timestamp; the current version is `privacy-basis-v2`. Do not claim that the supported person personally consented when only the organiser accepted the declaration.

Do not invent Privacy Policy or Terms URLs.

## Interest Selection

The screen asks `What do you help [Name] with?` and displays the real canonical record categories (never a second, separate taxonomy) in a horizontal, arrow-assisted chip carousel — every category from the record stack below except Wellbeing update, which is not offered as an initial-setup choice:

- Appointment
- Something to do
- Bill or renewal
- Home or car matter
- Important document
- Contact
- Care information

Selections may be skipped, and personalise INITIAL SETUP only: they determine which category gateways the next record stack offers while setup is still in progress (an empty selection offers all of them, so "skip"/"add later" is never blocked). Once setup completes, selections have no further effect — the record stack (reached via Home's everyday `Add`) always offers the complete category set, regardless of what was or wasn't chosen here. There is no permanent "areas you help with" setting.

## Structured Record Entry

The old `What would help today?` category-choice screen has been replaced. The current screen says:

> Let's get [Name] organised.

> Add the important things you want Lilica to keep track of, so we can remind you what's coming up and what still needs sorting.

It is a vertical snapping stack with one record category in focus. All categories remain accessible, while those matching selected interests are ordered first:

- Appointment
- Something to do
- Bill or renewal
- Home or car matter
- Important document
- Contact
- Care information
- Update

Tapping Add or Edit opens a compact bottom sheet. The sheet:

- Animates up over the stack
- Dismisses through Done, backdrop, system back or a downward drag while content is at the top
- Retains unsaved draft values while the onboarding screen remains mounted
- Uses compact fields and a scrollable, keyboard-aware form
- Saves a real record and advances focus to the next category

Before any record is saved, the footer offers `I'll add things later`. After a record exists, it offers `Go to [Name]'s Home`. Users are never required to complete every category.

## Everyday Record Management (Phase 9)

The same screen is the everyday Add/manage surface, not only a first-time onboarding step: Home's `Add` action reopens it after setup is already complete. In that everyday case, the heading reads `[Name]'s records`, the supporting copy reads `Add, review or update anything Lilica keeps track of for [Name].`, and the empty-category footer button reads `Back to Home` instead of `I'll add things later`. The underlying category-gateway, compact record list, bottom-sheet editor, wheel pickers and draft retention are identical in both cases — only this copy differs, driven by whether setup is already complete (`FirstThingScreen`'s `everyday` prop), not by a different screen or architecture.

Appointment, task, bill and home/car matter editors also carry an `Assigned to` control, separate from and in addition to the existing free-text responsibility field. Every option stores a stable care-space membership ID; it is never a display name or email, and it is never inferred from the free-text field. Since Phase 15, this control offers every active member of the care circle who has visibility into that record's domain (not just the organiser's own "You") — see `docs/PHASE_15_ARCHITECTURE.md`.

## Record Model

`LilicaRecord` supports fields used across multiple categories rather than a separate model for every example:

- Identity: id, type and supported-person ID
- Content: title and notes
- Timing: event date/time, due date and expiry date
- Workflow: status, completion and completion time
- Ownership: responsible person
- Repetition: recurrence interval and unit
- Confirmation: timestamped confirmation history
- Category details: location, provider, amount, reference, role, phone and email
- Attachments: local URI, source kind, filename, MIME type, size and optional image dimensions
- Audit: creation and update timestamps

Dates are stored as ISO calendar dates. UI input accepts UK `DD/MM/YYYY` format and validates real calendar dates.

`src/records.ts` derives due-today, overdue, upcoming, completed, unresolved, recently-updated and next-recurring-date state deterministically. Generative AI must not decide whether a record is overdue.

Phase 8 adds a canonical `Occurrence` beneath a durable Record. Dated task, bill, home/car, expiring-document and appointment records map to one stable initial occurrence; undated or malformed history remains without a fabricated occurrence. Date-only obligations remain calendar dates. Appointment wall times remain local date/time plus `Europe/London`; they are not flattened into guessed UTC instants. A passed scheduled appointment derives `past_awaiting_outcome` and is never automatically attended, completed, missed or overdue. Recurring completion creates one deterministic next occurrence, while previous versions preserve what was expected before an edit.

## Important Documents

The Important document editor offers:

- `Upload file`, using the operating-system document picker and allowing multiple files
- `Scan with camera`, using the rear camera to capture an image
- A removable list of pending or saved attachments

Native attachments are copied into the app's persistent document directory before their metadata is saved with the record. On web, the browser-provided URI is retained. Camera permission copy is configured in `app.json`.

`Scan with camera` currently means image capture. Automatic edge detection, cropping, PDF assembly, text recognition and OCR are deliberately deferred. There is no backend or cloud file storage, so attachments do not synchronise across devices.

## Home

Home displays only real saved records. It groups them into populated sections:

- Needs attention
- Today
- Coming up
- Latest

Do not add fake records, fabricated statistics, profile-completion prompts, feature grids or empty dashboard sections. Calendar (Phase 11 of the canonical roadmap) and To Do (Phase 12) are now real projections rather than placeholders; the Person tab remains a placeholder.

The header leads with the Lilica wordmark; the supported-person context sits beneath it as a persistent, tappable card that opens the person switcher (replacing the old dismissible "Everything for [Name], in one place" banner and the small "[Name]'s week" text trigger). Directly beneath that, a horizontal "at a glance" status strip shows Overdue/Due today/Coming up/Assigned to you/Updates this week counts, derived locally in `HomeScreen.tsx` from the records already loaded and Phase 9's stable assignment identity — this is not the "fake statistics" the rule above prohibits, since every number is a live count under the existing derivation, and Assigned to you is omitted entirely (never a fake zero) when no active membership exists to back it. Section item cards use a small category-tonal icon (drawn from plain Views, no icon-library dependency) instead of one uniform accent color, plus an explicit "Overdue" label only where the existing derivation says so.

## Calendar (Phase 11 of the canonical roadmap)

Calendar is a month-grid-and-selected-day projection of the same records Home reads (`state.records`), not a second record system. Each day cell shows a tinted icon-chip badge for its highest-priority category (a `+N` badge when more than one item falls on a date, a small red corner dot on any overdue item), and an icon legend beneath the grid explains every glyph. Tapping an item opens the established record editor via a one-shot `initialOpenRecordId` request, exactly as Home's own Add action already does. See `docs/PHASE_10_ARCHITECTURE.md`.

## To Do (Phase 12)

To Do projects genuinely actionable work — open task/bill/home-or-car-matter records that are not completed or cancelled — grouped into Overdue, Today / Needs doing, and Upcoming (a 30-day horizon, matching Home's own Coming Up window). Appointments, documents, contacts, care information and updates never appear, even though some are dated. Assignment filters (All/Mine/Unassigned) use Phase 9's stable `assignedMembershipId`, never a display name or the legacy `responsiblePerson` text. Completing or reopening an item uses the same canonical transition `RecordEditor`'s own Save button would produce (`completionUpdate()`, shared by both), so Home, Calendar and To Do can never disagree about what "complete" means for a record. See `docs/PHASE_12_ARCHITECTURE.md`.

## Person (Phase 13)

Person projects durable knowledge about the selected person — contacts, care/health information, home information, documents/paperwork and bills/renewals — each grouped from the same existing record types (`contact`, `careNote`, `homeMatter`, `document`, `bill`). Appointments, tasks and updates never appear here; they belong to Calendar, To Do and Home's Latest respectively. Person never infers a diagnosis, legal authority, or any other fact beyond what a record's own fields state, and never generates a summary sentence. Self-care wording ("You") is driven by the explicit self-care state, never by matching a display name. The tab previously rendered the organiser's account settings under stale "person" copy; that is now reached via a small "Account" link from Person's own header. See `docs/PHASE_13_ARCHITECTURE.md`.

## Reminders And Notifications (Phase 14)

Lilica can remind the signed-in user about genuinely actionable, dated work (appointments, tasks, bills, home/car matters) via **local device notifications only** — no server/push infrastructure yet. Reminder state and notification-delivery state are kept strictly separate from record truth: dismissing or snoozing a notification never completes, pays, or attends anything; only completing/cancelling the actual record (through the normal editor or To Do) suppresses its pending reminders. Default offsets are conservative (1 day and 2 hours before a timed appointment; 3 days before and on the day for a date-only item), never manufactured for a lead time already in the past. Notification permission is requested only at an explicit reminder-value moment (the record editor's "Remind me" toggle, or Account's master switch) — never at launch or during onboarding. See `docs/PHASE_14_ARCHITECTURE.md` for the full three-state separation model and what remains deferred (server/push delivery, device registration, Phase 15 collaboration notifications).

## Care Circle (Phase 15)

Sharing a care space is now real, explicit, permissioned and revocable between genuine Supabase accounts — never inferred from a name, email, relationship label, contact, or the legacy free-text responsibility field. An organiser invites someone by email to one of two role presets, Contributor or Viewer (never "Carer" by default, never dozens of roles), and explicitly reviews and selects which domains (everyday/care & health/bills & money/home & car/documents) that person can see before sending — nothing is granted by default beyond what's chosen. A pending invitee is not a member, is not assignable, and can read nothing. Assignment ("who's expected to deal with this") and permission ("who's allowed to see this") stay strictly separate: assigning a record to someone without visibility into its domain is rejected by the server, not just hidden by the client picker, and a removed member's historical assignment is retained rather than silently rewritten. Removal takes effect immediately everywhere. A care space can never be stranded without an organiser. See `docs/PHASE_15_ARCHITECTURE.md` for the full model and `docs/PHASE_15_QA.md` for physical two-real-account QA.

## Design Direction

Lilica should feel clean, premium, warm, calm, modern, spacious and highly legible. Yuka is a quality benchmark for focus, hierarchy and restraint; Ryeli is a typography reference; Kinlog informs supported-person flow logic only.

Avoid generic AI styling, clinical presentation, elderly stereotypes, washed-out one-note palettes, feature grids, excessive cards, random pills, heavy shadows, glassmorphism and paragraph-led Home screens.

The current Welcome screens are a retained foundation. Continue improving from the structured record workflow unless the product owner explicitly reopens an earlier screen.

## Technical Context

- Expo SDK 57
- React 19
- React Native 0.86
- TypeScript 6
- React Native Web
- AsyncStorage
- Expo Document Picker
- Expo Image Picker
- Expo File System
- Fraunces font package
- Supabase JavaScript client

Phase 4 provides dedicated non-production Supabase infrastructure and owner-only profiles. Phase 5 adds runtime authentication and the organiser profile. Phase 6 adds a multi-person supported-person schema, one care space per person, organiser memberships, membership-enforced RLS, idempotent roster provisioning, active-space switching and per-space local state. Phase 7 adds care-space-owned cloud records, safe legacy migration, an account-scoped local cache, semantic offline outbox, deterministic reconciliation and record RLS. Phase 8 adds canonical occurrences derived from those records, immutable occurrence versions, recurrence series/rules and a server-side stable assignment/external-contact foundation. Phase 9 adds everyday record management from Home and a stable-identity Assigned to: Unassigned/You control consuming that Phase 8 identity, entirely client-side with no new migration. Phase 3 provides the automated characterization/domain-contract harness and manual device baseline.

## Verification Expectations

After relevant changes:

- Run `npm run validate` for the complete local gate.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npx expo install --check`.
- Run `npx expo config --type public` after native configuration changes.
- Run the appropriate Expo export.
- Check onboarding resume, back navigation, privacy gating and real-record persistence.
- Check bottom-sheet dismissal, keyboard behaviour, retained drafts, document picking and camera capture on a physical device when possible.

## Reference Material

- Product brief: `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica.docx`
- Framework plan: `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica_Framework_and_Design_Plan.docx`
- Yuka: `C:\Users\DavidPC\Downloads\DAVID\Lilica\yuka`
- Kinlog: `C:\Users\DavidPC\Downloads\DAVID\Lilica\kinlog`
- Ryeli: `C:\Users\DavidPC\Downloads\ryeli`
