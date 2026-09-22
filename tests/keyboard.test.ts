// This used to leave Android to app.json's `android.softwareKeyboardLayoutMode:
// "resize"` in a real standalone build, on the assumption that native
// resize genuinely worked there. Real-device report (23 September 2026,
// screenshot evidence): in an actual production Android build, the
// content never resized for the keyboard at all -- the compose box sat
// in a dead gap below the visible area, completely off-screen. Android
// now always gets the same JS-driven `height` behaviour, on every
// runtime, never left to native resize alone.

import { keyboardAvoidingBehavior } from '../src/keyboard';

describe('keyboardAvoidingBehavior', () => {
  it('always uses padding on iOS', () => {
    expect(keyboardAvoidingBehavior('ios')).toBe('padding');
  });

  it('always uses JS-driven height avoidance on Android, never leaving it to native resize alone', () => {
    expect(keyboardAvoidingBehavior('android')).toBe('height');
  });
});
