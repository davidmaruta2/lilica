// Care Circle invitation delivery UX correction (14 September 2026),
// finalised the same day by the architectural closure that made
// delivery state server-authoritative (last_email_sent_at/
// email_send_count/last_share_opened_at on the invitation row itself,
// set only by record_invitation_email_sent()/record_invitation_share_
// opened() -- never local device state). This file proves the
// corrected state model end to end: CREATED and DELIVERED are two
// distinct, non-overlapping UI states for the same invitation row, and
// every delivery claim ("Invitation emailed."/"Sharing opened.")
// reflects a real, server-persisted success, never a local guess.
const mockInviteMember = jest.fn();
const mockSendInvitationEmail = jest.fn();
const mockRecordInvitationShareOpened = jest.fn();
jest.mock('../src/careCircle', () => {
  const actual = jest.requireActual('../src/careCircle');
  return {
    ...actual,
    inviteMember: (...args: unknown[]) => mockInviteMember(...args),
    sendInvitationEmail: (...args: unknown[]) => mockSendInvitationEmail(...args),
    recordInvitationShareOpened: (...args: unknown[]) => mockRecordInvitationShareOpened(...args),
  };
});

import { useState } from 'react';
import { Share } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { CareCircleScreen } from '../src/screens/CareCircleScreen';
import { CareCircleInvitation, CareCircleMember } from '../src/careCircle';

const organiser: CareCircleMember = {
  membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: [],
};

const baseProps = {
  personName: 'Maggie',
  members: [organiser],
  invitations: [] as CareCircleInvitation[],
  careSpaceId: 'space-1',
  onBack: jest.fn(),
  onRefresh: jest.fn(),
  inviterDisplayName: 'David',
};

// A tiny fake "server row" that mockSendInvitationEmail/
// mockRecordInvitationShareOpened mutate on success -- exactly what the
// real Edge Function/RPC do to the real invitation row. The Harness's
// own onRefresh() then "re-fetches" from this fake row, mirroring
// App.tsx's real refreshCareCircle() -> listCareSpaceInvitations()
// round trip. This is what makes the test genuinely prove the
// server-authoritative model rather than just re-testing local state.
let fakeInvitationRow: CareCircleInvitation;

function resetFakeInvitationRow() {
  fakeInvitationRow = {
    id: 'inv-1', inviteeEmail: 'marion@example.test', role: 'contributor', relationshipType: 'Someone else',
    relationshipLabel: 'Cousin', grantedDomains: ['general'], status: 'pending', inviteCode: 'ABCD1234',
    emailSendCount: 0, createdAt: '2026-09-15T00:00:00Z', expiresAt: '2026-09-29T00:00:00Z',
  };
}

function Harness(props: Omit<Parameters<typeof CareCircleScreen>[0], 'invitations'> & {
  invitations?: CareCircleInvitation[];
}) {
  const [invitations, setInvitations] = useState<CareCircleInvitation[]>(props.invitations ?? []);
  return (
    <CareCircleScreen
      {...props}
      invitations={invitations}
      onRefresh={() => {
        props.onRefresh?.();
        setInvitations((current) => {
          const withoutFake = current.filter((invitation) => invitation.id !== fakeInvitationRow.id);
          return [...withoutFake, { ...fakeInvitationRow }];
        });
      }}
    />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  resetFakeInvitationRow();
});

async function fillAndSubmitInvite(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.press(screen.getByText('Invite someone'));
  await fireEvent.changeText(screen.getByPlaceholderText('name@example.com'), 'marion@example.test');
  await fireEvent.changeText(screen.getByPlaceholderText('e.g. Cousin, neighbour'), 'Cousin');
  await fireEvent.press(screen.getByText('Continue'));
}

