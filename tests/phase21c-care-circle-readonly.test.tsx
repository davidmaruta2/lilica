import { fireEvent, render } from '@testing-library/react-native';

import { CareCircleScreen } from '../src/screens/CareCircleScreen';
import { CareCircleMember } from '../src/careCircle';

// Phase 21C: inviting a NEW member is the one gated action on this
// screen (creating a new Care Circle relationship, per the mutation
// inventory in docs/PHASE_21_ARCHITECTURE.md section 10) -- accepting,
// declining, leaving and removing a member are all deliberately never
// gated and are untouched by this task. "Invite someone" stays visible
// either way; tapping it while read-only shows the gate instead of
// opening the invite form.

const organiser: CareCircleMember = {
  membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: [],
};

const baseProps = {
  members: [organiser],
  invitations: [],
  careSpaceId: 'space-1',
  onBack: jest.fn(),
  onRefresh: jest.fn(),
};

describe('CareCircleScreen: Phase 21C invite gating', () => {
  it('"Invite someone" stays visible when read-only, but calls onInviteBlocked instead of opening the form', async () => {
    const onInviteBlocked = jest.fn();
    const screen = await render(
      <CareCircleScreen {...baseProps} isReadOnly onInviteBlocked={onInviteBlocked} />,
    );
    screen.getByText('Invite someone');
    fireEvent.press(screen.getByText('Invite someone'));
    expect(onInviteBlocked).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Send invitation')).toBeNull();
  });

  it('when not read-only, "Invite someone" opens the invite form exactly as before', async () => {
    const onInviteBlocked = jest.fn();
    const screen = await render(
      <CareCircleScreen {...baseProps} isReadOnly={false} onInviteBlocked={onInviteBlocked} />,
    );
    await fireEvent.press(screen.getByText('Invite someone'));
    screen.getByText('Send invitation');
    expect(onInviteBlocked).not.toHaveBeenCalled();
  });

  it('Remove (an ungated safety action) is unaffected by read-only state', async () => {
    const members: CareCircleMember[] = [
      organiser,
      { membershipId: 'm-2', displayName: 'Marion', role: 'contributor', relationshipType: 'Other relative', isSelf: false, grantedDomains: ['general'] },
    ];
    const screen = await render(
      <CareCircleScreen {...baseProps} members={members} isReadOnly onInviteBlocked={jest.fn()} />,
    );
    // Marion's own Remove button is present and enabled regardless of
    // read-only -- this action was never gated server-side either.
    screen.getByText('Remove');
  });
});
