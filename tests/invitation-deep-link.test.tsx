// useInvitationDeepLink: a second, independent Linking listener alongside
// AuthProvider's own -- only ever acts on an invitation link, never an
// auth-callback link (which this hook's own parser simply won't match).
// Tested via a small harness component (this project's own established
// pattern for exercising a hook -- see tests/settings-navigation.test.tsx)
// rather than renderHook, for consistency with the rest of this suite.
import { act } from 'react';
import { Linking, Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { useInvitationDeepLink } from '../src/invitationDeepLink';

function Harness() {
  const { invitationId, clear } = useInvitationDeepLink();
  return (
    <>
      <Text testID="invitation-id">{invitationId ?? ''}</Text>
      <Text accessibilityLabel="Clear" onPress={clear}>Clear</Text>
    </>
  );
}

describe('useInvitationDeepLink', () => {
  let urlListener: ((event: { url: string }) => void) | undefined;

  beforeEach(() => {
    urlListener = undefined;
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.spyOn(Linking, 'addEventListener').mockImplementation((_event: string, listener: (e: { url: string }) => void) => {
      urlListener = listener;
      return { remove: jest.fn() } as unknown as ReturnType<typeof Linking.addEventListener>;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('resolves the invitation id from the URL Lilica was opened with', async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue('lilica://invite/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    const screen = await render(<Harness />);
    await screen.findByText('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
  });

  it('resolves the invitation id from a URL received while already running (foregrounded by a tap)', async () => {
    const screen = await render(<Harness />);
    expect(screen.getByTestId('invitation-id').props.children).toBe('');

    act(() => urlListener?.({ url: 'https://lilica.co.uk/invite/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }));
    await screen.findByText('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
  });

  it('resolves the invitation id from the CURRENT canonical web format (query parameter) on cold start', async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue('https://lilica.co.uk/invite/?id=9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    const screen = await render(<Harness />);
    await screen.findByText('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
  });

  it('resolves the invitation id from the CURRENT canonical web format while already running (warm app)', async () => {
    const screen = await render(<Harness />);
    act(() => urlListener?.({ url: 'https://lilica.co.uk/invite/?id=9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }));
    await screen.findByText('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
  });

  it('never sets an invitation id for an unrelated URL (e.g. an auth callback link) -- the two listeners never interfere', async () => {
    const screen = await render(<Harness />);
    act(() => urlListener?.({ url: 'lilica://password-recovery?token=abc' }));
    expect(screen.getByTestId('invitation-id').props.children).toBe('');
  });

  it('clear() resets the id so the same link tap is never acted on twice', async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue('lilica://invite/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    const screen = await render(<Harness />);
    await screen.findByText('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    await fireEvent.press(screen.getByLabelText('Clear'));
    expect(screen.getByTestId('invitation-id').props.children).toBe('');
  });
});
