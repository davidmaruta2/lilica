// Phase 23 slice 9: a single combined "Lilica Chat" entry point -- direct
// product-owner report (23 September 2026): "while it's possible to
// start a DM through the care circle avatar, not seeing DMs through the
// main Lilica Chat space seems odd". Two clearly-labelled sections (Care
// Circle, Direct Messages), never blended into one undifferentiated
// list -- a DM is private between two people, Care Circle chat is
// visible to the whole circle.

const mockListMyChatOverview = jest.fn();
const mockStartNewConversation = jest.fn();

jest.mock('../src/chat', () => {
  const actual = jest.requireActual('../src/chat');
  return {
    ...actual,
    listMyChatOverview: (...args: unknown[]) => mockListMyChatOverview(...args),
    startNewConversation: (...args: unknown[]) => mockStartNewConversation(...args),
  };
});

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ChatOverviewScreen } from '../src/screens/ChatOverviewScreen';
import { ChatOverviewEntry } from '../src/chat';

const careCircleEntry: ChatOverviewEntry = {
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

const directEntry: ChatOverviewEntry = {
  threadId: 'thread-dm-1',
  kind: 'direct',
  otherMembershipId: 'm-sarah',
  otherDisplayName: 'Sarah',
  otherIsFormer: false,
  createdAt: '2026-09-22T09:00:00.000Z',
  lastMessageAt: '2026-09-22T09:05:00.000Z',
  lastMessageBody: 'Thanks for letting me know',
  lastMessageSenderIsSelf: false,
  unreadCount: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListMyChatOverview.mockResolvedValue({ ok: true, data: [] });
});

describe('Phase 23 slice 9: combined Lilica Chat overview', () => {
  it('shows honest empty states for both sections and a "+ New conversation" action for Care Circle', async () => {
    const screen = await render(
      <ChatOverviewScreen careSpaceId="space-1" onBack={jest.fn()} onOpenConversation={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('Care Circle'));
    screen.getByText('No conversations yet - start one below.');
    screen.getByText('Direct Messages');
    screen.getByText("No direct messages yet - start one from a Care Circle member's profile.");
    screen.getByLabelText('Start a new conversation');
  });

  it('lists Care Circle conversations and DMs in their own labelled sections', async () => {
    mockListMyChatOverview.mockResolvedValue({ ok: true, data: [careCircleEntry, directEntry] });
    const screen = await render(
      <ChatOverviewScreen careSpaceId="space-1" onBack={jest.fn()} onOpenConversation={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('Spinal disc injury'));
    screen.getByText('Appointment confirmed for Thursday');
    // Direct rows lead with WHO it's with, not the subject.
    screen.getByText('Sarah');
    screen.getByText('Thanks for letting me know');
    expect(mockListMyChatOverview).toHaveBeenCalledWith('space-1');
  });

  it('tapping a Care Circle row opens that exact conversation', async () => {
    mockListMyChatOverview.mockResolvedValue({ ok: true, data: [careCircleEntry] });
    const onOpenConversation = jest.fn();
    const screen = await render(
      <ChatOverviewScreen careSpaceId="space-1" onBack={jest.fn()} onOpenConversation={onOpenConversation} />,
    );
    await waitFor(() => screen.getByText('Spinal disc injury'));
    await fireEvent.press(screen.getByLabelText('Open Spinal disc injury'));
    expect(onOpenConversation).toHaveBeenCalledWith('thread-cc-1', 'Spinal disc injury', 'record-1');
  });

  it('tapping a Direct Messages row opens that exact conversation', async () => {
    mockListMyChatOverview.mockResolvedValue({ ok: true, data: [directEntry] });
    const onOpenConversation = jest.fn();
    const screen = await render(
      <ChatOverviewScreen careSpaceId="space-1" onBack={jest.fn()} onOpenConversation={onOpenConversation} />,
    );
    await waitFor(() => screen.getByText('Sarah'));
    await fireEvent.press(screen.getByLabelText('Open Sarah'));
    expect(onOpenConversation).toHaveBeenCalledWith('thread-dm-1', 'Sarah', undefined);
  });

  // Direct product-owner decision (23 September 2026): starting a NEW DM
  // stays avatar-only, never duplicated as a "pick someone" flow here --
  // the "+ New conversation" action only ever starts a Care Circle
  // conversation.
  it('"+ New conversation" only ever starts a Care Circle conversation, never a DM', async () => {
    mockStartNewConversation.mockResolvedValue({ ok: true, data: 'thread-new-1' });
    const onOpenConversation = jest.fn();
    const screen = await render(
      <ChatOverviewScreen
        careSpaceId="space-1"
        subjectOptions={[{ id: 'record-1', title: 'Metformin' }]}
        onBack={jest.fn()}
        onOpenConversation={onOpenConversation}
      />,
    );
    await waitFor(() => screen.getByLabelText('Start a new conversation'));
    await fireEvent.press(screen.getByLabelText('Start a new conversation'));
    await waitFor(() => screen.getByLabelText('Start a conversation about Metformin'));
    await fireEvent.press(screen.getByLabelText('Start a conversation about Metformin'));
    expect(mockStartNewConversation).toHaveBeenCalledWith('space-1', 'care_circle', undefined, undefined, 'record-1');
    await waitFor(() => expect(onOpenConversation).toHaveBeenCalledWith('thread-new-1', 'Metformin', 'record-1'));
  });
});
