import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockListRecentActivity = jest.fn();
jest.mock('../src/activity', () => {
  const actual = jest.requireActual('../src/activity');
  return { ...actual, listRecentActivity: (...args: unknown[]) => mockListRecentActivity(...args) };
});

import { RecentActivityScreen } from '../src/screens/RecentActivityScreen';

beforeEach(() => {
  mockListRecentActivity.mockReset();
});

describe('RecentActivityScreen', () => {
  it('shows a calm empty state, not an error, when a care space has no activity yet', async () => {
    mockListRecentActivity.mockResolvedValueOnce({ ok: true, data: { events: [], hasMore: false } });
    const screen = await render(<RecentActivityScreen careSpaceId="space-1" personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    await waitFor(() => screen.getByText(/Nothing has happened yet for Beauty/));
  });

  it('shows a local-only care space (no careSpaceId) as empty without ever calling the RPC', async () => {
    const screen = await render(<RecentActivityScreen personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    await waitFor(() => screen.getByText(/Nothing has happened yet for Beauty/));
    expect(mockListRecentActivity).not.toHaveBeenCalled();
  });

  it('groups events by day and shows real member attribution', async () => {
    mockListRecentActivity.mockResolvedValueOnce({
      ok: true,
      data: {
        events: [
          { id: 'evt-1', eventType: 'record_created', recordId: 'rec-1', recordDomain: 'general', metadata: { title: 'GP appointment' }, createdAt: new Date().toISOString(), actorMembershipId: 'mem-1', actorDisplayName: 'Marion', actorIsFormer: false },
        ],
        hasMore: false,
      },
    });
    const screen = await render(<RecentActivityScreen careSpaceId="space-1" personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    await waitFor(() => screen.getByText('Today'));
    screen.getByText('Marion added "GP appointment"');
  });

  it('tapping a record-related event opens the underlying record', async () => {
    mockListRecentActivity.mockResolvedValueOnce({
      ok: true,
      data: { events: [
        { id: 'evt-1', eventType: 'record_created', recordId: 'rec-1', recordDomain: 'general', metadata: { title: 'GP appointment' }, createdAt: new Date().toISOString(), actorMembershipId: 'mem-1', actorDisplayName: 'Marion', actorIsFormer: false },
      ], hasMore: false },
    });
    const onOpenRecord = jest.fn();
    const screen = await render(<RecentActivityScreen careSpaceId="space-1" personName="Beauty" onBack={jest.fn()} onOpenRecord={onOpenRecord} />);
    await waitFor(() => screen.getByText('Marion added "GP appointment"'));
    await fireEvent.press(screen.getByLabelText('Marion added "GP appointment"'));
    expect(onOpenRecord).toHaveBeenCalledWith('rec-1');
  });

  it('a member-lifecycle event (no record) never opens a record when tapped', async () => {
    mockListRecentActivity.mockResolvedValueOnce({
      ok: true,
      data: { events: [
        { id: 'evt-1', eventType: 'member_joined', recordId: undefined, recordDomain: 'general', metadata: {}, createdAt: new Date().toISOString(), actorMembershipId: 'mem-2', actorDisplayName: 'Sarah', actorIsFormer: false },
      ], hasMore: false },
    });
    const onOpenRecord = jest.fn();
    const screen = await render(<RecentActivityScreen careSpaceId="space-1" personName="Beauty" onBack={jest.fn()} onOpenRecord={onOpenRecord} />);
    const row = await waitFor(() => screen.getByLabelText('Sarah joined the Care Circle'));
    await fireEvent.press(row);
    expect(onOpenRecord).not.toHaveBeenCalled();
  });

  it('View more pages in another batch without duplicating what is already shown', async () => {
    mockListRecentActivity.mockResolvedValueOnce({
      ok: true,
      data: {
        events: Array.from({ length: 20 }, (_, i) => ({
          id: `evt-${i}`, eventType: 'record_created', recordId: `rec-${i}`, recordDomain: 'general',
          metadata: { title: `Item ${i}` }, createdAt: new Date(Date.now() - i * 1000).toISOString(),
          actorMembershipId: 'mem-1', actorDisplayName: 'David', actorIsFormer: false,
        })),
        hasMore: true,
      },
    });
    mockListRecentActivity.mockResolvedValueOnce({
      ok: true,
      data: { events: [{ id: 'evt-older', eventType: 'record_created', recordId: 'rec-older', recordDomain: 'general', metadata: { title: 'Older item' }, createdAt: new Date(Date.now() - 999_000).toISOString(), actorMembershipId: 'mem-1', actorDisplayName: 'David', actorIsFormer: false }], hasMore: false },
    });
    const screen = await render(<RecentActivityScreen careSpaceId="space-1" personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    await waitFor(() => screen.getByLabelText('View more activity'));
    await fireEvent.press(screen.getByLabelText('View more activity'));
    await waitFor(() => screen.getByText('David added "Older item"'));
    expect(mockListRecentActivity).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText('View more activity')).toBeNull();
  });
});
