// Phase 16: client-side coverage for the record-link RPC boundary. The
// real authorisation/idempotency/non-disclosure invariants are enforced
// server-side and covered by
// supabase/tests/database/phase16_document_maturity.test.sql (pgTAP, run
// via `npm run validate:backend`) -- this file only proves the client
// wraps those RPCs correctly.

const mockRpc = jest.fn();

jest.mock('../src/auth/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import { createRecordLink, listRecordLinks, removeAllLinksForRecord, removeRecordLink } from '../src/recordLinks';

beforeEach(() => {
  mockRpc.mockReset();
});

describe('listRecordLinks', () => {
  it('maps each row into a LinkedRecordSummary', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{
        link_id: 'link-1',
        link_type: 'related_to',
        direction: 'outgoing',
        other_record_id: 'appt-1',
        other_record_type: 'appointment',
        other_record_title: 'Orthopaedic appointment',
        created_at: '2026-09-12T00:00:00.000Z',
      }],
      error: null,
    });
    const result = await listRecordLinks('doc-1');
    expect(mockRpc).toHaveBeenCalledWith('list_record_links', { target_record_id: 'doc-1' });
    expect(result).toEqual({
      ok: true,
      data: [{
        linkId: 'link-1',
        linkType: 'related_to',
        direction: 'outgoing',
        recordId: 'appt-1',
        recordType: 'appointment',
        title: 'Orthopaedic appointment',
        createdAt: '2026-09-12T00:00:00.000Z',
      }],
    });
  });

  it('falls back to an empty title rather than null', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{
        link_id: 'link-1', link_type: 'action_for', direction: 'incoming',
        other_record_id: 'task-1', other_record_type: 'task', other_record_title: null,
        created_at: '2026-09-12T00:00:00.000Z',
      }],
      error: null,
    });
    const result = await listRecordLinks('doc-1');
    expect(result).toEqual({ ok: true, data: [expect.objectContaining({ title: '' })] });
  });

  it('surfaces a friendly message on failure, never throws', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const result = await listRecordLinks('doc-1');
    expect(result.ok).toBe(false);
  });
});

describe('createRecordLink', () => {
  it('passes every field through to create_record_link', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'link-1', error: null });
    const result = await createRecordLink({
      careSpaceId: 'space-1', sourceRecordId: 'doc-1', targetRecordId: 'appt-1', linkType: 'related_to',
    });
    expect(mockRpc).toHaveBeenCalledWith('create_record_link', {
      target_care_space_id: 'space-1',
      source_record_id: 'doc-1',
      target_record_id: 'appt-1',
      link_type: 'related_to',
    });
    expect(result).toEqual({ ok: true, data: 'link-1' });
  });
});

describe('removeRecordLink', () => {
  it('calls remove_record_link with the link id', async () => {
    mockRpc.mockResolvedValueOnce({ error: null });
    const result = await removeRecordLink('link-1');
    expect(mockRpc).toHaveBeenCalledWith('remove_record_link', { target_link_id: 'link-1' });
    expect(result).toEqual({ ok: true, data: undefined });
  });
});

describe('removeAllLinksForRecord (Phase 17: completes record deletion\'s link lifecycle)', () => {
  it('removes every link belonging to the record, never touching the record on the other end', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { link_id: 'link-1', link_type: 'related_to', direction: 'outgoing', other_record_id: 'appt-1', other_record_type: 'appointment', other_record_title: 'Orthopaedic appointment', created_at: '2026-09-12T00:00:00.000Z' },
        { link_id: 'link-2', link_type: 'action_for', direction: 'incoming', other_record_id: 'task-1', other_record_type: 'task', other_record_title: 'Call hospital to confirm', created_at: '2026-09-12T00:00:00.000Z' },
      ],
      error: null,
    });
    mockRpc.mockResolvedValue({ error: null });
    await removeAllLinksForRecord('doc-1');
    expect(mockRpc).toHaveBeenCalledWith('list_record_links', { target_record_id: 'doc-1' });
    expect(mockRpc).toHaveBeenCalledWith('remove_record_link', { target_link_id: 'link-1' });
    expect(mockRpc).toHaveBeenCalledWith('remove_record_link', { target_link_id: 'link-2' });
  });

  it('is a no-op, never throws, when the record has no links', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(removeAllLinksForRecord('doc-1')).resolves.toBeUndefined();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});
