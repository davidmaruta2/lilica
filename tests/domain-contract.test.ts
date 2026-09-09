import {
  acknowledgeReminder,
  canComplete,
  dateInTimeZone,
  deriveOccurrenceState,
  DomainRecord,
  ensureNextOccurrence,
  Occurrence,
  planLinkedDateChange,
  planRecurrenceEdit,
  RecordLink,
  recurrenceDate,
  RecurrenceRule,
  resolveSemanticOperations,
  shouldCreateLinkedAction,
  transitionOccurrence,
  viewEligibility,
} from '../src/domain';

const clock = {
  now: '2026-09-09T12:00:00.000Z',
  today: '2026-09-09' as const,
  comingUpThrough: '2026-10-09' as const,
};

function domainRecord(patch: Partial<DomainRecord> = {}): DomainRecord {
  return {
    id: 'record-1',
    careSpaceId: 'space-mum',
    kind: 'action',
    lifecycle: 'active',
    ...patch,
  };
}

function occurrence(patch: Partial<Occurrence> = {}): Occurrence {
  return {
    id: 'occurrence-1',
    recordId: 'record-1',
    kind: 'action',
    status: 'open',
    dueOn: '2026-09-09',
    ...patch,
  };
}

function recurrenceRule(patch: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return {
    id: 'rule-1',
    recordId: 'record-1',
    version: 1,
    frequency: 'month',
    interval: 1,
    anchorDate: '2026-01-31',
    effectiveFrom: '2026-01-31',
    state: 'active',
    ...patch,
  };
}

describe('stored lifecycle and derived state', () => {
  it('derives due today and overdue without writing a new status', () => {
    const due = occurrence({ status: 'open', dueOn: '2026-09-09' });
    const late = occurrence({ status: 'open', dueOn: '2026-09-08' });
    expect(deriveOccurrenceState(due, clock)).toMatchObject({ dueToday: true, overdue: false, unresolved: true });
    expect(deriveOccurrenceState(late, clock)).toMatchObject({ dueToday: false, overdue: true, unresolved: true });
    expect(due.status).toBe('open');
    expect(late.status).toBe('open');
  });

  it('treats a passed scheduled appointment as awaiting outcome, never overdue', () => {
    const appointment = occurrence({
      kind: 'event',
      status: 'scheduled',
      dueOn: undefined,
      startsAt: '2026-09-09T09:00:00.000Z',
      endsAt: '2026-09-09T10:00:00.000Z',
    });
    expect(deriveOccurrenceState(appointment, clock)).toMatchObject({
      overdue: false,
      pastAwaitingOutcome: true,
    });
    expect(appointment.status).toBe('scheduled');
  });

  it('keeps completion and cancellation as different terminal states', () => {
    const completed = transitionOccurrence(occurrence(), 'complete', 'member-david', clock.now);
    const cancelled = transitionOccurrence(occurrence(), 'cancel', 'member-david', clock.now);
    expect(completed.occurrence.status).toBe('completed');
    expect(completed.occurrence.completedAt).toBe(clock.now);
    expect(completed.confirmation).toMatchObject({
      actorMembershipId: 'member-david', claim: 'completed', source: 'user_assertion',
    });
    expect(cancelled.occurrence.status).toBe('cancelled');
    expect(cancelled.occurrence.completedAt).toBeUndefined();
    expect(cancelled.confirmation).toBeUndefined();
  });

  it('reopens without erasing the completion activity or mutating the input', () => {
    const completed = occurrence({ status: 'completed', completedAt: '2026-09-08T11:00:00.000Z' });
    const result = transitionOccurrence(completed, 'reopen', 'member-david', clock.now);
    expect(result.occurrence).toMatchObject({ status: 'open', completedAt: undefined });
    expect(result.activity).toMatchObject({ actorMembershipId: 'member-david', verb: 'reopened' });
    expect(completed).toMatchObject({ status: 'completed', completedAt: '2026-09-08T11:00:00.000Z' });
  });

  it('rejects invalid state transitions', () => {
    expect(() => transitionOccurrence(occurrence({ status: 'cancelled' }), 'complete', 'member-david', clock.now))
      .toThrow('Cannot complete');
  });

  it('reopens a terminal event to scheduled rather than action-open', () => {
    const event = occurrence({ kind: 'event', status: 'cancelled', dueOn: undefined, startsAt: '2026-09-10T09:00:00.000Z' });
    expect(transitionOccurrence(event, 'reopen', 'member-david', clock.now).occurrence.status).toBe('scheduled');
  });

  it('does not let reminder acknowledgement change record truth', () => {
    const open = occurrence();
    const result = acknowledgeReminder(open, 'delivery-1', 'dismiss');
    expect(result.occurrence).toBe(open);
    expect(result.occurrence.status).toBe('open');
    expect(result.acknowledgement).toEqual({ deliveryId: 'delivery-1', action: 'dismiss' });
  });
});

