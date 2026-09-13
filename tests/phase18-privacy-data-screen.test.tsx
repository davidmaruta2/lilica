// Phase 18/18B: PrivacyDataScreen -- every action calls a real function
// (never a fake toggle), and destructive actions require confirmation
// before anything happens.

const mockExportMyData = jest.fn();
const mockShareExportFile = jest.fn();
const mockCheckAccountDeletionEligibility = jest.fn();
const mockDeleteMyAccount = jest.fn();
jest.mock('../src/accountLifecycle', () => ({
  exportMyData: (...args: unknown[]) => mockExportMyData(...args),
  shareExportFile: (...args: unknown[]) => mockShareExportFile(...args),
  checkAccountDeletionEligibility: (...args: unknown[]) => mockCheckAccountDeletionEligibility(...args),
  deleteMyAccount: (...args: unknown[]) => mockDeleteMyAccount(...args),
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
  onAccountDeleted: jest.fn().mockResolvedValue(undefined),
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
  it('calls the real export function and lists each produced file with its own Share action', async () => {
    mockExportMyData.mockResolvedValue({
      ok: true,
      data: { files: [{ label: 'data.json', uri: 'file:///data.json' }, { label: 'Beauty / letter.pdf', uri: 'file:///letter.pdf' }], skippedDocuments: 0 },
    });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await fireEvent.press(screen.getAllByText('Export your data').slice(-1)[0]);
    expect(mockExportMyData).toHaveBeenCalledTimes(1);
    await waitFor(() => screen.getByText(/prepared/));
    screen.getByLabelText('Share data.json');
    screen.getByLabelText('Share Beauty / letter.pdf');
  });

  it('names how many documents were skipped, without hiding the ones that succeeded', async () => {
    mockExportMyData.mockResolvedValue({
      ok: true,
      data: { files: [{ label: 'data.json', uri: 'file:///data.json' }], skippedDocuments: 2 },
    });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await fireEvent.press(screen.getAllByText('Export your data').slice(-1)[0]);
    await waitFor(() => screen.getByText(/2 documents couldn't be included/));
  });

  it('tapping Share on a produced file calls the real share function', async () => {
    mockExportMyData.mockResolvedValue({ ok: true, data: { files: [{ label: 'data.json', uri: 'file:///data.json' }], skippedDocuments: 0 } });
    mockShareExportFile.mockResolvedValue({ ok: true, data: undefined });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await fireEvent.press(screen.getAllByText('Export your data').slice(-1)[0]);
    await waitFor(() => screen.getByLabelText('Share data.json'));
    await fireEvent.press(screen.getByLabelText('Share data.json'));
    expect(mockShareExportFile).toHaveBeenCalledWith({ label: 'data.json', uri: 'file:///data.json' });
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
  it('shows exactly which care space blocks deletion, and never offers the real deletion button while blocked', async () => {
    mockCheckAccountDeletionEligibility.mockResolvedValue({ ok: true, data: [{ careSpaceId: 'space-1', careSpaceName: 'Beauty' }] });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await fireEvent.press(screen.getByLabelText('Check if my account can be deleted'));
    await waitFor(() => screen.getByText(/Beauty/));
    expect(screen.queryByLabelText('Delete my account')).toBeNull();
    expect(mockDeleteMyAccount).not.toHaveBeenCalled();
  });

  it('offers the real final confirmation once the precheck clears, and calls the real delete function only after confirming', async () => {
    mockCheckAccountDeletionEligibility.mockResolvedValue({ ok: true, data: [] });
    mockDeleteMyAccount.mockResolvedValue({ ok: true, data: undefined });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await fireEvent.press(screen.getByLabelText('Check if my account can be deleted'));
    await waitFor(() => screen.getByLabelText('Delete my account'));
    await fireEvent.press(screen.getByLabelText('Delete my account'));
    expect(Alert.alert).toHaveBeenCalled();
    expect(mockDeleteMyAccount).toHaveBeenCalledTimes(1); // via the mocked destructive confirm
    await waitFor(() => expect(baseProps.onAccountDeleted).toHaveBeenCalledTimes(1));
  });

  it('Phase 21B: discloses that account deletion does not cancel an App Store/Google Play subscription', async () => {
    mockCheckAccountDeletionEligibility.mockResolvedValue({ ok: true, data: [] });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await fireEvent.press(screen.getByLabelText('Check if my account can be deleted'));
    await waitFor(() => screen.getByLabelText('Delete my account'));
    await fireEvent.press(screen.getByLabelText('Delete my account'));
    const [, message] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(message).toMatch(/does NOT automatically cancel/);
    expect(message).toMatch(/App Store or Google Play/);
  });

  it('a failed deletion shows the real error and never calls onAccountDeleted -- local data is never touched on failure', async () => {
    mockCheckAccountDeletionEligibility.mockResolvedValue({ ok: true, data: [] });
    mockDeleteMyAccount.mockResolvedValue({ ok: false, message: 'Cannot delete account: Beauty still depends on you as its only organiser.' });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await fireEvent.press(screen.getByLabelText('Check if my account can be deleted'));
    await waitFor(() => screen.getByLabelText('Delete my account'));
    await fireEvent.press(screen.getByLabelText('Delete my account'));
    await waitFor(() => screen.getByText(/still depends on you/));
    expect(baseProps.onAccountDeleted).not.toHaveBeenCalled();
  });
});
