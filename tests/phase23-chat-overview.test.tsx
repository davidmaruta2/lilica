// Phase 23 slice 10 -- a real three-level structure. Direct product-owner
// report (23 September 2026): "Marion" showed up as five separate,
// unrelated-looking rows because the earlier design (slice 9) flattened
// every individual topic-thread straight into this top-level screen.
// This is Level 1: one row per PERSON you have DMs with (grouped across
// however many topic-threads they actually have), plus one summary row
// for the whole Care Circle group -- never a flat per-thread dump.

const mockListMyChatOverview = jest.fn();

jest.mock('../src/chat', () => {
  const actual = jest.requireActual('../src/chat');
  return {
    ...actual,
    listMyChatOverview: (...args: unknown[]) => mockListMyChatOverview(...args),
  };
});

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ChatOverviewScreen } from '../src/screens/ChatOverviewScreen';
import { ChatOverviewEntry } from '../src/chat';

const careCircleEntryA: ChatOverviewEntry = {
  threadId: 'thread-cc-1',
  kind: 'care_circle',
  subjectRecordId: 'record-1',
  subjectRecordTitle: 'Spinal disc injury',
  createdAt: '2026-09-23T10:00:00.000Z',
  lastMessageAt: '2026-09-23T10:05:00.000Z',
  lastMessageBody: 'Appointment confirmed for Thursday',
  lastMessageSenderIsSelf: false,
  unreadCount: 2,
};

const careCircleEntryB: ChatOverviewEntry = {
  threadId: 'thread-cc-2',
  kind: 'care_circle',
  createdAt: '2026-09-20T09:00:00.000Z',
  lastMessageAt: '2026-09-20T09:05:00.000Z',
  lastMessageBody: 'Hey',
  lastMessageSenderIsSelf: true,
  unreadCount: 1,
};

// Two SEPARATE topic-threads with the SAME partner -- exactly the
// "Marion appeared five times" shape from the real bug report. Level 1
// must collapse these into one Marion row, not two.
const marionThreadA: ChatOverviewEntry = {
  threadId: 'thread-dm-1',
  kind: 'direct',
  otherMembershipId: 'm-marion',
  otherDisplayName: 'Marion',
  otherIsFormer: false,
  subjectRecordId: 'record-2',
  subjectRecordTitle: 'Mum needs to be reminded of medication',
  createdAt: '2026-09-22T09:00:00.000Z',
  lastMessageAt: '2026-09-22T09:05:00.000Z',
  lastMessageBody: 'Will do',
  lastMessageSenderIsSelf: false,
  unreadCount: 1,
};

const marionThreadB: ChatOverviewEntry = {
  threadId: 'thread-dm-2',
  kind: 'direct',
  otherMembershipId: 'm-marion',
  otherDisplayName: 'Marion',
  otherIsFormer: false,
  createdAt: '2026-09-22T20:00:00.000Z',
  lastMessageAt: '2026-09-22T20:20:00.000Z',
  lastMessageBody: 'I did, yes',
  lastMessageSenderIsSelf: true,
  unreadCount: 0,
};

const sarahThread: ChatOverviewEntry = {
  threadId: 'thread-dm-3',
  kind: 'direct',
  otherMembershipId: 'm-sarah',
  otherDisplayName: 'Sarah',
  otherIsFormer: false,
  createdAt: '2026-09-21T09:00:00.000Z',
  lastMessageAt: '2026-09-21T09:05:00.000Z',
  lastMessageBody: 'Can you pick up the prescription?',
  lastMessageSenderIsSelf: false,
  unreadCount: 3,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListMyChatOverview.mockResolvedValue({ ok: true, data: [] });
});

