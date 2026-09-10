import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { PersonSwitcher } from '../components/PersonSwitcher';
import { AppText } from '../components/Text';
import { Wordmark } from '../components/Wordmark';
import { CategoryIcon, categoryLabel, visualFor } from './HomeScreen';
import { formatDateForDisplay } from '../records';
import { colors, radius, spacing } from '../theme';
import { LilicaRecord, LilicaRecordType, LocalCareSpaceState } from '../types';

type Props = {
  records: LilicaRecord[];
  displayName?: string;
  relationshipLabel?: string;
  isSelf: boolean;
  people: LocalCareSpaceState[];
  activeCareSpaceId?: string;
  onSwitchPerson: (careSpaceId: string) => void;
  onAddPerson: () => void;
  onOpenRecord: (recordId: string) => void;
  onAddType: (type: LilicaRecordType) => void;
  onOpenAccount: () => void;
};

// Phase 13: durable-knowledge groupings, each backed by an existing record
// type -- no Person-specific store. Appointments (Calendar), tasks (To Do)
// and updates (Home's chronological Latest) deliberately have no section
// here; Person answers "what do we know", not "when" or "what needs doing".
type SectionDef = {
  key: string;
  title: string;
  type: LilicaRecordType;
  addLabel: string;
  detail: (record: LilicaRecord) => string | undefined;
};

function contactDetail(record: LilicaRecord): string | undefined {
  return [record.role, record.phone, record.email].filter(Boolean).join(' · ') || undefined;
}

function careDetail(record: LilicaRecord): string | undefined {
  return record.notes?.trim() || undefined;
}

function homeDetail(record: LilicaRecord): string | undefined {
  const parts: string[] = [];
  if (record.provider) parts.push(record.provider);
  const due = record.dueDate ?? record.date;
  if (due) parts.push(`Next due ${formatDateForDisplay(due)}`);
  return parts.join(' · ') || undefined;
}

function billDetail(record: LilicaRecord): string | undefined {
  const parts: string[] = [];
  if (record.amount) parts.push(record.amount);
  if (record.reference) parts.push(record.reference);
  const due = record.dueDate ?? record.date;
  if (due) parts.push(`Renews ${formatDateForDisplay(due)}`);
  return parts.join(' · ') || undefined;
}

function documentDetail(record: LilicaRecord): string | undefined {
  const parts: string[] = [];
  const count = record.attachments?.length ?? 0;
  if (count > 0) parts.push(`${count} file${count === 1 ? '' : 's'}`);
  if (record.expiryDate) parts.push(`Expires ${formatDateForDisplay(record.expiryDate)}`);
  return parts.join(' · ') || undefined;
}

const SECTIONS: SectionDef[] = [
  { key: 'contacts', title: 'Important contacts', type: 'contact', addLabel: 'Add a contact', detail: contactDetail },
  { key: 'care', title: 'Care & health information', type: 'careNote', addLabel: 'Add care information', detail: careDetail },
  { key: 'home', title: 'Home', type: 'homeMatter', addLabel: 'Add home information', detail: homeDetail },
  { key: 'documents', title: 'Documents & paperwork', type: 'document', addLabel: 'Add a document', detail: documentDetail },
  { key: 'bills', title: 'Bills & renewals', type: 'bill', addLabel: 'Add a bill or renewal', detail: billDetail },
];

function recentFirst(a: LilicaRecord, b: LilicaRecord) {
  return (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt);
}

