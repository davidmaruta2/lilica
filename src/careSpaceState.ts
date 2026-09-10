import {
  LocalCareSpaceState,
  MultiPersonOnboardingDraft,
  OnboardingState,
  Relationship,
  SupportedPersonDraft,
} from './types';

export type ProvisionedPerson = {
  draftId: string;
  careSpaceId: string;
  supportedPersonId: string;
  membershipId: string;
};

export function createUuid(): string {
  const pattern = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return pattern.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function createPersonDraft(relationshipType: Relationship, order: number): SupportedPersonDraft {
  return {
    draftId: createUuid(),
    relationshipType,
    order,
  };
}

export function createOnboardingDraft(addingAfterOnboarding = false): MultiPersonOnboardingDraft {
  return {
    version: 2,
    stage: 'relationships',
    people: [],
    addingAfterOnboarding,
  };
}

export function relationshipName(person: Pick<SupportedPersonDraft, 'relationshipType' | 'relationshipLabel'>): string {
  return person.relationshipLabel?.trim() || person.relationshipType;
}

export function validatePersonDraft(person: SupportedPersonDraft): boolean {
  const nameLength = person.displayName?.trim().length ?? 0;
  if (nameLength < 1 || nameLength > 80) return false;
  if (person.relationshipType === 'Other relative' || person.relationshipType === 'Someone else') {
    const labelLength = person.relationshipLabel?.trim().length ?? 0;
    return labelLength >= 1 && labelLength <= 50;
  }
  return true;
}

export function integrateProvisionedPeople(
  state: OnboardingState,
  people: SupportedPersonDraft[],
  provisioned: ProvisionedPerson[],
): OnboardingState {
  const links = new Map(provisioned.map((person) => [person.draftId, person]));
  const careSpaces = { ...state.careSpaces };

  for (const draft of people) {
    const link = links.get(draft.draftId);
    if (!link || !validatePersonDraft(draft)) continue;
    careSpaces[link.careSpaceId] = {
      careSpaceId: link.careSpaceId,
      supportedPersonId: link.supportedPersonId,
      membershipId: link.membershipId,
      bootstrapId: draft.draftId,
      relationshipType: draft.relationshipType,
      relationshipLabel: draft.relationshipLabel?.trim() || undefined,
      displayName: draft.displayName!.trim(),
      privacyDeclarationAccepted: false,
      interests: [],
      records: [],
      setupStatus: 'identity_only',
      allSetDismissed: false,
    };
  }

  return { ...state, careSpaces };
}

export function linkProvisionedCareSpaces(
  state: OnboardingState,
  provisioned: ProvisionedPerson[],
): OnboardingState {
  let activeCareSpaceId = state.activeCareSpaceId;
  const careSpaces = { ...state.careSpaces };

  for (const link of provisioned) {
    const entry = Object.entries(careSpaces).find(([, space]) => space.bootstrapId === link.draftId);
    if (!entry) continue;
    const [oldKey, space] = entry;
    delete careSpaces[oldKey];
    careSpaces[link.careSpaceId] = {
      ...space,
      careSpaceId: link.careSpaceId,
      supportedPersonId: link.supportedPersonId,
      membershipId: link.membershipId,
      records: space.records.map((record) => ({ ...record, supportedPersonId: link.supportedPersonId })),
    };
    if (activeCareSpaceId === oldKey) activeCareSpaceId = link.careSpaceId;
  }

  return projectActiveCareSpace({ ...state, careSpaces, activeCareSpaceId });
}

export function replaceCareSpace(
  state: OnboardingState,
  careSpaceId: string,
  update: (space: LocalCareSpaceState) => LocalCareSpaceState,
): OnboardingState {
  const current = state.careSpaces[careSpaceId];
  if (!current) return state;
  return {
    ...state,
    careSpaces: { ...state.careSpaces, [careSpaceId]: update(current) },
  };
}

export function activeCareSpace(state: OnboardingState): LocalCareSpaceState | undefined {
  return state.activeCareSpaceId ? state.careSpaces[state.activeCareSpaceId] : undefined;
}

export function projectActiveCareSpace(state: OnboardingState): OnboardingState {
  const active = activeCareSpace(state);
  if (!active) return state;
  return {
    ...state,
    relationship: active.relationshipType,
    supportedPersonName: active.displayName,
    supportedPersonId: active.supportedPersonId,
    privacyDeclarationAccepted: active.privacyDeclarationAccepted,
    privacyDeclarationVersion: active.privacyDeclarationVersion,
    privacyDeclarationAcceptedAt: active.privacyDeclarationAcceptedAt,
    interests: active.interests,
    records: active.records,
    firstItem: active.records[0],
    allSetDismissed: active.allSetDismissed,
  };
}
