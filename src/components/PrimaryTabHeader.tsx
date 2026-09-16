import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../theme';
import { AppText } from './Text';
import { NotificationAnchor, NotificationBellButton } from './NotificationBellButton';
import { SettingsCogButton } from './SettingsCogButton';
import { Wordmark } from './Wordmark';

type Props = {
  title: string;
  tone?: 'dark' | 'light';
  supporting?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  notificationCount?: number;
  onOpenNotifications?: (origin?: NotificationAnchor) => void;
  onOpenSettings?: () => void;
};

export function PrimaryTabHeader({
  title,
  tone = 'dark',
  supporting,
  leading,
  actions,
  notificationCount = 0,
  onOpenNotifications,
  onOpenSettings,
}: Props) {
  const isLight = tone === 'light';

  return (
    <View testID="primary-tab-header" style={styles.header}>
      <View style={styles.headingGroup}>
        {leading}
        <View style={styles.copy}>
          <Wordmark size="compact" tone={isLight ? 'light' : 'dark'} />
          <AppText variant="title" tone={isLight ? 'white' : 'default'}>
            {title}
          </AppText>
          {supporting ? (
            <AppText variant="body" tone={isLight ? 'white' : 'soft'} style={styles.supporting}>
              {supporting}
            </AppText>
          ) : null}
        </View>
      </View>
      {(actions || onOpenNotifications || onOpenSettings) ? (
        <View style={styles.actions}>
          {actions}
          {onOpenNotifications ? <NotificationBellButton count={notificationCount} onPress={onOpenNotifications} tone={tone} /> : null}
          {onOpenSettings ? <SettingsCogButton onPress={onOpenSettings} tone={tone} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headingGroup: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  copy: {
    minWidth: 0,
    flexShrink: 1,
  },
  supporting: {
    marginTop: spacing.xxs,
    opacity: 0.9,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