describe('stable recurrence series and occurrences', () => {
  it('uses the original month-end anchor for each occurrence', () => {
    const rule = recurrenceRule();
    expect(recurrenceDate(rule, 0)).toBe('2026-01-31');
    expect(recurrenceDate(rule, 1)).toBe('2026-02-28');
    expect(recurrenceDate(rule, 2)).toBe('2026-03-31');
  });

  it('uses 28 February for a leap-day annual anchor and returns to 29 February', () => {
    const rule = recurrenceRule({ frequency: 'year', anchorDate: '2024-02-29', effectiveFrom: '2024-02-29' });
    expect(recurrenceDate(rule, 1)).toBe('2025-02-28');
    expect(recurrenceDate(rule, 4)).toBe('2028-02-29');
  });

  it('creates the next occurrence once while preserving completed history', () => {
    const record = domainRecord({ id: 'record-1' });
    const completed = occurrence({
      id: 'record-1:occurrence:0',
      status: 'completed',
      completedAt: '2026-01-31T12:00:00.000Z',
      dueOn: '2026-01-31',
      sequence: 0,
      recurrenceKey: 'record-1:occurrence:0',
    });
    const first = ensureNextOccurrence(record, recurrenceRule(), completed, [completed]);
    const retry = ensureNextOccurrence(record, recurrenceRule(), completed, first.occurrences);
    expect(first.created).toBe(true);
    expect(first.occurrence).toMatchObject({ dueOn: '2026-02-28', sequence: 1, status: 'open' });
    expect(retry.created).toBe(false);
    expect(retry.occurrences).toHaveLength(2);
    expect(retry.occurrences[0]).toEqual(completed);
  });

  it('edits one occurrence without changing the series or completed neighbours', () => {
    const completed = occurrence({ id: 'occ-0', status: 'completed', sequence: 0, dueOn: '2026-01-31' });
    const selected = occurrence({ id: 'occ-1', sequence: 1, dueOn: '2026-02-28' });
    const result = planRecurrenceEdit(recurrenceRule(), selected, [completed, selected], 'one', '2026-03-02');
    expect(result.rule.version).toBe(1);
    expect(result.occurrences).toEqual([
      completed,
      expect.objectContaining({ id: 'occ-1', dueOn: '2026-03-02' }),
    ]);
  });

  it('versions this-and-future rules without rewriting occurrence history', () => {
    const completed = occurrence({ id: 'occ-0', status: 'completed', sequence: 0, originalDate: '2026-01-31' });
    const selected = occurrence({ id: 'occ-1', sequence: 1, dueOn: '2026-02-28', originalDate: '2026-02-28' });
    const future = occurrence({ id: 'occ-2', sequence: 2, dueOn: '2026-03-31', originalDate: '2026-03-31' });
    const input = [completed, selected, future];
    const result = planRecurrenceEdit(recurrenceRule(), selected, input, 'this_and_future', '2026-03-05');
    expect(result.rule).toMatchObject({ version: 2, anchorDate: '2026-03-05', effectiveFrom: '2026-02-28' });
    expect(result.affectedOccurrenceIds).toEqual(['occ-1', 'occ-2']);
    expect(result.occurrences).toBe(input);
  });

  it('refuses to rewrite a terminal occurrence', () => {
    const completed = occurrence({ id: 'occ-0', status: 'completed', sequence: 0, dueOn: '2026-01-31' });
    expect(() => planRecurrenceEdit(recurrenceRule(), completed, [completed], 'one', '2026-02-01'))
      .toThrow('history cannot be rewritten');
  });
});

