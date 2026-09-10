import { ReactNode, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { keyboardAvoidingBehavior, keyboardDismissMode } from '../keyboard';
import { colors, spacing } from '../theme';
import { KeyboardAwareScrollView } from './KeyboardAwareScrollView';

type ScreenProps = {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  backgroundColor?: string;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  footer,
  scroll = true,
  backgroundColor = colors.canvas,
  contentStyle,
}: ScreenProps) {
  const footerRef = useRef<View>(null);

  const content = scroll ? (
    <KeyboardAwareScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContainer}
      keyboardDismissMode={keyboardDismissMode(Platform.OS)}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      testID="screen-scroll-view"
      keepVisibleWithFocusRef={footer ? footerRef : undefined}
    >
      <View style={[styles.scrollContent, contentStyle]} testID="screen-scroll-content">
        {children}
      </View>
      {footer ? (
        <View ref={footerRef} style={[styles.footer, { backgroundColor }]} testID="screen-footer">
          {footer}
        </View>
      ) : null}
    </KeyboardAwareScrollView>
  ) : (
    <>
      <View style={[styles.staticContent, contentStyle]}>{children}</View>
      {footer ? <View style={[styles.footer, { backgroundColor }]} testID="screen-footer">{footer}</View> : null}
    </>
  );

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.safeArea, { backgroundColor }]}
      testID="screen-safe-area"
    >
      <KeyboardAvoidingView
        behavior={keyboardAvoidingBehavior(Platform.OS)}
        style={styles.keyboard}
        testID="screen-keyboard-avoiding-view"
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  staticContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    backgroundColor: colors.canvas,
  },
});
