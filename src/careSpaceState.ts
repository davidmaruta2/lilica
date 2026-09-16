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
  // Remove-supported-person follow-up: this account's own role for this
  // specific care space -- undefined only for the (rare) provisioning
  // path that doesn't carry it yet (createOnboardingDraft/local-only
  // linking). Lets Privacy & data list every space this account
  // genuinely ORGANISES, not just the currently active one.
  role?: 'organiser' | 'contributor' | 'viewer';
  // Phase 20D: mirrors LocalCareSpaceState.status -- see its own comment.
  status?: 'active' | 'archived';
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

// Real bug found via direct product-owner report, still reproducing after
// a genuinely fresh app session: "I deleted Beauty and Janet but still
// see Janet" (and see her again on every fresh reload, not just once).
// list_my_supported_people() (the source of `provisioned` here) already
// correctly excludes a genuinely deleted or access-revoked care space --
// but this function historically only ever ADDED or UPDATED entries,
// deliberately never REMOVING one the server no longer lists (see the
// comment on removeCareSpace() below, which explicitly calls that out as
// "a deliberate, separate concern from this explicit removal"). That
// design was correct for the ORIGINAL reason this function was written
// (a transient reconnect must never wipe out a care space just because a
// single request happened to omit it) but is wrong once a care space can
// be GENUINELY, PERMANENTLY gone (delete_care_space(), or this account's
// own membership being revoked) -- the stale local copy then survives
// forever, since every future reconnect keeps merging into it and never
// re-examines whether it should still exist at all.
//
// Fixed narrowly: prune a local entry only when it was PREVIOUSLY KNOWN
// to be server-synced (has its own membershipId already) and is NOT
// local-only (never `local-`-prefixed) and the server's own authoritative
// response -- a call that only reaches here at all once it has already
// succeeded -- no longer lists it. A local-only, never-yet-synced space
// is never touched by this (the server was never going to list it).
function pruneCareSpacesNoLongerReturnedByServer(
  careSpaces: Record<string, LocalCareSpaceState>,
  provisioned: ProvisionedPerson[],
): Record<string, LocalCareSpaceState> {
  const stillReturned = new Set(provisioned.map((link) => link.careSpaceId));
  const pruned: Record<string, LocalCareSpaceState> = {};
  for (const [id, space] of Object.entries(careSpaces)) {
    const wasKnownSynced = !id.startsWith('local-') && Boolean(space.membershipId);
    if (wasKnownSynced && !stillReturned.has(id)) continue;
    pruned[id] = space;
  }
  return pruned;
}

