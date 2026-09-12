import { Pressable, StyleSheet, View } from 'react-native';

import { CareCircleMember } from '../careCircle';
import { RecordLinkType } from '../recordLinks';
import { CategoryIcon, categoryLabel, visualFor } from '../screens/HomeScreen';
import { DerivedRecordState, deriveRecordState, formatDateForDisplay, recordDomainForType } from '../records';
import { colors, radius, spacing } from '../theme';
import { LilicaRecord, LilicaRecordType } from '../types';
import { AppText } from './Text';

// Phase 17: one stored record_link, already resolved to the OTHER
// record's full data by the host (RecordQuickEditor/FirstThingScreen,
// which already hold the current care space's full record list -- see
// list_record_links() in src/recordLinks.ts for how the link itself is
// fetched and filtered to what the caller may see). `direction` is
// relative to whichever record THIS RecordDetail is currently showing.
export type RelatedRecordEntry = {
  linkId: string;
  linkType: RecordLinkType;
  direction: 'outgoing' | 'incoming';
  record: LilicaRecord;
};

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
  // Phase 17: this record's own persisted links, already resolved and
  // permission-filtered by the host. Omitted/empty renders no section at
  // all -- a reference-only document is exactly as valid as a linked one.
  relatedRecords?: RelatedRecordEntry[];
  onOpenLinkedRecord?: (recordId: string) => void;
  // Phase 17: "View document" -- only ever rendered for a document record
  // that has at least one attachment, one row per attachment (never
  // assumes index 0 is the only one). The host owns the actual local-
  // copy-or-signed-URL retrieval (src/attachments.ts's openAttachment());
  // this component only ever shows the button and forwards which
  // attachment id was tapped.
  onViewDocument?: (attachmentId: string) => void;
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

// Phase 17: restrained, context-aware section labels for one stored link
// -- never the raw link_type. The SAME relationship reads differently
// depending on which side is currently open (brief section 17): a
// document shows "Related to"; an appointment/bill/home-or-car-matter
// shows "Documents"; a task created FROM a document shows "Related
// document"; a document shows the task that exists because of it under
// "Action".
function relatedSectionLabel(hostType: LilicaRecordType, entry: RelatedRecordEntry): string {
  if (entry.linkType === 'action_for') {
    return hostType === 'document' ? 'Action' : 'Related document';
  }
  if (hostType === 'document') return 'Related to';
  if (entry.record.type === 'document') return 'Documents';
  return 'Related to';
}

// A short, useful second line for a related row -- reusing the exact
// same date/assignment presentation this file already builds for the
// record it's showing, just applied to the OTHER record in the pair.
function relatedSubtitle(entry: RelatedRecordEntry, activeMembershipId?: string, careCircleMembers?: CareCircleMember[]): string | undefined {
  const other = entry.record;
  const derived = deriveRecordState(other);
  const usesDueDate = other.type === 'task' || other.type === 'bill' || other.type === 'homeMatter';
  const dateLine = usesDueDate ? dueDateLine(other, derived) : dateTimeLine(other);
  if (entry.linkType === 'action_for' && usesDueDate) {
    const assignee = assignmentLabel(other, activeMembershipId, careCircleMembers);
    return [dateLine, assignee && assignee !== 'Unassigned' ? assignee : undefined].filter(Boolean).join(' · ') || dateLine;
  }
  return dateLine;
}

const recurrenceLabels: Record<string, string> = {
  '1-week': 'Repeats weekly',
  '2-week': 'Repeats every 2 weeks',
  '1-month': 'Repeats monthly',
  '6-month': 'Repeats every 6 months',
  '1-year': 'Repeats annually',
};

export function RecordDetail({ record, activeMembershipId, careCircleMembers, onEdit, relatedRecords, onOpenLinkedRecord, onViewDocument }: Props) {
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
      </View>

      {record.notes ? (
        <View style={styles.notes}>
          <AppText variant="meta" tone="muted">Notes</AppText>
          <AppText variant="body" style={styles.notesText}>{record.notes}</AppText>
        </View>
      ) : null}

      {/* Phase 17: bidirectional related-record presentation -- one
          stored relationship, read from whichever side is currently
          open. Grouped by its own restrained, context-aware label; each
          row opens straight into that record's own read-only detail
          (never Edit), preserving the app's existing tap-record-to-VIEW
          rule. No section renders at all when there is nothing to show --
          a reference-only document stays exactly as valid. */}
      {relatedRecords && relatedRecords.length > 0 ? (
        <View style={styles.related}>
          {relatedRecords.map((entry) => (
            <View key={entry.linkId} style={styles.field}>
              <AppText variant="meta" tone="muted">{relatedSectionLabel(record.type, entry)}</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${entry.record.title}`}
                onPress={() => onOpenLinkedRecord?.(entry.record.id)}
                style={styles.relatedLinkRow}
              >
                <View style={styles.relatedLinkCopy}>
                  <AppText variant="body" tone="primary" numberOfLines={1}>{entry.record.title}</AppText>
                  {relatedSubtitle(entry, activeMembershipId, careCircleMembers) ? (
                    <AppText variant="secondary" tone="soft">{relatedSubtitle(entry, activeMembershipId, careCircleMembers)}</AppText>
                  ) : null}
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {record.type === 'document' && attachments.length > 0 ? (
        <View style={styles.field}>
          <AppText variant="meta" tone="muted">{attachments.length === 1 ? 'Document' : 'Documents'}</AppText>
          {attachments.map((attachment) => (
            <View key={attachment.id} style={styles.documentRow}>
              <AppText variant="body" numberOfLines={1} style={styles.documentName}>{attachment.name}</AppText>
              {onViewDocument ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${attachment.name}`}
                  onPress={() => onViewDocument(attachment.id)}
                  hitSlop={8}
                >
                  <AppText variant="bodyStrong" tone="primary">View</AppText>
                </Pressable>
              ) : null}
            </View>
          ))}
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
  related: { gap: spacing.md },
  relatedLinkRow: { minHeight: 40, justifyContent: 'center' },
  relatedLinkCopy: { gap: 1 },
  documentRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  documentName: { flex: 1 },
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
