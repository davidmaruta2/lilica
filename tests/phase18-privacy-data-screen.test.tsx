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
  leavableCareSpaces: [],
  removableCareSpaces: [],
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
    // Simulate the user pressing the destructive confirmation button, or
    // (for the post-deletion "Account deleted" acknowledgement, which has
    // no destructive button -- just a single OK) whichever button exists.
    const confirm = buttons?.find((button) => button.style === 'destructive') ?? buttons?.[0];
    confirm?.onPress?.();
  });
});

// Direct product-owner feedback: every section is now a collapsed-by-
// default accordion -- expand it before interacting with anything inside,
// exactly as a real user would tap the section header first.
async function expandSection(screen: Awaited<ReturnType<typeof render>>, title: string) {
  await fireEvent.press(screen.getByLabelText(`${title} section`));
}

describe('PrivacyDataScreen: sections start collapsed', () => {
  it('every section is collapsed until its own header is tapped', async () => {
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    expect(screen.queryByText(/Get a copy of everything/)).toBeNull();
    await expandSection(screen, 'Export your data');
    screen.getByText(/Get a copy of everything/);
  });
});

describe('PrivacyDataScreen: Export your data', () => {
  it('calls the real export function and lists each produced file with its own Share action', async () => {
    mockExportMyData.mockResolvedValue({
      ok: true,
      data: { files: [{ label: 'data.json', uri: 'file:///data.json' }, { label: 'Beauty / letter.pdf', uri: 'file:///letter.pdf' }], skippedDocuments: 0 },
    });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await expandSection(screen, 'Export your data');
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
    await expandSection(screen, 'Export your data');
    await fireEvent.press(screen.getAllByText('Export your data').slice(-1)[0]);
    await waitFor(() => screen.getByText(/2 documents couldn't be included/));
  });

  it('tapping Share on a produced file calls the real share function', async () => {
    mockExportMyData.mockResolvedValue({ ok: true, data: { files: [{ label: 'data.json', uri: 'file:///data.json' }], skippedDocuments: 0 } });
    mockShareExportFile.mockResolvedValue({ ok: true, data: undefined });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await expandSection(screen, 'Export your data');
    await fireEvent.press(screen.getAllByText('Export your data').slice(-1)[0]);
    await waitFor(() => screen.getByLabelText('Share data.json'));
    await fireEvent.press(screen.getByLabelText('Share data.json'));
    expect(mockShareExportFile).toHaveBeenCalledWith({ label: 'data.json', uri: 'file:///data.json' });
  });

  it('shows the real failure message, never a fake success', async () => {
    mockExportMyData.mockResolvedValue({ ok: false, message: 'You are offline.' });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await expandSection(screen, 'Export your data');
    await fireEvent.press(screen.getAllByText('Export your data').slice(-1)[0]);
    await waitFor(() => screen.getByText('You are offline.'));
  });
});

describe('PrivacyDataScreen: Clear data from this device', () => {
  it('requires confirmation before clearing anything', async () => {
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await expandSection(screen, 'Device & local data');
    await fireEvent.press(screen.getByLabelText('Clear data from this device'));
    expect(Alert.alert).toHaveBeenCalled();
    expect(baseProps.onClearLocalData).toHaveBeenCalledTimes(1); // via the mocked destructive confirm
  });

  it('warns about pending work before the confirmation is even shown', async () => {
    mockPendingLocalWork.mockResolvedValue({ hasPendingMutations: false, hasPendingUploads: true, hasPendingCleanup: false });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await expandSection(screen, 'Device & local data');
    await fireEvent.press(screen.getByLabelText('Clear data from this device'));
    const [, message] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(message).toMatch(/upload/);
  });
});

describe('PrivacyDataScreen: Leave care space', () => {
  it('is offered only when there is a leavable (non-organiser) care space', async () => {
    const screen = await render(<PrivacyDataScreen {...baseProps} leavableCareSpaces={[]} />);
    expect(screen.queryByLabelText('Care spaces section')).toBeNull();
    expect(screen.queryByLabelText('Leave Beauty')).toBeNull();
  });

  it('leaves via the real leaveCareSpace RPC after confirmation, then notifies the host', async () => {
    mockLeaveCareSpace.mockResolvedValue({ ok: true, data: undefined });
    const onCareSpaceLeft = jest.fn();
    const screen = await render(
      <PrivacyDataScreen {...baseProps} leavableCareSpaces={[{ careSpaceId: 'space-1', displayName: 'Beauty' }]} onCareSpaceLeft={onCareSpaceLeft} />,
    );
    await expandSection(screen, 'Care spaces');
    await fireEvent.press(screen.getByLabelText('Leave Beauty'));
    expect(mockLeaveCareSpace).toHaveBeenCalledWith('space-1');
    await waitFor(() => expect(onCareSpaceLeft).toHaveBeenCalledTimes(1));
  });

  // Direct product-owner report, 26 September 2026: "a contributor has no
  // way of leaving a care circle if they want to" -- this used to be
  // scoped to only the currently active care space. A contributor on
  // several care spaces now sees, and can leave, every one of them from
  // this one screen, the same fix already applied to removableCareSpaces.
  it('offers every leavable care space, not only one, and leaves the specific one tapped', async () => {
    mockLeaveCareSpace.mockResolvedValue({ ok: true, data: undefined });
    const screen = await render(
      <PrivacyDataScreen
        {...baseProps}
        leavableCareSpaces={[
          { careSpaceId: 'space-1', displayName: 'Beauty' },
          { careSpaceId: 'space-2', displayName: 'Marion' },
        ]}
      />,
    );
    await expandSection(screen, 'Care spaces');
    screen.getByLabelText('Leave Beauty');
    await fireEvent.press(screen.getByLabelText('Leave Marion'));
    expect(mockLeaveCareSpace).toHaveBeenCalledWith('space-2');
  });
});

describe('PrivacyDataScreen: Delete account as a sole organiser', () => {
  // Direct product-owner decision, 26 September 2026: being a sole
  // active organiser used to block deletion outright. It no longer does
  // -- it shows a clear warning naming the dependent care space(s) and
  // requires typing DELETE, rather than refusing the action.
  it('shows the organiser warning naming the care space, and disables confirmation until DELETE is typed', async () => {
    mockCheckAccountDeletionEligibility.mockResolvedValue({ ok: true, data: [{ careSpaceId: 'space-1', careSpaceName: 'Beauty' }] });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await expandSection(screen, 'Delete account');
    await fireEvent.press(screen.getByLabelText('Check if my account can be deleted'));
    await waitFor(() => screen.getByText(/organiser of Beauty/));
    screen.getByText(/closes this care circle/);
    screen.getByText(/permanent and cannot be reversed/);
    expect(screen.getByLabelText('Confirm account deletion')).toBeDisabled();
    expect(mockDeleteMyAccount).not.toHaveBeenCalled();
  });

  it('calls the real delete function once DELETE is typed and confirmed', async () => {
    mockCheckAccountDeletionEligibility.mockResolvedValue({ ok: true, data: [{ careSpaceId: 'space-1', careSpaceName: 'Beauty' }] });
    mockDeleteMyAccount.mockResolvedValue({ ok: true, data: undefined });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await expandSection(screen, 'Delete account');
    await fireEvent.press(screen.getByLabelText('Check if my account can be deleted'));
    await waitFor(() => screen.getByLabelText('Type DELETE to confirm account deletion'));
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm account deletion'), 'DELETE');
    await fireEvent.press(screen.getByLabelText('Confirm account deletion'));
    expect(mockDeleteMyAccount).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(baseProps.onAccountDeleted).toHaveBeenCalledTimes(1));
  });

  // Real-device report, 26 September 2026: after entering DELETE and
  // confirming, nothing visibly told the user the account was actually
  // gone -- onAccountDeleted() signs out and navigates away before any
  // on-screen text could be read. A real, blocking "Account deleted"
  // confirmation must appear and be acknowledged before sign-out proceeds.
  it('shows a blocking "Account deleted" confirmation, and only signs out once it is acknowledged', async () => {
    mockCheckAccountDeletionEligibility.mockResolvedValue({ ok: true, data: [{ careSpaceId: 'space-1', careSpaceName: 'Beauty' }] });
    mockDeleteMyAccount.mockResolvedValue({ ok: true, data: undefined });
    let acknowledge: (() => void) | undefined;
    (Alert.alert as jest.Mock).mockImplementation((title, message, buttons) => {
      if (title === 'Account deleted') {
        acknowledge = () => buttons?.[0]?.onPress?.();
        return;
      }
      const confirm = buttons?.find((button: { style?: string }) => button.style === 'destructive') ?? buttons?.[0];
      confirm?.onPress?.();
    });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await expandSection(screen, 'Delete account');
    await fireEvent.press(screen.getByLabelText('Check if my account can be deleted'));
    await waitFor(() => screen.getByLabelText('Type DELETE to confirm account deletion'));
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm account deletion'), 'DELETE');
    await fireEvent.press(screen.getByLabelText('Confirm account deletion'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
      'Account deleted',
      expect.stringMatching(/permanently deleted/i),
      expect.anything(),
      expect.objectContaining({ cancelable: false }),
    ));
    // Deletion succeeded server-side, but sign-out must NOT happen until
    // the confirmation is actually acknowledged.
    expect(baseProps.onAccountDeleted).not.toHaveBeenCalled();
    acknowledge?.();
    await waitFor(() => expect(baseProps.onAccountDeleted).toHaveBeenCalledTimes(1));
  });
});

describe('PrivacyDataScreen: Delete account (not a sole organiser)', () => {
  it('offers the real final confirmation once the precheck clears, and calls the real delete function only after confirming', async () => {
    mockCheckAccountDeletionEligibility.mockResolvedValue({ ok: true, data: [] });
    mockDeleteMyAccount.mockResolvedValue({ ok: true, data: undefined });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await expandSection(screen, 'Delete account');
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
    await expandSection(screen, 'Delete account');
    await fireEvent.press(screen.getByLabelText('Check if my account can be deleted'));
    await waitFor(() => screen.getByLabelText('Delete my account'));
    await fireEvent.press(screen.getByLabelText('Delete my account'));
    const [, message] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(message).toMatch(/does NOT automatically cancel/);
    expect(message).toMatch(/App Store or Google Play/);
  });

  it('a failed deletion shows the real error and never calls onAccountDeleted -- local data is never touched on failure', async () => {
    mockCheckAccountDeletionEligibility.mockResolvedValue({ ok: true, data: [] });
    mockDeleteMyAccount.mockResolvedValue({ ok: false, message: 'Could not reach the server. Please try again.' });
    const screen = await render(<PrivacyDataScreen {...baseProps} />);
    await expandSection(screen, 'Delete account');
    await fireEvent.press(screen.getByLabelText('Check if my account can be deleted'));
    await waitFor(() => screen.getByLabelText('Delete my account'));
    await fireEvent.press(screen.getByLabelText('Delete my account'));
    await waitFor(() => screen.getByText(/Could not reach the server/));
    expect(baseProps.onAccountDeleted).not.toHaveBeenCalled();
  });
});
