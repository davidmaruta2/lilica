import { KeyboardAvoidingViewProps, ScrollViewProps } from 'react-native';

type MobilePlatform = 'android' | 'ios' | string;

export function keyboardAvoidingBehavior(platform: MobilePlatform): KeyboardAvoidingViewProps['behavior'] {
  return platform === 'ios' ? 'padding' : undefined;
}

export function keyboardDismissMode(platform: MobilePlatform): ScrollViewProps['keyboardDismissMode'] {
  return platform === 'ios' ? 'interactive' : 'on-drag';
}
