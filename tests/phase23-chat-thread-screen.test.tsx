const mockGetOrCreateCareCircleThread = jest.fn();
const mockGetOrCreateDirectThread = jest.fn();
const mockGetOrCreateRecordThread = jest.fn();
const mockListChatMessages = jest.fn();
const mockListRecordConversation = jest.fn();
const mockSendChatMessage = jest.fn();
const mockEditChatMessage = jest.fn();
const mockDeleteChatMessage = jest.fn();
const mockMarkChatThreadRead = jest.fn();

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
    await waitFor(() => expect(mockSendChatMessage).toHaveBeenCalledWith('thread-1', 'Hello', undefined));
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
    await waitFor(() => expect(mockSendChatMessage).toHaveBeenCalledWith('thread-record-1', 'Started taking the new dose today', undefined));
  });

  it('never shows the subject picker (record mode has no subject picker, even though shared/direct modes both do)', async () => {
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
    expect(screen.queryByLabelText('Add a subject')).toBeNull();
  });
});

describe('Phase 23 slice 4: subject picker in Lilica Chat', () => {
  const subjectOptions = [
    { id: 'record-1', title: 'Metformin' },
    { id: 'record-2', title: 'Type 2 diabetes' },
  ];

  it('is not shown at all when no subject options are supplied', async () => {
    const screen = await render(<ChatThreadScreen careSpaceId="space-1" onBack={jest.fn()} />);
    await waitFor(() => screen.getByPlaceholderText('Message your Care Circle'));
    expect(screen.queryByLabelText('Add a subject')).toBeNull();
  });

  // Direct product-owner decision (22 September 2026): DM tagging behaves
  // exactly like Lilica Chat tagging, including surfacing in the record's
  // shared conversation -- a knowing privacy trade-off, not an oversight.
  it('is ALSO shown in direct message mode, and tags the DM message the same way', async () => {
    mockSendChatMessage.mockResolvedValue({ ok: true, data: { ...myMessage, id: 'msg-6', body: 'Been struggling with this today' } });
    const screen = await render(
      <ChatThreadScreen
        careSpaceId="space-1"
        directPartnerMembershipId="m-sarah"
        directPartnerDisplayName="Sarah"
        subjectOptions={subjectOptions}
        onBack={jest.fn()}
      />,
    );
    await waitFor(() => screen.getByLabelText('Add a subject'));
    await fireEvent.press(screen.getByLabelText('Add a subject'));
    await fireEvent.press(screen.getByLabelText('Tag this message to Metformin'));
    screen.getByText('Subject: Metformin');
    await fireEvent.changeText(screen.getByLabelText('Write a message'), 'Been struggling with this today');
    await fireEvent.press(screen.getByLabelText('Send message'));
    await waitFor(() => expect(mockSendChatMessage).toHaveBeenCalledWith('thread-direct-1', 'Been struggling with this today', 'record-1'));
  });

  it('picking a subject shows a chip, and sending tags the message with it -- then clears for the next message', async () => {
    mockSendChatMessage.mockResolvedValue({ ok: true, data: { ...myMessage, id: 'msg-5', body: 'New dose starts Monday' } });
    const screen = await render(<ChatThreadScreen careSpaceId="space-1" subjectOptions={subjectOptions} onBack={jest.fn()} />);
    await waitFor(() => screen.getByLabelText('Add a subject'));
    await fireEvent.press(screen.getByLabelText('Add a subject'));
    await fireEvent.press(screen.getByLabelText('Tag this message to Metformin'));
    screen.getByText('Subject: Metformin');

    await fireEvent.changeText(screen.getByLabelText('Write a message'), 'New dose starts Monday');
    await fireEvent.press(screen.getByLabelText('Send message'));
    await waitFor(() => expect(mockSendChatMessage).toHaveBeenCalledWith('thread-1', 'New dose starts Monday', 'record-1'));
    // The chip disappears and "Add a subject" is back for the next message.
    await waitFor(() => screen.getByLabelText('Add a subject'));
    expect(screen.queryByText('Subject: Metformin')).toBeNull();
  });

  it('"Remove" clears the selected subject without sending', async () => {
    const screen = await render(<ChatThreadScreen careSpaceId="space-1" subjectOptions={subjectOptions} onBack={jest.fn()} />);
    await waitFor(() => screen.getByLabelText('Add a subject'));
    await fireEvent.press(screen.getByLabelText('Add a subject'));
    await fireEvent.press(screen.getByLabelText('Tag this message to Type 2 diabetes'));
    screen.getByText('Subject: Type 2 diabetes');
    await fireEvent.press(screen.getByLabelText('Remove subject'));
    expect(screen.queryByText('Subject: Type 2 diabetes')).toBeNull();
    screen.getByLabelText('Add a subject');
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
    await waitFor(() => expect(mockSendChatMessage).toHaveBeenCalledWith('thread-old-1', 'Following up', undefined));
  });
});
