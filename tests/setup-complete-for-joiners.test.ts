// 4 November 2026 two-device test, finding F6: a contributor who joined an
// existing care circle saw "[Person] still needs setting up" with a Continue
// setup button into the organiser's setup wizard. Setting a person up is the
// organiser's job, so anyone else always sees the space as set up.

import { integrateReconnectedCareSpaces, isCareSpaceSetupComplete } from '../src/careSpaceState';
import { initialOnboardingState } from '../src/storage';
import { LocalCareSpaceState } from '../src/types';

function space(patch: Partial<LocalCareSpaceState> = {}): Pick<LocalCareSpaceState, 'setupStatus' | 'role'> {
  return { setupStatus: 'identity_only', role: undefined, ...patch };
}

describe('isCareSpaceSetupComplete', () => {
  it('is false when there is no space', () => {
    expect(isCareSpaceSetupComplete(undefined)).toBe(false);
  });

  it('is true for any contributor or viewer, whatever the stored status, so the setup card never shows for them', () => {
    expect(isCareSpaceSetupComplete(space({ role: 'contributor' }))).toBe(true);
    expect(isCareSpaceSetupComplete(space({ role: 'viewer' }))).toBe(true);
    expect(isCareSpaceSetupComplete(space({ role: 'contributor', setupStatus: 'privacy_pending' }))).toBe(true);
  });

  it('keeps the original rule for the organiser: only a ready space is complete', () => {
    expect(isCareSpaceSetupComplete(space({ role: 'organiser', setupStatus: 'identity_only' }))).toBe(false);
    expect(isCareSpaceSetupComplete(space({ role: 'organiser', setupStatus: 'interests_pending' }))).toBe(false);
    expect(isCareSpaceSetupComplete(space({ role: 'organiser', setupStatus: 'records_pending' }))).toBe(false);
    expect(isCareSpaceSetupComplete(space({ role: 'organiser', setupStatus: 'ready' }))).toBe(true);
  });

  it('keeps the original rule when the role is not known yet (a space still being created on this device)', () => {
    expect(isCareSpaceSetupComplete(space({ setupStatus: 'identity_only' }))).toBe(false);
    expect(isCareSpaceSetupComplete(space({ setupStatus: 'ready' }))).toBe(true);
  });
});

describe('a newly joined space', () => {
  it('arrives with the joiner role, so it counts as set up straight away', () => {
    const state = integrateReconnectedCareSpaces(initialOnboardingState, [
      {
        draftId: 'd1',
        careSpaceId: 'c1000000-0000-4000-a000-000000000001',
        supportedPersonId: 'p1',
        membershipId: 'm1',
        displayName: 'Robin',
        relationshipType: 'Someone else',
        role: 'contributor',
        status: 'active',
      },
    ]);
    const joined = state.careSpaces['c1000000-0000-4000-a000-000000000001'];
    expect(joined.setupStatus).toBe('identity_only');
    expect(isCareSpaceSetupComplete(joined)).toBe(true);
  });
});
