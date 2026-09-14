// Product-owner report (14 September 2026): removing a Care Circle
// member took effect immediately with no confirmation at all -- a real
// gap, since removal is immediate-effect (the removed member loses
// access right away) and isn't reversible from their own side. This
// proves the fix: Remove now opens a confirmation dialog, Cancel does
// nothing, and only confirming actually calls removeMember().
const mockRemoveMember = jest.fn();
jest.mock('../src/careCircle', () => {
  const actual = jest.requireActual('../src/careCircle');
  return { ...actual, removeMember: (...args: unknown[]) => mockRemoveMember(...args) };
});

import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { CareCircleScreen } from '../src/screens/CareCircleScreen';
import { CareCircleMember } from '../src/careCircle';

const organiser: CareCircleMember = {
  membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: [],
};
const marion: CareCircleMember = {
  membershipId: 'm-2', displayName: 'Marion', role: 'contributor', relationshipType: 'Other relative', isSelf: false, grantedDomains: ['general'],
};

const baseProps = {
  members: [organiser, marion],
  invitations: [],
  careSpaceId: 'space-1',
  onBack: jest.fn(),
  onRefresh: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('Care Circle: removing a member requires confirmation', () => {
  it('pressing Remove opens a confirmation dialog naming the member -- removeMember is NOT called yet', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<CareCircleScreen {...baseProps} />);
    await fireEvent.press(screen.getByText('Remove'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toContain('Marion');
    expect(mockRemoveMember).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('Cancel dismisses without calling removeMember', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<CareCircleScreen {...baseProps} />);
    await fireEvent.press(screen.getByText('Remove'));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const cancelButton = buttons.find((button) => button.text === 'Cancel');
    cancelButton?.onPress?.();
    expect(mockRemoveMember).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('confirming the destructive "Remove" button actually calls removeMember with the right membership id', async () => {
    mockRemoveMember.mockResolvedValue({ ok: true, data: undefined });
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<CareCircleScreen {...baseProps} />);
    await fireEvent.press(screen.getByText('Remove'));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; style?: string; onPress?: () => void }[];
    const removeButton = buttons.find((button) => button.text === 'Remove');
    expect(removeButton?.style).toBe('destructive');
    await removeButton?.onPress?.();
    expect(mockRemoveMember).toHaveBeenCalledWith('m-2');
    alertSpy.mockRestore();
  });
});
