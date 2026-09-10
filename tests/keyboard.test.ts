// `app.json` declares `android.softwareKeyboardLayoutMode: "resize"`, but
// that native config only takes effect in a custom dev client or a
// standalone/production build — Expo Go's own host app ships a fixed native
// AndroidManifest and never applies a loaded project's native Android
// config. Inside Expo Go the window never actually resizes for the
// keyboard, so `KeyboardAwareScrollView`'s reveal logic has nothing to react
// to unless Android is also given real JS-driven `KeyboardAvoidingView`
// behaviour, same as iOS already has. This is the actual fix for the
// physical-device report that Password/the CTA became visible after
// scrolling was corrected on iOS but Android still did not move at all.

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { executionEnvironment: 'bare' },
}));

import Constants from 'expo-constants';
import { keyboardAvoidingBehavior } from '../src/keyboard';

describe('keyboardAvoidingBehavior', () => {
  afterEach(() => {
    (Constants as { executionEnvironment: string }).executionEnvironment = 'bare';
  });

  it('always uses padding on iOS regardless of runtime', () => {
    expect(keyboardAvoidingBehavior('ios')).toBe('padding');
  });

  it('gives Android real JS-driven avoidance inside Expo Go, where native resize cannot apply', () => {
    (Constants as { executionEnvironment: string }).executionEnvironment = 'storeClient';
    expect(keyboardAvoidingBehavior('android')).toBe('height');
  });

  it('leaves Android to the native resize config in a real dev-client/standalone build', () => {
    (Constants as { executionEnvironment: string }).executionEnvironment = 'standalone';
    expect(keyboardAvoidingBehavior('android')).toBeUndefined();
  });
});
