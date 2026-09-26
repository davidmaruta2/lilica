// Direct product-owner request, 26 September 2026: "how do I amend the
// contributor's permissions?" -- change_member_role() already existed
// server-side but nothing in CareCircleScreen ever called it after
// invite time. Reuses the exact same role-pill/domain-checkbox pattern
// the invite form already established (see care-circle-invitation-delivery.test.tsx
// for that form's own coverage), pre-filled with the member's CURRENT
// role/domains.
const mockChangeMemberRole = jest.fn();
jest.mock('../src/careCircle', () => {
  const actual = jest.requireActual('../src/careCircle');
  return { ...actual, changeMemberRole: (...args: unknown[]) => mockChangeMemberRole(...args) };
});

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CareCircleScreen } from '../src/screens/CareCircleScreen';
import { CareCircleMember } from '../src/careCircle';

const organiser: CareCircleMember = {
  membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: [],
};
const marion: CareCircleMember = {
  membershipId: 'm-2', displayName: 'Marion', role: 'viewer', relationshipType: 'Other relative', isSelf: false, grantedDomains: ['general'],
};

const baseProps = {
  personName: 'Beauty',
  invitations: [],
  careSpaceId: 'space-1',
  onBack: jest.fn(),
  onRefresh: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('Care Circle: editing a member\'s role and permissions', () => {
  it('is never offered for the organiser -- their access is not a granted-domain question', async () => {
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser]} />);
    expect(screen.queryByText('Edit permissions')).toBeNull();
  });

  it('offers Edit permissions for a contributor/viewer, pre-filled with their current role and domains', async () => {
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, marion]} />);
    await fireEvent.press(screen.getByText('Edit permissions'));
    screen.getByText("Edit Marion's permissions");
    // Pre-filled: Marion is currently 'viewer' with 'general' granted.
    expect(screen.getByLabelText(/Everyday things, selected\. Grants access to:/)).toBeTruthy();
    expect(screen.getByLabelText('Care & health, not selected')).toBeTruthy();
  });

  it('saving calls the real changeMemberRole RPC with the edited role and domains, then refreshes', async () => {
    mockChangeMemberRole.mockResolvedValue({ ok: true, data: undefined });
    const onRefresh = jest.fn();
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, marion]} onRefresh={onRefresh} />);
    await fireEvent.press(screen.getByText('Edit permissions'));
    await fireEvent.press(screen.getByText('Contributor'));
    await fireEvent.press(screen.getByLabelText('Care & health, not selected'));
    await fireEvent.press(screen.getByText('Save changes'));
    expect(mockChangeMemberRole).toHaveBeenCalledWith({
      membershipId: 'm-2',
      role: 'contributor',
      grantedDomains: ['general', 'health'],
    });
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Edit Marion's permissions")).toBeNull();
  });

  it('Cancel discards the edit without calling changeMemberRole', async () => {
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, marion]} />);
    await fireEvent.press(screen.getByText('Edit permissions'));
    await fireEvent.press(screen.getByText('Cancel'));
    expect(mockChangeMemberRole).not.toHaveBeenCalled();
    expect(screen.queryByText("Edit Marion's permissions")).toBeNull();
  });

  it('a failed save shows the real error and keeps the form open', async () => {
    mockChangeMemberRole.mockResolvedValue({ ok: false, message: 'Could not reach the server. Please try again.' });
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, marion]} />);
    await fireEvent.press(screen.getByText('Edit permissions'));
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => screen.getByText(/Could not reach the server/));
    screen.getByText("Edit Marion's permissions");
  });
});
