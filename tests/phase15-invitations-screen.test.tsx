import { fireEvent, render } from '@testing-library/react-native';

import { InvitationsScreen } from '../src/screens/InvitationsScreen';
import { MyInvitation } from '../src/careCircle';

// Phase 15: the invitee-facing invitation screen. It must never guess an
// action succeeded -- accept/decline resolve to { ok, message? } and a
// failure keeps the invitation in the list with the server's own error
// shown inline, never silently removed.

const invitation: MyInvitation = {
  id: 'inv-1',
  careSpaceId: 'space-1',
  careSpaceNames: ['Jackie'],
  invitedByDisplayName: 'Olu',
  role: 'contributor',
  relationshipType: 'Other relative',
  relationshipLabel: 'Cousin',
  grantedDomains: ['general', 'home'],
  createdAt: '2026-09-11T00:00:00.000Z',
  expiresAt: '2026-09-25T00:00:00.000Z',
};

describe('Phase 15: InvitationsScreen', () => {
  it('shows the care space, inviter, role and exactly what was granted', async () => {
    const screen = await render(
      <InvitationsScreen invitations={[invitation]} onAccept={jest.fn()} onDecline={jest.fn()} onClose={jest.fn()} />,
    );
    screen.getByText('Jackie');
    screen.getByText(/Invited by Olu as a Contributor/);
    expect(screen.queryByText(/Cousin/)).toBeNull();
    // Care Circle permission-domain audit follow-up: the invitee now
    // sees the SAME real description an organiser sees when choosing
    // what to grant (DOMAIN_DESCRIPTIONS, never a second set) for every
    // granted domain, not just its bare label.
    screen.getByText('Everyday things', { exact: false });
    screen.getByText(/Appointments, tasks, contacts and everyday updates/);
    screen.getByText('Home & car', { exact: false });
    screen.getByText(/Home and car matters, like repairs and maintenance/);
  });

  it('accepting calls onAccept with the invitation id', async () => {
    const onAccept = jest.fn().mockResolvedValue({ ok: true });
    const screen = await render(
      <InvitationsScreen invitations={[invitation]} onAccept={onAccept} onDecline={jest.fn()} onClose={jest.fn()} />,
    );
    await fireEvent.press(screen.getByText('Accept'));
    expect(onAccept).toHaveBeenCalledWith(invitation);
  });

  it('declining calls onDecline with the invitation id', async () => {
    const onDecline = jest.fn().mockResolvedValue({ ok: true });
    const screen = await render(
      <InvitationsScreen invitations={[invitation]} onAccept={jest.fn()} onDecline={onDecline} onClose={jest.fn()} />,
    );
    await fireEvent.press(screen.getByText('Decline'));
    expect(onDecline).toHaveBeenCalledWith(invitation);
  });

  it('shows the server error inline and never implies success on failure', async () => {
    const onAccept = jest.fn().mockResolvedValue({ ok: false, message: 'This invitation is no longer open' });
    const screen = await render(
      <InvitationsScreen invitations={[invitation]} onAccept={onAccept} onDecline={jest.fn()} onClose={jest.fn()} />,
    );
    await fireEvent.press(screen.getByText('Accept'));
    screen.getByText('This invitation is no longer open');
    // The invitation itself is still shown -- never removed on a failed action.
    screen.getByText('Jackie');
  });

  it('"Not now" calls onClose without touching any invitation', async () => {
    const onAccept = jest.fn();
    const onDecline = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <InvitationsScreen invitations={[invitation]} onAccept={onAccept} onDecline={onDecline} onClose={onClose} />,
    );
    await fireEvent.press(screen.getByText('Not now'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
    expect(onDecline).not.toHaveBeenCalled();
  });
});
