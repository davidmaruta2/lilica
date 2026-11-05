// 5 November 2026, direct product-owner request: everything opened from Care
// Circle used to unfold inside the one long list. Edit permissions, Invite
// someone and the invitation-created step now each open as their own screen
// with a header and a "Care Circle >" breadcrumb that goes back in one tap.
const mockInviteMember = jest.fn();
const mockChangeMemberRole = jest.fn();
jest.mock('../src/careCircle', () => {
  const actual = jest.requireActual('../src/careCircle');
  return {
    ...actual,
    inviteMember: (...args: unknown[]) => mockInviteMember(...args),
    changeMemberRole: (...args: unknown[]) => mockChangeMemberRole(...args),
  };
});

import { fireEvent, render } from '@testing-library/react-native';

import { CareCircleScreen } from '../src/screens/CareCircleScreen';
import { CareCircleMember } from '../src/careCircle';

const organiser: CareCircleMember = {
  membershipId: 'm-1', displayName: 'Sam Carter', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: [],
};
const alex: CareCircleMember = {
  membershipId: 'm-2', displayName: 'Alex Morgan', role: 'viewer', relationshipType: 'Other relative', isSelf: false, grantedDomains: ['general'],
};

const baseProps = {
  personName: 'Robin',
  invitations: [],
  careSpaceId: 'space-1',
  onBack: jest.fn(),
  onRefresh: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('Care Circle sub screens', () => {
  it('Edit permissions opens on its own screen, not inside the member list', async () => {
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, alex]} />);
    screen.getByText('Members');
    await fireEvent.press(screen.getByText('Edit permissions'));
    screen.getByText("Edit Alex Morgan's permissions");
    expect(screen.queryByText('Members')).toBeNull();
    expect(screen.queryByText('Invite someone')).toBeNull();
    screen.getByTestId('care-circle-breadcrumb');
  });

  it('the breadcrumb takes you back to the Care Circle list in one tap', async () => {
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, alex]} />);
    await fireEvent.press(screen.getByText('Edit permissions'));
    await fireEvent.press(screen.getByLabelText('Back to Care Circle'));
    screen.getByText('Members');
    expect(screen.queryByText("Edit Alex Morgan's permissions")).toBeNull();
  });

  it('the header back arrow does the same', async () => {
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, alex]} />);
    await fireEvent.press(screen.getByText('Edit permissions'));
    await fireEvent.press(screen.getByTestId('secondary-header-back'));
    screen.getByText('Members');
  });

  it('Invite someone opens a separate screen and the breadcrumb returns to the list without sending anything', async () => {
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, alex]} />);
    await fireEvent.press(screen.getByText('Invite someone'));
    screen.getByPlaceholderText('name@example.com');
    expect(screen.queryByText('Members')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Back to Care Circle'));
    screen.getByText('Members');
    expect(screen.queryByPlaceholderText('name@example.com')).toBeNull();
    expect(mockInviteMember).not.toHaveBeenCalled();
  });

  it('the invitation-created step is its own screen too, and Dismiss returns to the list', async () => {
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, alex]} />);
    await fireEvent.press(screen.getByText('Invite someone'));
    await fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'friend@example.test');
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Cousin, neighbour'), 'Friend');
    await fireEvent.press(screen.getByText('Continue'));
    await screen.findByText('Invitation created');
    expect(screen.queryByText('Members')).toBeNull();
    screen.getByTestId('care-circle-breadcrumb');
    await fireEvent.press(screen.getByText('Dismiss'));
    screen.getByText('Members');
  });

  it('a failed save shows its error on the Edit permissions screen itself, which stays open', async () => {
    mockChangeMemberRole.mockResolvedValue({ ok: false, message: 'Could not reach the server. Please try again.' });
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, alex]} />);
    await fireEvent.press(screen.getByText('Edit permissions'));
    await fireEvent.press(screen.getByText('Save changes'));
    await screen.findByText(/Could not reach the server/);
    screen.getByText("Edit Alex Morgan's permissions");
    expect(screen.queryByText('Members')).toBeNull();
  });
});
