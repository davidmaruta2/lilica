import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render } from '@testing-library/react-native';

import {
  activeCareSpace,
  integrateProvisionedPeople,
  integrateReconnectedCareSpaces,
  projectActiveCareSpace,
  replaceCareSpace,
  validatePersonDraft,
} from '../src/careSpaceState';
import { RelationshipScreen } from '../src/screens/RelationshipScreen';
import { initialOnboardingState, loadOnboardingState } from '../src/storage';
import { SupportedPersonDraft } from '../src/types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

const getItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>;

const drafts: SupportedPersonDraft[] = [
  { draftId: '10000000-0000-4000-a000-000000000001', relationshipType: 'Mum', displayName: 'Jackie', order: 0 },
  { draftId: '10000000-0000-4000-a000-000000000002', relationshipType: 'Dad', displayName: 'Brian', order: 1 },
];

function provisioned() {
  return drafts.map((draft, index) => ({
    draftId: draft.draftId,
    careSpaceId: `care-${index}`,
    supportedPersonId: `person-${index}`,
    membershipId: `membership-${index}`,
  }));
}

describe('Phase 6A multi-person contract', () => {
  it('selects multiple relationships in the vertical carousel', async () => {
    const onToggle = jest.fn();
    const expanded = await render(
      <RelationshipScreen people={drafts} onBack={jest.fn()} onToggle={onToggle} onContinue={jest.fn()} />,
    );
    expect(expanded.getByLabelText('Mum').props.accessibilityState.checked).toBe(true);
    expect(expanded.getByLabelText('Dad').props.accessibilityState.checked).toBe(true);
    await fireEvent.press(expanded.getByLabelText('Child'));
    expect(onToggle).toHaveBeenCalledWith('Child');
  });

  it('collapses selected relationships into a compact summary', async () => {
    const collapsed = await render(
      <RelationshipScreen people={drafts} collapsed onBack={jest.fn()} onContinue={jest.fn()} onAddAnother={jest.fn()} />,
    );
    collapsed.getByText('Mum');
    collapsed.getByText('Dad');
    collapsed.getByLabelText('+ Add another person');
  });

  it('offers a Remove control per person in the collapsed summary, wired to onRemovePerson', async () => {
    const onRemovePerson = jest.fn();
    const collapsed = await render(
      <RelationshipScreen
        people={drafts}
        collapsed
        onBack={jest.fn()}
        onContinue={jest.fn()}
        onAddAnother={jest.fn()}
        onRemovePerson={onRemovePerson}
      />,
    );
    await fireEvent.press(collapsed.getByLabelText('Remove Dad'));
    expect(onRemovePerson).toHaveBeenCalledWith('10000000-0000-4000-a000-000000000002');
  });

  it('renders no Remove control when onRemovePerson is not supplied', async () => {
    const collapsed = await render(
      <RelationshipScreen people={drafts} collapsed onBack={jest.fn()} onContinue={jest.fn()} onAddAnother={jest.fn()} />,
    );
    expect(collapsed.queryByLabelText('Remove Dad')).toBeNull();
  });

  it('allows duplicate relationship types because draft identity is distinct', () => {
    const children: SupportedPersonDraft[] = [
      { draftId: 'child-1', relationshipType: 'Child', displayName: 'Amelia', order: 0 },
      { draftId: 'child-2', relationshipType: 'Child', displayName: 'Oscar', order: 1 },
    ];
    expect(children.every(validatePersonDraft)).toBe(true);
    expect(new Set(children.map((person) => person.draftId)).size).toBe(2);
  });

  it('requires custom labels for Other relative and Someone else', () => {
    expect(validatePersonDraft({ draftId: 'a', relationshipType: 'Other relative', displayName: 'Susan', order: 0 })).toBe(false);
    expect(validatePersonDraft({ draftId: 'a', relationshipType: 'Other relative', relationshipLabel: 'Aunt', displayName: 'Susan', order: 0 })).toBe(true);
    expect(validatePersonDraft({ draftId: 'b', relationshipType: 'Someone else', relationshipLabel: 'Neighbour', displayName: 'Helen', order: 1 })).toBe(true);
  });
});

