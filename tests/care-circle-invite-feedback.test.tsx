// 4 November 2026 two-device test findings (F3, F4, F5): the invite form said
// nothing when a field was missing, nothing confirmed an invitation had been
// sent, and the pending invitation row was laid out sideways and cut off.
const mockInviteMember = jest.fn();
const mockSendInvitationEmail = jest.fn();
jest.mock('../src/careCircle', () => {
  const actual = jest.requireActual('../src/careCircle');
  return {
    ...actual,
    inviteMember: (...args: unknown[]) => mockInviteMember(...args),
    sendInvitationEmail: (...args: unknown[]) => mockSendInvitationEmail(...args),
  };
});

import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { CareCircleScreen } from '../src/screens/CareCircleScreen';
import { CareCircleInvitation, CareCircleMember } from '../src/careCircle';

const organiser: CareCircleMember = {
  membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: [],
};

const baseProps = {
  personName: 'Robin',
  members: [organiser],
  careSpaceId: 'space-1',
  onBack: jest.fn(),
  onRefresh: jest.fn(),
  inviterDisplayName: 'David',
};

let fakeRow: CareCircleInvitation;

function Harness(props: { invitations?: CareCircleInvitation[] }) {
  const [invitations, setInvitations] = useState<CareCircleInvitation[]>(props.invitations ?? []);
  return (
    <CareCircleScreen
      {...baseProps}
      invitations={invitations}
      onRefresh={() => setInvitations((current) => [...current.filter((row) => row.id !== fakeRow.id), { ...fakeRow }])}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  fakeRow = {
    id: 'inv-1', inviteeEmail: 'friend@example.test', role: 'contributor', relationshipType: 'Someone else',
    relationshipLabel: 'Friend', grantedDomains: ['general'], status: 'pending', inviteCode: 'ABCD1234',
    emailSendCount: 0, createdAt: '2026-11-04T00:00:00Z', expiresAt: '2026-11-18T00:00:00Z',
  };
});

describe('invite form tells the organiser what is missing (F3)', () => {
  it('shows a message next to Continue when "How you know them" is empty, and does not create an invitation', async () => {
    const screen = await render(<Harness />);
    await fireEvent.press(screen.getByText('Invite someone'));
    await fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'friend@example.test');
    await fireEvent.press(screen.getByText('Continue'));
    expect(screen.getByTestId('invite-form-error').props.children).toMatch(/how you know them/i);
    expect(mockInviteMember).not.toHaveBeenCalled();
  });

  it('asks for the email when it is empty, and clears the message once they type', async () => {
    const screen = await render(<Harness />);
    await fireEvent.press(screen.getByText('Invite someone'));
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Cousin, neighbour'), 'Friend');
    await fireEvent.press(screen.getByText('Continue'));
    expect(screen.getByTestId('invite-form-error').props.children).toMatch(/their email/i);
    await fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'friend@example.test');
    expect(screen.queryByTestId('invite-form-error')).toBeNull();
  });

  it('shows a server error beside the form too, not only at the top of the page', async () => {
    mockInviteMember.mockResolvedValue({ ok: false, message: 'Something went wrong. Try again.' });
    const screen = await render(<Harness />);
    await fireEvent.press(screen.getByText('Invite someone'));
    await fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'friend@example.test');
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Cousin, neighbour'), 'Friend');
    await fireEvent.press(screen.getByText('Continue'));
    expect(await screen.findByTestId('invite-form-error')).toBeTruthy();
  });
});

describe('confirms an invitation was sent (F4)', () => {
  it('says "Invitation sent to <email>" after a successful email send', async () => {
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    mockSendInvitationEmail.mockImplementation(async () => {
      fakeRow = { ...fakeRow, lastEmailSentAt: '2026-11-04T00:05:00Z', emailSendCount: 1 };
      return { ok: true, data: undefined };
    });
    const screen = await render(<Harness />);
    await fireEvent.press(screen.getByText('Invite someone'));
    await fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'friend@example.test');
    await fireEvent.changeText(screen.getByPlaceholderText('e.g. Cousin, neighbour'), 'Friend');
    await fireEvent.press(screen.getByText('Continue'));
    await fireEvent.press(screen.getByText('Send by email'));
    await screen.findByText('Pending invitations');
    screen.getByText(/Invitation sent to friend@example\.test/);
  });
});

describe('pending invitation row layout (F5)', () => {
  it('stacks the email, role and status in one column inside the card', async () => {
    const screen = await render(<Harness invitations={[fakeRow]} />);
    const role = screen.getByText(/Invited as Contributor/);
    // The text nodes must share one column wrapper (cardCopy), not sit
    // side by side as direct children of the row-direction card.
    const column = role.parent;
    expect(column).toBeTruthy();
    const flat = JSON.stringify(column?.props.style ?? {});
    expect(flat).toContain('"flex":1');
    expect(flat).toContain('"minWidth":0');
  });
});
