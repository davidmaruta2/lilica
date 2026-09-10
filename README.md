# Lilica

Lilica is a React Native care-organising app for Luxford Interactive. It helps an organiser keep separate appointments, tasks, bills, home or car matters, documents, contacts, care information and updates for each person they support.

The repository currently contains the Phase 1 product foundation, Phase 5 authentication and the Phase 6 multi-person ownership kernel. Before making product or design changes, read:

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
- Real record persistence through AsyncStorage
- Deterministic due, overdue, upcoming and recurrence-ready record state
- Home sections populated only from real saved records

The Welcome work should be preserved unless the product owner explicitly requests changes. The record-entry sheet may be dismissed by its Done action, backdrop, system back action or a downward swipe while the form is at the top. Unsaved drafts remain available while the onboarding screen remains mounted.

## Important Limitation

Phase 6 stores supported-person identity, one-person care spaces and organiser memberships in Supabase. Privacy acknowledgements, interests, records and attachments remain device-local and are partitioned by care space; cloud record persistence and sync belong to Phase 7. Signing out preserves that local data rather than assigning or deleting it.

The current free-text responsibility field is not a care-circle identity. The approved roadmap preserves it as unresolved legacy text in Phase 7, introduces stable assignment entities in Phase 8, replaces new free text with a data-driven control in Phase 9, projects it into To Do in Phase 12, and populates it with real active members only after Phase 15 collaboration. Assignment never grants visibility; server permissions remain separate.

Profile photos are deferred because no private storage boundary exists yet. Date of birth is intentionally not collected.

Document files and camera captures are stored locally in the app's document directory. There is no backend upload, cross-device synchronisation, OCR or document-processing pipeline.

## Backend Foundation

Phase 4 adds the dedicated non-production Supabase project and owner-only profiles. Phase 5 connects authentication and organiser profiles. Phase 6 adds `care_spaces`, `supported_people`, `care_space_memberships`, membership-enforced RLS and an atomic idempotent multi-person bootstrap RPC. Local care content remains authoritative until Phase 7.

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

Phase 3 adds a small Jest/`jest-expo` and React Native Testing Library safety harness. `npm run validate` runs typecheck, automated tests, Expo dependency/config checks and a web export. The future domain examples in `src/domain` are deliberately not connected to the application yet. Physical-device checks remain manual; see `docs/PHASE_3_QA_BASELINE.md`, `docs/PHASE_5_QA.md` and `docs/PHASE_6_QA.md`.

Physical-device acceptance has confirmed the corrected keyboard behavior and the password, verification-code, check-email and reset paths. The approved Phase 6 checkpoint passed full validation. Phase 7 cloud records/sync has not started and requires separate approval.

## Reference Material

- Product brief: `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica.docx`
- Framework plan: `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica_Framework_and_Design_Plan.docx`
- Yuka visual references: `C:\Users\DavidPC\Downloads\DAVID\Lilica\yuka`
- Kinlog flow references: `C:\Users\DavidPC\Downloads\DAVID\Lilica\kinlog`
- Ryeli typography references: `C:\Users\DavidPC\Downloads\ryeli`