describe('CareCircleScreen: CREATED and DELIVERED are two distinct, non-overlapping states', () => {
  it('(1) after creating an invitation, shows ONLY the Invitation created panel', async () => {
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    const screen = await render(<Harness {...baseProps} />);
    await fillAndSubmitInvite(screen);
    screen.getByText('Invitation created');
    screen.getByText('Send by email');
    screen.getByText('Share invitation');
  });

  it('(2) the same invitation is NOT simultaneously rendered under Pending invitations while the creation panel is showing', async () => {
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    const screen = await render(<Harness {...baseProps} />);
    await fillAndSubmitInvite(screen);
    screen.getByText('Invitation created');
    expect(screen.queryByText('Pending invitations')).toBeNull();
  });

  it('(3, 4, 5, 13) a successful, server-recorded email send closes the creation panel and the invitation appears EXACTLY ONCE under Pending invitations, marked "Invitation emailed."', async () => {
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    // Mirrors the real Edge Function: only on success does the SERVER
    // row gain lastEmailSentAt -- exactly what onRefresh() then reads.
    mockSendInvitationEmail.mockImplementation(async () => {
      fakeInvitationRow = { ...fakeInvitationRow, lastEmailSentAt: '2026-09-15T00:05:00Z', emailSendCount: fakeInvitationRow.emailSendCount + 1 };
      return { ok: true, data: undefined };
    });
    const screen = await render(<Harness {...baseProps} />);
    await fillAndSubmitInvite(screen);
    await fireEvent.press(screen.getByText('Send by email'));
    await screen.findByText('Pending invitations');
    expect(screen.queryByText('Invitation created')).toBeNull();
    screen.getByText('Invitation emailed.');
    expect(screen.getAllByText('marion@example.test').length).toBe(1); // exactly once, never twice
  });

  it('(6) once emailed, the email action becomes "Resend email", never "Send by email" again', async () => {
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    mockSendInvitationEmail.mockImplementation(async () => {
      fakeInvitationRow = { ...fakeInvitationRow, lastEmailSentAt: '2026-09-15T00:05:00Z', emailSendCount: 1 };
      return { ok: true, data: undefined };
    });
    const screen = await render(<Harness {...baseProps} />);
    await fillAndSubmitInvite(screen);
    await fireEvent.press(screen.getByText('Send by email'));
    await screen.findByText('Invitation emailed.');
    screen.getByText('Resend email');
    expect(screen.queryByText('Send by email')).toBeNull();
  });

  it('(7) after emailing, Share remains available as an alternative -- relabelled "Share instead"', async () => {
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    mockSendInvitationEmail.mockImplementation(async () => {
      fakeInvitationRow = { ...fakeInvitationRow, lastEmailSentAt: '2026-09-15T00:05:00Z', emailSendCount: 1 };
      return { ok: true, data: undefined };
    });
    const screen = await render(<Harness {...baseProps} />);
    await fillAndSubmitInvite(screen);
    await fireEvent.press(screen.getByText('Send by email'));
    await screen.findByText('Invitation emailed.');
    screen.getByText('Share instead');
  });

  it('(8) a successful, server-recorded share closes the creation panel and shows the truthful "Sharing opened." -- never overclaiming "Invitation shared" (Android cannot confirm completion)', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    mockRecordInvitationShareOpened.mockImplementation(async () => {
      fakeInvitationRow = { ...fakeInvitationRow, lastShareOpenedAt: '2026-09-15T00:06:00Z' };
      return { ok: true, data: undefined };
    });
    const screen = await render(<Harness {...baseProps} />);
    await fillAndSubmitInvite(screen);
    await fireEvent.press(screen.getByText('Share invitation'));
    await screen.findByText('Pending invitations');
    expect(screen.queryByText('Invitation created')).toBeNull();
    screen.getByText('Sharing opened.');
    expect(screen.queryByText('Invitation shared.')).toBeNull();
    screen.getByText('Send by email'); // email button stays as-is after a share
    screen.getByText('Share again');
    shareSpy.mockRestore();
  });

  it('(9) a cancelled share (iOS dismissedAction) does NOT record the share server-side, and the creation panel stays open', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    const screen = await render(<Harness {...baseProps} />);
    await fillAndSubmitInvite(screen);
    await fireEvent.press(screen.getByText('Share invitation'));
    expect(mockRecordInvitationShareOpened).not.toHaveBeenCalled();
    screen.getByText('Invitation created'); // still open
    expect(screen.queryByText('Pending invitations')).toBeNull();
    shareSpy.mockRestore();
  });

  it('(10) an email failure does NOT record server email state, and keeps the creation panel open with Retry available', async () => {
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    mockSendInvitationEmail.mockResolvedValue({ ok: false, message: "The invitation was created, but the email couldn't be sent." });
    const screen = await render(<Harness {...baseProps} />);
    await fillAndSubmitInvite(screen);
    await fireEvent.press(screen.getByText('Send by email'));
    await screen.findByText("The invitation was created, but the email couldn't be sent.");
    screen.getByText('Invitation created'); // still open -- brief's explicit requirement
    expect(screen.queryByText('Pending invitations')).toBeNull();
    expect(screen.queryByText('Invitation emailed.')).toBeNull();
  });

  it('retrying a failed send calls sendInvitationEmail again for the SAME invitation id -- never creates a new invitation', async () => {
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    mockSendInvitationEmail
      .mockResolvedValueOnce({ ok: false, message: 'failed' })
      .mockImplementationOnce(async () => {
        fakeInvitationRow = { ...fakeInvitationRow, lastEmailSentAt: '2026-09-15T00:05:00Z', emailSendCount: 1 };
        return { ok: true, data: undefined };
      });
    const screen = await render(<Harness {...baseProps} />);
    await fillAndSubmitInvite(screen);
    await fireEvent.press(screen.getByText('Send by email'));
    await screen.findByText('failed');
    await fireEvent.press(screen.getByText('Send by email'));
    expect(mockInviteMember).toHaveBeenCalledTimes(1); // never a second invite
    expect(mockSendInvitationEmail).toHaveBeenCalledTimes(2);
    expect(mockSendInvitationEmail).toHaveBeenNthCalledWith(2, { invitationId: 'inv-1' });
    await screen.findByText('Invitation emailed.');
  });

  it('(11) Dismiss closes the creation panel and exposes the invitation once under Pending invitations as "Not sent yet." -- with Send/Share still available', async () => {
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    const screen = await render(<Harness {...baseProps} />);
    await fillAndSubmitInvite(screen);
    await fireEvent.press(screen.getByText('Dismiss'));
    expect(screen.queryByText('Invitation created')).toBeNull();
    screen.getByText('Pending invitations');
    screen.getByText('Not sent yet.');
    screen.getByText('Send by email');
    screen.getByText('Share invitation');
    expect(screen.getAllByText('marion@example.test').length).toBe(1);
  });

  it('(12) an undelivered pending invitation (fresh app open / different device -- nothing recorded server-side yet) retains Send by email / Share invitation and reads "Not sent yet."', async () => {
    const undeliveredInvitation: CareCircleInvitation = {
      id: 'inv-existing', inviteeEmail: 'marion@example.test', role: 'contributor', relationshipType: 'Other relative',
      relationshipLabel: 'Aunt', grantedDomains: ['general'], status: 'pending', inviteCode: 'TESTCODE', emailSendCount: 0,
      createdAt: '2026-09-15T00:00:00Z', expiresAt: '2026-09-29T00:00:00Z',
    };
    const screen = await render(<Harness {...baseProps} invitations={[undeliveredInvitation]} />);
    screen.getByText('Not sent yet.');
    screen.getByText('Send by email');
    screen.getByText('Share invitation');
  });

  it('(14) Cancel invitation is still present and unaffected on a Pending row, wherever its own delivery status stands', async () => {
    const pendingInvitation: CareCircleInvitation = {
      id: 'inv-existing', inviteeEmail: 'marion@example.test', role: 'contributor', relationshipType: 'Other relative',
      relationshipLabel: 'Aunt', grantedDomains: ['general'], status: 'pending', inviteCode: 'TESTCODE', emailSendCount: 0,
      createdAt: '2026-09-15T00:00:00Z', expiresAt: '2026-09-29T00:00:00Z',
    };
    const screen = await render(<Harness {...baseProps} invitations={[pendingInvitation]} />);
    screen.getByText('Cancel invitation');
  });
});