export function PersonScreen({
  records,
  displayName,
  relationshipLabel,
  isSelf,
  people,
  activeCareSpaceId,
  onSwitchPerson,
  onAddPerson,
  onOpenRecord,
  onAddType,
  onOpenAccount,
}: Props) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const name = displayName?.trim() || 'Them';
  const possessive = isSelf ? 'you' : name;

  const grouped = useMemo(
    () => SECTIONS.map((section) => ({
      ...section,
      items: records
        .filter((record) => record.type === section.type && record.status !== 'cancelled')
        .sort(recentFirst),
    })),
    [records],
  );

  const populated = grouped.filter((section) => section.items.length > 0);
  const isSparse = populated.length === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Wordmark />
        <Pressable accessibilityRole="button" accessibilityLabel="Account" onPress={onOpenAccount} hitSlop={8}>
          <AppText variant="secondary" tone="primary" style={styles.accountLink}>Account</AppText>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Switch person, currently ${name}`}
        onPress={() => setSwitcherOpen(true)}
        style={styles.personCard}
      >
        <View style={styles.personIcon}>
          <AppText variant="title" tone="primary">{name.charAt(0).toUpperCase()}</AppText>
        </View>
        <View style={styles.personCopy}>
          <AppText variant="title">{isSelf ? 'You' : name}</AppText>
          {!isSelf && relationshipLabel ? <AppText variant="secondary" tone="soft">{relationshipLabel}</AppText> : null}
        </View>
        {people.length > 1 ? <AppText variant="bodyStrong" tone="primary">v</AppText> : null}
      </Pressable>

      <AppText variant="body" tone="soft">
        {isSelf ? 'What Lilica knows and keeps track of for you.' : `What Lilica knows and keeps track of for ${possessive}.`}
      </AppText>

      {isSparse ? (
        <View style={styles.emptyState}>
          <AppText variant="secondary" tone="soft" centre>
            Nothing saved for {isSelf ? 'you' : name} yet. Add a contact, document or other useful detail whenever it's helpful.
          </AppText>
          <Button label="Add something" variant="secondary" onPress={() => onAddType('contact')} style={styles.emptyButton} />
        </View>
      ) : (
        <View style={styles.sections}>
          {populated.map((section) => (
            <View key={section.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <AppText variant="section">{section.title}</AppText>
                <Pressable accessibilityRole="button" accessibilityLabel={section.addLabel} onPress={() => onAddType(section.type)} hitSlop={8}>
                  <AppText variant="secondary" tone="primary">Add</AppText>
                </Pressable>
              </View>
              <View style={styles.sectionList}>
                {section.items.map((record) => {
                  const visual = visualFor(record.type);
                  const detail = section.detail(record);
                  return (
                    <Pressable
                      key={record.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${record.title}`}
                      onPress={() => onOpenRecord(record.id)}
                      style={styles.row}
                    >
                      <View style={[styles.iconChip, { backgroundColor: visual.tint }]}>
                        <CategoryIcon type={record.type} color={visual.accent} />
                      </View>
                      <View style={styles.rowCopy}>
                        <AppText variant="bodyStrong" numberOfLines={2}>{record.title}</AppText>
                        {detail ? <AppText variant="secondary" tone="soft" numberOfLines={2}>{detail}</AppText> : null}
                        <AppText variant="meta" tone="muted">Added {formatDateForDisplay(record.createdAt.slice(0, 10)) ?? ''}</AppText>
                      </View>
                      <AppText variant="section" tone="primary">&gt;</AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.careCircle}>
        <AppText variant="section">Care circle</AppText>
        <View style={styles.careCircleRow}>
          <View style={[styles.iconChip, { backgroundColor: colors.primarySoft }]}>
            <AppText variant="bodyStrong" tone="primary">Y</AppText>
          </View>
          <View style={styles.rowCopy}>
            <AppText variant="bodyStrong">You</AppText>
            <AppText variant="secondary" tone="soft">The only person with access right now.</AppText>
          </View>
        </View>
      </View>

      <PersonSwitcher
        visible={switcherOpen}
        people={people}
        activeId={activeCareSpaceId}
        onClose={() => setSwitcherOpen(false)}
        onSelect={onSwitchPerson}
        onAdd={onAddPerson}
      />
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
    gap: spacing.md,
  },
  header: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountLink: {
    fontWeight: '700',
  },
  personCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  personIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personCopy: {
    flex: 1,
    gap: 2,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  emptyButton: {
    width: 'auto',
    paddingHorizontal: spacing.lg,
  },
  sections: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionList: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  careCircle: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  careCircleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
