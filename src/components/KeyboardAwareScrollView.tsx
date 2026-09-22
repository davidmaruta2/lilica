import { createContext, ReactNode, RefObject, useCallback, useContext, useEffect, useRef } from 'react';
import {
  findNodeHandle,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps,
  UIManager,
  View,
} from 'react-native';

import { computeRevealScrollTo } from '../keyboardReveal';

const KeyboardScrollContext = createContext<(target: number) => void>(() => undefined);
const ScrollToEndContext = createContext<() => void>(() => undefined);

// Extra space kept between the focused field and the keyboard/footer edge.
const REVEAL_PADDING = 24;

export function useRevealFocusedInput() {
  return useContext(KeyboardScrollContext);
}

// A defensive alternative to useRevealFocusedInput() for a field that is
// always the LAST thing in the scroll content (a chat compose box, never
// a mid-content field) -- scrollToEnd needs no measurement of anything at
// all, so it can't be defeated by the coordinate-space/timing/legacy-API
// fragility the measure-based reveal() is exposed to. Real device report
// (23 September 2026): the compose box stayed hidden behind the keyboard
// even after fixing a genuine context-resolution bug in reveal() -- this
// exists because a field known to sit at the very end doesn't need the
// general-purpose (and more fragile) machinery at all.
export function useScrollToEnd() {
  return useContext(ScrollToEndContext);
}

type Props = ScrollViewProps & {
  children: ReactNode;
  // Content below the focused field - the screen's footer/CTA - that should
  // also be brought into view alongside a focused field whenever there is
  // room for both above the keyboard. The focused field always takes
  // priority if a short viewport genuinely can't fit both at once.
  keepVisibleWithFocusRef?: RefObject<View | null>;
};

export function KeyboardAwareScrollView({
  children,
  onLayout,
  onScroll,
  keepVisibleWithFocusRef,
  ...props
}: Props) {
  const scrollView = useRef<ScrollView>(null);
  const focusedTarget = useRef<number | undefined>(undefined);
  const scrollOffset = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The legacy `scrollResponderScrollNativeHandleToKeyboard` API compares a
  // field's position (measured relative to this ScrollView) against the
  // keyboard's reported screenY (measured relative to the original,
  // pre-resize window). With Android's `softwareKeyboardLayoutMode: resize`,
  // those two coordinate spaces disagree, so the computed offset collapses
  // to ~0 and the field never actually scrolls into view.
  //
  // The fix measures the field and the ScrollView's own current on-screen
  // rect in the same (window) coordinate space, via two chained native
  // `measureInWindow` calls: the target is only measured once the
  // container's own measurement has actually returned. An earlier version
  // cached the container measurement in a ref written by an independent,
  // separately-timed `measureInWindow` call and just hoped one
  // `requestAnimationFrame` was enough time for it to land - it usually
  // wasn't, so `reveal` kept reading a stale, pre-keyboard (full-height)
  // container size and concluded nothing needed to scroll. That race was
  // platform-independent, which is why it broke identically on Android
  // (window resize) and iOS (KeyboardAvoidingView padding).
  const measureAndReveal = useCallback((target: number) => {
    const containerHandle = findNodeHandle(scrollView.current);
    if (containerHandle == null) return;
    UIManager.measureInWindow(containerHandle, (cx: number, cy: number, cw: number, ch: number) => {
      UIManager.measureInWindow(target, (fx: number, fy: number, fw: number, fh: number) => {
        const finish = (trailing?: { top: number; height: number }) => {
          const scrollTo = computeRevealScrollTo({
            visible: { top: cy, height: ch },
            target: { top: fy, height: fh },
            currentOffset: scrollOffset.current,
            padding: REVEAL_PADDING,
            trailing,
          });
          if (scrollTo !== undefined) {
            scrollView.current?.scrollTo({ y: scrollTo, animated: true });
          }
        };

        const trailingHandle = findNodeHandle(keepVisibleWithFocusRef?.current ?? null);
        if (trailingHandle == null) {
          finish();
          return;
        }
        UIManager.measureInWindow(trailingHandle, (tx: number, ty: number, tw: number, th: number) => {
          finish({ top: ty, height: th });
        });
      });
    });
  }, [keepVisibleWithFocusRef]);

  const scrollToEndRequested = useRef(false);

  const reveal = useCallback((target: number) => {
    scrollToEndRequested.current = false;
    focusedTarget.current = target;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    // One pass now, in case the keyboard/layout change has already
    // settled (e.g. moving focus between fields while the keyboard stays
    // open, where no further keyboard event will fire at all).
    requestAnimationFrame(() => measureAndReveal(target));
    // A second, corrective pass shortly after, in case this focus change
    // is what opens the keyboard and its show/resize/padding animation is
    // still mid-flight when the first pass measures. Re-running is safe:
    // once the field is genuinely visible, computeRevealScrollTo is a
    // no-op.
    retryTimer.current = setTimeout(() => measureAndReveal(target), 180);
  }, [measureAndReveal]);

  // See useScrollToEnd()'s own comment -- no measurement, so nothing here
  // can be defeated by a stale/mismatched coordinate space. Same
  // now-plus-retry shape as reveal(), for the same "keyboard animation
  // still mid-flight on the first pass" reason.
  const scrollToEnd = useCallback(() => {
    focusedTarget.current = undefined;
    scrollToEndRequested.current = true;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    const run = () => scrollView.current?.scrollToEnd({ animated: true });
    requestAnimationFrame(run);
    retryTimer.current = setTimeout(run, 180);
  }, []);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      if (scrollToEndRequested.current) {
        scrollView.current?.scrollToEnd({ animated: true });
      } else if (focusedTarget.current !== undefined) {
        reveal(focusedTarget.current);
      }
    });
    return () => {
      subscription.remove();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [reveal]);

  return (
    <KeyboardScrollContext.Provider value={reveal}>
      <ScrollToEndContext.Provider value={scrollToEnd}>
        <ScrollView
          ref={scrollView}
          onLayout={onLayout}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y;
            onScroll?.(event);
          }}
          scrollEventThrottle={16}
          {...props}
        >
          {children}
        </ScrollView>
      </ScrollToEndContext.Provider>
    </KeyboardScrollContext.Provider>
  );
}
