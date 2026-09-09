import {
  ActivityEvent,
  Assignment,
  Confirmation,
  DomainRecord,
  IsoDate,
  Occurrence,
  OccurrenceStatus,
  PermissionSet,
  RecordKind,
  RecordLink,
  RecurrenceRule,
  SemanticOperation,
} from './types';

const DAY_MS = 86_400_000;
const TERMINAL_STATUSES: OccurrenceStatus[] = ['completed', 'cancelled', 'missed'];

function parseIsoDate(value: IsoDate) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function isoDate(year: number, month: number, day: number): IsoDate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` as IsoDate;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dateOrdinal(value: IsoDate) {
  const { year, month, day } = parseIsoDate(value);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function addDays(value: IsoDate, amount: number): IsoDate {
  const { year, month, day } = parseIsoDate(value);
  const result = new Date(Date.UTC(year, month - 1, day + amount));
  return isoDate(result.getUTCFullYear(), result.getUTCMonth() + 1, result.getUTCDate());
}

export function dateInTimeZone(instant: string | Date, timezone: string): IsoDate {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}` as IsoDate;
}

export function deriveOccurrenceState(
  occurrence: Occurrence,
  clock: { now: string; today: IsoDate },
) {
  const terminal = TERMINAL_STATUSES.includes(occurrence.status);
  const actionable = occurrence.kind === 'action' && !terminal;
  const dateDifference = occurrence.dueOn
    ? dateOrdinal(occurrence.dueOn) - dateOrdinal(clock.today)
    : undefined;
  const eventEnd = occurrence.endsAt ?? occurrence.startsAt;
  const eventDate = occurrence.startsAt
    ? dateInTimeZone(occurrence.startsAt, occurrence.timezone ?? 'Europe/London')
    : undefined;

  return {
    dueToday: actionable && dateDifference === 0,
    overdue: actionable && dateDifference !== undefined && dateDifference < 0,
    upcoming: !terminal && (
      (dateDifference !== undefined && dateDifference > 0)
      || (occurrence.kind === 'event' && eventDate !== undefined && eventDate > clock.today)
    ),
    unresolved: actionable,
    pastAwaitingOutcome: occurrence.kind === 'event'
      && occurrence.status === 'scheduled'
      && Boolean(eventEnd)
      && new Date(eventEnd!).getTime() < new Date(clock.now).getTime(),
  };
}

const TRANSITIONS: Record<OccurrenceStatus, Partial<Record<DomainAction, OccurrenceStatus>>> = {
  open: { complete: 'completed', cancel: 'cancelled' },
  awaiting_confirmation: { complete: 'completed', cancel: 'cancelled' },
  scheduled: { complete: 'completed', cancel: 'cancelled', mark_missed: 'missed' },
  completed: { reopen: 'open' },
  cancelled: { reopen: 'open' },
  missed: { reopen: 'scheduled' },
};

export type DomainAction = 'complete' | 'cancel' | 'reopen' | 'mark_missed';

export function transitionOccurrence(
  occurrence: Occurrence,
  action: DomainAction,
  actorMembershipId: string,
  occurredAt: string,
) {
  let nextStatus = TRANSITIONS[occurrence.status][action];
  if (action === 'reopen' && occurrence.kind === 'event' && nextStatus) nextStatus = 'scheduled';
  if (!nextStatus) throw new Error(`Cannot ${action} an occurrence with status ${occurrence.status}`);

  const verb: ActivityEvent['verb'] = action === 'complete'
    ? 'completed'
    : action === 'cancel'
      ? 'cancelled'
      : action === 'mark_missed'
        ? 'marked_missed'
        : 'reopened';

  const confirmation: Confirmation | undefined = action === 'complete' ? {
    id: `confirmation:${occurrence.id}:${occurredAt}`,
    occurrenceId: occurrence.id,
    actorMembershipId,
    claim: 'completed',
    source: 'user_assertion',
    confirmedAt: occurredAt,
  } : undefined;

  return {
    occurrence: {
      ...occurrence,
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? occurredAt : undefined,
    },
    activity: {
      id: `activity:${occurrence.id}:${action}:${occurredAt}`,
      occurrenceId: occurrence.id,
      actorMembershipId,
      verb,
      occurredAt,
    } satisfies ActivityEvent,
    confirmation,
  };
}

export function acknowledgeReminder<T extends Occurrence>(
  occurrence: T,
  deliveryId: string,
  action: 'dismiss' | 'snooze',
) {
  return {
    occurrence,
    acknowledgement: { deliveryId, action },
  };
}

