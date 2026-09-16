import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { NotificationCentreItem } from '../notificationCentre';
import { colors, radius, shadow, spacing } from '../theme';
import { FoundationIcon, FoundationIconComponent } from './FoundationIcon';
import { BellIcon, HistoryIcon, UsersRoundIcon, XIcon } from './foundationIcons';
import { NotificationAnchor } from './NotificationBellButton';
import { AppText } from './Text';

type Props = {
  visible: boolean;
  origin?: NotificationAnchor;
  items: NotificationCentreItem[];
  unreadIds: Set<string>;
  personName?: string;
  onDismiss: () => void;
  onOpenRecord: (recordId: string) => void;
  onViewActivity?: () => void;
};

const PANEL_MARGIN = 16;

function relativeTime(iso: string): string {
  const value = new Date(iso);
  const now = new Date();
  const minutes = Math.max(0, Math.round((now.getTime() - value.getTime()) / 60_000));
  if (minutes < 60) return minutes <= 1 ? 'Just now' : `${minutes} mins ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function itemVisual(item: NotificationCentreItem): { icon: FoundationIconComponent; tint: string; ink: string } {
  if (item.kind === 'careCircle') return { icon: UsersRoundIcon, tint: colors.tealSoft, ink: colors.teal };
  if (item.kind === 'overdue') return { icon: BellIcon, tint: colors.dangerSoft, ink: colors.danger };
  if (item.kind === 'reminder') return { icon: BellIcon, tint: colors.primarySoft, ink: colors.primary };
  return { icon: HistoryIcon, tint: colors.blueSoft, ink: colors.blue };
}

export function NotificationCentre({
  visible,
  origin,
  items,
  unreadIds,
  personName,
  onDismiss,
  onOpenRecord,
  onViewActivity,
}: Props) {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const panelWidth = Math.min(width - (PANEL_MARGIN * 2), 390);
  const panelLeft = Math.min(
    Math.max((origin?.x ?? width) + (origin?.width ?? 0) - panelWidth, PANEL_MARGIN),
    width - panelWidth - PANEL_MARGIN,
  );
  const panelTop = Math.max((origin?.y ?? 52) + (origin?.height ?? 44) + spacing.xs, 64);
  const originCenterX = (origin?.x ?? width - PANEL_MARGIN) + ((origin?.width ?? 0) / 2);
  const translateFromX = originCenterX - (panelLeft + (panelWidth / 2));
  const translateFromY = (origin?.y ?? panelTop) - panelTop;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.setValue(0);
      Animated.spring(progress, { toValue: 1, damping: 20, stiffness: 190, mass: 0.8, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [mounted, progress, visible]);

  const visibleItems = useMemo(() => items.slice(0, 30), [items]);
  if (!mounted) return null;

  const panelTransform = {
    opacity: progress,
    transform: [
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [translateFromX, 0] }) },
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [translateFromY, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.18, 1] }) },
    ],
  };

  function openRecord(recordId: string) {
    onDismiss();
    onOpenRecord(recordId);
  }

  function viewActivity() {
    onDismiss();
    onViewActivity?.();
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }) }]} />
        <Pressable accessibilityLabel="Close notifications" style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Animated.View
          testID="notification-centre"
          style={[
            styles.panel,
            { left: panelLeft, top: panelTop, width: panelWidth, maxHeight: Math.max(280, height - panelTop - 24) },
            panelTransform,
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <AppText variant="section">Notifications</AppText>
              <AppText variant="secondary" tone="soft">{personName ? `Updates for ${personName}` : 'Updates and reminders'}</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Done" onPress={onDismiss} style={styles.closeButton}>
              <FoundationIcon icon={XIcon} role="navigation" color={colors.primary} />
            </Pressable>
          </View>

          {visibleItems.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
                <FoundationIcon icon={BellIcon} role="utility" color={colors.primary} />
              </View>
              <AppText variant="bodyStrong">You are all caught up</AppText>
              <AppText variant="secondary" tone="soft">New reminders and Care Circle updates will appear here.</AppText>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {visibleItems.map((item) => {
                const visual = itemVisual(item);
                const unread = unreadIds.has(item.id);
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole={item.recordId ? 'button' : undefined}
                    accessibilityLabel={`${item.title}. ${item.body}`}
                    onPress={item.recordId ? () => openRecord(item.recordId as string) : undefined}
                    style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && item.recordId && styles.rowPressed]}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: visual.tint }]}>
                      <FoundationIcon icon={visual.icon} role="navigation" color={visual.ink} />
                    </View>
                    <View style={styles.rowCopy}>
                      <View style={styles.rowHeading}>
                        <AppText variant="meta" style={{ color: visual.ink }}>{item.title}</AppText>
                        {unread ? <View accessibilityLabel="Unread" style={styles.unreadDot} /> : null}
                      </View>
                      <AppText variant="secondary">{item.body}</AppText>
                      <AppText variant="meta" tone="soft">{relativeTime(item.occurredAt)}</AppText>
                    </View>
                  </Pressable>
                );
              })}
              {onViewActivity ? (
                <Pressable accessibilityRole="button" accessibilityLabel="View all recent activity" onPress={viewActivity} style={styles.viewActivity}>
                  <AppText variant="button" tone="primary">View all recent activity</AppText>
                </Pressable>
              ) : null}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.ink },
  panel: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.soft,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerCopy: { flex: 1 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.sm, gap: spacing.xs },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  rowUnread: { backgroundColor: '#F7EAF0' },
  rowPressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  iconCircle: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0, gap: 1 },
  rowHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  unreadDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: '#C71742' },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.xs },
  viewActivity: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xxs },
});
