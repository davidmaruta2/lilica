import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { ActivityEvent, describeActivityEvent, listRecentActivity } from '../activity';
import { colors, radius, spacing } from '../theme';

// Phase 20B, Feature A: "What has happened since I last looked?" Lives
// under People (brief section 9 -- explicitly NOT a Home preview). Fetches
// its own bounded first page on mount and pages further only on an
// explicit "View more" tap (brief section 11 -- never loads hundreds of
// events at once). Tapping a record-related event opens the exact same
// record detail experience every other list in the app already uses.
type Props = {
  careSpaceId?: string;
  personName?: string;
  onBack: () => void;
  onOpenRecord: (recordId: string) => void;
};

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function groupByDay(events: ActivityEvent[]): { label: string; events: ActivityEvent[] }[] {
  const groups: { label: string; events: ActivityEvent[] }[] = [];
  for (const event of events) {
    const label = dayLabel(event.createdAt);
    const existing = groups.find((group) => group.label === label);
    if (existing) existing.events.push(event);
    else groups.push({ label, events: [event] });
  }
  return groups;
}

export function RecentActivityScreen({ careSpaceId, personName, onBack, onOpenRecord }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    if (!careSpaceId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(undefined);
    listRecentActivity(careSpaceId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) { setError(result.message); return; }
      setEvents(result.data.events);
      setHasMore(result.data.hasMore);
    });
    return () => { cancelled = true; };
  }, [careSpaceId]);

  async function loadMore() {
    if (!careSpaceId || events.length === 0) return;
    setLoadingMore(true);
    const result = await listRecentActivity(careSpaceId, events[events.length - 1].createdAt);
    setLoadingMore(false);
    if (!result.ok) { setError(result.message); return; }
    setEvents((current) => [...current, ...result.data.events]);
    setHasMore(result.data.hasMore);
  }

  const groups = groupByDay(events);

  return (
    <Screen>
      <Header title="Recent activity" onBack={onBack} />
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <AppText variant="secondary" tone="danger">{error}</AppText>
      ) : events.length === 0 ? (
        <AppText variant="secondary" tone="soft">
          Nothing has happened yet for {personName || 'this person'} - activity from everyone in the Care Circle will appear here.
        </AppText>
      ) : (
        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.label} style={styles.dayGroup}>
              <AppText variant="meta" tone="soft" style={styles.dayLabel}>{group.label}</AppText>
              <View style={styles.rows}>
                {group.events.map((event) => (
                  <Pressable
                    key={event.id}
                    accessibilityRole={event.recordId ? 'button' : undefined}
                    accessibilityLabel={describeActivityEvent(event)}
                    onPress={event.recordId ? () => onOpenRecord(event.recordId as string) : undefined}
                    style={styles.row}
                  >
                    <View style={styles.rowCopy}>
                      <AppText variant="body">{describeActivityEvent(event)}</AppText>
                    </View>
                    <AppText variant="meta" tone="soft">{timeLabel(event.createdAt)}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
          {hasMore ? (
            <Pressable accessibilityRole="button" accessibilityLabel="View more activity" onPress={() => void loadMore()} style={styles.viewMore} disabled={loadingMore}>
              {loadingMore ? <ActivityIndicator /> : <AppText variant="secondary" tone="primary">View more</AppText>}
            </Pressable>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  groups: {
    gap: spacing.md,
  },
  dayGroup: {
    gap: spacing.xxs,
  },
  dayLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rows: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowCopy: {
    flex: 1,
  },
  viewMore: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
