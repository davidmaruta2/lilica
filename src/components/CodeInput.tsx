import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { useRevealFocusedInput } from './KeyboardAwareScrollView';
import { AppText } from './Text';

export function CodeInput({ value, onChangeText, autoFocus = true }: {
  value: string;
  onChangeText: (value: string) => void;
  autoFocus?: boolean;
}) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const revealFocusedInput = useRevealFocusedInput();
  const code = value.replace(/\D/g, '').slice(0, 6);
  const activeIndex = Math.min(code.length, 5);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessible={false}
        onPress={() => input.current?.focus()}
        style={styles.cells}
        testID="verification-code-cells"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <View
            key={index}
            style={[
              styles.cell,
              focused && index === activeIndex && styles.activeCell,
              code[index] && styles.filledCell,
            ]}
          >
            <AppText variant="title" centre>{code[index] ?? ''}</AppText>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={input}
        accessibilityLabel="Six-digit code"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        caretHidden
        keyboardType="number-pad"
        maxLength={6}
        onBlur={() => setFocused(false)}
        onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, 6))}
        onFocus={(event) => {
          setFocused(true);
          revealFocusedInput(event.nativeEvent.target);
        }}
        style={styles.capture}
        testID="verification-code-input"
        textContentType="oneTimeCode"
        value={code}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  cells: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    maxWidth: 58,
    height: 66,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCell: {
    borderColor: colors.teal,
    backgroundColor: colors.surface,
  },
  filledCell: {
    borderColor: colors.teal,
  },
  capture: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
