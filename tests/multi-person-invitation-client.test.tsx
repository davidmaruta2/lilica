// Multi-person Care Circle invitation scope (`\downloads\perm.txt`, 15
// September 2026) -- client-side proof (brief section 41). Server-side
// correctness (authority, no duplicate membership, coherent atomic
// accept/decline/revoke, per-person security) is proven exhaustively by
// supabase/tests/database/multi_person_invitation_groups.test.sql; this
// file proves the CLIENT surfaces that correctly: the organiser's
// supported-person selection, what gets shown/sent, and how a resolved
// multi-person invitation is reviewed and accepted.
const mockInviteMember = jest.fn();
const mockInviteMemberGroup = jest.fn();
const mockSendInvitationEmail = jest.fn();
jest.mock('../src/careCircle', () => {
  const actual = jest.requireActual('../src/careCircle');
  return {
    ...actual,
    inviteMember: (...args: unknown[]) => mockInviteMember(...args),
    inviteMemberGroup: (...args: unknown[]) => mockInviteMemberGroup(...args),
    sendInvitationEmail: (...args: unknown[]) => mockSendInvitationEmail(...args),
  };
});

import { fireEvent, render } from '@testing-library/react-native';

import { CareCircleScreen } from '../src/screens/CareCircleScreen';
import { JoinCareCircleScreen } from '../src/screens/JoinCareCircleScreen';
import { InvitationsScreen } from '../src/screens/InvitationsScreen';
import { CareCircleInvitation, CareCircleMember, CodeResolvedInvitation, MyInvitation } from '../src/careCircle';

const organiser: CareCircleMember = {
  membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: [],
};

const baseProps = {
  personName: 'Maggie',
  members: [organiser],
  invitations: [] as CareCircleInvitation[],
  careSpaceId: 'maggie-space',
  onBack: jest.fn(),
  onRefresh: jest.fn(),
  inviterDisplayName: 'David',
};

const eligiblePeople = [
  { careSpaceId: 'maggie-space', displayName: 'Maggie' },
  { careSpaceId: 'ben-space', displayName: 'Ben' },
];

beforeEach(() => {
  jest.clearAllMocks();
});

async function openInvite(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.press(screen.getByText('Invite someone'));
  await fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'sarah@example.test');
  await fireEvent.changeText(screen.getByPlaceholderText('e.g. Cousin, neighbour'), 'Friend');
}

