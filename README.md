# Lilica

Lilica is a React Native care-organising app for Luxford Interactive. It helps an organiser keep separate appointments, tasks, bills, home or car matters, documents, contacts, care information and updates for each person they support.

The repository currently contains the Phase 1 product foundation, Phase 5 authentication, the Phase 6 multi-person ownership kernel, completed Phase 7 persistence, the Phase 8 core Record -> Occurrence engine, Phase 9's everyday add/record management with a stable-identity assignment control, Calendar (canonical roadmap Phase 11), and Phase 12's To Do actionable-work projection. Before making product or design changes, read:

- `docs/PROJECT_BRIEF.md`
- `docs/LUMEN_HANDOFF.md`
- `docs/REVISION_LOG.md`
- `docs/PHASE_6_CLAUDE_HANDOFF.md` for Phase 6 history and constraints
- `AGENTS.md`

## Current Experience

- Three-slide Welcome / How Lilica Works introduction
- Supabase email/password account creation, six-digit verification, login and six-digit-code recovery
- Separate durable organiser profile with a required display name
- Multi-person supported-person roster, identity review and first-person choice
- Separate privacy, interests, records and Home context for each care space
- Minimal active-person switcher with add-person and incomplete-setup routes
- Horizontal interest-selection carousel
- `Let's get [Name] organised` vertical snapping record stack
- Eight record types with compact bottom-sheet editors
- Upload and camera capture for important documents
- Supabase-backed record persistence with an account-scoped local cache and durable offline outbox
- Canonical, stable care-space-owned occurrences with explicit date-only/local-time semantics and recurrence history
- Everyday record management from Home (the same category-gateway/list/add/edit screen used during onboarding) with a stable-identity Assigned to: Unassigned/You control
- Deterministic due, overdue, upcoming and past-awaiting-outcome state
- Home sections populated only from real saved records
- Calendar: a month grid and selected-day list projecting the same records Home reads, with no separate calendar-event store; opening an item reuses the same record editor everywhere else in the app
- To Do: open task/bill/home-or-car-matter records grouped into Overdue, Today / Needs doing and Upcoming, with All/Mine/Unassigned assignment filters and completion that reuses the same canonical transition as the record editor

The Welcome work should be preserved unless the product owner explicitly requests changes. The record-entry sheet may be dismissed by its Done action, backdrop, system back action or a downward swipe while the form is at the top. Unsaved drafts remain available while the onboarding screen remains mounted.

## Important Limitation

Supported-person identity, one-person care spaces, organiser memberships and records are now Supabase-backed. Privacy acknowledgements, interests, setup progress and attachment bytes remain device-local. Signing out preserves the account-scoped record cache and pending outbox rather than assigning or deleting them; authenticated sync pauses until valid sign-in.

Phase 7 stores records durably in Supabase under `care_space_id`, while an account-scoped local cache and semantic outbox preserve offline startup and retry. Existing non-UUID record IDs map deterministically to cloud UUIDs. Server RLS permits only active organiser memberships, and compatible stale field edits merge while overlapping edits remain conflicts. Attachment bytes/URIs stay local. See `docs/PHASE_7_ARCHITECTURE.md` and `docs/PHASE_7_QA.md`.

The current free-text responsibility field is not a care-circle identity, and Phase 9 preserved it exactly rather than replacing it. Phase 8 introduces server-side stable assignment and external-contact entity foundations; Phase 9 adds a data-driven Assigned to: Unassigned/You control alongside the unchanged legacy free-text field, storing a stable membership ID rather than a display name. Only Unassigned and You are offered because no other active membership exists yet. Phase 12 projects assignments into To Do, and Phase 15 adds real collaboration members and permissions. Assignment never grants visibility; server permissions remain separate.

Profile photos are deferred because no private storage boundary exists yet. Date of birth is intentionally not collected.

Document files and camera captures are stored locally in the app's document directory. There is no backend upload, cross-device synchronisation, OCR or document-processing pipeline.

## Backend Foundation

Phase 4 adds the dedicated non-production Supabase project and owner-only profiles. Phase 5 connects authentication and organiser profiles. Phase 6 adds care-space ownership. Phase 7 adds durable records, safe migration and account/care-space cache, outbox and reconciliation. Phase 8 adds canonical occurrences, immutable occurrence versions, stable recurrence series/rules, idempotent occurrence mutations and the minimum assignment/contact foundation under organiser-only RLS.

See `docs/SUPABASE_OPERATIONS.md` for environment boundaries, migrations, security tests, secrets handling, and recovery limits.

## Development

This project uses Expo SDK 57, React Native 0.86 and TypeScript 6.

```bash
npm install
npm run start
npm run web
npm run typecheck
npm test
npm run validate
npm run validate:backend
npm run validate:all
```

Useful verification commands:

```bash
npx expo install --check
npx expo config --type public
npx expo export --platform web
```

Phase 3 adds a small Jest/`jest-expo` and React Native Testing Library safety harness. `npm run validate` runs typecheck, automated tests, Expo dependency/config checks and a web export. Phase 8 connects the canonical occurrence mapper to record creation, the local cache and server reconciliation without changing the record-entry UI. Physical-device checks remain manual; see `docs/PHASE_8_QA.md`.

Physical-device acceptance has confirmed the corrected keyboard, authentication/recovery paths, Phase 7 record migration/sync behaviour and Phase 8's Record -> Occurrence engine on Android and iPhone.

## Reference Material

- Product brief: `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica.docx`
- Framework plan: `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica_Framework_and_Design_Plan.docx`
- Yuka visual references: `C:\Users\DavidPC\Downloads\DAVID\Lilica\yuka`
- Kinlog flow references: `C:\Users\DavidPC\Downloads\DAVID\Lilica\kinlog`
- Ryeli typography references: `C:\Users\DavidPC\Downloads\ryeli`
