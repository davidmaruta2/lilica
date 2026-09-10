import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  initialOnboardingState,
  loadOnboardingState,
  prepareOnboardingStateForStartup,
  saveOnboardingState,
} from '../src/storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const getItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;
const setItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>;

function fixture(name: string) {
  return require(`./fixtures/migration/${name}`) as Record<string, unknown>;
}

describe('Phase 1 AsyncStorage characterization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the initial state when no data has been stored', async () => {
    getItem.mockResolvedValue(null);
    await expect(loadOnboardingState()).resolves.toBe(initialOnboardingState);
  });

  it('preserves the current records array as stored', async () => {
    const stored = fixture('current-records.json');
    getItem.mockResolvedValue(JSON.stringify(stored));
    const loaded = await loadOnboardingState();
    expect(loaded.records).toEqual(stored.records);
    expect(loaded.privacyDeclarationVersion).toBe('privacy-basis-v2');
  });

  it('migrates a legacy firstItem when records is absent', async () => {
    const stored = fixture('legacy-first-item.json');
    getItem.mockResolvedValue(JSON.stringify(stored));
    const loaded = await loadOnboardingState();
    expect(loaded.records).toHaveLength(1);
    expect(loaded.records[0]).toMatchObject({
      id: 'appointment-legacy-1',
      date: '24 September',
      status: 'saved',
      updatedAt: '2026-09-08T12:00:00.000Z',
    });
  });

  it.each([
    'completed-record.json',
    'recurring-record.json',
    'record-with-attachments.json',
  ])('round-trips historical fields from %s', async (name) => {
    const stored = fixture(name);
    getItem.mockResolvedValue(JSON.stringify(stored));
    const loaded = await loadOnboardingState();
    expect(loaded.records).toEqual(stored.records);
  });

  it('falls back to legacy firstItem when records has a malformed non-array value', async () => {
    const stored = fixture('partial-legacy-state.json');
    getItem.mockResolvedValue(JSON.stringify(stored));
    const loaded = await loadOnboardingState();
    expect(loaded.records).toEqual([
      expect.objectContaining({ id: 'document-partial-1', status: 'saved' }),
    ]);
    expect(loaded.onboardingComplete).toBe(false);
    expect(loaded.allSetDismissed).toBe(false);
  });

  it('currently rejects malformed JSON rather than repairing it', async () => {
    getItem.mockResolvedValue('{not-json');
    await expect(loadOnboardingState()).rejects.toBeInstanceOf(SyntaxError);
  });

  it('writes the entire onboarding state under one storage operation', async () => {
    setItem.mockResolvedValue();
    await saveOnboardingState(initialOnboardingState);
    expect(setItem).toHaveBeenCalledWith('lilica:onboarding:v1', JSON.stringify(initialOnboardingState));
  });

  it('isolates authenticated onboarding state by account without adopting legacy device data', async () => {
    getItem.mockImplementation(async (key) => key === 'lilica:onboarding:v1'
      ? JSON.stringify({ ...initialOnboardingState, supportedPersonName: 'Maggie', onboardingComplete: true })
      : null);

    const loaded = await loadOnboardingState('new-user-id');
    expect(getItem).toHaveBeenCalledWith('lilica:onboarding:v1:new-user-id');
    expect(loaded).toBe(initialOnboardingState);

    setItem.mockResolvedValue();
    await saveOnboardingState({ ...initialOnboardingState, supportedPersonName: 'David' }, 'new-user-id');
    expect(setItem).toHaveBeenCalledWith(
      'lilica:onboarding:v1:new-user-id',
      JSON.stringify({ ...initialOnboardingState, supportedPersonName: 'David' }),
    );
  });

  it('starts logged-out sessions at Welcome without deleting stored progress', () => {
    const stored = {
      ...initialOnboardingState,
      stage: 'emailAuth' as const,
      onboardingComplete: true,
    };

    expect(prepareOnboardingStateForStartup(stored)).toMatchObject({
      stage: 'welcome',
      onboardingComplete: true,
    });
    expect(stored.stage).toBe('emailAuth');
  });

  it('continues authenticated users from their account-scoped progress', () => {
    expect(prepareOnboardingStateForStartup({
      ...initialOnboardingState,
      stage: 'firstThing',
      privacyDeclarationAccepted: true,
    }, 'user-a').stage).toBe('firstThing');

    expect(prepareOnboardingStateForStartup({
      ...initialOnboardingState,
      stage: 'emailAuth',
      onboardingComplete: true,
    }, 'user-a').stage).toBe('home');
  });

  it('re-routes a resumed first-pass relationship stage back through the self/someone-else fork', () => {
    // A stage of 'relationship' saved before the fork existed (or from
    // simply backing out of that screen) must not resume the app directly
    // at the old relationship wheel -- it must resume at the fork instead,
    // since no care space or draft actually exists yet.
    expect(prepareOnboardingStateForStartup({
      ...initialOnboardingState,
      stage: 'relationship',
      privacyDeclarationAccepted: true,
    }, 'user-a').stage).toBe('careFork');
  });

  it('leaves a resumed relationship stage alone once onboarding has actually started', () => {
    // Once a care space or in-progress draft exists, the fork has already
    // been passed (or intentionally skipped for "someone else"); resuming
    // mid-relationship-selection must not be rewound back to the fork.
    expect(prepareOnboardingStateForStartup({
      ...initialOnboardingState,
      stage: 'relationship',
      privacyDeclarationAccepted: true,
      onboardingDraft: {
        stage: 'relationships',
        currentDraftId: undefined,
        people: [{ draftId: 'd1', order: 0, relationshipType: 'Mum', relationshipLabel: undefined, displayName: '' }],
      },
    } as any, 'user-a').stage).toBe('relationship');

    expect(prepareOnboardingStateForStartup({
      ...initialOnboardingState,
      stage: 'relationship',
      privacyDeclarationAccepted: true,
      careSpaces: { 'space-1': {} as any },
    }, 'user-a').stage).toBe('relationship');
  });

  it('round-trips several records in the same category without collapsing them', async () => {
    const appointments = ['Orthodontist', 'GP', 'Dentist'].map((title, index) => ({
      id: `appointment-${index}`,
      type: 'appointment' as const,
      title,
      eventDate: `2026-09-${15 + index}`,
      createdAt: '2026-09-09T12:00:00.000Z',
    }));
    const state = { ...initialOnboardingState, records: appointments };
    setItem.mockResolvedValue();
    await saveOnboardingState(state, 'user-a');
    getItem.mockResolvedValue(JSON.stringify(state));

    await expect(loadOnboardingState('user-a')).resolves.toMatchObject({ records: appointments });
  });
});
