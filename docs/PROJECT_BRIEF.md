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

The repository is still a Phase 1 product foundation. It includes:

- Core visual system and navigation shell
- Welcome / How Lilica Works introduction
- Prototype account-method and email flow
- Supported-person relationship and preferred name
- Privacy declaration and persistence
- Interest selection
- Structured record capture during onboarding
- First-arrival Home populated from real records
- Local persistence and legacy first-item migration

Do not build production AI, bank integrations, payment initiation, emergency monitoring, fall detection, eMAR, diagnosis, subscriptions, complex family permissions, provider integrations or a full OCR pipeline without explicit approval.

## Current Onboarding Flow

1. Three-slide Welcome / How Lilica Works introduction
2. Choose account method
3. Enter email when email is selected
4. Choose relationship to the supported person
5. Enter the supported person's first or preferred name
6. Accept the privacy declaration
7. Choose areas the organiser commonly helps with
8. Add real information on `Let's get [Name] organised`
9. Continue to Home after one record, or skip and add things later

The introduction and account-choice presentation were revised by Lumen and should not be casually redesigned. The active product workflow begins after the interest-selection screen.

## Authentication And Identity Gap

Authentication is currently a local UI placeholder. Apple and Google actions do not perform real OAuth, and email entry does not verify the email or request a password or one-time code.

The app also does not yet establish the organiser as a person. Before care-circle collaboration can be implemented, the product needs four distinct concepts:

- **Account:** authentication identity and verified email.
- **User profile:** organiser name, display name and optional photo; date of birth should only be collected if a real product need is established.
- **Supported-person profile:** the person receiving support, kept separate from the organiser.
- **Care-circle membership:** user, supported person/circle, relationship, role, permissions, invitation status and inviter.

Recommended later flow: authenticate and verify, collect a minimal `About you` profile, then ask who the user supports. Apple/Google users should not be forced to create a separate Lilica password. Email users need a genuine password or passwordless verification flow.

This gap is documented only. It is not implemented in the current revision.

## Privacy And Consent

The privacy screen must:

1. Ask the organiser to get permission or hold the right authority.
2. Ask them to keep the supported person involved.
3. Explain Lilica's privacy commitment without making an absolute promise that conflicts with user-directed sharing or legal duties.

The declaration must be actively selected before continuing. Store its version and acceptance timestamp; the current version is `privacy-basis-v2`. Do not claim that the supported person personally consented when only the organiser accepted the declaration.

Do not invent Privacy Policy or Terms URLs.

## Interest Selection

The screen asks `What do you help [Name] with?` and displays six selectable areas in a horizontal, arrow-assisted chip carousel:

- Appointments and visits
- Everyday things to sort
- Care and routines
- Home and bills
- Important paperwork
- Keeping family updated

Selections may be skipped. They influence the order of the next record stack but never remove categories.

## Structured Record Entry

The old `What would help today?` category-choice screen has been replaced. The current screen says:

> Let's get [Name] organised.

> Add the important things you want Lilica to keep track of, so we can remind you what's coming up and what still needs sorting.

It is a vertical snapping stack with one record category in focus. All categories remain accessible, while those matching selected interests are ordered first:

- Appointment
- Something to do
- Bill or renewal
- Home matter
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

Do not add fake records, statistics, profile-completion prompts, feature grids or empty dashboard sections. The existing shell includes placeholder Calendar, To Do and Person tabs; those are not full Phase 2 products.

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

There is no backend/database, production authentication, lint script or automated test suite.

## Verification Expectations

After relevant changes:

- Run `npm run typecheck`.
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
