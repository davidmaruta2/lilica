import Constants from 'expo-constants';
import { KeyboardAvoidingViewProps, ScrollViewProps } from 'react-native';

type MobilePlatform = 'android' | 'ios' | string;

// app.json declares `android.softwareKeyboardLayoutMode: "resize"`, which
// only takes effect in a custom dev client or a standalone/production
// build — Expo Go's own host app ships a fixed native AndroidManifest and
// does not apply a loaded project's native Android config at all. Inside
// Expo Go the window never actually resizes for the keyboard, so nothing
// measured from the container ever shrinks and the reveal logic in
// `KeyboardAwareScrollView` has nothing to react to. Give Android the same
// JS-driven `KeyboardAvoidingView` behaviour iOS already uses whenever the
// app is running inside Expo Go. In a real dev-client/standalone build,
// where `resize` genuinely works, keep behaviour `undefined` so the native
// resize is not double-compensated by also padding/shrinking in JS.
function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

export function keyboardAvoidingBehavior(platform: MobilePlatform): KeyboardAvoidingViewProps['behavior'] {
  if (platform === 'ios') return 'padding';
  if (platform === 'android') return isExpoGo() ? 'height' : undefined;
  return undefined;
}

export function keyboardDismissMode(platform: MobilePlatform): ScrollViewProps['keyboardDismissMode'] {
  return platform === 'ios' ? 'interactive' : 'on-drag';
}
