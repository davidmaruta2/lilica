// Phase 20D: local-state pure functions for ARCHIVE/RESTORE
// (setCareSpaceStatus, activeCareSpaces, archivedCareSpaces).
import { activeCareSpaces, archivedCareSpaces, setCareSpaceStatus } from '../src/careSpaceState';
import { initialOnboardingState } from '../src/storage';
import { LocalCareSpaceState } from '../src/types';

function space(overrides: Partial<LocalCareSpaceState>): LocalCareSpaceState {
  return {
    careSpaceId: 'space-a',
    supportedPersonId: 'person-a',
    bootstrapId: 'bootstrap-a',
    relationshipType: 'Mum',
    displayName: 'Maggie',
    privacyDeclarationAccepted: true,
    interests: [],
    records: [],
    setupStatus: 'ready',
    allSetDismissed: true,
    ...overrides,
  };
}

describe('setCareSpaceStatus', () => {
  it('archives the targeted care space, preserving every other field', () => {
    const maggie = space({ careSpaceId: 'space-a', displayName: 'Maggie' });
    const state = { ...initialOnboardingState, careSpaces: { 'space-a': maggie }, activeCareSpaceId: 'space-a' };
    const next = setCareSpaceStatus(state, 'space-a', 'archived');
    expect(next.careSpaces['space-a'].status).toBe('archived');
    expect(next.careSpaces['space-a'].displayName).toBe('Maggie');
    expect(next.careSpaces['space-a'].records).toEqual(maggie.records);
  });

  it('restores an archived care space back to active', () => {
    const maggie = space({ careSpaceId: 'space-a', status: 'archived' });
    const state = { ...initialOnboardingState, careSpaces: { 'space-a': maggie }, activeCareSpaceId: undefined };
    const next = setCareSpaceStatus(state, 'space-a', 'active');
    expect(next.careSpaces['space-a'].status).toBe('active');
  });

  it('archiving the currently active space falls back to a remaining ACTIVE one -- never an archived one', () => {
    const maggie = space({ careSpaceId: 'space-a', displayName: 'Maggie' });
    const ben = space({ careSpaceId: 'space-b', supportedPersonId: 'person-b', bootstrapId: 'bootstrap-b', displayName: 'Ben', status: 'archived' });
    const jackie = space({ careSpaceId: 'space-c', supportedPersonId: 'person-c', bootstrapId: 'bootstrap-c', displayName: 'Jackie' });
    const state = {
      ...initialOnboardingState,
      careSpaces: { 'space-a': maggie, 'space-b': ben, 'space-c': jackie },
      activeCareSpaceId: 'space-a',
    };
    const next = setCareSpaceStatus(state, 'space-a', 'archived');
    expect(next.activeCareSpaceId).toBe('space-c');
    expect(next.supportedPersonName).toBe('Jackie');
  });

  it('archiving the only remaining care space clears the projected fields (no stale name left behind)', () => {
    const maggie = space({ careSpaceId: 'space-a', displayName: 'Maggie' });
    const state = { ...initialOnboardingState, careSpaces: { 'space-a': maggie }, activeCareSpaceId: 'space-a', supportedPersonName: 'Maggie' };
    const next = setCareSpaceStatus(state, 'space-a', 'archived');
    expect(next.activeCareSpaceId).toBeUndefined();
    expect(next.supportedPersonName).toBeUndefined();
  });

  it('is a safe no-op for a care space id that is not present', () => {
    const maggie = space({ careSpaceId: 'space-a' });
    const state = { ...initialOnboardingState, careSpaces: { 'space-a': maggie }, activeCareSpaceId: 'space-a' };
    const next = setCareSpaceStatus(state, 'space-nonexistent', 'archived');
    expect(next).toBe(state);
  });
});

describe('activeCareSpaces / archivedCareSpaces', () => {
  it('separates active from archived care spaces -- the ordinary switcher must never see an archived one', () => {
    const maggie = space({ careSpaceId: 'space-a', displayName: 'Maggie' });
    const ben = space({ careSpaceId: 'space-b', supportedPersonId: 'person-b', bootstrapId: 'bootstrap-b', displayName: 'Ben', status: 'archived' });
    const state = { ...initialOnboardingState, careSpaces: { 'space-a': maggie, 'space-b': ben } };
    expect(activeCareSpaces(state).map((s) => s.displayName)).toEqual(['Maggie']);
    expect(archivedCareSpaces(state).map((s) => s.displayName)).toEqual(['Ben']);
  });

  it('a care space with no status at all counts as active (undefined defaults to active, never archived)', () => {
    const maggie = space({ careSpaceId: 'space-a', status: undefined });
    const state = { ...initialOnboardingState, careSpaces: { 'space-a': maggie } };
    expect(activeCareSpaces(state)).toHaveLength(1);
    expect(archivedCareSpaces(state)).toHaveLength(0);
  });
});
