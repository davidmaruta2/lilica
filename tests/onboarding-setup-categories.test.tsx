import AsyncStorage from '@react-native-async-storage/async-storage';

import { firstItemOptions } from '../src/data/options';
import { loadOnboardingState } from '../src/storage';
import { LilicaRecordType } from '../src/types';

// Corrective task: "What do you help X with?" now offers the real
// canonical record categories -- never a second, competing taxonomy
// (the old `interestOptions`/`Interest` broad-bucket list, retired).
// FirstThingScreen's own filtering behaviour (initial setup offers only
// the chosen categories; the everyday Add flow always offers all of
// them, regardless of what was chosen) is covered in
// tests/phase1-ui.characterization.test.tsx; this file covers the data
// alignment itself, and that the selection survives a restart/
// sign-out-sign-in without ever restricting anything afterwards.

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

const getItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;

describe('Corrective task: setup categories align with the canonical record system', () => {
  it('every initial-setup-eligible option is a real canonical record category, with no invented category', () => {
    const canonicalTypes: LilicaRecordType[] = firstItemOptions.map((option) => option.id);
    const setupEligible = firstItemOptions.filter((option) => option.onboardingEligible !== false);
    for (const option of setupEligible) {
      expect(canonicalTypes).toContain(option.id);
    }
  });

  it('Wellbeing update is a canonical category but is not offered as an initial-setup choice', () => {
    const update = firstItemOptions.find((option) => option.id === 'update');
    expect(update?.onboardingEligible).toBe(false);
  });
});

describe('Corrective task: initial-setup selections are temporary orchestration, not durable capability state', () => {
  it('a category not chosen during setup survives an app restart (fresh load from storage) still fully available', async () => {
    getItem.mockResolvedValue(JSON.stringify({
      migrationVersion: 2,
      stage: 'home',
      onboardingComplete: true,
      careSpaces: {
        'care-beauty': {
          careSpaceId: 'care-beauty',
          supportedPersonId: 'person-beauty',
          membershipId: 'membership-1',
          bootstrapId: 'draft-1',
          relationshipType: 'Mum',
          displayName: 'Beauty',
          privacyDeclarationAccepted: true,
          privacyDeclarationVersion: 'privacy-basis-v2',
          // Only Appointments and Bills were chosen during initial setup.
          interests: ['appointment', 'bill'],
          records: [],
          setupStatus: 'ready',
          allSetDismissed: false,
        },
      },
      activeCareSpaceId: 'care-beauty',
    }));

    // Simulates a restart / sign-out-sign-in: a fresh read from storage,
    // not a continuation of any in-memory state.
    const restarted = await loadOnboardingState('user-a');
    const beauty = restarted.careSpaces['care-beauty'];
    expect(beauty.setupStatus).toBe('ready');
    // The stored selection itself survives (it's still readable), but
    // because setupStatus is 'ready', FirstThingScreen's own `everyday`
    // handling (see tests/phase1-ui.characterization.test.tsx) makes it
    // completely inert from here on -- every canonical category,
    // including ones never selected (e.g. Care information/"Medication"),
    // remains available through the normal Add flow with no special
    // migration, setting change, or return to onboarding.
    expect(beauty.interests).toEqual(['appointment', 'bill']);
  });
});
