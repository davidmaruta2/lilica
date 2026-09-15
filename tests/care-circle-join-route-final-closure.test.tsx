// Care Circle invitation final closure (`\downloads\carecircle-final-
// closure.txt`, 15 September 2026): a direct product-owner report --
// there was no obvious, persistent place for an already-logged-in user
// to enter an invitation code, and (a separate, genuine bug found while
// fixing this) the People-tab entry point set state with no visible
// effect at all because of an else-if ordering conflict in App.tsx.
// This proves: the button is clearly visible on the Care Circle screen
// itself, for ANY authenticated user regardless of role (organiser or
// contributor); it is never called "Request to join"; and Back/Cancel
// returns to Care Circle, never Home, mirroring the exact settingsSection
// state-machine pattern tests/settings-navigation.test.tsx already
// established for this codebase's App.tsx (which has no direct-render
// test harness of its own).
import { useState } from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { CareCircleScreen } from '../src/screens/CareCircleScreen';
import { JoinCareCircleScreen } from '../src/screens/JoinCareCircleScreen';
import { CareCircleInvitation, CareCircleMember } from '../src/careCircle';

const organiserSelf: CareCircleMember = {
  membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: [],
};
const contributorSelf: CareCircleMember = {
  membershipId: 'm-2', displayName: 'Sarah', role: 'contributor', relationshipType: 'Other relative', isSelf: true, grantedDomains: ['general'],
};

const baseProps = {
  personName: 'Maggie',
  invitations: [] as CareCircleInvitation[],
  careSpaceId: 'maggie-space',
  onBack: jest.fn(),
  onRefresh: jest.fn(),
  inviterDisplayName: 'David',
};

describe('CareCircleScreen: "Join a Care Circle" is clearly visible to every authenticated user', () => {
  it('is offered to the organiser, alongside "Invite someone" -- never hidden or replaced', async () => {
    const onJoinAnotherCareCircle = jest.fn();
    const screen = await render(
      <CareCircleScreen {...baseProps} members={[organiserSelf]} onJoinAnotherCareCircle={onJoinAnotherCareCircle} />,
    );
    screen.getByText('Join a Care Circle');
    screen.getByText("Have an invitation code? Enter it to join a Care Circle.");
    screen.getByText('Invite someone');
    await fireEvent.press(screen.getByText('Join a Care Circle'));
    expect(onJoinAnotherCareCircle).toHaveBeenCalledTimes(1);
  });

  it('is offered to a contributor too -- not organiser-only', async () => {
    const onJoinAnotherCareCircle = jest.fn();
    const screen = await render(
      <CareCircleScreen {...baseProps} members={[contributorSelf]} onJoinAnotherCareCircle={onJoinAnotherCareCircle} />,
    );
    screen.getByText('Join a Care Circle');
  });

  it('is never labelled "Request to join" -- this app has no unsolicited-access-request concept', async () => {
    const screen = await render(
      <CareCircleScreen {...baseProps} members={[organiserSelf]} onJoinAnotherCareCircle={jest.fn()} />,
    );
    expect(screen.queryByText(/request to join/i)).toBeNull();
  });

  it('is absent only when the caller genuinely omits the callback (never a dead-end button)', async () => {
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiserSelf]} />);
    expect(screen.queryByText('Join a Care Circle')).toBeNull();
  });
});

// App.tsx has no existing direct-render test harness in this codebase
// (see tests/settings-navigation.test.tsx's own header comment) -- this
// exercises the exact same showCareCircle/showJoinCareCircle state-
// machine pattern App.tsx itself now uses, after the fix, wired to the
// real CareCircleScreen/JoinCareCircleScreen components.
type Route = 'home' | 'careCircle' | 'joinCareCircle';

function Harness() {
  const [route, setRoute] = useState<Route>('home');
  return (
    <>
      {route === 'home' ? <Text>route:home</Text> : null}
      {route === 'careCircle' ? (
        <CareCircleScreen
          {...baseProps}
          members={[organiserSelf]}
          onBack={() => setRoute('home')}
          onJoinAnotherCareCircle={() => setRoute('joinCareCircle')}
        />
      ) : null}
      {route === 'joinCareCircle' ? (
        <JoinCareCircleScreen
          onResolveCode={jest.fn().mockResolvedValue({ ok: false, message: 'x' })}
          onAccept={jest.fn()}
          onClose={() => setRoute('careCircle')}
          onJoined={() => setRoute('home')}
        />
      ) : null}
      <Text accessibilityLabel="Open Care Circle" onPress={() => setRoute('careCircle')}>Open Care Circle</Text>
    </>
  );
}

describe('App-level navigation: Join a Care Circle Back/Cancel returns to Care Circle, not Home', () => {
  it('opening Join from Care Circle, then Back, returns to Care Circle -- not Home', async () => {
    const screen = await render(<Harness />);
    await fireEvent.press(screen.getByLabelText('Open Care Circle'));
    screen.getByText('Members');
    await fireEvent.press(screen.getByText('Join a Care Circle'));
    screen.getByText('Enter the care circle code if you\'ve been given one by the organiser');
    await fireEvent.press(screen.getByLabelText('Go back')); // the code-entry step's own Header back arrow -> onClose
    screen.getByText('Members'); // back on Care Circle, not route:home
    expect(screen.queryByText('route:home')).toBeNull();
  });
});
