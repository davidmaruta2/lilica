const mockGetOrCreateCareCircleThread = jest.fn();
const mockGetOrCreateDirectThread = jest.fn();
const mockGetOrCreateRecordThread = jest.fn();
const mockListChatMessages = jest.fn();
const mockListRecordConversation = jest.fn();
const mockSendChatMessage = jest.fn();
const mockEditChatMessage = jest.fn();
const mockDeleteChatMessage = jest.fn();
const mockMarkChatThreadRead = jest.fn();
const mockSetConversationSubject = jest.fn();

jest.mock('../src/chat', () => ({
  getOrCreateCareCircleThread: (...args: unknown[]) => mockGetOrCreateCareCircleThread(...args),
  getOrCreateDirectThread: (...args: unknown[]) => mockGetOrCreateDirectThread(...args),
  getOrCreateRecordThread: (...args: unknown[]) => mockGetOrCreateRecordThread(...args),
  listChatMessages: (...args: unknown[]) => mockListChatMessages(...args),
  listRecordConversation: (...args: unknown[]) => mockListRecordConversation(...args),
  sendChatMessage: (...args: unknown[]) => mockSendChatMessage(...args),
  editChatMessage: (...args: unknown[]) => mockEditChatMessage(...args),
  deleteChatMessage: (...args: unknown[]) => mockDeleteChatMessage(...args),
  markChatThreadRead: (...args: unknown[]) => mockMarkChatThreadRead(...args),
  setConversationSubject: (...args: unknown[]) => mockSetConversationSubject(...args),
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ChatThreadScreen } from '../src/screens/ChatThreadScreen';
import { ChatMessage } from '../src/chat';

const sarahMessage: ChatMessage = {
  id: 'msg-1',
  threadId: 'thread-1',
  senderMembershipId: 'm-sarah',
  senderDisplayName: 'Sarah',
  senderIsFormer: false,
  senderIsSelf: false,
  body: 'Picking up the prescription this afternoon',
  createdAt: '2026-09-22T10:00:00.000Z',
};

const myMessage: ChatMessage = {
  id: 'msg-2',
  threadId: 'thread-1',
  senderMembershipId: 'm-me',
  senderDisplayName: 'David',
  senderIsFormer: false,
  senderIsSelf: true,
  body: 'Great, thank you',
  createdAt: '2026-09-22T10:05:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetOrCreateCareCircleThread.mockResolvedValue({ ok: true, data: 'thread-1' });
  mockGetOrCreateDirectThread.mockResolvedValue({ ok: true, data: 'thread-direct-1' });
  mockGetOrCreateRecordThread.mockResolvedValue({ ok: true, data: 'thread-record-1' });
  mockListChatMessages.mockResolvedValue({ ok: true, data: { messages: [], hasMore: false } });
  mockListRecordConversation.mockResolvedValue({ ok: true, data: { messages: [], hasMore: false } });
  mockMarkChatThreadRead.mockResolvedValue({ ok: true, data: undefined });
  mockSetConversationSubject.mockResolvedValue({ ok: true, data: undefined });
});

describe('Phase 23 slice 1: shared Lilica Chat mode', () => {
  it('loads (or creates) the shared thread and marks it read on open', async () => {
    mockListChatMessages.mockResolvedValue({ ok: true, data: { messages: [sarahMessage, myMessage], hasMore: false } });
    const screen = await render(<ChatThreadScreen careSpaceId="space-1" onBack={jest.fn()} />);
    await waitFor(() => screen.getByText('Great, thank you'));
    expect(mockGetOrCreateCareCircleThread).toHaveBeenCalledWith('space-1');
    expect(mockGetOrCreateDirectThread).not.toHaveBeenCalled();
    expect(mockMarkChatThreadRead).toHaveBeenCalledWith('thread-1');
    screen.getByText('Lilica Chat');
    screen.getByPlaceholderText('Message your Care Circle');
  });

  it('shows the honest empty state with no messages', async () => {
    const screen = await render(<ChatThreadScreen careSpaceId="space-1" onBack={jest.fn()} />);
    await waitFor(() => screen.getByText(/No messages yet/));
    screen.getByText('No messages yet - send the first one to start talking with your Care Circle.');
  });

  it('sending a message calls sendChatMessage and clears the draft', async () => {
    mockSendChatMessage.mockResolvedValue({ ok: true, data: { ...myMessage, id: 'msg-3', body: 'Hello' } });
    const onMessagesChanged = jest.fn();
    const screen = await render(<ChatThreadScreen careSpaceId="space-1" onBack={jest.fn()} onMessagesChanged={onMessagesChanged} />);
    await waitFor(() => screen.getByPlaceholderText('Message your Care Circle'));
    const input = screen.getByLabelText('Write a message');
    await fireEvent.changeText(input, 'Hello');
    await waitFor(() => expect(screen.getByLabelText('Write a message').props.value).toBe('Hello'));
    await fireEvent.press(screen.getByLabelText('Send message'));
    await waitFor(() => expect(mockSendChatMessage).toHaveBeenCalledWith('thread-1', 'Hello'));
    await waitFor(() => screen.getByText('Hello'));
    expect(screen.getByLabelText('Write a message').props.value).toBe('');
    // onMessagesChanged is called once on load, and again after sending.
    expect(onMessagesChanged.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('editing your own message calls editChatMessage with the new body', async () => {
    mockListChatMessages.mockResolvedValue({ ok: true, data: { messages: [myMessage], hasMore: false } });
    mockEditChatMessage.mockResolvedValue({ ok: true, data: { ...myMessage, body: 'Updated text', editedAt: '2026-09-22T10:10:00.000Z' } });
    const screen = await render(<ChatThreadScreen careSpaceId="space-1" onBack={jest.fn()} />);
    await waitFor(() => screen.getByText('Great, thank you'));
    await fireEvent.press(screen.getByLabelText('Edit message'));
    await waitFor(() => screen.getByLabelText('Edit message text'));
    await fireEvent.changeText(screen.getByLabelText('Edit message text'), 'Updated text');
    await waitFor(() => expect(screen.getByLabelText('Edit message text').props.value).toBe('Updated text'));
    await fireEvent.press(screen.getByLabelText('Save edit'));
    await waitFor(() => expect(mockEditChatMessage).toHaveBeenCalledWith('msg-2', 'Updated text'));
    await waitFor(() => screen.getByText('Updated text'));
    screen.getByText(/Edited/);
  });

  it('a message from another member never shows Edit/Delete', async () => {
    mockListChatMessages.mockResolvedValue({ ok: true, data: { messages: [sarahMessage], hasMore: false } });
    const screen = await render(<ChatThreadScreen careSpaceId="space-1" onBack={jest.fn()} />);
    await waitFor(() => screen.getByText('Picking up the prescription this afternoon'));
    expect(screen.queryByLabelText('Edit message')).toBeNull();
    expect(screen.queryByLabelText('Delete message')).toBeNull();
  });
});

describe('Phase 23 slice 2: direct message mode', () => {
  it('loads (or creates) the direct thread with the given partner, never the shared thread', async () => {
    const screen = await render(
      <ChatThreadScreen careSpaceId="space-1" directPartnerMembershipId="m-sarah" directPartnerDisplayName="Sarah" onBack={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('Sarah'));
    expect(mockGetOrCreateDirectThread).toHaveBeenCalledWith('space-1', 'm-sarah');
    expect(mockGetOrCreateCareCircleThread).not.toHaveBeenCalled();
    screen.getByPlaceholderText('Message Sarah');
  });

  it('shows a partner-specific empty state', async () => {
    const screen = await render(
      <ChatThreadScreen careSpaceId="space-1" directPartnerMembershipId="m-sarah" directPartnerDisplayName="Sarah" onBack={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('No messages yet - send the first one to Sarah.'));
  });
});

describe('Phase 23 slice 3: record-linked chat mode', () => {
  it('loads (or creates) the record thread by recordId, and reads the MERGED conversation via listRecordConversation, never listChatMessages', async () => {
    const screen = await render(
      <ChatThreadScreen careSpaceId="space-1" recordId="record-1" recordTitle="Metformin" onBack={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('Metformin'));
    expect(mockGetOrCreateRecordThread).toHaveBeenCalledWith('record-1');
    expect(mockGetOrCreateCareCircleThread).not.toHaveBeenCalled();
    expect(mockGetOrCreateDirectThread).not.toHaveBeenCalled();
    expect(mockListRecordConversation).toHaveBeenCalledWith('record-1');
    expect(mockListChatMessages).not.toHaveBeenCalled();
    screen.getByPlaceholderText('Write a message');
  });

  it('shows a record-specific empty state naming what the conversation is about', async () => {
    const screen = await render(
      <ChatThreadScreen careSpaceId="space-1" recordId="record-1" recordTitle="Metformin" onBack={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('No messages yet - start the conversation about Metformin.'));
  });

  // Slice 4: a message tagged from Lilica Chat can appear here even
  // though it was never sent into this record's own dedicated thread --
  // this is exactly what listRecordConversation's merge is for.
  it('shows a message tagged from Lilica Chat, with its "Re: <subject>" chip', async () => {
    mockListRecordConversation.mockResolvedValue({
      ok: true,
      data: { messages: [{ ...sarahMessage, threadId: 'thread-1', subjectRecordId: 'record-1', subjectRecordTitle: 'Metformin' }], hasMore: false },
    });
    const screen = await render(
      <ChatThreadScreen careSpaceId="space-1" recordId="record-1" recordTitle="Metformin" onBack={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('Picking up the prescription this afternoon'));
    screen.getByText('Re: Metformin');
  });

  it('sending a message in record mode uses the record thread id, with no subject param (subject tagging is never offered in record mode)', async () => {
    mockSendChatMessage.mockResolvedValue({ ok: true, data: { ...myMessage, id: 'msg-4', body: 'Started taking the new dose today' } });
    const screen = await render(
      <ChatThreadScreen careSpaceId="space-1" recordId="record-1" recordTitle="Metformin" onBack={jest.fn()} />,
    );
    await waitFor(() => screen.getByPlaceholderText('Write a message'));
    const input = screen.getByLabelText('Write a message');
    await fireEvent.changeText(input, 'Started taking the new dose today');
    await waitFor(() => expect(screen.getByLabelText('Write a message').props.value).toBe('Started taking the new dose today'));
    await fireEvent.press(screen.getByLabelText('Send message'));
    await waitFor(() => expect(mockSendChatMessage).toHaveBeenCalledWith('thread-record-1', 'Started taking the new dose today'));
  });

  it('never shows the conversation subject prompt (record mode has no subject of its own to change, even though shared/direct modes both do)', async () => {
    const screen = await render(
      <ChatThreadScreen
        careSpaceId="space-1"
        recordId="record-1"
        recordTitle="Metformin"
        subjectOptions={[{ id: 'record-1', title: 'Metformin' }]}
        onBack={jest.fn()}
      />,
    );
    await waitFor(() => screen.getByPlaceholderText('Write a message'));
    expect(screen.queryByLabelText('Is it related to an existing medical or care issue?')).toBeNull();
  });
});

// Slice 6/7: a conversation's subject lives on the conversation itself
// (set once via ChatConversationListScreen, or changed here) -- not
// re-picked per message. ChatThreadScreen offers a header-area prompt (no
// subject yet) or a "Change subject" action (already has one), both
// opening the same picker/free-text panel, and calling
// setConversationSubject.
describe('Phase 23 slice 6/7: conversation-level subject, amendable in ChatThreadScreen', () => {
  const subjectOptions = [
    { id: 'record-1', title: 'Metformin' },
    { id: 'record-2', title: 'Type 2 diabetes' },
  ];

  it('prompts for a subject when the conversation has none yet', async () => {
    const screen = await render(<ChatThreadScreen careSpaceId="space-1" subjectOptions={subjectOptions} onBack={jest.fn()} />);
    await waitFor(() => screen.getByLabelText('Is it related to an existing medical or care issue?'));
  });

  it('is ALSO offered in direct message mode (DM subject tagging behaves the same as Lilica Chat -- direct product-owner decision, 22 September 2026)', async () => {
    const screen = await render(
      <ChatThreadScreen
        careSpaceId="space-1"
        directPartnerMembershipId="m-sarah"
        directPartnerDisplayName="Sarah"
        subjectOptions={subjectOptions}
        onBack={jest.fn()}
      />,
    );
    await waitFor(() => screen.getByLabelText('Is it related to an existing medical or care issue?'));
  });

  it('picking a Medical Log item sets the conversation subject, and it becomes the header title', async () => {
    const screen = await render(<ChatThreadScreen careSpaceId="space-1" subjectOptions={subjectOptions} onBack={jest.fn()} />);
    await waitFor(() => screen.getByLabelText('Is it related to an existing medical or care issue?'));
    await fireEvent.press(screen.getByLabelText('Is it related to an existing medical or care issue?'));
    await fireEvent.press(screen.getByLabelText('Set the subject to Metformin'));
    await waitFor(() => expect(mockSetConversationSubject).toHaveBeenCalledWith('thread-1', { subjectRecordId: 'record-1' }));
    await waitFor(() => screen.getByText('Metformin'));
    screen.getByLabelText('Change subject');
  });

  it('giving it a free-text title works the same way, for a concern not logged yet', async () => {
    const screen = await render(<ChatThreadScreen careSpaceId="space-1" subjectOptions={subjectOptions} onBack={jest.fn()} />);
    await waitFor(() => screen.getByLabelText('Is it related to an existing medical or care issue?'));
    await fireEvent.press(screen.getByLabelText('Is it related to an existing medical or care issue?'));
    await fireEvent.changeText(screen.getByLabelText('Conversation subject title'), 'Weekend visit plans');
    await fireEvent.press(screen.getByLabelText('Save subject title'));
    await waitFor(() => expect(mockSetConversationSubject).toHaveBeenCalledWith('thread-1', { title: 'Weekend visit plans' }));
    await waitFor(() => screen.getByText('Weekend visit plans'));
  });

  it('a conversation opened with an explicit subject shows "Change subject", never a duplicate prompt', async () => {
    mockListChatMessages.mockResolvedValue({ ok: true, data: { messages: [sarahMessage], hasMore: false } });
    const screen = await render(
      <ChatThreadScreen
        careSpaceId="space-1"
        explicitThreadId="thread-old-1"
        explicitThreadTitle="Metformin"
        subjectOptions={subjectOptions}
        onBack={jest.fn()}
      />,
    );
    await waitFor(() => screen.getByText('Picking up the prescription this afternoon'));
    screen.getByLabelText('Change subject');
    expect(screen.queryByLabelText('Is it related to an existing medical or care issue?')).toBeNull();
  });

  it('changing the subject on an already-tagged conversation updates the header to the new subject', async () => {
    mockListChatMessages.mockResolvedValue({ ok: true, data: { messages: [sarahMessage], hasMore: false } });
    const screen = await render(
      <ChatThreadScreen
        careSpaceId="space-1"
        explicitThreadId="thread-old-1"
        explicitThreadTitle="Metformin"
        subjectOptions={subjectOptions}
        onBack={jest.fn()}
      />,
    );
    await waitFor(() => screen.getByLabelText('Change subject'));
    await fireEvent.press(screen.getByLabelText('Change subject'));
    await fireEvent.press(screen.getByLabelText('Set the subject to Type 2 diabetes'));
    await waitFor(() => expect(mockSetConversationSubject).toHaveBeenCalledWith('thread-old-1', { subjectRecordId: 'record-2' }));
    await waitFor(() => screen.getByText('Type 2 diabetes'));
    expect(screen.queryByText('Metformin')).toBeNull();
  });
});

// Phase 23 slice 5: opening one SPECIFIC past conversation (reopened from
// ChatConversationListScreen) instead of "the most recently active one".
describe('Phase 23 slice 5: explicitThreadId opens a specific conversation directly', () => {
  it('uses explicitThreadId as-is, never calling any get-or-create RPC', async () => {
    mockListChatMessages.mockResolvedValue({ ok: true, data: { messages: [sarahMessage], hasMore: false } });
    const screen = await render(
      <ChatThreadScreen careSpaceId="space-1" explicitThreadId="thread-old-1" explicitThreadTitle="Conversation started 10 Sept" onBack={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('Picking up the prescription this afternoon'));
    expect(mockGetOrCreateCareCircleThread).not.toHaveBeenCalled();
    expect(mockGetOrCreateDirectThread).not.toHaveBeenCalled();
    expect(mockListChatMessages).toHaveBeenCalledWith('thread-old-1');
    expect(mockMarkChatThreadRead).toHaveBeenCalledWith('thread-old-1');
    screen.getByText('Conversation started 10 Sept');
  });

  it('sending into an explicit thread uses that exact thread id', async () => {
    mockSendChatMessage.mockResolvedValue({ ok: true, data: { ...myMessage, id: 'msg-7', body: 'Following up' } });
    const screen = await render(
      <ChatThreadScreen careSpaceId="space-1" explicitThreadId="thread-old-1" onBack={jest.fn()} />,
    );
    await waitFor(() => screen.getByPlaceholderText('Message your Care Circle'));
    await fireEvent.changeText(screen.getByLabelText('Write a message'), 'Following up');
    await fireEvent.press(screen.getByLabelText('Send message'));
    await waitFor(() => expect(mockSendChatMessage).toHaveBeenCalledWith('thread-old-1', 'Following up'));
  });
});
