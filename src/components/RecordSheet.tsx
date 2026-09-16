import { forwardRef, ReactNode, useEffect, useImperativeHandle, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { keyboardAvoidingBehavior, keyboardDismissMode } from '../keyboard';
import { colors, radius, shadow, spacing } from '../theme';
import { KeyboardAwareScrollView } from './KeyboardAwareScrollView';
import { AppText } from './Text';

type Props = {
  title: string;
  children: ReactNode;
  onDismiss: () => void;
  origin?: RecordSheetOrigin;
  // Explicit product direction: closing the sheet -- by any of the three
  // routes below (Done, backdrop tap, swipe-down) -- should save pending
  // valid changes first, not just discard them back to an in-memory
  // draft. Called synchronously right before the close animation starts;
  // the host (RecordQuickEditor/FirstThingScreen) is what actually knows
  // how to trigger its own RecordEditor's save (via RecordEditorHandle),
  // this component only ever guarantees it is asked once per close.
  onBeforeDismiss?: () => void;
};

export type RecordSheetOrigin = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RecordSheetHandle = {
  dismiss: () => void;
};

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_SHEET_WIDTH = 560;

export const RecordSheet = forwardRef<RecordSheetHandle, Props>(function RecordSheet(
  { title, children, onDismiss, onBeforeDismiss, origin },
  ref,
) {
  const translateY = useRef(new Animated.Value(origin ? 0 : SCREEN_HEIGHT)).current;
  const expansion = useRef(new Animated.Value(origin ? 0 : 1)).current;
  const closing = useRef(false);
  const scrollOffset = useRef(0);

  function restore() {
    const slide = Animated.spring(translateY, {
      toValue: 0, damping: 24, stiffness: 220, mass: 0.9, useNativeDriver: !origin,
    });
    if (origin) {
      Animated.parallel([
        slide,
        Animated.spring(expansion, {
          toValue: 1, damping: 24, stiffness: 190, mass: 0.9, useNativeDriver: false,
        }),
      ]).start();
    } else slide.start();
  }

  function dismiss() {
    if (closing.current) return;
    closing.current = true;
    onBeforeDismiss?.();
    const closingAnimation = origin
      ? Animated.parallel([
        Animated.timing(expansion, { toValue: 0, duration: 190, useNativeDriver: false }),
        Animated.timing(translateY, { toValue: 0, duration: 190, useNativeDriver: false }),
      ])
      : Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 220, useNativeDriver: true });
    closingAnimation.start(({ finished }) => {
      if (finished) onDismiss();
      closing.current = false;
    });
  }

  useEffect(() => {
    restore();
  }, []);

  useImperativeHandle(ref, () => ({ dismiss }));

  const finalWidth = Math.min(SCREEN_WIDTH, MAX_SHEET_WIDTH);
  const anchoredStyle = origin ? {
    position: 'absolute' as const,
    left: expansion.interpolate({ inputRange: [0, 1], outputRange: [origin.x, (SCREEN_WIDTH - finalWidth) / 2] }),
    top: expansion.interpolate({ inputRange: [0, 1], outputRange: [origin.y, SCREEN_HEIGHT * 0.12] }),
    width: expansion.interpolate({ inputRange: [0, 1], outputRange: [origin.width, finalWidth] }),
    height: expansion.interpolate({ inputRange: [0, 1], outputRange: [origin.height, SCREEN_HEIGHT * 0.88] }),
    borderRadius: expansion.interpolate({ inputRange: [0, 1], outputRange: [radius.sm, radius.lg] }),
    opacity: expansion.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0.72, 0.94, 1] }),
    overflow: 'hidden' as const,
  } : undefined;

  // Bug fix: this used to sit on the whole sheet (handle+header AND the
  // scrollable content below), which meant it was competing with the
  // KeyboardAwareScrollView's own native scroll/bounce gesture for the
  // touch on every device -- a well-known RN nested-gesture conflict where
  // the ScrollView's native pan recognizer usually wins, so the swipe
  // silently never captured and nothing happened except via the explicit
  // Done button. Scoped now to the handle/header strip only (never
  // scrollable, so there is nothing to compete with).
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => (
      gesture.dy > 8
      && Math.abs(gesture.dy) > Math.abs(gesture.dx)
    ),
    onPanResponderGrant: Keyboard.dismiss,
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 90 || gesture.vy > 0.8) dismiss();
      else restore();
    },
    onPanResponderTerminate: restore,
  })).current;

  return (
    <Modal transparent statusBarTranslucent animationType="fade" onRequestClose={dismiss}>
      <KeyboardAvoidingView
        behavior={keyboardAvoidingBehavior(Platform.OS)}
        style={styles.overlay}
        testID="record-sheet-keyboard-avoiding-view"
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Close editor" onPress={dismiss} style={styles.backdrop} />
        <Animated.View
          testID="record-sheet"
          accessibilityViewIsModal
          style={[styles.sheet, anchoredStyle, { transform: [{ translateY }] }]}
        >
          <View style={styles.sheetTop} {...panResponder.panHandlers}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Minimise editor"
              hitSlop={16}
              onPress={dismiss}
              style={styles.handleTouchable}
            >
              <View style={styles.handle} />
            </Pressable>
            <View style={styles.header}>
              <AppText variant="section" numberOfLines={1} style={styles.title}>{title}</AppText>
              <Pressable accessibilityRole="button" onPress={dismiss} hitSlop={12} style={styles.done}>
                <AppText variant="bodyStrong" tone="primary">Done</AppText>
              </Pressable>
            </View>
          </View>
          <KeyboardAwareScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={keyboardDismissMode(Platform.OS)}
            showsVerticalScrollIndicator={false}
            testID="record-sheet-scroll-view"
            scrollEventThrottle={16}
            onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
          >
            {children}
          </KeyboardAwareScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(36,29,28,0.28)' },
  sheet: {
    width: '100%',
    maxWidth: MAX_SHEET_WIDTH,
    maxHeight: '88%',
    minHeight: '48%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow.soft,
  },
  sheetTop: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  handleTouchable: { alignSelf: 'center', minWidth: 44, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 42, height: 5, borderRadius: radius.pill, backgroundColor: colors.line },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  title: { flex: 1 },
  done: { minWidth: 52, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: Platform.OS === 'ios' ? spacing.xxl : spacing.lg },
});
