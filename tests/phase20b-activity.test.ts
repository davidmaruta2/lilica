// Phase 20B, Feature A: client-side coverage for the activity RPC boundary
// and its pure display-formatting function. The real permission-filtering,
// idempotency and immutability invariants are enforced server-side and
// covered by supabase/tests/database/phase20b_activity.test.sql (pgTAP) --
// this file only proves the client wraps that RPC correctly and never
// invents wording the event's own metadata doesn't support.

const mockRpc = jest.fn();

jest.mock('../src/auth/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import { describeActivityEvent, listRecentActivity, ActivityEvent } from '../src/activity';

beforeEach(() => {
  mockRpc.mockReset();
});

describe('listRecentActivity', () => {
  it('maps rows into ActivityEvent and reports hasMore when a full page returns', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: `evt-${i}`,
      event_type: 'record_created',
      record_id: 'rec-1',
      record_domain: 'general',
      metadata: { title: 'Arrange transport' },
      created_at: '2026-09-13T10:00:00.000Z',
      actor_membership_id: 'mem-1',
      actor_display_name: 'David',
      actor_is_former: false,
    }));
    mockRpc.mockResolvedValueOnce({ data: rows, error: null });
    const result = await listRecentActivity('space-1');
    expect(mockRpc).toHaveBeenCalledWith('list_recent_activity', {
      target_care_space_id: 'space-1',
      before_created_at: null,
      page_size: 20,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.events).toHaveLength(20);
    expect(result.data.events[0]).toEqual({
      id: 'evt-0',
      eventType: 'record_created',
      recordId: 'rec-1',
      recordDomain: 'general',
      metadata: { title: 'Arrange transport' },
      createdAt: '2026-09-13T10:00:00.000Z',
      actorMembershipId: 'mem-1',
      actorDisplayName: 'David',
      actorIsFormer: false,
    });
    expect(result.data.hasMore).toBe(true);
  });

  it('passes a cursor and reports hasMore=false for a short final page', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{
      id: 'evt-last', event_type: 'member_joined', record_id: null, record_domain: 'general',
      metadata: {}, created_at: '2026-09-12T00:00:00.000Z', actor_membership_id: 'mem-2',
      actor_display_name: 'Sarah', actor_is_former: false,
    }], error: null });
    const result = await listRecentActivity('space-1', '2026-09-13T09:00:00.000Z');
    expect(mockRpc).toHaveBeenCalledWith('list_recent_activity', {
      target_care_space_id: 'space-1',
      before_created_at: '2026-09-13T09:00:00.000Z',
      page_size: 20,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.events[0].recordId).toBeUndefined();
    expect(result.data.hasMore).toBe(false);
  });

  it('surfaces a friendly message on error rather than throwing', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('network request failed') });
    const result = await listRecentActivity('space-1');
    expect(result.ok).toBe(false);
  });
});

function event(overrides: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: 'evt-1',
    eventType: 'record_created',
    recordId: 'rec-1',
    recordDomain: 'general',
    metadata: {},
    createdAt: '2026-09-13T10:00:00.000Z',
    actorMembershipId: 'mem-1',
    actorDisplayName: 'David',
    actorIsFormer: false,
    ...overrides,
  };
}

describe('describeActivityEvent', () => {
  it('describes a creation truthfully from the event\'s own metadata', () => {
    expect(describeActivityEvent(event({ eventType: 'record_created', metadata: { title: 'GP appointment' } })))
      .toBe('David added "GP appointment"');
  });

  it('describes a bill completion as "marked paid", distinct from a plain completion', () => {
    expect(describeActivityEvent(event({ eventType: 'record_completed', metadata: { title: 'Water bill', recordType: 'bill' } })))
      .toBe('David marked "Water bill" paid');
    expect(describeActivityEvent(event({ eventType: 'record_completed', metadata: { title: 'Collect prescription', recordType: 'task' } })))
      .toBe('David completed "Collect prescription"');
  });

  it('describes member lifecycle events without a former-member qualifier for the joining event', () => {
    expect(describeActivityEvent(event({ eventType: 'member_joined', recordId: undefined, metadata: {} })))
      .toBe('David joined the Care Circle');
  });

  it('marks a former member\'s historical event as such, without fabricating who removed them', () => {
    expect(describeActivityEvent(event({ eventType: 'member_removed', recordId: undefined, actorIsFormer: true, metadata: {} })))
      .toBe('David (former member) was removed from the Care Circle');
  });

  it('never invents a title when metadata has none', () => {
    expect(describeActivityEvent(event({ eventType: 'record_created', metadata: {} })))
      .toBe('David added something new');
  });

  it('describes a document upload using only the attachment name provided', () => {
    expect(describeActivityEvent(event({ eventType: 'document_uploaded', metadata: { attachmentName: 'Hospital letter.pdf' } })))
      .toBe('David uploaded "Hospital letter.pdf"');
  });
});