describe('links, responsibility, activity and views', () => {
  it('requires confirmation for manual and relative linked-date changes', () => {
    const manual: RecordLink = {
      id: 'link-1', sourceRecordId: 'appointment', targetRecordId: 'transport', type: 'transport_for', datePolicy: { type: 'manual' },
    };
    const relative: RecordLink = { ...manual, id: 'link-2', datePolicy: { type: 'relative', daysBefore: 3 } };
    expect(planLinkedDateChange(manual, '2026-10-12', '2026-10-01')).toEqual({
      proposedDate: '2026-10-01', requiresConfirmation: true, reason: 'manual_date',
    });
    expect(planLinkedDateChange(relative, '2026-10-12')).toEqual({
      proposedDate: '2026-10-09', requiresConfirmation: true, reason: 'relative_policy',
    });
  });

  it('keeps responsibility separate from permission to complete', () => {
    const assignment = { occurrenceId: 'occurrence-1', membershipId: 'member-sarah', state: 'accepted' as const };
    expect(canComplete(assignment, { canView: true, canEdit: false, canComplete: false })).toBe(false);
    expect(canComplete(undefined, { canView: true, canEdit: true, canComplete: true })).toBe(true);
  });

  it('attributes activity to the acting membership', () => {
    const result = transitionOccurrence(occurrence(), 'complete', 'member-sarah', clock.now);
    expect(result.activity).toMatchObject({
      occurrenceId: 'occurrence-1', actorMembershipId: 'member-sarah', verb: 'completed', occurredAt: clock.now,
    });
  });

  it('projects one occurrence deterministically into relevant views', () => {
    const event = occurrence({ kind: 'event', status: 'scheduled', dueOn: undefined, startsAt: '2026-09-09T14:00:00.000Z', timezone: 'Europe/London' });
    expect(viewEligibility(domainRecord({ kind: 'event' }), event, clock)).toEqual({
      homeSection: 'today', calendar: true, todo: false, person: false,
    });

    const task = occurrence({ dueOn: '2026-09-08' });
    expect(viewEligibility(domainRecord({ kind: 'action' }), task, clock)).toEqual({
      homeSection: 'needs_attention', calendar: true, todo: true, person: false,
    });

    const futureEvent = occurrence({ kind: 'event', status: 'scheduled', dueOn: undefined, startsAt: '2026-09-20T10:00:00.000Z', timezone: 'Europe/London' });
    expect(viewEligibility(domainRecord({ kind: 'event' }), futureEvent, clock).homeSection).toBe('coming_up');
  });

  it('does not create a duplicate task for an already-actionable bill', () => {
    expect(shouldCreateLinkedAction(domainRecord({ kind: 'action', actionSubtype: 'bill_payment' }), 'bill_payment')).toBe(false);
    expect(shouldCreateLinkedAction(domainRecord({ kind: 'information' }), 'renewal')).toBe(true);
  });
});

describe('semantic conflict handling', () => {
  it('merges compatible completion and note edits', () => {
    expect(resolveSemanticOperations(
      { id: 'op-1', entityId: 'occ-1', kind: 'complete' },
      { id: 'op-2', entityId: 'occ-1', kind: 'set_field', field: 'notes', value: 'Collected' },
    ).resolution).toBe('merge');
  });

  it('surfaces incompatible transitions and same-field edits', () => {
    expect(resolveSemanticOperations(
      { id: 'op-1', entityId: 'occ-1', kind: 'complete' },
      { id: 'op-2', entityId: 'occ-1', kind: 'cancel' },
    )).toEqual({ resolution: 'conflict', reason: 'incompatible_transition' });
    expect(resolveSemanticOperations(
      { id: 'op-3', entityId: 'occ-1', kind: 'set_field', field: 'dueOn', value: '2026-10-01' },
      { id: 'op-4', entityId: 'occ-1', kind: 'set_field', field: 'dueOn', value: '2026-10-02' },
    )).toEqual({ resolution: 'conflict', reason: 'same_field' });
  });

  it('deduplicates a retried semantic operation', () => {
    const operation = { id: 'op-1', entityId: 'occ-1', kind: 'complete' as const };
    expect(resolveSemanticOperations(operation, operation).resolution).toBe('duplicate');
  });
});

describe('UK date and timezone edges', () => {
  it('keeps date-only recurrence independent of UTC clock changes', () => {
    expect(recurrenceDate(recurrenceRule({ frequency: 'week', anchorDate: '2026-03-22', effectiveFrom: '2026-03-22' }), 1))
      .toBe('2026-03-29');
  });

  it('derives the UK calendar day across BST and GMT', () => {
    expect(dateInTimeZone('2026-06-30T23:30:00.000Z', 'Europe/London')).toBe('2026-07-01');
    expect(dateInTimeZone('2026-12-31T23:30:00.000Z', 'Europe/London')).toBe('2026-12-31');
    expect(dateInTimeZone('2026-03-29T01:30:00.000Z', 'Europe/London')).toBe('2026-03-29');
    expect(dateInTimeZone('2026-10-25T01:30:00.000Z', 'Europe/London')).toBe('2026-10-25');
  });
});
