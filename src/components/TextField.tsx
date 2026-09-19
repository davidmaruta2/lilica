import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';
import { useRevealFocusedInput } from './KeyboardAwareScrollView';
import { AppText } from './Text';

type TextFieldProps = TextInputProps & {
  label: string;
  compact?: boolean;
  rightAccessory?: React.ReactNode;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField({ label, compact, style, rightAccessory, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  const revealFocusedInput = useRevealFocusedInput();

  return (
    <View style={styles.wrap}>
      <AppText variant="secondary" tone="soft" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.inputRow}>
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
          style={[
            styles.input,
            compact && styles.compactInput,
            focused && styles.focused,
            Boolean(rightAccessory) && styles.inputWithAccessory,
            style,
          ]}
        />
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
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
  inputRow: {
    justifyContent: 'center',
  },
  accessory: {
    position: 'absolute',
    right: spacing.xs,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
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
  inputWithAccessory: {
    paddingRight: spacing.xxl,
  },
  compactInput: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
});