describe('Phase 6 care-space state', () => {
  it('creates separate care spaces, people, and memberships for Mum and Dad', () => {
    const state = integrateProvisionedPeople(initialOnboardingState, drafts, provisioned());
    expect(Object.keys(state.careSpaces)).toEqual(['care-0', 'care-1']);
    expect(new Set(Object.values(state.careSpaces).map((space) => space.supportedPersonId)).size).toBe(2);
    expect(new Set(Object.values(state.careSpaces).map((space) => space.membershipId)).size).toBe(2);
  });

  it('reconnects cloud care spaces on a new device without inventing local consent', () => {
    const state = integrateReconnectedCareSpaces(initialOnboardingState, [{
      draftId: drafts[0].draftId,
      careSpaceId: 'a1000000-0000-4000-a000-000000000001',
      supportedPersonId: 'a2000000-0000-4000-a000-000000000001',
      membershipId: 'a3000000-0000-4000-a000-000000000001',
      displayName: 'Jackie',
      relationshipType: 'Mum',
    }]);
    const reconnected = activeCareSpace(state)!;
    expect(reconnected.displayName).toBe('Jackie');
    expect(reconnected.setupStatus).toBe('identity_only');
    expect(reconnected.privacyDeclarationAccepted).toBe(false);
    expect(reconnected.records).toEqual([]);
  });

  it('isolates interests and records when the active care space changes', () => {
    let state = integrateProvisionedPeople(initialOnboardingState, drafts, provisioned());
    state = replaceCareSpace(state, 'care-0', (space) => ({
      ...space,
      interests: ['appointment', 'bill'],
      records: [{ id: 'dentist', type: 'appointment', title: 'Dentist', supportedPersonId: space.supportedPersonId, createdAt: '2026-09-10T00:00:00Z' }],
    }));
    state = replaceCareSpace(state, 'care-1', (space) => ({
      ...space,
      interests: ['careNote'],
      records: [{ id: 'gp', type: 'appointment', title: 'GP', supportedPersonId: space.supportedPersonId, createdAt: '2026-09-10T00:00:00Z' }],
    }));

    const jackie = projectActiveCareSpace({ ...state, activeCareSpaceId: 'care-0' });
    expect(jackie.interests).toEqual(['appointment', 'bill']);
    expect(jackie.records.map((record) => record.id)).toEqual(['dentist']);
    const brian = projectActiveCareSpace({ ...jackie, activeCareSpaceId: 'care-1' });
    expect(brian.interests).toEqual(['careNote']);
    expect(brian.records.map((record) => record.id)).toEqual(['gp']);
    expect(activeCareSpace(brian)?.displayName).toBe('Brian');
  });

  it('migrates a completed legacy person once without changing records or attachments', async () => {
    const legacyRecord = {
      id: 'record-1',
      type: 'document',
      title: 'Power of attorney',
      createdAt: '2026-09-09T12:00:00Z',
      attachments: [{ id: 'attachment-1', kind: 'file', uri: 'file://poa.pdf', name: 'poa.pdf', createdAt: '2026-09-09T12:00:00Z' }],
    };
    getItem.mockResolvedValue(JSON.stringify({
      ...initialOnboardingState,
      migrationVersion: undefined,
      careSpaces: undefined,
      relationship: 'Mum',
      supportedPersonName: 'Jackie',
      supportedPersonId: 'legacy-jackie',
      privacyDeclarationAccepted: true,
      privacyDeclarationVersion: 'privacy-basis-v2',
      interests: ['appointments'],
      records: [legacyRecord],
      onboardingComplete: true,
      stage: 'home',
    }));

    const first = await loadOnboardingState('user-a');
    const second = await loadOnboardingState('user-a');
    expect(Object.keys(first.careSpaces)).toHaveLength(1);
    expect(Object.keys(second.careSpaces)).toEqual(Object.keys(first.careSpaces));
    const space = activeCareSpace(first)!;
    expect(space.displayName).toBe('Jackie');
    expect(space.records[0].id).toBe('record-1');
    expect(space.records[0].attachments?.[0].id).toBe('attachment-1');
    expect(space.setupStatus).toBe('ready');
  });
});
