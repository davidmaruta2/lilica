import AsyncStorage from '@react-native-async-storage/async-storage';

import { COOLDOWN_DAYS, registerReviewMoment, shouldPrompt } from '../src/reviewPrompt';

const mockRequestReview = jest.fn();
let mockAvailable = true;
jest.mock('expo-store-review', () => ({
  isAvailableAsync: () => Promise.resolve(mockAvailable),
  hasAction: () => Promise.resolve(true),
  requestReview: () => mockRequestReview(),
}));

const DAY = 86_400_000;
const t0 = new Date('2026-12-01T10:00:00Z');
const later = (days: number) => new Date(t0.getTime() + days * DAY);

describe('shouldPrompt', () => {
  it('needs a success moment, three quiet days, and a cooldown', () => {
    const base = { firstSignalAt: t0.toISOString(), completedTasks: 2 };
    expect(shouldPrompt(base, 'task_completed', later(4))).toBe(true);
    expect(shouldPrompt({ ...base, completedTasks: 1 }, 'task_completed', later(4))).toBe(false);
    expect(shouldPrompt(base, 'task_completed', later(1))).toBe(false);
    expect(shouldPrompt({ ...base, completedTasks: 0 }, 'care_summary_created', later(4))).toBe(true);
    expect(shouldPrompt({ ...base, lastPromptAt: later(4).toISOString() }, 'care_summary_created', later(4 + COOLDOWN_DAYS - 1))).toBe(false);
    expect(shouldPrompt({ ...base, lastPromptAt: later(4).toISOString() }, 'care_summary_created', later(4 + COOLDOWN_DAYS + 1))).toBe(true);
  });
});

describe('registerReviewMoment', () => {
  beforeEach(async () => {
    mockRequestReview.mockReset();
    mockAvailable = true;
    await AsyncStorage.clear();
  });

  it('does not ask on the first success, then asks after the second and three days', async () => {
    expect(await registerReviewMoment('u1', 'task_completed', t0)).toBe(false);
    expect(await registerReviewMoment('u1', 'task_completed', later(1))).toBe(false);
    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(await registerReviewMoment('u1', 'task_completed', later(4))).toBe(true);
    expect(mockRequestReview).toHaveBeenCalledTimes(1);
  });

  it('does not ask again inside the cooldown', async () => {
    await registerReviewMoment('u1', 'task_completed', t0);
    await registerReviewMoment('u1', 'task_completed', later(1));
    await registerReviewMoment('u1', 'care_summary_created', later(5));
    expect(await registerReviewMoment('u1', 'care_summary_created', later(30))).toBe(false);
    expect(mockRequestReview).toHaveBeenCalledTimes(1);
  });

  it('never asks when the store prompt is unavailable or there is no user', async () => {
    mockAvailable = false;
    await registerReviewMoment('u1', 'care_summary_created', t0);
    expect(await registerReviewMoment('u1', 'care_summary_created', later(5))).toBe(false);
    expect(await registerReviewMoment(undefined, 'care_summary_created', later(5))).toBe(false);
    expect(mockRequestReview).not.toHaveBeenCalled();
  });
});

describe('registerReviewMoment on a binary without the native module', () => {
  it('does nothing and does not throw when expo-store-review cannot load', async () => {
    await AsyncStorage.clear();
    jest.resetModules();
    jest.doMock('expo-store-review', () => {
      throw new Error("Cannot find native module 'ExpoStoreReview'");
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const isolated = require('../src/reviewPrompt') as typeof import('../src/reviewPrompt');
    await expect(isolated.registerReviewMoment('u1', 'care_summary_created', later(5))).resolves.toBe(false);
    await expect(isolated.registerReviewMoment('u1', 'task_completed', later(9))).resolves.toBe(false);
    jest.dontMock('expo-store-review');
  });
});
