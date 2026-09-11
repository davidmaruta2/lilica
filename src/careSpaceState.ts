import {
  CareSpaceSetupStatus,
  LocalCareSpaceState,
  MultiPersonOnboardingDraft,
  OnboardingStage,
  OnboardingState,
  Relationship,
  SupportedPersonDraft,
} from './types';
import { createUuid } from './identifiers';

export type ProvisionedPerson = {
  draftId: string;
  careSpaceId: string;
  supportedPersonId: string;
  membershipId: string;
  displayName?: string;
  relationshipType?: Relationship;
  relationshipLabel?: string;
};

export { createUuid } from './identifiers';

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

export function integrateReconnectedCareSpaces(
  state: OnboardingState,
  provisioned: ProvisionedPerson[],
): OnboardingState {
  const careSpaces = { ...state.careSpaces };
  for (const link of provisioned) {
    const current = careSpaces[link.careSpaceId];
    if (current) {
      careSpaces[link.careSpaceId] = {
        ...current,
        supportedPersonId: link.supportedPersonId,
        membershipId: link.membershipId,
      };
      continue;
    }
    if (!link.displayName || !link.relationshipType) continue;
    careSpaces[link.careSpaceId] = {
      careSpaceId: link.careSpaceId,
      supportedPersonId: link.supportedPersonId,
      membershipId: link.membershipId,
      bootstrapId: link.draftId,
      relationshipType: link.relationshipType,
      relationshipLabel: link.relationshipLabel,
      displayName: link.displayName,
      privacyDeclarationAccepted: false,
      interests: [],
      records: [],
      setupStatus: 'identity_only',
      allSetDismissed: false,
    };
  }
  const activeCareSpaceId = state.activeCareSpaceId && careSpaces[state.activeCareSpaceId]
    ? state.activeCareSpaceId
    : provisioned[0]?.careSpaceId;
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

// Corrective task 5 (Everyday Add navigation defect): App.tsx's top-level
// "Back" walks a fixed onboarding stageOrder array backward by default.
// That is correct for the genuine first-time onboarding sequence
// (interests -> firstThing), but 'firstThing' is ALSO where Home's
// everyday "Add" button jumps straight to (from 'home' itself) -- both
// leave state.stage identically 'firstThing', so stage position alone
// cannot distinguish onboarding entry from everyday-add entry. Walking
// stageOrder blindly in the everyday case lands back on 'interests'
// ("What do you help X with?"), an onboarding screen the person has
// already completed -- the reported bug.
//
// setupStatus is the real, already-explicit distinguishing signal, never
// inferred from navigation/screen history: it only ever reaches 'ready'
// once onboarding has genuinely finished for this care space (set by
// completeOnboarding()), so a 'firstThing' visit while it is already
// 'ready' is necessarily an everyday Add, never onboarding -- back must
// return to Home instead of continuing further back through stageOrder.
// This must hold for "Back" both before and after a save, since App.tsx
// wires the identical onBack handler to both moments.
export function resolveBackStage(
  currentStage: OnboardingStage,
  setupStatus: CareSpaceSetupStatus | undefined,
  stageOrder: OnboardingStage[],
): OnboardingStage | undefined {
  if (currentStage === 'firstThing' && setupStatus === 'ready') {
    return 'home';
  }
  const currentIndex = stageOrder.indexOf(currentStage);
  return currentIndex > 0 ? stageOrder[currentIndex - 1] : undefined;
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
