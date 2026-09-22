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

  it('tapping a conversation calls onOpenConversation with its thread id and title', async () => {
    mockListMyConversations.mockResolvedValue({ ok: true, data: [titledConversation] });
    const onOpenConversation = jest.fn();
    const screen = await render(
      <ChatConversationListScreen careSpaceId="space-1" kind="care_circle" onBack={jest.fn()} onOpenConversation={onOpenConversation} />,
    );
    await waitFor(() => screen.getByText("This week's appointments"));
    await fireEvent.press(screen.getByLabelText("Open This week's appointments"));
    expect(onOpenConversation).toHaveBeenCalledWith('thread-2', "This week's appointments");
  });

  it('"+ New conversation" starts one and opens it immediately', async () => {
    mockStartNewConversation.mockResolvedValue({ ok: true, data: 'thread-new-1' });
    const onOpenConversation = jest.fn();
    const screen = await render(
      <ChatConversationListScreen careSpaceId="space-1" kind="care_circle" onBack={jest.fn()} onOpenConversation={onOpenConversation} />,
    );
    await waitFor(() => screen.getByLabelText('Start a new conversation'));
    await fireEvent.press(screen.getByLabelText('Start a new conversation'));
    expect(mockStartNewConversation).toHaveBeenCalledWith('space-1', 'care_circle', undefined);
    await waitFor(() => expect(onOpenConversation).toHaveBeenCalledWith('thread-new-1'));
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

  it('"+ New conversation" passes the partner membership id through', async () => {
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
    expect(mockStartNewConversation).toHaveBeenCalledWith('space-1', 'direct', 'm-sarah');
    await waitFor(() => expect(onOpenConversation).toHaveBeenCalledWith('thread-new-dm-1'));
  });
});
