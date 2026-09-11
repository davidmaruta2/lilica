import { Pressable, StyleSheet, View } from 'react-native';

import { CareCircleMember } from '../careCircle';
import { CategoryIcon, categoryLabel, visualFor } from '../screens/HomeScreen';
import { DerivedRecordState, deriveRecordState, formatDateForDisplay, recordDomainForType } from '../records';
import { colors, radius, spacing } from '../theme';
import { LilicaRecord } from '../types';
import { AppText } from './Text';

// Corrective task: existing records open in a genuine read-only detail
// view, not the editor -- see docs/CORRECTIVE_TASK_VIEW_EDIT.md. This
// component is that view: one reusable, category-aware presentation, used
// by every host (RecordQuickEditor for Home/Calendar/To Do/People, and
// FirstThingScreen's own inline sheet for category lists) rather than a
// separate detail implementation per screen.
//
// It renders ONLY from the record's own fields, via the same
// deriveRecordState()/formatDateForDisplay() every other screen already
// uses -- no new derived state, no new field, no fabricated summary.

type Props = {
  record: LilicaRecord;
  activeMembershipId?: string;
  careCircleMembers?: CareCircleMember[];
  // Omitted entirely when the current care-circle member is not
  // authorised to edit this record -- see canEditRecord() below. Absence
  // hides the Edit action; it is never disabled-but-visible.
  onEdit?: () => void;
};

const dueLabels: Record<string, string> = {
  task: "Who's dealing with it",
  bill: "Who's dealing with it",
  homeMatter: "Who's dealing with it",
  appointment: "Who's taking them",
};

// Same real data Phase 15 already produces (src/careCircle.ts), applied as
// a courtesy UI check -- apply_record_mutation() on the server remains the
// actual authority. A viewer never gets Edit; a contributor only gets it
// for a record whose domain they were actually granted; an organiser (or
// no loaded care circle at all -- a local-only space, or before the first
// fetch resolves) keeps today's behaviour.
export function canEditRecord(record: LilicaRecord, careCircleMembers?: CareCircleMember[]): boolean {
  const myMember = careCircleMembers?.find((member) => member.isSelf);
  if (!myMember) return true;
  if (myMember.role === 'organiser') return true;
  if (myMember.role === 'contributor') return myMember.grantedDomains.includes(recordDomainForType(record.type));
  return false;
}

// Mirrors ToDoScreen's own assignmentLabel() exactly (Unassigned/You/real
// name via stable membership ID, never a display-name/email match) --
// duplicated rather than imported to keep this correction's footprint to
// the files already reported, not a cross-screen extraction.
function assignmentLabel(record: LilicaRecord, activeMembershipId?: string, careCircleMembers?: CareCircleMember[]): string | undefined {
  if (!record.assignedMembershipId) return 'Unassigned';
  if (activeMembershipId && record.assignedMembershipId === activeMembershipId) return 'You';
  return careCircleMembers?.find((member) => member.membershipId === record.assignedMembershipId)?.displayName;
}

function dateTimeLine(record: LilicaRecord): string | undefined {
  if (record.type === 'appointment' || record.type === 'update') {
    const date = formatDateForDisplay(record.eventDate ?? record.date);
    const time = record.eventTime ?? record.time;
    if (date && time) return `${date} · ${time}`;
    return date ?? time;
  }
  if (record.type === 'careNote') return formatDateForDisplay(record.eventDate ?? record.date);
  return undefined;
}

// Presentational-only due-date wording, same convention ToDoScreen's own
// dueMetaText() already established (Overdue keeps its plain date; Today/
// plain date otherwise) -- layered on the existing derived.overdue/
// dueToday booleans, never a new stored/derived field.
function dueDateLine(record: LilicaRecord, derived: DerivedRecordState): string | undefined {
  const due = record.dueDate ?? record.date;
  if (derived.overdue) return `Overdue · ${formatDateForDisplay(due) ?? ''}`;
  if (derived.dueToday) return 'Due today';
  return formatDateForDisplay(due);
}

const recurrenceLabels: Record<string, string> = {
  '1-week': 'Repeats weekly',
  '2-week': 'Repeats every 2 weeks',
  '1-month': 'Repeats monthly',
  '6-month': 'Repeats every 6 months',
  '1-year': 'Repeats annually',
};

