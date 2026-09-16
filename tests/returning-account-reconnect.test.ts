import {
  ProvisionedPerson,
  resolveOnboardingStateAfterAccountReconnect,
} from '../src/careSpaceState';
import { initialOnboardingState } from '../src/storage';

const existingPeople: ProvisionedPerson[] = [
  {
    draftId: '11111111-1111-4111-8111-111111111111',
    careSpaceId: '22222222-2222-4222-8222-222222222222',
    supportedPersonId: '33333333-3333-4333-8333-333333333333',
    membershipId: '44444444-4444-4444-8444-444444444444',
    displayName: 'Maggie',
    relationshipType: 'Mum',
    role: 'organiser',
    status: 'active',
  },
  {
    draftId: '55555555-5555-4555-8555-555555555555',
    careSpaceId: '66666666-6666-4666-8666-666666666666',
    supportedPersonId: '77777777-7777-4777-8777-777777777777',
    membershipId: '88888888-8888-4888-8888-888888888888',
    displayName: 'Ben',
    relationshipType: 'Dad',
    role: 'organiser',
    status: 'active',
  },
];

describe('returning-account startup reconciliation', () => {
  it('turns a fresh local install with existing server people into a returning account', () => {
    const result = resolveOnboardingStateAfterAccountReconnect(
      {
        ...initialOnboardingState,
        stage: 'peopleReview',
        onboardingDraft: {
          version: 2,
          stage: 'review',
          people: [],
          addingAfterOnboarding: false,
        },
      },
      existingPeople,
    );

    expect(result.onboardingComplete).toBe(true);
    expect(result.stage).toBe('home');
    expect(result.onboardingDraft).toBeUndefined();
    expect(Object.values(result.careSpaces).map((person) => person.displayName).sort()).toEqual(['Ben', 'Maggie']);
  });

  it('leaves a genuinely new account in onboarding when the server has no people', () => {
    const result = resolveOnboardingStateAfterAccountReconnect(initialOnboardingState, []);

    expect(result.onboardingComplete).toBe(false);
    expect(result.stage).toBe('welcome');
    expect(result.careSpaces).toEqual({});
  });

  it('does not alter completed onboarding navigation during an ordinary reconnect', () => {
    const result = resolveOnboardingStateAfterAccountReconnect(
      { ...initialOnboardingState, onboardingComplete: true, stage: 'firstThing' },
      existingPeople,
    );

    expect(result.onboardingComplete).toBe(true);
    expect(result.stage).toBe('firstThing');
  });
});
