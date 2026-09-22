import { fireEvent, render } from '@testing-library/react-native';

import { MemberDetailPopup } from '../src/components/MemberDetailPopup';
import { CareCircleMember } from '../src/careCircle';

const sarah: CareCircleMember = {
  membershipId: 'm-sarah',
  displayName: 'Sarah',
  role: 'contributor',
  relationshipType: 'Other relative',
  isSelf: false,
  grantedDomains: ['general'],
};

const you: CareCircleMember = {
  membershipId: 'm-me',
  displayName: 'David',
  role: 'organiser',
  relationshipType: 'Myself',
  isSelf: true,
  grantedDomains: ['general'],
};

const avatarTone = { chip: '#eee', text: '#333' };

describe('Phase 23 slice 2: "Message privately" from a Care Circle member popup', () => {
  it('shows the button for another member when onMessagePrivately is supplied, and calls it on press', async () => {
    const onMessagePrivately = jest.fn();
    const screen = await render(
      <MemberDetailPopup visible member={sarah} avatarTone={avatarTone} onClose={jest.fn()} onMessagePrivately={onMessagePrivately} />,
    );
    await fireEvent.press(screen.getByLabelText('Message Sarah privately'));
    expect(onMessagePrivately).toHaveBeenCalledTimes(1);
  });

  it('never shows the button for the "You" entry, even when onMessagePrivately is supplied', async () => {
    const screen = await render(
      <MemberDetailPopup visible member={you} avatarTone={avatarTone} onClose={jest.fn()} onMessagePrivately={jest.fn()} />,
    );
    expect(screen.queryByLabelText(/Message .* privately/)).toBeNull();
  });

  it('is omitted entirely when onMessagePrivately is not supplied (e.g. a local-only care space)', async () => {
    const screen = await render(
      <MemberDetailPopup visible member={sarah} avatarTone={avatarTone} onClose={jest.fn()} />,
    );
    expect(screen.queryByLabelText('Message Sarah privately')).toBeNull();
    // Close is still there -- the popup itself is unaffected.
    screen.getByLabelText('Close member details');
  });
});
