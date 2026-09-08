import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';
import { AppText } from './Text';

type TextFieldProps = TextInputProps & {
  label: string;
};

export function TextField({ label, style, ...props }: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <AppText variant="secondary" tone="soft" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        {...props}
        allowFontScaling
        placeholderTextColor={colors.muted}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        style={[styles.input, focused && styles.focused, style]}
      />
    </View>
  );
}

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
});
