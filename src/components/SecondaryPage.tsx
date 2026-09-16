import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors, spacing } from '../theme';
import { phase22Foundation } from '../visualFoundation';
import { FoundationIcon, FoundationIconComponent } from './FoundationIcon';
import { ForwardIcon } from './foundationIcons';
import { AppText } from './Text';

export function SecondaryPageIntro({ children }: { children: ReactNode }) {
  return <AppText variant="secondary" tone="soft" style={styles.intro}>{children}</AppText>;
}

export function SecondarySection({ title, action, children, tone = 'neutral', style }: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  tone?: 'neutral' | 'plum' | 'blue' | 'green' | 'rose';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      {title || action ? (
        <View style={styles.sectionHeadingRow}>
          {title ? <AppText variant="section" tone="primary" style={styles.sectionHeading}>{title}</AppText> : <View />}
          {action}
        </View>
      ) : null}
      <View style={[styles.sectionSurface, toneStyles[tone]]}>{children}</View>
    </View>
  );
}

export function SecondaryIconCircle({ icon, tone = 'plum' }: { icon: FoundationIconComponent; tone?: IconTone }) {
  return (
    <View style={[styles.iconCircle, iconToneStyles[tone].background]}>
      <FoundationIcon icon={icon} role="navigation" color={iconToneStyles[tone].color} />
    </View>
  );
}

type IconTone = 'plum' | 'blue' | 'green' | 'rose' | 'danger' | 'neutral';

export function SecondaryDisclosureRow({
  icon,
  iconTone = 'plum',
  title,
  description,
  metadata,
  onPress,
  destructive = false,
  right,
  accessibilityLabel,
}: {
  icon?: FoundationIconComponent;
  iconTone?: IconTone;
  title: string;
  description?: string;
  metadata?: string;
  onPress?: () => void;
  destructive?: boolean;
  right?: ReactNode;
  accessibilityLabel?: string;
}) {
  const content = (
    <>
      {icon ? <SecondaryIconCircle icon={icon} tone={destructive ? 'danger' : iconTone} /> : null}
      <View style={styles.rowCopy}>
        <AppText variant="bodyStrong" tone={destructive ? 'danger' : 'default'} style={styles.rowTitle}>{title}</AppText>
        {description ? <AppText variant="secondary" tone={destructive ? 'danger' : 'soft'} style={styles.rowDescription}>{description}</AppText> : null}
        {metadata ? <AppText variant="meta" tone="muted">{metadata}</AppText> : null}
      </View>
      {right ?? (onPress ? <FoundationIcon icon={ForwardIcon} role="navigation" color={destructive ? colors.danger : colors.primary} /> : null)}
    </>
  );

  if (!onPress) return <View testID="secondary-disclosure-row" style={[styles.row, destructive && styles.destructiveRow]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      testID="secondary-disclosure-row"
      onPress={onPress}
      style={({ pressed }) => [styles.row, destructive && styles.destructiveRow, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export function SecondaryRolePill({ children, tone = 'plum' }: { children: ReactNode; tone?: 'plum' | 'blue' }) {
  return (
    <View style={[styles.rolePill, tone === 'blue' && styles.rolePillBlue]}>
      <AppText variant="meta" tone="primary" style={tone === 'blue' ? styles.rolePillBlueText : undefined}>{children}</AppText>
    </View>
  );
}

const toneStyles = StyleSheet.create({
  neutral: { backgroundColor: colors.surface },
  plum: { backgroundColor: '#F7EDF2' },
  blue: { backgroundColor: '#EEF5F7' },
  green: { backgroundColor: '#F0F4E8' },
  rose: { backgroundColor: '#F9ECEF' },
});

const iconToneStyles: Record<IconTone, { background: ViewStyle; color: string }> = {
  plum: { background: { backgroundColor: colors.primarySoft }, color: colors.primary },
  blue: { background: { backgroundColor: colors.blueSoft }, color: '#276A78' },
  green: { background: { backgroundColor: colors.oliveSoft }, color: '#657044' },
  rose: { background: { backgroundColor: colors.dangerSoft }, color: colors.danger },
  danger: { background: { backgroundColor: '#FDE8E7' }, color: '#D93036' },
  neutral: { background: { backgroundColor: colors.surfaceMuted }, color: colors.inkSoft },
};

const styles = StyleSheet.create({
  intro: { marginTop: -spacing.xs, marginBottom: spacing.md },
  sectionHeadingRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  sectionHeading: { fontSize: 17, lineHeight: 22 },
  sectionSurface: { borderRadius: phase22Foundation.radius.surface, overflow: 'hidden', borderWidth: 1, borderColor: '#E8DFD6' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  destructiveRow: { backgroundColor: '#FDECEC', borderBottomColor: '#F4CDCE' },
  pressed: { opacity: 0.76 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, lineHeight: 19 },
  rowDescription: { fontSize: 12, lineHeight: 16 },
  rolePill: { borderRadius: 999, backgroundColor: colors.primarySoft, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  rolePillBlue: { backgroundColor: '#DDEEF7' },
  rolePillBlueText: { color: '#28698B' },
});
