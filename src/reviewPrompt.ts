// Growth plan item 5: ask for a store rating, but only after a genuine
// success moment and never in a way that filters by sentiment.
//
// Rules (Apple and Google both require these in spirit):
//   * the native in-app prompt only - no custom "do you like Lilica?" screen
//     that sends happy users to the store and unhappy users elsewhere;
//   * no incentive, no wording that steers towards five stars;
//   * a success moment is the user's second completed task, or a Care
//     Summary they created - the caller only reports these on success, so a
//     user who just hit an error is never asked;
//   * at least 3 days after the first signal, and at most once per 120 days.
//     (The OS applies its own, stricter yearly limit on top.)

import AsyncStorage from '@react-native-async-storage/async-storage';

type StoreReviewModule = {
  isAvailableAsync: () => Promise<boolean>;
  hasAction: () => Promise<boolean>;
  requestReview: () => Promise<void>;
};

// expo-store-review contains native code. An over-the-air update can reach
// installed binaries that were built before it was added, and a plain import
// would throw at launch there. Load it lazily and treat any failure as "this
// build cannot show the prompt": the feature simply switches on once a build
// that includes the module is installed.
function loadStoreReview(): StoreReviewModule | null {
  try {
    const mod = require('expo-store-review') as StoreReviewModule;
    return mod && typeof mod.requestReview === 'function' ? mod : null;
  } catch {
    return null;
  }
}

export type ReviewMoment = 'task_completed' | 'care_summary_created';

export const MIN_DAYS_AFTER_FIRST_SIGNAL = 3;
export const COOLDOWN_DAYS = 120;
export const COMPLETED_TASKS_NEEDED = 2;

type ReviewState = {
  firstSignalAt?: string;
  completedTasks: number;
  lastPromptAt?: string;
};

const DAY_MS = 86_400_000;
const keyFor = (userId: string) => `lilica.reviewPrompt.v1.${userId}`;

export function shouldPrompt(state: ReviewState, moment: ReviewMoment, now: Date): boolean {
  const enoughSuccess = moment === 'care_summary_created' || state.completedTasks >= COMPLETED_TASKS_NEEDED;
  if (!enoughSuccess) return false;
  if (!state.firstSignalAt) return false;
  if (now.getTime() - new Date(state.firstSignalAt).getTime() < MIN_DAYS_AFTER_FIRST_SIGNAL * DAY_MS) return false;
  if (state.lastPromptAt && now.getTime() - new Date(state.lastPromptAt).getTime() < COOLDOWN_DAYS * DAY_MS) return false;
  return true;
}

async function load(userId: string): Promise<ReviewState> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      firstSignalAt: typeof parsed.firstSignalAt === 'string' ? parsed.firstSignalAt : undefined,
      completedTasks: typeof parsed.completedTasks === 'number' ? parsed.completedTasks : 0,
      lastPromptAt: typeof parsed.lastPromptAt === 'string' ? parsed.lastPromptAt : undefined,
    };
  } catch {
    return { completedTasks: 0 };
  }
}

async function save(userId: string, state: ReviewState): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(state));
  } catch {
    // Local bookkeeping only.
  }
}

// Call after a successful task completion or Care Summary. Resolves true
// only if the native prompt was actually requested.
export async function registerReviewMoment(
  userId: string | undefined,
  moment: ReviewMoment,
  now = new Date(),
): Promise<boolean> {
  if (!userId) return false;
  const StoreReview = loadStoreReview();
  if (!StoreReview) return false;
  try {
    const state = await load(userId);
    if (!state.firstSignalAt) state.firstSignalAt = now.toISOString();
    if (moment === 'task_completed') state.completedTasks += 1;

    let asked = false;
    if (shouldPrompt(state, moment, now) && (await StoreReview.isAvailableAsync()) && (await StoreReview.hasAction())) {
      await StoreReview.requestReview();
      state.lastPromptAt = now.toISOString();
      asked = true;
    }
    await save(userId, state);
    return asked;
  } catch {
    return false;
  }
}