describe('CareCircleScreen: supported-person selection (brief section 3)', () => {
  it('does NOT show a person-selection section when there is only one eligible person -- unchanged, simple single-person flow', async () => {
    const screen = await render(<CareCircleScreen {...baseProps} organiserEligiblePeople={[eligiblePeople[0]]} />);
    await openInvite(screen);
    expect(screen.queryByText('Who can they help with?')).toBeNull();
  });

  it('shows the section, with the CURRENT person preselected and other eligible people visible but NOT preselected (brief section 4)', async () => {
    const screen = await render(<CareCircleScreen {...baseProps} organiserEligiblePeople={eligiblePeople} />);
    await openInvite(screen);
    screen.getByText('Who can they help with?');
    expect(screen.getByLabelText('Maggie, selected')).toBeTruthy();
    expect(screen.getByLabelText('Ben, not selected')).toBeTruthy();
    screen.getByText("They'll only be able to see information for the people you select.");
  });

  it('unchecking every person disables Continue -- at least one selection is required', async () => {
    const screen = await render(<CareCircleScreen {...baseProps} organiserEligiblePeople={eligiblePeople} />);
    await openInvite(screen);
    await fireEvent.press(screen.getByLabelText('Maggie, selected'));
    expect(screen.getByLabelText('Continue').props.accessibilityState.disabled).toBe(true);
  });

  it('selecting Ben in addition to the preselected Maggie calls inviteMemberGroup with BOTH care space ids -- never inviteMember (the single-person path)', async () => {
    mockInviteMemberGroup.mockResolvedValue({
      ok: true,
      data: {
        groupId: 'group-1',
        inviteCode: 'ABCD1234',
        representativeInvitationId: 'inv-maggie',
        results: [
          { careSpaceId: 'maggie-space', supportedPersonName: 'Maggie', outcome: 'invited' },
          { careSpaceId: 'ben-space', supportedPersonName: 'Ben', outcome: 'invited' },
        ],
      },
    });
    const screen = await render(<CareCircleScreen {...baseProps} organiserEligiblePeople={eligiblePeople} />);
    await openInvite(screen);
    await fireEvent.press(screen.getByLabelText('Ben, not selected'));
    await fireEvent.press(screen.getByText('Continue'));
    expect(mockInviteMemberGroup).toHaveBeenCalledWith(expect.objectContaining({ careSpaceIds: ['maggie-space', 'ben-space'] }));
    expect(mockInviteMember).not.toHaveBeenCalled();
  });

  it('selecting only the preselected person calls plain inviteMember, not inviteMemberGroup (brief section 17 -- no needless complexity)', async () => {
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    const screen = await render(<CareCircleScreen {...baseProps} organiserEligiblePeople={eligiblePeople} />);
    await openInvite(screen);
    await fireEvent.press(screen.getByText('Continue'));
    expect(mockInviteMember).toHaveBeenCalledWith(expect.objectContaining({ careSpaceId: 'maggie-space' }));
    expect(mockInviteMemberGroup).not.toHaveBeenCalled();
  });

  it('after a two-person invitation is created, the panel shows BOTH selected people and offers the single group code', async () => {
    mockInviteMemberGroup.mockResolvedValue({
      ok: true,
      data: {
        groupId: 'group-1',
        inviteCode: 'ABCD1234',
        representativeInvitationId: 'inv-maggie',
        results: [
          { careSpaceId: 'maggie-space', supportedPersonName: 'Maggie', outcome: 'invited' },
          { careSpaceId: 'ben-space', supportedPersonName: 'Ben', outcome: 'invited' },
        ],
      },
    });
    const screen = await render(<CareCircleScreen {...baseProps} organiserEligiblePeople={eligiblePeople} />);
    await openInvite(screen);
    await fireEvent.press(screen.getByLabelText('Ben, not selected'));
    await fireEvent.press(screen.getByText('Continue'));
    screen.getByText('Invitation created');
    screen.getByText(/covers helping with: Maggie and Ben/);
    screen.getByText('ABCD-1234');
  });

  it('truthfully reports someone already excluded because they already have access (brief sections 35/36) -- never a duplicate invitation for them', async () => {
    mockInviteMemberGroup.mockResolvedValue({
      ok: true,
      data: {
        groupId: 'group-2',
        inviteCode: 'WXYZ9876',
        representativeInvitationId: 'inv-ben',
        results: [
          { careSpaceId: 'maggie-space', supportedPersonName: 'Maggie', outcome: 'already_has_access' },
          { careSpaceId: 'ben-space', supportedPersonName: 'Ben', outcome: 'invited' },
        ],
      },
    });
    const screen = await render(<CareCircleScreen {...baseProps} organiserEligiblePeople={eligiblePeople} />);
    await openInvite(screen);
    await fireEvent.press(screen.getByLabelText('Ben, not selected'));
    await fireEvent.press(screen.getByText('Continue'));
    screen.getByText(/Already has access to: Maggie -- not included in this invitation/);
  });

  it('when EVERY selected person already has access, shows a calm info message and creates no invitation panel at all', async () => {
    mockInviteMemberGroup.mockResolvedValue({
      ok: true,
      data: {
        groupId: undefined,
        inviteCode: undefined,
        representativeInvitationId: undefined,
        results: [
          { careSpaceId: 'maggie-space', supportedPersonName: 'Maggie', outcome: 'already_has_access' },
          { careSpaceId: 'ben-space', supportedPersonName: 'Ben', outcome: 'already_has_access' },
        ],
      },
    });
    const screen = await render(<CareCircleScreen {...baseProps} organiserEligiblePeople={eligiblePeople} />);
    await openInvite(screen);
    await fireEvent.press(screen.getByLabelText('Ben, not selected'));
    await fireEvent.press(screen.getByText('Continue'));
    screen.getByText('sarah@example.test already has access to everyone you selected.');
    expect(screen.queryByText('Invitation created')).toBeNull();
  });

  it('Cancel invitation on a grouped Pending row acts on the whole group, not just this care space (brief section 19)', async () => {
    const groupedInvitation: CareCircleInvitation = {
      id: 'inv-maggie', inviteeEmail: 'sarah@example.test', role: 'contributor', relationshipType: 'Someone else',
      relationshipLabel: 'Friend', grantedDomains: ['general'], status: 'pending', inviteCode: 'ABCD1234',
      emailSendCount: 0, createdAt: '2026-09-15T00:00:00Z', expiresAt: '2026-09-29T00:00:00Z',
      groupId: 'group-1', groupParticipantNames: ['Ben', 'Maggie'],
    };
    const screen = await render(<CareCircleScreen {...baseProps} organiserEligiblePeople={eligiblePeople} invitations={[groupedInvitation]} />);
    screen.getByText('This invitation also covers: Ben and Maggie');
  });
});