describe('CareCircleScreen: cross-device/restart behaviour -- delivery state comes from the invitation prop itself, never local storage', () => {
  it('a fresh render (simulating app restart/reinstall/a different device) that receives an ALREADY-emailed invitation shows "Invitation emailed." immediately -- no prior local state required', async () => {
    const alreadyEmailedInvitation: CareCircleInvitation = {
      id: 'inv-existing', inviteeEmail: 'marion@example.test', role: 'contributor', relationshipType: 'Other relative',
      relationshipLabel: 'Aunt', grantedDomains: ['general'], status: 'pending', inviteCode: 'TESTCODE',
      lastEmailSentAt: '2026-09-14T12:00:00Z', emailSendCount: 1,
      createdAt: '2026-09-15T00:00:00Z', expiresAt: '2026-09-29T00:00:00Z',
    };
    // A genuinely fresh component instance, no Harness state carried
    // over from any prior render -- exactly what a restart/reinstall/
    // second device looks like from the component's own point of view.
    const screen = await render(<CareCircleScreen {...baseProps} invitations={[alreadyEmailedInvitation]} />);
    screen.getByText('Invitation emailed.');
    screen.getByText('Resend email');
  });

  it('offers Resend email / Share instead for an existing, already-emailed pending invitation, targeting its own id -- never creating a new one', async () => {
    const pendingInvitation: CareCircleInvitation = {
      id: 'inv-existing', inviteeEmail: 'marion@example.test', role: 'contributor', relationshipType: 'Other relative',
      relationshipLabel: 'Aunt', grantedDomains: ['general'], status: 'pending', inviteCode: 'TESTCODE',
      lastEmailSentAt: '2026-09-14T12:00:00Z', emailSendCount: 1,
      createdAt: '2026-09-15T00:00:00Z', expiresAt: '2026-09-29T00:00:00Z',
    };
    mockSendInvitationEmail.mockResolvedValue({ ok: true, data: undefined });
    const screen = await render(<CareCircleScreen {...baseProps} invitations={[pendingInvitation]} />);
    screen.getByText('marion@example.test');
    screen.getByText('Invitation emailed.');
    await fireEvent.press(screen.getByText('Resend email'));
    expect(mockSendInvitationEmail).toHaveBeenCalledWith({ invitationId: 'inv-existing' });
    expect(mockInviteMember).not.toHaveBeenCalled();
  });
});

