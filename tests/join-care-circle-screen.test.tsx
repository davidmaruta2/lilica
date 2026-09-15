// Care Circle invitation & joining flow completion (`\downloads\carecircle.txt`,
// 14 September 2026): the manual invitation-CODE joining route. Proves:
// code entry -> review -> join, invalid/expired code handling, and that
// acceptance always goes through the SAME onAccept function the caller
// supplies (in the real app, App.tsx's own handleAcceptInvitation --
// never a second, parallel acceptance path).
import { fireEvent, render } from '@testing-library/react-native';

import { JoinCareCircleScreen } from '../src/screens/JoinCareCircleScreen';
import { CodeResolvedInvitation } from '../src/careCircle';

const validPreview: CodeResolvedInvitation = {
  invitationId: 'inv-99',
  careSpaceNames: ['Maggie'],
  invitedByDisplayName: 'David',
  role: 'contributor',
  grantedDomains: ['general', 'health'],
};

describe('JoinCareCircleScreen', () => {
  it('(code entry) starts on the code-entry step, Continue disabled until something is typed', async () => {
    const screen = await render(
      <JoinCareCircleScreen onResolveCode={jest.fn()} onAccept={jest.fn()} onClose={jest.fn()} onJoined={jest.fn()} />,
    );
    screen.getByText("Enter the care circle code if you've been given one by the organiser");
    expect(screen.getByLabelText('Continue').props.accessibilityState.disabled).toBe(true);
  });

  it('(valid invitation review) a valid code shows the real inviter, person, role and domain explanations -- never invented data', async () => {
    const onResolveCode = jest.fn().mockResolvedValue({ ok: true, data: validPreview });
    const screen = await render(
      <JoinCareCircleScreen onResolveCode={onResolveCode} onAccept={jest.fn()} onClose={jest.fn()} onJoined={jest.fn()} />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('ABCD-1234'), 'abcd-1234');
    await fireEvent.press(screen.getByText('Continue'));
    expect(onResolveCode).toHaveBeenCalledWith('abcd-1234');
    await screen.findByText("You've been invited to help with Maggie's care");
    screen.getByText('Invited by David as a Contributor');
    screen.getByText('You will have access to:', { exact: false });
  });

  it('(invalid code) shows the server\'s own calm message and lets the user correct/re-enter the code', async () => {
    const onResolveCode = jest.fn().mockResolvedValue({ ok: false, message: 'We could not find an active invitation with that code.' });
    const screen = await render(
      <JoinCareCircleScreen onResolveCode={onResolveCode} onAccept={jest.fn()} onClose={jest.fn()} onJoined={jest.fn()} />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('ABCD-1234'), 'NOTREAL1');
    await fireEvent.press(screen.getByText('Continue'));
    await screen.findByText('We could not find an active invitation with that code.');
    // Still on the entry step -- can correct and try again.
    screen.getByPlaceholderText('ABCD-1234');
  });

  it('(expired/cancelled code) shows the distinct "no longer active" message', async () => {
    const onResolveCode = jest.fn().mockResolvedValue({ ok: false, message: 'This invitation is no longer active' });
    const screen = await render(
      <JoinCareCircleScreen onResolveCode={onResolveCode} onAccept={jest.fn()} onClose={jest.fn()} onJoined={jest.fn()} />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('ABCD-1234'), 'ABCD1234');
    await fireEvent.press(screen.getByText('Continue'));
    await screen.findByText('This invitation is no longer active');
  });

  it('acceptance is explicit -- entering a valid code never joins by itself, only pressing Join Care Circle does, and it calls onAccept with EXACTLY the resolved invitation id', async () => {
    const onResolveCode = jest.fn().mockResolvedValue({ ok: true, data: validPreview });
    const onAccept = jest.fn().mockResolvedValue({ ok: true });
    const onJoined = jest.fn();
    const screen = await render(
      <JoinCareCircleScreen onResolveCode={onResolveCode} onAccept={onAccept} onClose={jest.fn()} onJoined={onJoined} />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('ABCD-1234'), 'ABCD1234');
    await fireEvent.press(screen.getByText('Continue'));
    await screen.findByText("You've been invited to help with Maggie's care");
    expect(onAccept).not.toHaveBeenCalled(); // resolving/reviewing never joins by itself
    await fireEvent.press(screen.getByText('Join Care Circle'));
    expect(onAccept).toHaveBeenCalledWith({ invitationId: 'inv-99', groupId: undefined });
    expect(onJoined).toHaveBeenCalledTimes(1);
  });

  it('a genuine accept failure (e.g. identity mismatch) shows the real message and does NOT call onJoined', async () => {
    const onResolveCode = jest.fn().mockResolvedValue({ ok: true, data: validPreview });
    const onAccept = jest.fn().mockResolvedValue({ ok: false, message: 'Invitation not found' });
    const onJoined = jest.fn();
    const screen = await render(
      <JoinCareCircleScreen onResolveCode={onResolveCode} onAccept={onAccept} onClose={jest.fn()} onJoined={onJoined} />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('ABCD-1234'), 'ABCD1234');
    await fireEvent.press(screen.getByText('Continue'));
    await screen.findByText("You've been invited to help with Maggie's care");
    await fireEvent.press(screen.getByText('Join Care Circle'));
    await screen.findByText('Invitation not found');
    expect(onJoined).not.toHaveBeenCalled();
  });

  it('"Not now" on the review step calls onClose without accepting anything', async () => {
    const onResolveCode = jest.fn().mockResolvedValue({ ok: true, data: validPreview });
    const onAccept = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <JoinCareCircleScreen onResolveCode={onResolveCode} onAccept={onAccept} onClose={onClose} onJoined={jest.fn()} />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('ABCD-1234'), 'ABCD1234');
    await fireEvent.press(screen.getByText('Continue'));
    await screen.findByText("You've been invited to help with Maggie's care");
    await fireEvent.press(screen.getByText('Not now'));
    expect(onAccept).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a viewer-role invitation with no granted domains shows the calm "nothing shared yet" state, never an invented default', async () => {
    const onResolveCode = jest.fn().mockResolvedValue({
      ok: true,
      data: { ...validPreview, role: 'viewer', grantedDomains: [] },
    });
    const screen = await render(
      <JoinCareCircleScreen onResolveCode={onResolveCode} onAccept={jest.fn()} onClose={jest.fn()} onJoined={jest.fn()} />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('ABCD-1234'), 'ABCD1234');
    await fireEvent.press(screen.getByText('Continue'));
    await screen.findByText('Invited by David as a Viewer');
    screen.getByText('Nothing has been shared with you yet.');
  });
});