export function integrateReconnectedCareSpaces(
  state: OnboardingState,
  provisioned: ProvisionedPerson[],
): OnboardingState {
  const careSpaces = pruneCareSpacesNoLongerReturnedByServer({ ...state.careSpaces }, provisioned);
  for (const link of provisioned) {
    const current = careSpaces[link.careSpaceId];
    if (current) {
      careSpaces[link.careSpaceId] = {
        ...current,
        supportedPersonId: link.supportedPersonId,
        membershipId: link.membershipId,
        role: link.role,
        status: link.status,
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
      role: link.role,
      status: link.status,
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

// A signed-in account can be opened on a genuinely fresh install with no
// owner-scoped AsyncStorage yet, even though its care spaces already exist
// on the server. Treating that empty local state as a new account lets the
// person run first-time setup again and provision duplicate care spaces.
// Once the authoritative reconnect returns existing people, the account is
// therefore no longer in first-time onboarding. Individual spaces remain
// `identity_only` when their device-local setup state is unavailable, so
// Home can still offer the established "finish setup" path without ever
// recreating their identity records.
export function resolveOnboardingStateAfterAccountReconnect(
  state: OnboardingState,
  provisioned: ProvisionedPerson[],
): OnboardingState {
  const integrated = integrateReconnectedCareSpaces(state, provisioned);
  if (state.onboardingComplete || provisioned.length === 0) return integrated;
  return {
    ...integrated,
    onboardingComplete: true,
    onboardingDraft: undefined,
    stage: 'home',
  };
}

// Extracted from App.tsx's handleAcceptInvitation() (14 September 2026,
// `\downloads\perm.txt`'s brand-new-invitee closure follow-up) so the
// exact fix has real, isolated unit-test coverage -- App.tsx itself has
// no render harness by established convention, so the fix's own
// state-transition logic is pulled out into this already-tested, pure
// module instead of a giant App.tsx test-harness refactor.
//
// A genuinely new user who accepts an invitation WITHOUT ever going
// through the normal "who are you caring for" setup had
// onboardingComplete stuck at its default `false` forever --
// renderAuthenticatedOnboarding()'s own stage-resolution ternary
// (`state.onboardingComplete ? 'home' : initialPersonStage(state)`)
// then routed them straight into that normal onboarding flow on the
// very next render, despite already having real, accepted access to a
// shared care space. This mirrors completeOnboarding()'s own exact
// state shape (the only other place this flag is ever set) -- accepting
// a genuine invitation is just as valid a way to finish initial setup
// as creating your own first supported person is. A no-op for an
// existing organiser who already completed onboarding once (accepting
// a SECOND care space's invitation never needs to touch
// stage/onboardingComplete again).
export function resolveOnboardingStateAfterAcceptingInvitation(state: OnboardingState): OnboardingState {
  if (!state.onboardingComplete) {
    return { ...state, onboardingComplete: true, stage: 'home', onboardingDraft: undefined };
  }
  return state;
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

// Remove-supported-person: the local-state half of deleteCareSpace()
// (src/careSpaces.ts) -- called only after the server-side deletion has
// genuinely succeeded (or, for a local-only care space that was never
// synced, directly -- there is nothing server-side to delete). Removes the
// entry outright rather than leaving a stale copy behind (unlike
// integrateReconnectedCareSpaces(), which only ever adds/updates entries
// and never removes one no longer present in a reconnect response -- a
// deliberate, separate concern from this explicit removal). If the removed
// space was the active one, falls back to whichever other space remains
// (if any), matching the same "some space must be active if one exists"
// invariant projectActiveCareSpace() already relies on.
// Phase 20D: local-state half of archive/restore. Unlike removeCareSpace()
// this never deletes the entry -- only its status flips. If the care
// space being ARCHIVED was the active one, falls back to another
// currently-ACTIVE space (never an already-archived one -- archived
// spaces must never silently become the active person), matching the
// same "some space must be active if one exists" invariant
// projectActiveCareSpace() already relies on. Restoring never needs to
// change activeCareSpaceId -- a restored space simply becomes selectable
// again, it doesn't need to become active.
export function setCareSpaceStatus(
  state: OnboardingState,
  careSpaceId: string,
  status: 'active' | 'archived',
): OnboardingState {
  const current = state.careSpaces[careSpaceId];
  if (!current) return state;
  const careSpaces = { ...state.careSpaces, [careSpaceId]: { ...current, status } };
  let activeCareSpaceId = state.activeCareSpaceId;
  if (status === 'archived' && activeCareSpaceId === careSpaceId) {
    activeCareSpaceId = Object.values(careSpaces).find((space) => space.careSpaceId !== careSpaceId && space.status !== 'archived')?.careSpaceId;
  }
  return projectActiveCareSpace({ ...state, careSpaces, activeCareSpaceId });
}

// The ordinary active-person switcher/navigation must never surface an
// archived care space (brief section 6) -- this is the one shared filter
// every such surface should use, rather than each screen re-deriving the
// same "status !== 'archived'" check independently.
export function activeCareSpaces(state: OnboardingState): LocalCareSpaceState[] {
  return Object.values(state.careSpaces).filter((space) => space.status !== 'archived');
}

export function archivedCareSpaces(state: OnboardingState): LocalCareSpaceState[] {
  return Object.values(state.careSpaces).filter((space) => space.status === 'archived');
}

export function removeCareSpace(state: OnboardingState, careSpaceId: string): OnboardingState {
  if (!state.careSpaces[careSpaceId]) return state;
  const careSpaces = { ...state.careSpaces };
  delete careSpaces[careSpaceId];
  const remainingIds = Object.keys(careSpaces);
  const activeCareSpaceId = state.activeCareSpaceId === careSpaceId
    ? remainingIds[0]
    : state.activeCareSpaceId;
  return projectActiveCareSpace({ ...state, careSpaces, activeCareSpaceId });
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

// Real bug found via direct product-owner report (remove-supported-person
// follow-up): removing the LAST remaining care space leaves
// activeCareSpaceId undefined, so activeCareSpace(state) resolves to
// undefined -- but this function used to just return `state` UNCHANGED in
// that case, leaving every previously-projected field (most visibly
// supportedPersonName, which Home reads directly for its avatar/name)
// stuck at whatever the just-removed care space's values were. Home then
// kept showing "Janet" after Janet -- the last remaining supported
// person -- was removed. Now explicitly clears every projected field to
// its genuine "nothing active" value instead of silently leaving stale
// data in place.
export function projectActiveCareSpace(state: OnboardingState): OnboardingState {
  const active = activeCareSpace(state);
  if (!active) {
    return {
      ...state,
      relationship: undefined,
      supportedPersonName: undefined,
      supportedPersonId: undefined,
      privacyDeclarationAccepted: false,
      privacyDeclarationVersion: undefined,
      privacyDeclarationAcceptedAt: undefined,
      interests: [],
      records: [],
      firstItem: undefined,
      allSetDismissed: false,
    };
  }
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
