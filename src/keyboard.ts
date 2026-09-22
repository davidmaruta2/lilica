import { KeyboardAvoidingViewProps, ScrollViewProps } from 'react-native';

type MobilePlatform = 'android' | 'ios' | string;

// This used to trust app.json's `android.softwareKeyboardLayoutMode:
// "resize"` to shrink the window for the keyboard in a real standalone
// build, leaving KeyboardAvoidingView's own `behaviour` `undefined` on
// Android outside Expo Go so native resize wasn't "double-compensated".
// Real-device report (23 September 2026, screenshot evidence): in an
// actual production Android build, the content never resized for the
// keyboard at all -- the compose box sat in a dead gap below the visible
// area, completely off-screen, not just imperfectly positioned. Native
// `resize` is evidently not reliable enough across real devices/keyboards
// to depend on alone. `KeyboardAvoidingView`'s own JS-driven `height`
// behaviour actively shrinks the view by the keyboard's actual reported
// height on every platform/device, so Android now always gets the same
// treatment iOS already relies on, never `undefined`.
export function keyboardAvoidingBehavior(platform: MobilePlatform): KeyboardAvoidingViewProps['behavior'] {
  if (platform === 'ios') return 'padding';
  if (platform === 'android') return 'height';
  return undefined;
}

export function keyboardDismissMode(platform: MobilePlatform): ScrollViewProps['keyboardDismissMode'] {
  return platform === 'ios' ? 'interactive' : 'on-drag';
}