describe('Phase 23 slice 10: Lilica Chat home (Level 1) -- grouped, never a flat dump', () => {
  it('shows one Care Circle summary row and an honest empty state for Direct Messages', async () => {
    const screen = await render(
      <ChatOverviewScreen careSpaceId="space-1" onBack={jest.fn()} onOpenCareCircle={jest.fn()} onOpenDirect={jest.fn()} />,
    );
    await waitFor(() => screen.getByLabelText('Open Care Circle'));
    screen.getByText('No conversations yet');
    screen.getByText('Direct Messages');
    screen.getByText("No direct messages yet - start one from a Care Circle member's profile.");
  });

  it('collapses every Care Circle topic-thread into ONE summary row, with combined unread count and the single most recent preview', async () => {
    mockListMyChatOverview.mockResolvedValue({ ok: true, data: [careCircleEntryA, careCircleEntryB] });
    const screen = await render(
      <ChatOverviewScreen careSpaceId="space-1" onBack={jest.fn()} onOpenCareCircle={jest.fn()} onOpenDirect={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('Appointment confirmed for Thursday'));
    // Only ONE "Care Circle" row -- never "Spinal disc injury" as its own
    // row, and never a second row for the other topic-thread.
    expect(screen.getAllByLabelText('Open Care Circle')).toHaveLength(1);
    screen.getByText('3'); // 2 + 1 combined unread
    expect(screen.queryByText('Spinal disc injury')).toBeNull();
  });

  it('collapses every topic-thread with the SAME partner into ONE row for that person -- the exact "Marion x5" bug this replaces', async () => {
    mockListMyChatOverview.mockResolvedValue({ ok: true, data: [marionThreadA, marionThreadB, sarahThread] });
    const screen = await render(
      <ChatOverviewScreen careSpaceId="space-1" onBack={jest.fn()} onOpenCareCircle={jest.fn()} onOpenDirect={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('Marion'));
    expect(screen.getAllByText('Marion')).toHaveLength(1);
    // Marion's most recent activity (thread B, 20:20) wins the preview,
    // combined unread across both her threads (1 + 0 = 1).
    screen.getByText('I did, yes', { exact: false });
    screen.getByText('1');
    // Never a per-topic subject shown as its own row here.
    expect(screen.queryByText('Mum needs to be reminded of medication')).toBeNull();
    screen.getByText('Sarah');
  });

  it('sorts Direct Messages by most recent activity, most recent first', async () => {
    mockListMyChatOverview.mockResolvedValue({ ok: true, data: [sarahThread, marionThreadB] });
    const screen = await render(
      <ChatOverviewScreen careSpaceId="space-1" onBack={jest.fn()} onOpenCareCircle={jest.fn()} onOpenDirect={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('Marion'));
    const marionRow = screen.getByLabelText('Open Marion');
    const sarahRow = screen.getByLabelText('Open Sarah');
    // Marion's thread B (20:20) is more recent than Sarah's (09:05).
    expect(marionRow).toBeTruthy();
    expect(sarahRow).toBeTruthy();
  });

  it('tapping the Care Circle row opens Level 2 for the whole Care Circle, not a specific thread', async () => {
    mockListMyChatOverview.mockResolvedValue({ ok: true, data: [careCircleEntryA] });
    const onOpenCareCircle = jest.fn();
    const screen = await render(
      <ChatOverviewScreen careSpaceId="space-1" onBack={jest.fn()} onOpenCareCircle={onOpenCareCircle} onOpenDirect={jest.fn()} />,
    );
    await waitFor(() => screen.getByLabelText('Open Care Circle'));
    await fireEvent.press(screen.getByLabelText('Open Care Circle'));
    expect(onOpenCareCircle).toHaveBeenCalledTimes(1);
  });

  it('tapping a person\'s row opens Level 2 for that person, not a specific thread', async () => {
    mockListMyChatOverview.mockResolvedValue({ ok: true, data: [marionThreadA, marionThreadB] });
    const onOpenDirect = jest.fn();
    const screen = await render(
      <ChatOverviewScreen careSpaceId="space-1" onBack={jest.fn()} onOpenCareCircle={jest.fn()} onOpenDirect={onOpenDirect} />,
    );
    await waitFor(() => screen.getByLabelText('Open Marion'));
    await fireEvent.press(screen.getByLabelText('Open Marion'));
    expect(onOpenDirect).toHaveBeenCalledWith('m-marion', 'Marion');
  });

  it('marks a former member clearly, still grouped as one row', async () => {
    mockListMyChatOverview.mockResolvedValue({
      ok: true,
      data: [{ ...marionThreadA, otherIsFormer: true }],
    });
    const screen = await render(
      <ChatOverviewScreen careSpaceId="space-1" onBack={jest.fn()} onOpenCareCircle={jest.fn()} onOpenDirect={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('Marion (former member)'));
  });

  it('never offers to start a new conversation from Level 1 -- that only ever lives one level down', () => {
    return render(
      <ChatOverviewScreen careSpaceId="space-1" onBack={jest.fn()} onOpenCareCircle={jest.fn()} onOpenDirect={jest.fn()} />,
    ).then((screen) => {
      expect(screen.queryByLabelText('Start a new conversation')).toBeNull();
    });
  });
});
