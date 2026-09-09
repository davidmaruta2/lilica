import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { AppText } from '../components/Text';
import { deriveRecordState, formatDateForDisplay } from '../records';
import { colors, radius, shadow, spacing } from '../theme';
import { FirstItem, OnboardingState } from '../types';

type Props = {
  state: OnboardingState;
  onAddSomething: () => void;
  onDismissAllSet: () => void;
};

function itemTiming(item: FirstItem) {
  const eventDate = formatDateForDisplay(item.eventDate ?? item.date);
  const dueDate = formatDateForDisplay(item.dueDate ?? item.date);
  if (item.type === 'appointment') return item.eventTime || item.time ? `${eventDate}, ${item.eventTime ?? item.time}` : eventDate;
  if (item.type === 'bill' || item.type === 'task' || item.type === 'homeMatter') return dueDate ? `Due ${dueDate}` : 'No due date';
  if (item.type === 'document' && item.expiryDate) return `Expires ${formatDateForDisplay(item.expiryDate)}`;
  if (item.type === 'contact' && item.role) return item.role;
  return 'Saved for later';
}

function sectionFor(item: FirstItem) {
  const derived = deriveRecordState(item);
  if (derived.overdue || derived.dueToday) return 'Needs attention';
  if (item.type === 'appointment' && item.eventDate === new Date().toISOString().slice(0, 10)) return 'Today';
  if (derived.upcoming) return 'Coming up';
  if ((item.type === 'task' || item.type === 'bill' || item.type === 'homeMatter') && derived.unresolved) return 'Needs attention';
  return 'Latest';
}

export function HomeScreen({
  state,
  onAddSomething,
  onDismissAllSet,
}: Props) {
  const records = state.records.length > 0 ? state.records : state.firstItem ? [state.firstItem] : [];
  const personName = state.supportedPersonName?.trim() || 'Them';
  const sections = ['Needs attention', 'Today', 'Coming up', 'Latest']
    .map((title) => ({ title, records: records.filter((record) => sectionFor(record) === title) }))
    .filter((section) => section.records.length > 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <AppText variant="meta" tone="muted">Lilica</AppText>
          <AppText variant="title" style={styles.title} numberOfLines={2} adjustsFontSizeToFit>
            {personName}'s week
          </AppText>
        </View>
        <Button label="Add" onPress={onAddSomething} style={styles.addButton} />
      </View>

      {!state.allSetDismissed ? (
        <View style={styles.message}>
          <AppText variant="bodyStrong">Everything for {personName}, in one place.</AppText>
          <Button label="Dismiss" variant="text" onPress={onDismissAllSet} style={styles.dismiss} />
        </View>
      ) : null}

      {sections.length > 0 ? (
        <View style={styles.sections}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <View style={styles.sectionHeader}>
                <AppText variant="section">{section.title}</AppText>
              </View>
              {section.records.map((item) => (
                <View key={item.id} style={styles.item}>
                  <View style={styles.itemAccent} />
                  <View style={styles.itemCopy}>
                    <AppText variant="meta" tone="muted">{item.type}</AppText>
                    <AppText variant="bodyStrong">{item.title}</AppText>
                    <AppText variant="secondary" tone="soft">{itemTiming(item)}</AppText>
                    {item.responsiblePerson ? (
                      <AppText variant="secondary" tone="soft">With {item.responsiblePerson}</AppText>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <AppText variant="section">Start with one thing you want to keep track of.</AppText>
          <Button label="Add something" onPress={onAddSomething} style={styles.emptyButton} />
        </View>
      )}

      <View style={styles.ask}>
        <View>
          <AppText variant="meta" tone="primary">Ask Lilica</AppText>
          <AppText variant="bodyStrong">What is coming up?</AppText>
        </View>
        <View style={styles.askMark}>
          <AppText variant="bodyStrong" tone="white">?</AppText>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    marginTop: spacing.xs,
    maxWidth: 230,
  },
  addButton: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  message: {
    backgroundColor: colors.oliveSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dismiss: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sections: {
    gap: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  addInline: {
    minHeight: 40,
    paddingHorizontal: spacing.xs,
  },
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    ...shadow.soft,
  },
  itemAccent: {
    width: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  itemCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  emptyCopy: {
    marginTop: spacing.sm,
  },
  emptyButton: {
    marginTop: spacing.lg,
  },
  ask: {
    marginTop: spacing.xl,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  askMark: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