export function RecordDetail({ record, activeMembershipId, careCircleMembers, onEdit }: Props) {
  const visual = visualFor(record.type);
  const derived = deriveRecordState(record);
  const usesDueDate = record.type === 'task' || record.type === 'bill' || record.type === 'homeMatter';
  const supportsAssignment = record.type === 'appointment' || record.type === 'task' || record.type === 'bill' || record.type === 'homeMatter';
  const supportsCompletion = record.type === 'task' || record.type === 'bill' || record.type === 'homeMatter';
  const completed = record.completed === true || record.status === 'completed';
  const isOverdue = derived.overdue;
  const dateLine = usesDueDate ? dueDateLine(record, derived) : dateTimeLine(record);
  const assignee = supportsAssignment ? assignmentLabel(record, activeMembershipId, careCircleMembers) : undefined;
  const responsibleLabel = dueLabels[record.type];
  const recurrenceKey = record.recurrence ? `${record.recurrence.interval}-${record.recurrence.unit}` : undefined;
  const attachments = record.attachments ?? [];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.iconChip, { backgroundColor: visual.tint }]}>
          <CategoryIcon type={record.type} color={visual.accent} />
        </View>
        <View style={styles.headerCopy}>
          <AppText variant="meta" tone="muted">{categoryLabel(record.type)}</AppText>
          <AppText variant="title" style={styles.titleText}>{record.title}</AppText>
        </View>
      </View>

      {(dateLine || isOverdue || completed) ? (
        <View style={styles.statusRow}>
          {dateLine ? (
            <AppText variant="bodyStrong" tone={isOverdue ? 'danger' : 'default'}>{dateLine}</AppText>
          ) : null}
          {supportsCompletion && completed ? (
            <View style={styles.sortedPill}>
              <AppText variant="secondary" tone="success" style={styles.sortedPillText}>Sorted</AppText>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.fields}>
        {record.type === 'appointment' && record.location ? (
          <DetailRow label="Location" value={record.location} />
        ) : null}
        {record.type === 'homeMatter' && record.provider ? (
          <DetailRow label="Provider or contact" value={record.provider} />
        ) : null}
        {record.type === 'bill' && record.amount ? (
          <DetailRow label="Amount" value={record.amount} />
        ) : null}
        {record.type === 'bill' && record.reference ? (
          <DetailRow label="Reference" value={record.reference} />
        ) : null}
        {record.type === 'document' && record.expiryDate ? (
          <DetailRow label="Expiry date" value={formatDateForDisplay(record.expiryDate)} />
        ) : null}
        {record.type === 'contact' && record.role ? (
          <DetailRow label="Role or relationship" value={record.role} />
        ) : null}
        {record.type === 'contact' && record.phone ? (
          <DetailRow label="Phone" value={record.phone} />
        ) : null}
        {record.type === 'contact' && record.email ? (
          <DetailRow label="Email" value={record.email} />
        ) : null}
        {recurrenceKey ? (
          <DetailRow label="Repeats" value={recurrenceLabels[recurrenceKey] ?? 'Repeats'} />
        ) : null}
        {responsibleLabel && record.responsiblePerson ? (
          <DetailRow label={responsibleLabel} value={record.responsiblePerson} />
        ) : null}
        {assignee ? (
          <DetailRow label="Assigned to" value={assignee} />
        ) : null}
        {record.type === 'document' && attachments.length > 0 ? (
          <View style={styles.field}>
            <AppText variant="meta" tone="muted">{attachments.length === 1 ? 'Attachment' : 'Attachments'}</AppText>
            {attachments.map((attachment) => (
              <AppText key={attachment.id} variant="body" numberOfLines={1}>{attachment.name}</AppText>
            ))}
          </View>
        ) : null}
      </View>

      {record.notes ? (
        <View style={styles.notes}>
          <AppText variant="meta" tone="muted">Notes</AppText>
          <AppText variant="body" style={styles.notesText}>{record.notes}</AppText>
        </View>
      ) : null}

      {onEdit ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${record.title}`} onPress={onEdit} style={styles.editButton}>
          <AppText variant="bodyStrong" tone="primary">Edit</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <AppText variant="meta" tone="muted">{label}</AppText>
      <AppText variant="body">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg, paddingBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconChip: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 2 },
  titleText: { marginTop: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  sortedPill: {
    backgroundColor: colors.oliveSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  sortedPillText: { fontWeight: '700' },
  fields: { gap: spacing.md },
  field: { gap: 2 },
  notes: { gap: spacing.xxs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  notesText: { marginTop: 2 },
  editButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
});
