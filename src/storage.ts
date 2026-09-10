import AsyncStorage from '@react-native-async-storage/async-storage';

import { LilicaRecord, LocalCareSpaceState, OnboardingState, Relationship } from './types';

const STORAGE_KEY = 'lilica:onboarding:v1';
const STAGES_AFTER_PRIVACY = ['interests', 'firstThing', 'itemForm', 'home'];

function storageKey(ownerId?: string): string {
  return ownerId ? `${STORAGE_KEY}:${ownerId}` : STORAGE_KEY;
}

export const initialOnboardingState: OnboardingState = {
  migrationVersion: 2,
  stage: 'welcome',
  interests: [],
  records: [],
  privacyDeclarationAccepted: false,
  onboardingComplete: false,
  allSetDismissed: false,
  careSpaces: {},
};

export function prepareOnboardingStateForStartup(
  loaded: OnboardingState,
  ownerId?: string,
): OnboardingState {
  if (!ownerId) return { ...loaded, stage: 'welcome' };
  if (loaded.onboardingComplete) return { ...loaded, stage: 'home' };
  if (!loaded.privacyDeclarationAccepted && STAGES_AFTER_PRIVACY.includes(loaded.stage)) {
    return { ...loaded, stage: 'privacyConsent' };
  }
  return loaded;
}

function stableUuid(seed: string): string {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < seed.length; index += 1) {
    first = Math.imul(first ^ seed.charCodeAt(index), 16777619);
    second = Math.imul(second ^ seed.charCodeAt(index), 3266489917);
  }
  const hex = `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}a5a5c3c3d4d4e6e6`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function migrateLegacySpace(parsed: Partial<OnboardingState>, records: LilicaRecord[]): LocalCareSpaceState | undefined {
  const displayName = parsed.supportedPersonName?.trim();
  const relationshipType = parsed.relationship as Relationship | undefined;
  if (!displayName || !relationshipType) return undefined;

  const seed = `${parsed.supportedPersonId ?? ''}|${relationshipType}|${displayName}|${records[0]?.id ?? ''}`;
  const bootstrapId = stableUuid(`bootstrap|${seed}`);
  const careSpaceId = `local-${stableUuid(`space|${seed}`)}`;
  return {
    careSpaceId,
    supportedPersonId: parsed.supportedPersonId ?? `local-${stableUuid(`person|${seed}`)}`,
    bootstrapId,
    relationshipType,
    displayName,
    privacyDeclarationAccepted: parsed.privacyDeclarationAccepted ?? false,
    privacyDeclarationVersion: parsed.privacyDeclarationVersion,
    privacyDeclarationAcceptedAt: parsed.privacyDeclarationAcceptedAt,
    interests: Array.isArray(parsed.interests) ? parsed.interests : [],
    records,
    setupStatus: parsed.onboardingComplete ? 'ready' : parsed.privacyDeclarationAccepted ? 'interests_pending' : 'privacy_pending',
    allSetDismissed: parsed.allSetDismissed ?? false,
  };
}

export async function loadOnboardingState(ownerId?: string): Promise<OnboardingState> {
  const stored = await AsyncStorage.getItem(storageKey(ownerId));

  if (!stored) {
    return initialOnboardingState;
  }

  const parsed = JSON.parse(stored) as Partial<OnboardingState>;
  const legacyFirstItem = parsed.firstItem;
  const records: LilicaRecord[] = Array.isArray(parsed.records)
    ? parsed.records
    : legacyFirstItem
      ? [{
          ...legacyFirstItem,
          status: legacyFirstItem.status ?? 'saved',
          updatedAt: legacyFirstItem.updatedAt ?? legacyFirstItem.createdAt,
        }]
      : [];

  const existingSpaces = parsed.careSpaces && typeof parsed.careSpaces === 'object'
    ? parsed.careSpaces
    : {};
  const legacySpace = Object.keys(existingSpaces).length === 0
    ? migrateLegacySpace(parsed, records)
    : undefined;
  const careSpaces = legacySpace
    ? { [legacySpace.careSpaceId]: legacySpace }
    : existingSpaces;

  return {
    ...initialOnboardingState,
    ...parsed,
    migrationVersion: 2,
    records,
    careSpaces,
    activeCareSpaceId: parsed.activeCareSpaceId ?? legacySpace?.careSpaceId,
  };
}

export async function saveOnboardingState(state: OnboardingState, ownerId?: string): Promise<void> {
  await AsyncStorage.setItem(storageKey(ownerId), JSON.stringify(state));
}

export async function clearOnboardingState(ownerId?: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(ownerId));
}