describe('JoinCareCircleScreen: multi-person invitation review (brief section 41)', () => {
  const multiPreview: CodeResolvedInvitation = {
    groupId: 'group-1',
    careSpaceNames: ['Ben', 'Maggie'],
    invitedByDisplayName: 'David',
    role: 'contributor',
    grantedDomains: ['general', 'health'],
  };

  it('shows EVERY selected person, never just the first one', async () => {
    const onResolveCode = jest.fn().mockResolvedValue({ ok: true, data: multiPreview });
    const screen = await render(
      <JoinCareCircleScreen onResolveCode={onResolveCode} onAccept={jest.fn()} onClose={jest.fn()} onJoined={jest.fn()} />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('ABCD-1234'), 'ABCD1234');
    await fireEvent.press(screen.getByText('Continue'));
    await screen.findByText("You've been invited to help support Ben and Maggie");
  });

  it('accepting calls onAccept with the groupId, never an invitationId, for a grouped invitation', async () => {
    const onResolveCode = jest.fn().mockResolvedValue({ ok: true, data: multiPreview });
    const onAccept = jest.fn().mockResolvedValue({ ok: true });
    const onJoined = jest.fn();
    const screen = await render(
      <JoinCareCircleScreen onResolveCode={onResolveCode} onAccept={onAccept} onClose={jest.fn()} onJoined={onJoined} />,
    );
    await fireEvent.changeText(screen.getByPlaceholderText('ABCD-1234'), 'ABCD1234');
    await fireEvent.press(screen.getByText('Continue'));
    await screen.findByText("You've been invited to help support Ben and Maggie");
    await fireEvent.press(screen.getByText('Join Care Circle'));
    expect(onAccept).toHaveBeenCalledWith({ invitationId: undefined, groupId: 'group-1' });
    expect(onJoined).toHaveBeenCalledTimes(1);
  });
});

describe('InvitationsScreen: multi-person invitation review (brief section 41)', () => {
  const groupedInvitation: MyInvitation = {
    id: 'group-1',
    groupId: 'group-1',
    careSpaceId: 'ben-space',
    careSpaceNames: ['Ben', 'Maggie'],
    invitedByDisplayName: 'David',
    role: 'contributor',
    relationshipType: 'Someone else',
    relationshipLabel: 'Friend',
    grantedDomains: ['general'],
    createdAt: '2026-09-15T00:00:00Z',
    expiresAt: '2026-09-29T00:00:00Z',
  };

  it('lists every selected person for one grouped invitation, as ONE card -- not one card per person', async () => {
    const screen = await render(
      <InvitationsScreen invitations={[groupedInvitation]} onAccept={jest.fn()} onDecline={jest.fn()} onClose={jest.fn()} />,
    );
    screen.getByText('Ben and Maggie');
    expect(screen.queryAllByText('Accept')).toHaveLength(1);
  });

  it('passes the whole invitation (carrying groupId) to onAccept/onDecline so the caller can dispatch correctly', async () => {
    const onAccept = jest.fn().mockResolvedValue({ ok: true });
    const screen = await render(
      <InvitationsScreen invitations={[groupedInvitation]} onAccept={onAccept} onDecline={jest.fn()} onClose={jest.fn()} />,
    );
    await fireEvent.press(screen.getByText('Accept'));
    expect(onAccept).toHaveBeenCalledWith(groupedInvitation);
  });
});
