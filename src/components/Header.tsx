import { createContext, ReactNode, useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { phase22Foundation } from '../visualFoundation';
import { FoundationIcon } from './FoundationIcon';
import { BackIcon, XIcon } from './foundationIcons';
import { AppText } from './Text';

type HeaderProps = {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

const SecondaryPageCloseContext = createContext<(() => void) | undefined>(undefined);

export function SecondaryPageCloseProvider({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return <SecondaryPageCloseContext.Provider value={onClose}>{children}</SecondaryPageCloseContext.Provider>;
}

export function Header({ title, onBack, right }: HeaderProps) {
  const contextualClose = useContext(SecondaryPageCloseContext);
  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="secondary-header-back"
            onPress={onBack}
            style={styles.back}
          >
            <FoundationIcon icon={BackIcon} role="navigation" />
          </Pressable>
        ) : null}
      </View>
      {title ? (
        <AppText variant="section" centre style={styles.title}>
          {title}
        </AppText>
      ) : (
        <View style={styles.title} />
      )}
      <View style={[styles.side, styles.right]}>
        {right ?? (contextualClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close settings"
            onPress={contextualClose}
            style={styles.close}
          >
            <FoundationIcon icon={XIcon} role="navigation" color={colors.primary} />
          </Pressable>
        ) : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  side: {
    width: 64,
  },
  right: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
  },
  back: {
    width: phase22Foundation.control.minimumTouchTarget,
    height: phase22Foundation.control.minimumTouchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: phase22Foundation.control.minimumTouchTarget,
    height: phase22Foundation.control.minimumTouchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
