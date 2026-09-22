// Real end-to-end proof that focusing the chat compose box actually
// scrolls it above the keyboard -- not just that the accessibility label
// exists. Two earlier "fixes" in this area (22-23 September 2026) looked
// right by inspection and still didn't work on real devices, confirmed by
// screenshot: a genuine React-context resolution bug (the reveal function
// never actually ran), and then Android's native keyboard resize turning
// out not to be reliable enough to depend on at all. This exercises the
// REAL KeyboardAwareScrollView/Screen machinery end to end (only chat.ts's
// network calls are mocked) via a real ScrollView.scrollToEnd spy, the way
// a real keyboard focus does it -- not a mocked-away reveal function.

const mockGetOrCreateCareCircleThread = jest.fn();
const mockListChatMessages = jest.fn();
const mockMarkChatThreadRead = jest.fn();

jest.mock('../src/chat', () => ({
  getOrCreateCareCircleThread: (...args: unknown[]) => mockGetOrCreateCareCircleThread(...args),
  getOrCreateDirectThread: jest.fn(),
  getOrCreateRecordThread: jest.fn(),
  listChatMessages: (...args: unknown[]) => mockListChatMessages(...args),
  listRecordConversation: jest.fn(),
  sendChatMessage: jest.fn(),
  editChatMessage: jest.fn(),
  deleteChatMessage: jest.fn(),
  markChatThreadRead: (...args: unknown[]) => mockMarkChatThreadRead(...args),
  setConversationSubject: jest.fn(),
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { ChatThreadScreen } from '../src/screens/ChatThreadScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetOrCreateCareCircleThread.mockResolvedValue({ ok: true, data: 'thread-1' });
  mockListChatMessages.mockResolvedValue({ ok: true, data: { messages: [], hasMore: false } });
  mockMarkChatThreadRead.mockResolvedValue({ ok: true, data: undefined });
});

describe('Phase 23: the compose box genuinely scrolls above the keyboard on focus', () => {
  it('calls the real ScrollView.scrollToEnd when the compose field is focused', async () => {
    const scrollToEndSpy = jest.spyOn(ScrollView.prototype, 'scrollToEnd').mockImplementation(() => undefined);

    const screen = await render(<ChatThreadScreen careSpaceId="space-1" onBack={jest.fn()} />);
    await waitFor(() => screen.getByPlaceholderText('Message your Care Circle'));

    fireEvent(screen.getByLabelText('Write a message'), 'focus', { nativeEvent: { target: 42 } });

    await waitFor(() => expect(scrollToEndSpy).toHaveBeenCalledWith({ animated: true }));

    scrollToEndSpy.mockRestore();
  });

  // Real device report (23 September 2026): still "partially" hidden even
  // after the fix above -- KeyboardAvoidingView's own padding/height
  // animation is still running when the first scrollToEnd() lands, so the
  // viewport keeps shrinking a little further afterwards. This proves the
  // container's own onLayout (which fires on every frame of that
  // animation, since it's a real layout change) triggers a corrective
  // re-scroll, without depending on any fixed delay.
  it('re-scrolls when the container height changes after focus (KeyboardAvoidingView still animating)', async () => {
    const scrollToEndSpy = jest.spyOn(ScrollView.prototype, 'scrollToEnd').mockImplementation(() => undefined);

    const screen = await render(<ChatThreadScreen careSpaceId="space-1" onBack={jest.fn()} />);
    await waitFor(() => screen.getByPlaceholderText('Message your Care Circle'));

    fireEvent(screen.getByLabelText('Write a message'), 'focus', { nativeEvent: { target: 42 } });
    await waitFor(() => expect(scrollToEndSpy).toHaveBeenCalled());
    scrollToEndSpy.mockClear();

    // First layout establishes the baseline height; a later, DIFFERENT
    // height is what a still-animating KeyboardAvoidingView produces.
    fireEvent(screen.getByTestId('screen-scroll-view'), 'layout', { nativeEvent: { layout: { height: 500, width: 400, x: 0, y: 0 } } });
    fireEvent(screen.getByTestId('screen-scroll-view'), 'layout', { nativeEvent: { layout: { height: 460, width: 400, x: 0, y: 0 } } });

    expect(scrollToEndSpy).toHaveBeenCalledWith({ animated: true });

    scrollToEndSpy.mockRestore();
  });
});
