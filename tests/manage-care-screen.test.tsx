// Phase 20D, Part C: "Manage [Name]'s care" -- the one consolidated
// destination for infrequent care-space administration. Dangerous-action
// hierarchy (brief section 26): status/handoff first, Archive/Restore
// next, permanent removal last, its own visually-separated danger area.
import { fireEvent, render } from '@testing-library/react-native';

import { ManageCareScreen } from '../src/screens/ManageCareScreen';

const organiser = (id: string, name: string, isSelf = false) => ({
  membershipId: id,
  displayName: name,
  role: 'organiser' as const,
  relationshipType: 'Other relative' as const,
  isSelf,
  grantedDomains: [],
});
const contributor = (id: string, name: string) => ({
  membershipId: id,
  displayName: name,
  role: 'contributor' as const,
  relationshipType: 'Other relative' as const,
  isSelf: false,
  grantedDomains: [],
});

const baseProps = {
  careSpaceId: 'space-1',
  personName: 'Maggie',
  status: 'active' as const,
  members: [organiser('m-self', 'David', true)],
  selfMembershipId: 'm-self',
  onBack: jest.fn(),
  onOpenCareCircle: jest.fn(),
  onArchive: jest.fn().mockResolvedValue({ ok: true }),
  onRestore: jest.fn().mockResolvedValue({ ok: true }),
  onPromote: jest.fn().mockResolvedValue({ ok: true }),
  onRemove: jest.fn().mockResolvedValue({ ok: true }),
  onRequestDeletion: jest.fn().mockResolvedValue({ ok: true }),
  onApproveDeletion: jest.fn().mockResolvedValue({ ok: true }),
  onDeclineDeletion: jest.fn().mockResolvedValue({ ok: true }),
  onCancelDeletion: jest.fn().mockResolvedValue({ ok: true }),
  onRefreshDeletionStatus: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('ManageCareScreen: care status / Archive / Restore', () => {
  it('an active care space offers Archive, and calls the real handler', async () => {
    const screen = await render(<ManageCareScreen {...baseProps} />);
    screen.getByText("Maggie's care is active.");
    await fireEvent.press(screen.getByText("Archive Maggie's care"));
    expect(baseProps.onArchive).toHaveBeenCalledTimes(1);
  });

  it('an archived care space offers Restore instead, with its own copy', async () => {
    const screen = await render(<ManageCareScreen {...baseProps} status="archived" />);
    screen.getByText(/is archived. Everything is preserved/);
    await fireEvent.press(screen.getByText("Restore Maggie's care"));
    expect(baseProps.onRestore).toHaveBeenCalledTimes(1);
  });
});

describe('ManageCareScreen: organiser handoff', () => {
  it('names the sole-organiser state when there is only one', async () => {
    const screen = await render(<ManageCareScreen {...baseProps} />);
    screen.getByText("You're currently the only organiser.");
  });

  it('offers "Make organiser" for every eligible active non-organiser member, and calls the real handler', async () => {
    const members = [organiser('m-self', 'David', true), contributor('m-marion', 'Marion')];
    const screen = await render(<ManageCareScreen {...baseProps} members={members} />);
    await fireEvent.press(screen.getByLabelText('Make Marion an organiser'));
    expect(baseProps.onPromote).toHaveBeenCalledWith('m-marion');
  });

  it('never offers to promote the caller themselves', async () => {
    const members = [organiser('m-self', 'David', true)];
    const screen = await render(<ManageCareScreen {...baseProps} members={members} />);
    expect(screen.queryByLabelText('Make David an organiser')).toBeNull();
  });
});

describe('ManageCareScreen: permanent removal -- dangerous-action hierarchy', () => {
  it('a sole organiser sees the direct Remove action (existing checkbox confirmation, unchanged) -- (E) existing sole-organiser behaviour is unchanged', async () => {
    const screen = await render(<ManageCareScreen {...baseProps} />);
    screen.getByLabelText('Remove Maggie');
    await fireEvent.press(screen.getByLabelText('Remove Maggie'));
    screen.getByText('This cannot be undone.');
    screen.getByText(/Removing does not itself cancel an App Store or Google Play subscription/);
    await fireEvent.press(screen.getByLabelText('I understand this cannot be undone'));
    await fireEvent.press(screen.getAllByLabelText('Remove Maggie')[1]);
    expect(baseProps.onRemove).toHaveBeenCalledTimes(1);
  });

  it('with multiple organisers and no pending request, confirming opens a REQUEST instead of an immediate delete -- (A/B/C) the request confirmation communicates permanence, agreement, and the subscription disclosure', async () => {
    const members = [organiser('m-self', 'David', true), organiser('m-marion', 'Marion')];
    const screen = await render(<ManageCareScreen {...baseProps} members={members} />);
    await fireEvent.press(screen.getByLabelText('Remove Maggie'));
    // (A) permanent removal
    screen.getByText('Once every organiser agrees, this cannot be undone.');
    // (B) all organisers must agree
    screen.getByText(/all active organisers must agree before it can be permanently removed/);
    // (C) does not itself cancel the relevant app-store subscription
    screen.getByText(/Requesting removal does not itself cancel an App Store or Google Play subscription/);
    await fireEvent.press(screen.getByLabelText('I understand this cannot be undone'));
    await fireEvent.press(screen.getAllByLabelText('Remove Maggie')[1]);
    expect(baseProps.onRequestDeletion).toHaveBeenCalledTimes(1);
    expect(baseProps.onRemove).not.toHaveBeenCalled();
  });

  it('shows a calm "waiting for N organiser(s)" status while a request is pending', async () => {
    const members = [organiser('m-self', 'David', true), organiser('m-marion', 'Marion')];
    const deletionStatus = {
      requestId: 'req-1',
      requestedByMembershipId: 'm-self',
      createdAt: '2026-09-15T00:00:00Z',
      organiserCount: 2,
      approvedCount: 1,
      approvedMembershipIds: ['m-self'],
    };
    const screen = await render(<ManageCareScreen {...baseProps} members={members} deletionStatus={deletionStatus} />);
    screen.getByText('Waiting for 1 more organiser');
  });

  it('the requester sees Cancel; a different organiser sees Approve/Decline', async () => {
    const members = [organiser('m-self', 'David', true), organiser('m-marion', 'Marion')];
    const deletionStatus = {
      requestId: 'req-1',
      requestedByMembershipId: 'm-marion',
      createdAt: '2026-09-15T00:00:00Z',
      organiserCount: 2,
      approvedCount: 1,
      approvedMembershipIds: ['m-marion'],
    };
    const screen = await render(<ManageCareScreen {...baseProps} members={members} deletionStatus={deletionStatus} />);
    screen.getByText('Approve permanent removal');
    screen.getByText('Decline');
    expect(screen.queryByText('Cancel this request')).toBeNull();
    // (D) the approval UI clearly identifies the operation as permanent,
    // and includes the subscription disclosure since it naturally belongs
    // here too.
    screen.getByText(/Approving is permanent once every organiser agrees, and does not itself cancel an App Store or Google Play subscription/);

    await fireEvent.press(screen.getByText('Approve permanent removal'));
    expect(baseProps.onApproveDeletion).toHaveBeenCalledTimes(1);
  });

  it('a requester never sees the approval-specific permanence copy meant for the OTHER organiser (they already saw the fuller request confirmation)', async () => {
    const members = [organiser('m-self', 'David', true), organiser('m-marion', 'Marion')];
    const deletionStatus = {
      requestId: 'req-1',
      requestedByMembershipId: 'm-self',
      createdAt: '2026-09-15T00:00:00Z',
      organiserCount: 2,
      approvedCount: 1,
      approvedMembershipIds: ['m-self'],
    };
    const screen = await render(<ManageCareScreen {...baseProps} members={members} deletionStatus={deletionStatus} />);
    expect(screen.queryByText(/Approving is permanent/)).toBeNull();
  });

  it('refreshes deletion status on mount', async () => {
    await render(<ManageCareScreen {...baseProps} />);
    expect(baseProps.onRefreshDeletionStatus).toHaveBeenCalled();
  });

  it('links to Care Circle rather than duplicating it', async () => {
    const screen = await render(<ManageCareScreen {...baseProps} />);
    await fireEvent.press(screen.getByText('Manage Care Circle'));
    expect(baseProps.onOpenCareCircle).toHaveBeenCalledTimes(1);
  });
});
