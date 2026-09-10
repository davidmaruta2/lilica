import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';
import { useRevealFocusedInput } from './KeyboardAwareScrollView';
import { AppText } from './Text';

type TextFieldProps = TextInputProps & {
  label: string;
  compact?: boolean;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField({ label, compact, style, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  const revealFocusedInput = useRevealFocusedInput();

  return (
    <View style={styles.wrap}>
      <AppText variant="secondary" tone="soft" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        {...props}
        ref={ref}
        allowFontScaling
        placeholderTextColor={colors.muted}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          revealFocusedInput(event.nativeEvent.target);
          props.onFocus?.(event);
        }}
        style={[styles.input, compact && styles.compactInput, focused && styles.focused, style]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    paddingHorizontal: spacing.xs,
  },
  input: {
    minHeight: 66,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    color: colors.ink,
    ...typography.body,
  },
  focused: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  compactInput: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
});
