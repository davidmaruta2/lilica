# Lilica Agent Instructions

This is the Lilica React Native app for Luxford Interactive.

Before writing code, read:

- `docs/PROJECT_BRIEF.md`
- `docs/LUMEN_HANDOFF.md`
- `docs/REVISION_LOG.md`
- `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica.docx`
- `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica_Framework_and_Design_Plan.docx`

Visual and flow references:

- Yuka: `C:\Users\DavidPC\Downloads\DAVID\Lilica\yuka`
- Kinlog: `C:\Users\DavidPC\Downloads\DAVID\Lilica\kinlog`
- Ryeli: `C:\Users\DavidPC\Downloads\ryeli`

## Working Rules

- Keep the project on Expo SDK 57 unless explicitly instructed otherwise. Versioned documentation: `https://docs.expo.dev/versions/v57.0.0/`.
- Preserve the current Welcome / How Lilica Works work. The product owner considers it a good foundation and does not want it casually undone.
- Continue from the post-interest `Let's get [Name] organised` experience unless a request explicitly targets an earlier screen.
- Keep onboarding calm, consumer-friendly and progressive. Do not expose data-model or dashboard terminology in user-facing copy.
- Persist only real user-created records. Never use fake records to make Home appear populated.
- Use deterministic date/status logic for due, overdue and recurrence behaviour. Do not use generative AI for record state.
- Treat authentication, organiser profile, care-circle membership and permissions as an acknowledged architectural gap. Do not imply that email-only placeholder entry is production authentication.
- Do not expand into production AI, OCR, payment, banking, monitoring or clinical features without explicit approval.
- Work with existing uncommitted changes and do not revert another contributor's work.

## Current Technical State

- Expo 57, React 19, React Native 0.86, TypeScript 6
- AsyncStorage for local onboarding and record state
- Expo Document Picker, Image Picker and File System for local document attachments
- Dedicated non-production Supabase foundation with migrations and owner-only profile RLS; no runtime client, production authentication, record sync or cloud file storage
- Jest/`jest-expo` plus React Native Testing Library safety harness; unwired pure future-domain contract in `src/domain`

Before handing work back, run `npm run validate`; run `npm run validate:backend` for database changes. Read `docs/SUPABASE_OPERATIONS.md` before any backend work. Perform real-device visual and gesture checks whenever possible; use `docs/PHASE_3_QA_BASELINE.md` and never describe browser/component tests as physical-device proof.
