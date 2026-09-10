import { createContext, ReactNode, useCallback, useContext, useEffect, useRef } from 'react';
import { Keyboard, ScrollView, ScrollViewProps } from 'react-native';

const KeyboardScrollContext = createContext<(target: number) => void>(() => undefined);

export function useRevealFocusedInput() {
  return useContext(KeyboardScrollContext);
}

export function KeyboardAwareScrollView({ children, ...props }: ScrollViewProps & { children: ReactNode }) {
  const scrollView = useRef<ScrollView>(null);
  const focusedTarget = useRef<number | undefined>(undefined);

  const reveal = useCallback((target: number) => {
    focusedTarget.current = target;
    requestAnimationFrame(() => {
      scrollView.current?.scrollResponderScrollNativeHandleToKeyboard(target, 16, true);
    });
  }, []);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      if (focusedTarget.current !== undefined) reveal(focusedTarget.current);
    });
    return () => subscription.remove();
  }, [reveal]);

  return (
    <KeyboardScrollContext.Provider value={reveal}>
      <ScrollView ref={scrollView} {...props}>{children}</ScrollView>
    </KeyboardScrollContext.Provider>
  );
}
