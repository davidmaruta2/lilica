# Lilica

Lilica is a React Native app for Luxford Interactive. It is currently in Phase 1: product foundation and onboarding.

Before making product or design changes, read:

- `docs/PROJECT_BRIEF.md`
- `docs/LUMEN_HANDOFF.md`
- `AGENTS.md`

The current app is functional enough to demonstrate the Phase 1 flow, but the visual design is not approved.

The latest revision separated email entry into its own CTA-style onboarding moment and reduced some paragraph-heavy treatment, but the result is still too cluttered and does not meet the Yuka benchmark. The next agent should not treat the current UI as a near-final design. It needs a substantial composition, typography and information-design rethink while preserving the working Phase 1 state and navigation.

Do not proceed into Phase 2 until Phase 1 is visually accepted.

## Development

This project uses Expo SDK 57.

```bash
npm install
npm run web
npm run start
npm run typecheck
```

For Expo Go QR:

```bash
npx expo start --host lan
```

Latest local run used:

- Web: `http://localhost:8082`
- Expo Go: `exp://192.168.1.178:8082`

## Key Context

Reference material lives outside the app folder:

- Product brief: `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica.docx`
- Framework plan: `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica_Framework_and_Design_Plan.docx`
- Yuka visual references: `C:\Users\DavidPC\Downloads\DAVID\Lilica\yuka`
- Kinlog flow references: `C:\Users\DavidPC\Downloads\DAVID\Lilica\kinlog`
- Ryeli typography references: `C:\Users\DavidPC\Downloads\ryeli`
- Current failure screenshots: `C:\Users\DavidPC\Downloads\i1.png` and `C:\Users\DavidPC\Downloads\i2.png`
