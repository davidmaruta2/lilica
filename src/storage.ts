import AsyncStorage from '@react-native-async-storage/async-storage';

import { OnboardingState } from './types';

const STORAGE_KEY = 'lilica:onboarding:v1';

export const initialOnboardingState: OnboardingState = {
  stage: 'welcome',
  interests: [],
  privacyDeclarationAccepted: false,
  onboardingComplete: false,
  allSetDismissed: false,
};

export async function loadOnboardingState(): Promise<OnboardingState> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return initialOnboardingState;
  }

  return {
    ...initialOnboardingState,
    ...JSON.parse(stored),
  };
}

export async function saveOnboardingState(state: OnboardingState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function clearOnboardingState(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
