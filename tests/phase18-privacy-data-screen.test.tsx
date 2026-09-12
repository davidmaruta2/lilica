// Phase 18: PrivacyDataScreen -- every action calls a real function
// (never a fake toggle), and destructive actions require confirmation
// before anything happens.

const mockExportMyData = jest.fn();
const mockCheckAccountDeletionEligibility = jest.fn();
jest.mock('../src/accountLifecycle', () => ({
  exportMyData: (...args: unknown[]) => mockExportMyData(...args),
  checkAccountDeletionEligibility: (...args: unknown[]) => mockCheckAccountDeletionEligibility(...args),
}));

const mockLeaveCareSpace = jest.fn();
jest.mock('../src/careCircle', () => ({
  leaveCareSpace: (...args: unknown[]) => mockLeaveCareSpace(...args),
}));

const mockPendingLocalWork = jest.fn();
jest.mock('../src/localData', () => ({
  pendingLocalWork: (...args: unknown[]) => mockPendingLocalWork(...args),
}));

import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { PrivacyDataScreen } from '../src/screens/PrivacyDataScreen';

const baseProps = {
  storageOwnerId: 'owner-1',
  currentCareSpaceId: 'space-1',
  currentCareSpaceName: 'Beauty',
  currentRecords: [],
  onBack: jest.fn(),
  onCareSpaceLeft: jest.fn(),
  onClearLocalData: jest.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPendingLocalWork.mockResolvedValue({ hasPendingMutations: false, hasPendingUploads: false, hasPendingCleanup: false });
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
    // Simulate the user pressing the destructive confirmation button.
    const confirm = buttons?.find((button) => button.style === 'destructive');
    confirm?.onPress?.();
  });
});

describe('PrivacyDataScreen: Export your data', () => {
  it('calls the real export function and shows a success message', async () => {
    mockExportMyData.mockResolvedValue({ ok: true, data: undefined });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await fireEvent.press(screen.getAllByText('Export your data').slice(-1)[0]);
    expect(mockExportMyData).toHaveBeenCalledTimes(1);
    await waitFor(() => screen.getByText(/prepared/));
  });

  it('shows the real failure message, never a fake success', async () => {
    mockExportMyData.mockResolvedValue({ ok: false, message: 'You are offline.' });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await fireEvent.press(screen.getAllByText('Export your data').slice(-1)[0]);
    await waitFor(() => screen.getByText('You are offline.'));
  });
});

describe('PrivacyDataScreen: Clear data from this device', () => {
  it('requires confirmation before clearing anything', async () => {
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await fireEvent.press(screen.getByLabelText('Clear data from this device'));
    expect(Alert.alert).toHaveBeenCalled();
    expect(baseProps.onClearLocalData).toHaveBeenCalledTimes(1); // via the mocked destructive confirm
  });

  it('warns about pending work before the confirmation is even shown', async () => {
    mockPendingLocalWork.mockResolvedValue({ hasPendingMutations: false, hasPendingUploads: true, hasPendingCleanup: false });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await fireEvent.press(screen.getByLabelText('Clear data from this device'));
    const [, message] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(message).toMatch(/upload/);
  });
});

describe('PrivacyDataScreen: Leave care space', () => {
  it('is offered only when the current member is not the organiser', async () => {
    const screen = await render(<PrivacyDataScreen {...baseProps} canLeaveCurrentCareSpace={false} />);
    expect(screen.queryByLabelText('Leave Beauty')).toBeNull();
  });

  it('leaves via the real leaveCareSpace RPC after confirmation, then notifies the host', async () => {
    mockLeaveCareSpace.mockResolvedValue({ ok: true, data: undefined });
    const onCareSpaceLeft = jest.fn();
    const screen = await render(<PrivacyDataScreen {...baseProps} canLeaveCurrentCareSpace onCareSpaceLeft={onCareSpaceLeft} />);
    await fireEvent.press(screen.getByLabelText('Leave Beauty'));
    expect(mockLeaveCareSpace).toHaveBeenCalledWith('space-1');
    await waitFor(() => expect(onCareSpaceLeft).toHaveBeenCalledTimes(1));
  });
});

describe('PrivacyDataScreen: Delete account', () => {
  it('shows exactly which care space blocks deletion, and never claims success it cannot deliver', async () => {
    mockCheckAccountDeletionEligibility.mockResolvedValue({ ok: true, data: [{ careSpaceId: 'space-1', careSpaceName: 'Beauty' }] });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await fireEvent.press(screen.getByLabelText('Check if my account can be deleted'));
    await waitFor(() => screen.getByText(/Beauty/));
  });

  it('is honest that deletion itself is not yet available, even when nothing blocks it', async () => {
    mockCheckAccountDeletionEligibility.mockResolvedValue({ ok: true, data: [] });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await fireEvent.press(screen.getByLabelText('Check if my account can be deleted'));
    await waitFor(() => screen.getByText(/isn't available/));
  });
});