export function recurrenceDate(rule: RecurrenceRule, sequence: number): IsoDate {
  if (!Number.isInteger(sequence) || sequence < 0) throw new Error('Sequence must be a non-negative integer');
  const { year, month, day } = parseIsoDate(rule.anchorDate);

  if (rule.frequency === 'week') return addDays(rule.anchorDate, sequence * rule.interval * 7);

  if (rule.frequency === 'month') {
    const monthIndex = (month - 1) + sequence * rule.interval;
    const targetYear = year + Math.floor(monthIndex / 12);
    const targetMonth = ((monthIndex % 12) + 12) % 12 + 1;
    return isoDate(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
  }

  const targetYear = year + sequence * rule.interval;
  return isoDate(targetYear, month, Math.min(day, daysInMonth(targetYear, month)));
}

export function occurrenceKey(recordId: string, sequence: number) {
  return `${recordId}:occurrence:${sequence}`;
}

export function ensureNextOccurrence(
  record: DomainRecord,
  rule: RecurrenceRule,
  completed: Occurrence,
  existing: Occurrence[],
) {
  if (completed.status !== 'completed' || completed.sequence === undefined) {
    throw new Error('A completed recurring occurrence with a sequence is required');
  }
  if (rule.recordId !== record.id || completed.recordId !== record.id) {
    throw new Error('Record, rule and occurrence must belong to the same series');
  }

  const sequence = completed.sequence + 1;
  const key = occurrenceKey(record.id, sequence);
  const found = existing.find((item) => item.recurrenceKey === key);
  if (found) return { occurrences: existing, occurrence: found, created: false };

  const dueOn = recurrenceDate(rule, sequence);
  const occurrence: Occurrence = {
    id: key,
    recordId: record.id,
    kind: completed.kind,
    status: completed.kind === 'event' ? 'scheduled' : 'open',
    dueOn,
    sequence,
    recurrenceKey: key,
    ruleVersion: rule.version,
    originalDate: dueOn,
  };
  return { occurrences: [...existing, occurrence], occurrence, created: true };
}

export function planRecurrenceEdit(
  rule: RecurrenceRule,
  selected: Occurrence,
  occurrences: Occurrence[],
  scope: 'one' | 'this_and_future',
  newDate: IsoDate,
) {
  if (TERMINAL_STATUSES.includes(selected.status)) {
    throw new Error('Completed, cancelled or missed occurrence history cannot be rewritten');
  }
  if (scope === 'one') {
    return {
      rule,
      occurrences: occurrences.map((item) => item.id === selected.id
        ? { ...item, dueOn: newDate }
        : item),
      affectedOccurrenceIds: [selected.id],
    };
  }

  const selectedSequence = selected.sequence ?? 0;
  const affectedOccurrenceIds = occurrences
    .filter((item) => (item.sequence ?? -1) >= selectedSequence && !TERMINAL_STATUSES.includes(item.status))
    .map((item) => item.id);
  return {
    rule: {
      ...rule,
      version: rule.version + 1,
      anchorDate: newDate,
      effectiveFrom: selected.originalDate ?? selected.dueOn ?? newDate,
    },
    occurrences,
    affectedOccurrenceIds,
  };
}

export function planLinkedDateChange(link: RecordLink, sourceDate: IsoDate, currentDate?: IsoDate) {
  if (link.datePolicy.type === 'manual') {
    return { proposedDate: currentDate, requiresConfirmation: true, reason: 'manual_date' as const };
  }
  return {
    proposedDate: addDays(sourceDate, -link.datePolicy.daysBefore),
    requiresConfirmation: true,
    reason: 'relative_policy' as const,
  };
}

export function canComplete(_assignment: Assignment | undefined, permissions: PermissionSet) {
  return permissions.canComplete;
}

export function viewEligibility(
  record: DomainRecord,
  occurrence: Occurrence,
  clock: { now: string; today: IsoDate; comingUpThrough: IsoDate },
) {
  const state = deriveOccurrenceState(occurrence, clock);
  const active = record.lifecycle === 'active';
  const terminal = TERMINAL_STATUSES.includes(occurrence.status);
  const todayEvent = occurrence.kind === 'event'
    && occurrence.status === 'scheduled'
    && occurrence.startsAt !== undefined
    && dateInTimeZone(occurrence.startsAt, occurrence.timezone ?? 'Europe/London') === clock.today;
  const projectionDate = occurrence.kind === 'event' && occurrence.startsAt
    ? dateInTimeZone(occurrence.startsAt, occurrence.timezone ?? 'Europe/London')
    : occurrence.dueOn;
  const comingUp = active && !terminal && projectionDate !== undefined
    && projectionDate > clock.today && projectionDate <= clock.comingUpThrough;
  const needsAttention = active && (state.overdue || state.dueToday || state.pastAwaitingOutcome);

  return {
    homeSection: needsAttention ? 'needs_attention' as const
      : todayEvent ? 'today' as const
        : comingUp ? 'coming_up' as const
          : undefined,
    calendar: active && !terminal && (occurrence.kind === 'event' || Boolean(occurrence.dueOn)),
    todo: active && occurrence.kind === 'action'
      && (occurrence.status === 'open' || occurrence.status === 'awaiting_confirmation'),
    person: active && (['information', 'document', 'contact'] as RecordKind[]).includes(record.kind),
  };
}

export function shouldCreateLinkedAction(source: DomainRecord, requestedSubtype: DomainRecord['actionSubtype']) {
  return !(source.kind === 'action' && source.actionSubtype === 'bill_payment' && requestedSubtype === 'bill_payment');
}

export function resolveSemanticOperations(left: SemanticOperation, right: SemanticOperation) {
  if (left.entityId !== right.entityId) return { resolution: 'independent' as const };
  if (left.id === right.id) return { resolution: 'duplicate' as const };
  if ((left.kind === 'complete' && right.kind === 'cancel') || (left.kind === 'cancel' && right.kind === 'complete')) {
    return { resolution: 'conflict' as const, reason: 'incompatible_transition' as const };
  }
  if (left.kind === 'set_field' && right.kind === 'set_field') {
    if (left.field === right.field && left.value !== right.value) {
      return { resolution: 'conflict' as const, reason: 'same_field' as const };
    }
    return { resolution: 'merge' as const };
  }
  return { resolution: 'merge' as const };
}
