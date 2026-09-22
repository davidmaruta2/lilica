const mockListMyConversations = jest.fn();
const mockStartNewConversation = jest.fn();

jest.mock('../src/chat', () => {
  const actual = jest.requireActual('../src/chat');
  return {
    ...actual,
    listMyConversations: (...args: unknown[]) => mockListMyConversations(...args),
    startNewConversation: (...args: unknown[]) => mockStartNewConversation(...args),
  };
});

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ChatConversationListScreen } from '../src/screens/ChatConversationListScreen';
import { ConversationSummary } from '../src/chat';

const olderConversation: ConversationSummary = {
  threadId: 'thread-1',
  createdAt: '2026-09-10T09:00:00.000Z',
  lastMessageAt: '2026-09-10T09:05:00.000Z',
  lastMessageBody: 'Thanks for letting me know',
  lastMessageSenderIsSelf: false,
  unreadCount: 0,
};

const titledConversation: ConversationSummary = {
  threadId: 'thread-2',
  title: 'This week\'s appointments',
  createdAt: '2026-09-20T09:00:00.000Z',
  lastMessageAt: '2026-09-22T10:00:00.000Z',
  lastMessageBody: 'See you Thursday',
  lastMessageSenderIsSelf: true,
  unreadCount: 3,
};

const freshSubjectConversation: ConversationSummary = {
  threadId: 'thread-3',
  subjectRecordId: 'record-spinal',
  subjectRecordTitle: 'Spinal disc injury',
  createdAt: '2026-09-23T20:05:00.000Z',
  unreadCount: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListMyConversations.mockResolvedValue({ ok: true, data: [] });
});

describe('Phase 23 slice 5: Lilica Chat conversation list', () => {
  it('shows the honest empty state and a "+ New conversation" action', async () => {
    const screen = await render(
      <ChatConversationListScreen careSpaceId="space-1" kind="care_circle" onBack={jest.fn()} onOpenConversation={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('No conversations yet - start one below.'));
    screen.getByLabelText('Start a new conversation');
    screen.getByText('Lilica Chat');
  });

  it('lists real conversations, most recent first, with title fallback, preview and unread badge', async () => {
    mockListMyConversations.mockResolvedValue({ ok: true, data: [titledConversation, olderConversation] });
    const screen = await render(
      <ChatConversationListScreen careSpaceId="space-1" kind="care_circle" onBack={jest.fn()} onOpenConversation={jest.fn()} />,
    );
    await waitFor(() => screen.getByText("This week's appointments"));
    screen.getByText('See you Thursday', { exact: false });
    screen.getByText('3');
    // Fallback label for the untitled conversation.
    screen.getByText('Conversation started 10 Sept');
    screen.getByText('Thanks for letting me know');
    expect(mockListMyConversations).toHaveBeenCalledWith('space-1', 'care_circle', undefined);
  });

  // Direct product-owner report (23 September 2026): a conversation
  // started with a real subject but no messages yet showed no date at
  // all -- just "No messages yet", undated.
  it('a conversation with its own subject but no messages yet shows a "Created on" date, never a bare "No messages yet"', async () => {
    mockListMyConversations.mockResolvedValue({ ok: true, data: [freshSubjectConversation] });
    const screen = await render(
      <ChatConversationListScreen careSpaceId="space-1" kind="care_circle" onBack={jest.fn()} onOpenConversation={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('Spinal disc injury'));
    screen.getByText('Created on 23 Sept 2026 at 21:05');
    expect(screen.queryByText('No messages yet')).toBeNull();
  });

  it('tapping a conversation calls onOpenConversation with its thread id and title', async () => {
    mockListMyConversations.mockResolvedValue({ ok: true, data: [titledConversation] });
    const onOpenConversation = jest.fn();
    const screen = await render(
      <ChatConversationListScreen careSpaceId="space-1" kind="care_circle" onBack={jest.fn()} onOpenConversation={onOpenConversation} />,
    );
    await waitFor(() => screen.getByText("This week's appointments"));
    await fireEvent.press(screen.getByLabelText("Open This week's appointments"));
    expect(onOpenConversation).toHaveBeenCalledWith('thread-2', "This week's appointments", undefined);
  });

  // Slice 6: "+ New conversation" opens the subject picker first -- a
  // Medical Log item, or a free-text title for something not logged yet
  // -- before the conversation is actually created.
  it('"+ New conversation" opens a subject picker, then starts the conversation with the chosen Medical Log item', async () => {
    mockStartNewConversation.mockResolvedValue({ ok: true, data: 'thread-new-1' });
    const onOpenConversation = jest.fn();
    const screen = await render(
      <ChatConversationListScreen
        careSpaceId="space-1"
        kind="care_circle"
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

  it('"+ New conversation" with a free-text title, for something not logged yet', async () => {
    mockStartNewConversation.mockResolvedValue({ ok: true, data: 'thread-new-2' });
    const onOpenConversation = jest.fn();
    const screen = await render(
      <ChatConversationListScreen careSpaceId="space-1" kind="care_circle" onBack={jest.fn()} onOpenConversation={onOpenConversation} />,
    );
    await waitFor(() => screen.getByLabelText('Start a new conversation'));
    await fireEvent.press(screen.getByLabelText('Start a new conversation'));
    await fireEvent.changeText(screen.getByLabelText('Conversation title'), 'Weekend visit plans');
    await fireEvent.press(screen.getByLabelText('Start conversation with this title'));
    expect(mockStartNewConversation).toHaveBeenCalledWith('space-1', 'care_circle', undefined, 'Weekend visit plans', undefined);
    await waitFor(() => expect(onOpenConversation).toHaveBeenCalledWith('thread-new-2', 'Weekend visit plans', undefined));
  });
});

describe('Phase 23 slice 5: direct message conversation list (one specific partner)', () => {
  it('lists conversations with that partner only, and shows a partner-specific header/empty state', async () => {
    const screen = await render(
      <ChatConversationListScreen
        careSpaceId="space-1"
        kind="direct"
        partnerMembershipId="m-sarah"
        partnerDisplayName="Sarah"
        onBack={jest.fn()}
        onOpenConversation={jest.fn()}
      />,
    );
    await waitFor(() => screen.getByText('No conversations with Sarah yet - start one below.'));
    screen.getByText('Chat with Sarah');
    expect(mockListMyConversations).toHaveBeenCalledWith('space-1', 'direct', 'm-sarah');
  });

  it('"+ New conversation" passes the partner membership id through, alongside the chosen title', async () => {
    mockStartNewConversation.mockResolvedValue({ ok: true, data: 'thread-new-dm-1' });
    const onOpenConversation = jest.fn();
    const screen = await render(
      <ChatConversationListScreen
        careSpaceId="space-1"
        kind="direct"
        partnerMembershipId="m-sarah"
        partnerDisplayName="Sarah"
        onBack={jest.fn()}
        onOpenConversation={onOpenConversation}
      />,
    );
    await waitFor(() => screen.getByLabelText('Start a new conversation'));
    await fireEvent.press(screen.getByLabelText('Start a new conversation'));
    await fireEvent.changeText(screen.getByLabelText('Conversation title'), 'Catching up');
    await fireEvent.press(screen.getByLabelText('Start conversation with this title'));
    expect(mockStartNewConversation).toHaveBeenCalledWith('space-1', 'direct', 'm-sarah', 'Catching up', undefined);
    await waitFor(() => expect(onOpenConversation).toHaveBeenCalledWith('thread-new-dm-1', 'Catching up', undefined));
  });
});
