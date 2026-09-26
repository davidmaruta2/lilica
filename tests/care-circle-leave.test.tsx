// Direct product-owner request, 26 September 2026: "all key care circle
// actions in one place" -- a contributor/viewer can now leave the
// currently-open Care Circle directly from this screen (previously only
// reachable via Privacy & data's separate, comprehensive all-circles
// list, which still exists unchanged for leaving a DIFFERENT circle).
// Mirrors care-circle-remove-member-confirm.test.tsx's own established
// pattern for a real, confirmed destructive action.
const mockLeaveCareSpace = jest.fn();
jest.mock('../src/careCircle', () => {
  const actual = jest.requireActual('../src/careCircle');
  return { ...actual, leaveCareSpace: (...args: unknown[]) => mockLeaveCareSpace(...args) };
});

import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CareCircleScreen } from '../src/screens/CareCircleScreen';
import { CareCircleMember } from '../src/careCircle';

const organiser: CareCircleMember = {
  membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: [],
};
const selfAsContributor: CareCircleMember = {
  membershipId: 'm-2', displayName: 'Marion', role: 'contributor', relationshipType: 'Other relative', isSelf: true, grantedDomains: ['general'],
};

const baseProps = {
  personName: 'Beauty',
  invitations: [],
  careSpaceId: 'space-1',
  onBack: jest.fn(),
  onRefresh: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('Care Circle: leaving this circle', () => {
  it('is never offered to the organiser -- Manage this person\'s care is their own equivalent action', async () => {
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser]} onLeaveCareSpace={jest.fn()} />);
    expect(screen.queryByText(/Leave Beauty/)).toBeNull();
  });

  it('is never offered when the caller omits onLeaveCareSpace, even for a contributor -- never a dead affordance', async () => {
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, selfAsContributor]} />);
    expect(screen.queryByText(/Leave Beauty/)).toBeNull();
  });

  it('a contributor sees a confirmation naming the person before anything happens', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, selfAsContributor]} onLeaveCareSpace={jest.fn()} />);
    await fireEvent.press(screen.getByText('Leave Beauty'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toContain('Beauty');
    expect(mockLeaveCareSpace).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('Cancel dismisses without calling leaveCareSpace', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, selfAsContributor]} onLeaveCareSpace={jest.fn()} />);
    await fireEvent.press(screen.getByText('Leave Beauty'));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((button) => button.text === 'Cancel')?.onPress?.();
    expect(mockLeaveCareSpace).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('confirming actually calls the real leaveCareSpace RPC, then notifies the host only once it succeeds', async () => {
    mockLeaveCareSpace.mockResolvedValue({ ok: true, data: undefined });
    const onLeaveCareSpace = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, selfAsContributor]} onLeaveCareSpace={onLeaveCareSpace} />);
    await fireEvent.press(screen.getByText('Leave Beauty'));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; style?: string; onPress?: () => void }[];
    const leaveButton = buttons.find((button) => button.text === 'Leave');
    expect(leaveButton?.style).toBe('destructive');
    await leaveButton?.onPress?.();
    expect(mockLeaveCareSpace).toHaveBeenCalledWith('space-1');
    await waitFor(() => expect(onLeaveCareSpace).toHaveBeenCalledTimes(1));
    alertSpy.mockRestore();
  });

  it('a failed leave shows the real error and never calls the host callback', async () => {
    mockLeaveCareSpace.mockResolvedValue({ ok: false, message: 'Could not reach the server. Please try again.' });
    const onLeaveCareSpace = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<CareCircleScreen {...baseProps} members={[organiser, selfAsContributor]} onLeaveCareSpace={onLeaveCareSpace} />);
    await fireEvent.press(screen.getByText('Leave Beauty'));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await buttons.find((button) => button.text === 'Leave')?.onPress?.();
    await waitFor(() => screen.getByText(/Could not reach the server/));
    expect(onLeaveCareSpace).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