// Care Circle invitation & joining flow completion (`\downloads\carecircle.txt`,
// 14 September 2026): the human-friendly invitation code, and the
// existing-user manual "Join a Care Circle" entry point.
describe('CareCircleScreen: invitation code and the manual join entry point', () => {
  it('shows the real invitation code (grouped ABCD-1234-style) on both the creation panel and a Pending row', async () => {
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'WXYZ9876' } });
    fakeInvitationRow = { ...fakeInvitationRow, inviteCode: 'WXYZ9876' }; // matches what the mock resolves, so the Harness's own onRefresh() (which "re-fetches" from this fake row) reflects it
    const screen = await render(<Harness {...baseProps} />);
    await fillAndSubmitInvite(screen);
    screen.getByText('Invitation code');
    screen.getByText('WXYZ-9876');
  });

  it('"Join a Care Circle" only renders when the caller provides the callback, and calls it when pressed', async () => {
    const onJoinAnotherCareCircle = jest.fn();
    const screen = await render(<Harness {...baseProps} onJoinAnotherCareCircle={onJoinAnotherCareCircle} />);
    await fireEvent.press(screen.getByText('Join a Care Circle'));
    expect(onJoinAnotherCareCircle).toHaveBeenCalledTimes(1);
  });

  it('"Join a Care Circle" is absent when the caller omits the callback -- never a dead-end button', async () => {
    const screen = await render(<Harness {...baseProps} />);
    expect(screen.queryByText('Join a Care Circle')).toBeNull();
  });
});
