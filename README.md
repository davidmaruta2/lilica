# Lilica

Lilica is a React Native care-organising app for Luxford Interactive. It helps one person organise appointments, tasks, bills, home matters, documents, contacts, care information and updates for someone they support.

The repository currently contains the Phase 1 onboarding foundation and an early real-record workflow. Before making product or design changes, read:

- `docs/PROJECT_BRIEF.md`
- `docs/LUMEN_HANDOFF.md`
- `docs/REVISION_LOG.md`
- `AGENTS.md`

## Current Experience

- Three-slide Welcome / How Lilica Works introduction
- Local placeholder account-method and email flow
- Supported-person relationship, name and privacy-consent steps
- Horizontal interest-selection carousel
- `Let's get [Name] organised` vertical snapping record stack
- Eight record types with compact bottom-sheet editors
- Upload and camera capture for important documents
- Real record persistence through AsyncStorage
- Deterministic due, overdue, upcoming and recurrence-ready record state
- Home sections populated only from real saved records

The Welcome work should be preserved unless the product owner explicitly requests changes. The record-entry sheet may be dismissed by its Done action, backdrop, system back action or a downward swipe while the form is at the top. Unsaved drafts remain available while the onboarding screen remains mounted.

## Important Limitation

Authentication remains a local prototype. Email entry does not yet verify the address or create a secure account. The app also does not yet collect the organiser's own profile, and there is no care-circle membership or permissions model. These are documented requirements for later work, not implemented features.

Document files and camera captures are stored locally in the app's document directory. There is no backend upload, cross-device synchronisation, OCR or document-processing pipeline.

## Backend Foundation

Phase 4 adds a dedicated non-production Supabase development project, version-controlled migrations, a minimal auth-linked `profiles` table, owner-only RLS, and local/hosted policy tests. The running app is deliberately not connected to Supabase yet, and local Phase 1 data remains authoritative.

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

Phase 3 adds a small Jest/`jest-expo` and React Native Testing Library safety harness. `npm run validate` runs typecheck, automated tests, Expo dependency/config checks and a web export. The future domain examples in `src/domain` are deliberately not connected to the application yet. Physical-device checks remain manual; see `docs/PHASE_3_QA_BASELINE.md`.

## Reference Material

- Product brief: `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica.docx`
- Framework plan: `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica_Framework_and_Design_Plan.docx`
- Yuka visual references: `C:\Users\DavidPC\Downloads\DAVID\Lilica\yuka`
- Kinlog flow references: `C:\Users\DavidPC\Downloads\DAVID\Lilica\kinlog`
- Ryeli typography references: `C:\Users\DavidPC\Downloads\ryeli`
