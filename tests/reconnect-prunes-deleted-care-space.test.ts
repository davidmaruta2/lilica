// Real bug found via direct product-owner report, still reproducing after
// a genuinely fresh app session ("closed Expo Go fully and rescanned,
// Janet still shows"): integrateReconnectedCareSpaces() historically only
// ever added/updated entries, never removing one the server no longer
// lists -- correct for a transient reconnect glitch, but wrong once a
// care space is GENUINELY, PERMANENTLY gone (delete_care_space(), or this
// account's own membership being revoked). Every subsequent app reload
// re-ran reconnect, which kept merging into the stale local copy forever
// rather than ever re-examining whether it should still exist.
import { integrateReconnectedCareSpaces, ProvisionedPerson } from '../src/careSpaceState';
import { initialOnboardingState } from '../src/storage';
import { LocalCareSpaceState } from '../src/types';

function space(overrides: Partial<LocalCareSpaceState>): LocalCareSpaceState {
  return {
    careSpaceId: 'space-a',
    supportedPersonId: 'person-a',
    bootstrapId: 'bootstrap-a',
    relationshipType: 'Mum',
    displayName: 'Beauty',
    membershipId: 'membership-a',
    privacyDeclarationAccepted: true,
    interests: [],
    records: [],
    setupStatus: 'ready',
    allSetDismissed: true,
    ...overrides,
  };
}

function link(overrides: Partial<ProvisionedPerson>): ProvisionedPerson {
  return {
    draftId: 'draft-a',
    careSpaceId: 'space-a',
    supportedPersonId: 'person-a',
    membershipId: 'membership-a',
    displayName: 'Beauty',
    relationshipType: 'Mum',
    role: 'organiser',
    status: 'active',
    ...overrides,
  };
}

describe('integrateReconnectedCareSpaces: prunes a genuinely deleted/revoked care space', () => {
  it('removes a previously-synced care space the server no longer lists at all -- the exact reported bug', () => {
    const beauty = space({ careSpaceId: 'space-a', displayName: 'Beauty' });
    const janet = space({ careSpaceId: 'space-b', supportedPersonId: 'person-b', bootstrapId: 'bootstrap-b', membershipId: 'membership-b', displayName: 'Janet' });
    const state = { ...initialOnboardingState, careSpaces: { 'space-a': beauty, 'space-b': janet }, activeCareSpaceId: 'space-b', supportedPersonName: 'Janet' };

    // The server's own authoritative response after both were deleted --
    // Beauty and Janet no longer appear at all.
    const next = integrateReconnectedCareSpaces(state, []);

    expect(next.careSpaces['space-a']).toBeUndefined();
    expect(next.careSpaces['space-b']).toBeUndefined();
    expect(next.activeCareSpaceId).toBeUndefined();
    // The stale name must not survive either (the earlier, separate
    // projectActiveCareSpace() fix for the same underlying report).
    expect(next.supportedPersonName).toBeUndefined();
  });

  it('removes only the one no longer returned, leaving an untouched synced space alone', () => {
    const beauty = space({ careSpaceId: 'space-a', displayName: 'Beauty' });
    const janet = space({ careSpaceId: 'space-b', supportedPersonId: 'person-b', bootstrapId: 'bootstrap-b', membershipId: 'membership-b', displayName: 'Janet' });
    const state = { ...initialOnboardingState, careSpaces: { 'space-a': beauty, 'space-b': janet }, activeCareSpaceId: 'space-b' };

    // The server now returns ONLY Beauty -- Janet's own membership was
    // revoked/her care space deleted.
    const next = integrateReconnectedCareSpaces(state, [link({ careSpaceId: 'space-a', displayName: 'Beauty' })]);

    expect(next.careSpaces['space-a']).toBeDefined();
    expect(next.careSpaces['space-b']).toBeUndefined();
    expect(next.activeCareSpaceId).toBe('space-a');
    expect(next.supportedPersonName).toBe('Beauty');
  });

  it('never prunes a local-only (never-synced) care space, even when the server response omits it -- the server was never going to list it', () => {
    const localOnly = space({ careSpaceId: 'local-abc', membershipId: undefined, displayName: 'Ben' });
    const state = { ...initialOnboardingState, careSpaces: { 'local-abc': localOnly }, activeCareSpaceId: 'local-abc' };

    const next = integrateReconnectedCareSpaces(state, []);

    expect(next.careSpaces['local-abc']).toBeDefined();
    expect(next.careSpaces['local-abc'].displayName).toBe('Ben');
  });

  it('never prunes a synced space that IS still returned by the server (the original, pre-existing guarantee this fix must not break)', () => {
    const beauty = space({ careSpaceId: 'space-a', displayName: 'Beauty' });
    const state = { ...initialOnboardingState, careSpaces: { 'space-a': beauty }, activeCareSpaceId: 'space-a' };

    const next = integrateReconnectedCareSpaces(state, [link({ careSpaceId: 'space-a', displayName: 'Beauty' })]);

    expect(next.careSpaces['space-a']).toBeDefined();
  });
});
