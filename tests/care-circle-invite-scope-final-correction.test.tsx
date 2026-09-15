// LILICA -- FINAL CARE CIRCLE INVITATION SCOPE CORRECTION
// (`\downloads\carecircle-final-invitation-scope-correction.txt`, 15
// September 2026). The real, physically-reported defect: David
// (organiser of both Maggie and Ben) opened "Invite someone" and the
// UI only offered Maggie. Traced to the exact cause: App.tsx's
// organiserEligiblePeople list is derived entirely from each care
// space's local `role` field, and that field was previously populated
// ONLY by a one-shot, un-retried reconnectCareSpaces() call fired once
// per signed-in session -- if that single attempt hadn't completed (or
// had failed) by the time Care Circle was opened, the multi-person
// checkbox section silently never appeared, for the rest of that
// session, with no way to recover short of restarting the app. Fixed by
// re-running reconnectCareSpaces()/integrateReconnectedCareSpaces()
// (both pre-existing, unmodified) every time Care Circle is opened --
// the exact same refresh-on-open pattern this codebase already uses for
// members/invitations. This file proves the underlying reconciliation
// function itself correctly repairs the exact starting state that
// caused the bug, and that the resulting eligible-people list correctly
// excludes a care space David does not organise.
import {
  integrateProvisionedPeople,
  integrateReconnectedCareSpaces,
  activeCareSpaces,
  ProvisionedPerson,
} from '../src/careSpaceState';
import { initialOnboardingState } from '../src/storage';
import { SupportedPersonDraft } from '../src/types';

const drafts: SupportedPersonDraft[] = [
  { draftId: 'maggie-draft', relationshipType: 'Mum', displayName: 'Maggie', order: 0 },
  { draftId: 'ben-draft', relationshipType: 'Dad', displayName: 'Ben', order: 1 },
];

describe('The exact reported root cause: role missing on David\'s own bootstrapped care spaces', () => {
  it('a freshly-bootstrapped care space (never yet reconnected) has NO role set -- reproducing the exact bug precondition', () => {
    const provisioned = drafts.map((draft, index) => ({
      draftId: draft.draftId,
      careSpaceId: `care-${index}`,
      supportedPersonId: `person-${index}`,
      membershipId: `membership-${index}`,
    }));
    const state = integrateProvisionedPeople(initialOnboardingState, drafts, provisioned);
    const spaces = activeCareSpaces(state);
    expect(spaces).toHaveLength(2);
    // This is the exact defect precondition: role is undefined for
    // BOTH of David's own spaces immediately after bootstrap, so an
    // organiserEligiblePeople filter on role === 'organiser' would find
    // NEITHER of them -- not even Maggie -- until reconnectCareSpaces()
    // genuinely runs and succeeds.
    expect(spaces.every((space) => space.role === undefined)).toBe(true);
  });

  it('reconnectCareSpaces()\'s own reconciliation (integrateReconnectedCareSpaces) repairs this -- BOTH Maggie and Ben correctly become organiser once the real server data arrives', () => {
    const provisioned = drafts.map((draft, index) => ({
      draftId: draft.draftId,
      careSpaceId: `care-${index}`,
      supportedPersonId: `person-${index}`,
      membershipId: `membership-${index}`,
    }));
    let state = integrateProvisionedPeople(initialOnboardingState, drafts, provisioned);

    // Exactly what list_my_supported_people() returns for David: both
    // spaces, both role 'organiser'.
    const serverTruth: ProvisionedPerson[] = [
      { draftId: 'maggie-draft', careSpaceId: 'care-0', supportedPersonId: 'person-0', membershipId: 'membership-0', displayName: 'Maggie', relationshipType: 'Mum', role: 'organiser', status: 'active' },
      { draftId: 'ben-draft', careSpaceId: 'care-1', supportedPersonId: 'person-1', membershipId: 'membership-1', displayName: 'Ben', relationshipType: 'Dad', role: 'organiser', status: 'active' },
    ];
    state = integrateReconnectedCareSpaces(state, serverTruth);

    const spaces = activeCareSpaces(state);
    const organiserEligiblePeople = spaces
      .filter((space) => space.role === 'organiser' && !space.careSpaceId.startsWith('local-') && space.displayName)
      .map((space) => ({ careSpaceId: space.careSpaceId, displayName: space.displayName as string }));

    // This is the exact fix proven: BOTH Maggie and Ben are now
    // eligible -- App.tsx's checkbox section (organiserEligiblePeople.
    // length > 1) will genuinely render both, not just the current one.
    expect(organiserEligiblePeople).toHaveLength(2);
    expect(organiserEligiblePeople.map((p) => p.displayName).sort()).toEqual(['Ben', 'Maggie']);
  });

  it('TEST 7 (brief): a care space where David is only a CONTRIBUTOR is correctly excluded -- never selectable for invitation', () => {
    const provisioned = drafts.map((draft, index) => ({
      draftId: draft.draftId,
      careSpaceId: `care-${index}`,
      supportedPersonId: `person-${index}`,
      membershipId: `membership-${index}`,
    }));
    let state = integrateProvisionedPeople(initialOnboardingState, drafts, provisioned);

    // David organises Maggie, but is only a contributor of a THIRD
    // space ("Kate") that also shows up in his own supported-person
    // list (e.g. someone else invited him to it).
    const serverTruth: ProvisionedPerson[] = [
      { draftId: 'maggie-draft', careSpaceId: 'care-0', supportedPersonId: 'person-0', membershipId: 'membership-0', displayName: 'Maggie', relationshipType: 'Mum', role: 'organiser', status: 'active' },
      { draftId: 'ben-draft', careSpaceId: 'care-1', supportedPersonId: 'person-1', membershipId: 'membership-1', displayName: 'Ben', relationshipType: 'Dad', role: 'organiser', status: 'active' },
      { draftId: 'kate-draft', careSpaceId: 'care-2', supportedPersonId: 'person-2', membershipId: 'membership-2', displayName: 'Kate', relationshipType: 'Other relative', relationshipLabel: 'Friend', role: 'contributor', status: 'active' },
    ];
    state = integrateReconnectedCareSpaces(state, serverTruth);

    const spaces = activeCareSpaces(state);
    const organiserEligiblePeople = spaces
      .filter((space) => space.role === 'organiser' && !space.careSpaceId.startsWith('local-') && space.displayName)
      .map((space) => ({ careSpaceId: space.careSpaceId, displayName: space.displayName as string }));

    expect(organiserEligiblePeople.map((p) => p.displayName).sort()).toEqual(['Ben', 'Maggie']);
    expect(organiserEligiblePeople.some((p) => p.displayName === 'Kate')).toBe(false);
  });
});
