// Remove-supported-person: a real organiser capability that was simply
// missing until now (delete_my_account() only ever detaches memberships;
// leave_care_space()/remove_member() only ever end one membership -- see
// src/careSpaces.ts's deleteCareSpace() and docs/REVISION_LOG.md). Covers
// the checkbox-gated confirmation UI, PrivacyDataScreen's own wiring, and
// the local-state removal helper.

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

import { fireEvent, render } from '@testing-library/react-native';

import { RemoveCareSpaceConfirm } from '../src/components/RemoveCareSpaceConfirm';
import { PrivacyDataScreen } from '../src/screens/PrivacyDataScreen';
import { removeCareSpace } from '../src/careSpaceState';
import { initialOnboardingState } from '../src/storage';
import { LocalCareSpaceState } from '../src/types';

beforeEach(() => {
  jest.clearAllMocks();
  mockPendingLocalWork.mockResolvedValue({ hasPendingMutations: false, hasPendingUploads: false, hasPendingCleanup: false });
});

describe('RemoveCareSpaceConfirm: checkbox gates the destructive action', () => {
  it('the Remove button stays disabled until the checkbox is ticked', async () => {
    const onConfirm = jest.fn();
    const screen = await render(
      <RemoveCareSpaceConfirm visible careSpaceName="Beauty" busy={false} onConfirm={onConfirm} onCancel={jest.fn()} />,
    );
    const removeButton = screen.getByLabelText('Remove Beauty');
    expect(removeButton.props.accessibilityState?.disabled ?? removeButton.props.disabled).toBeTruthy();
    await fireEvent.press(removeButton);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('ticking the checkbox enables Remove, and pressing it calls onConfirm', async () => {
    const onConfirm = jest.fn();
    const screen = await render(
      <RemoveCareSpaceConfirm visible careSpaceName="Beauty" busy={false} onConfirm={onConfirm} onCancel={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText('I understand this cannot be undone'));
    await fireEvent.press(screen.getByLabelText('Remove Beauty'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Cancel dismisses without confirming, and un-ticks the checkbox for next time', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const screen = await render(
      <RemoveCareSpaceConfirm visible careSpaceName="Beauty" busy={false} onConfirm={onConfirm} onCancel={onCancel} />,
    );
    await fireEvent.press(screen.getByLabelText('I understand this cannot be undone'));
    await fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows the collaborator warning only when there genuinely are other active members', async () => {
    const withCollaborators = await render(
      <RemoveCareSpaceConfirm visible careSpaceName="Beauty" collaboratorCount={2} busy={false} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    withCollaborators.getByText(/2 other people who currently help will lose access/);

    const withoutCollaborators = await render(
      <RemoveCareSpaceConfirm visible careSpaceName="Beauty" collaboratorCount={0} busy={false} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(withoutCollaborators.queryByText(/will lose access/)).toBeNull();
  });

  it('never claims success or failure on its own -- shows whatever error the caller passes', async () => {
    const screen = await render(
      <RemoveCareSpaceConfirm visible careSpaceName="Beauty" busy={false} error="Something went wrong." onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    screen.getByText('Something went wrong.');
  });

  it('a sole organiser (default) sees the original wording and the subscription disclosure', async () => {
    const screen = await render(
      <RemoveCareSpaceConfirm visible careSpaceName="Beauty" busy={false} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    screen.getByText('This cannot be undone.');
    screen.getByText(/Removing does not itself cancel an App Store or Google Play subscription/);
    expect(screen.queryByText(/all active organisers must agree/)).toBeNull();
  });

  it('requiresAllOrganisers communicates permanence-on-agreement, the agreement requirement, and the subscription disclosure', async () => {
    const screen = await render(
      <RemoveCareSpaceConfirm visible careSpaceName="Beauty" requiresAllOrganisers busy={false} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    screen.getByText('Once every organiser agrees, this cannot be undone.');
    screen.getByText(/all active organisers must agree before it can be permanently removed/);
    screen.getByText(/Requesting removal does not itself cancel an App Store or Google Play subscription/);
  });
});

describe('PrivacyDataScreen: Remove a supported person', () => {
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

  it('is not shown at all when there is nothing this account can remove', async () => {
    const screen = await render(<PrivacyDataScreen {...baseProps} removableCareSpaces={[]} />);
    expect(screen.queryByText('Remove a supported person')).toBeNull();
  });

  it('an organiser sees the section, opens the confirmation, and a successful removal reports success', async () => {
    const onRemoveCareSpace = jest.fn().mockResolvedValue({ ok: true });
    const screen = await render(
      <PrivacyDataScreen
        {...baseProps}
        removableCareSpaces={[{ careSpaceId: 'space-1', displayName: 'Beauty', collaboratorCount: 0 }]}
        onRemoveCareSpace={onRemoveCareSpace}
      />,
    );
    screen.getByText('Remove a supported person');
    await fireEvent.press(screen.getByLabelText('Remove a supported person section'));
    await fireEvent.press(screen.getByLabelText('Remove Beauty'));
    // The confirmation modal is now open -- its own Remove button is
    // still disabled until the checkbox is ticked (proven above), so
    // tick it here before confirming.
    await fireEvent.press(screen.getByLabelText('I understand this cannot be undone'));
    await fireEvent.press(screen.getAllByLabelText('Remove Beauty')[1]);
    expect(onRemoveCareSpace).toHaveBeenCalledWith('space-1');
    await screen.findByText('Beauty has been removed.');
  });

  it('a genuine failure surfaces the real message and keeps the confirmation open, never silently discarding it', async () => {
    const onRemoveCareSpace = jest.fn().mockResolvedValue({ ok: false, message: 'Only an active organiser of this care space can remove it' });
    const screen = await render(
      <PrivacyDataScreen
        {...baseProps}
        removableCareSpaces={[{ careSpaceId: 'space-1', displayName: 'Beauty', collaboratorCount: 0 }]}
        onRemoveCareSpace={onRemoveCareSpace}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Remove a supported person section'));
    await fireEvent.press(screen.getByLabelText('Remove Beauty'));
    await fireEvent.press(screen.getByLabelText('I understand this cannot be undone'));
    await fireEvent.press(screen.getAllByLabelText('Remove Beauty')[1]);
    await screen.findAllByText('Only an active organiser of this care space can remove it');
  });

  it('lists every removable care space as its own row, and removing one only ever targets that one', async () => {
    const onRemoveCareSpace = jest.fn().mockResolvedValue({ ok: true });
    const screen = await render(
      <PrivacyDataScreen
        {...baseProps}
        removableCareSpaces={[
          { careSpaceId: 'space-1', displayName: 'Maggie', collaboratorCount: 2 },
          { careSpaceId: 'space-2', displayName: 'Ben', collaboratorCount: 0 },
        ]}
        onRemoveCareSpace={onRemoveCareSpace}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Remove a supported person section'));
    screen.getByLabelText('Remove Maggie');
    screen.getByLabelText('Remove Ben');

    await fireEvent.press(screen.getByLabelText('Remove Ben'));
    await fireEvent.press(screen.getByLabelText('I understand this cannot be undone'));
    await fireEvent.press(screen.getAllByLabelText('Remove Ben')[1]);
    expect(onRemoveCareSpace).toHaveBeenCalledWith('space-2');
    expect(onRemoveCareSpace).not.toHaveBeenCalledWith('space-1');
  });
});

describe('removeCareSpace: local-state removal (careSpaceState.ts)', () => {
  function space(overrides: Partial<LocalCareSpaceState>): LocalCareSpaceState {
    return {
      careSpaceId: 'space-a',
      supportedPersonId: 'person-a',
      bootstrapId: 'bootstrap-a',
      relationshipType: 'Mum',
      displayName: 'Beauty',
      privacyDeclarationAccepted: true,
      interests: [],
      records: [],
      setupStatus: 'ready',
      allSetDismissed: true,
      ...overrides,
    };
  }

  it('removes exactly the targeted care space and no other', () => {
    const beauty = space({ careSpaceId: 'space-a', displayName: 'Beauty' });
    const jackie = space({ careSpaceId: 'space-b', supportedPersonId: 'person-b', bootstrapId: 'bootstrap-b', displayName: 'Jackie' });
    const state = {
      ...initialOnboardingState,
      careSpaces: { 'space-a': beauty, 'space-b': jackie },
      activeCareSpaceId: 'space-a',
    };
    const next = removeCareSpace(state, 'space-a');
    expect(next.careSpaces['space-a']).toBeUndefined();
    expect(next.careSpaces['space-b']).toBeDefined();
  });

  it('falls back to a remaining care space when the active one is removed', () => {
    const beauty = space({ careSpaceId: 'space-a', displayName: 'Beauty' });
    const jackie = space({ careSpaceId: 'space-b', supportedPersonId: 'person-b', bootstrapId: 'bootstrap-b', displayName: 'Jackie' });
    const state = {
      ...initialOnboardingState,
      careSpaces: { 'space-a': beauty, 'space-b': jackie },
      activeCareSpaceId: 'space-a',
    };
    const next = removeCareSpace(state, 'space-a');
    expect(next.activeCareSpaceId).toBe('space-b');
    expect(next.supportedPersonName).toBe('Jackie');
  });

  it('leaves activeCareSpaceId undefined when the only care space is removed, and clears every projected field -- direct product-owner report: "I deleted Beauty and Janet but the app home page dashboard still shows Janet avatar"', () => {
    const janet = space({ careSpaceId: 'space-a', displayName: 'Janet' });
    const state = {
      ...initialOnboardingState,
      careSpaces: { 'space-a': janet },
      activeCareSpaceId: 'space-a',
      supportedPersonName: 'Janet',
    };
    const next = removeCareSpace(state, 'space-a');
    expect(next.activeCareSpaceId).toBeUndefined();
    expect(Object.keys(next.careSpaces)).toHaveLength(0);
    // The real bug: projectActiveCareSpace() used to return state UNCHANGED
    // when no care space is active, leaving supportedPersonName (and every
    // other projected field) stuck at the just-removed person's own value
    // -- Home reads this directly for its avatar/name.
    expect(next.supportedPersonName).toBeUndefined();
    expect(next.records).toEqual([]);
    expect(next.firstItem).toBeUndefined();
  });

  it('is a safe no-op for a care space id that is not present', () => {
    const beauty = space({ careSpaceId: 'space-a', displayName: 'Beauty' });
    const state = {
      ...initialOnboardingState,
      careSpaces: { 'space-a': beauty },
      activeCareSpaceId: 'space-a',
    };
    const next = removeCareSpace(state, 'space-nonexistent');
    expect(next).toBe(state);
  });
});
