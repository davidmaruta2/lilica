// Real gap reported directly by the product owner (15 September 2026):
// "I still don't see any option to request to join a care circle... when
// I've been sent one." The manual invitation-code entry point
// (JoinCareCircleScreen) was previously only reachable from INSIDE an
// already-open Care Circle screen, itself gated behind having a real,
// synced care space of one's own -- someone with nothing set up yet
// (exactly who a fresh invitation code is most likely to reach) had no
// way to find it anywhere in the app. This proves the fix: a "Join a
// Care Circle" row in the Settings drawer, always offered regardless of
// onOpenCareCircle/whether the account has any care space of its own.
import { fireEvent, render } from '@testing-library/react-native';

import { SettingsMenu } from '../src/components/SettingsMenu';

describe('Settings drawer: "Join a Care Circle" is always reachable', () => {
  it('is offered even when the account has no care space of its own (onOpenCareCircle omitted)', async () => {
    const onOpenJoinCareCircle = jest.fn();
    const screen = await render(
      <SettingsMenu
        visible
        section="menu"
        onClose={jest.fn()}
        onOpenAccount={jest.fn()}
        onOpenJoinCareCircle={onOpenJoinCareCircle}
        onOpenPrivacyData={jest.fn()}
        onOpenSubscription={jest.fn()}
        onOpenHowTo={jest.fn()}
        onOpenFaq={jest.fn()}
        onOpenContact={jest.fn()}
      />,
    );
    screen.getByText('Join a Care Circle');
    await fireEvent.press(screen.getByText('Join a Care Circle'));
    expect(onOpenJoinCareCircle).toHaveBeenCalledTimes(1);
  });

  it('is offered ALONGSIDE Care Circle when the account also has a care space of its own', async () => {
    const onOpenJoinCareCircle = jest.fn();
    const onOpenCareCircle = jest.fn();
    const screen = await render(
      <SettingsMenu
        visible
        section="menu"
        onClose={jest.fn()}
        onOpenAccount={jest.fn()}
        onOpenCareCircle={onOpenCareCircle}
        onOpenJoinCareCircle={onOpenJoinCareCircle}
        onOpenPrivacyData={jest.fn()}
        onOpenSubscription={jest.fn()}
        onOpenHowTo={jest.fn()}
        onOpenFaq={jest.fn()}
        onOpenContact={jest.fn()}
      />,
    );
    screen.getByText('Care Circle');
    screen.getByText('Join a Care Circle');
  });

  it('is never shown when the caller omits it (existing tests that render this component without the new prop keep working)', async () => {
    const screen = await render(
      <SettingsMenu
        visible
        section="menu"
        onClose={jest.fn()}
        onOpenAccount={jest.fn()}
        onOpenPrivacyData={jest.fn()}
        onOpenSubscription={jest.fn()}
        onOpenHowTo={jest.fn()}
        onOpenFaq={jest.fn()}
        onOpenContact={jest.fn()}
      />,
    );
    expect(screen.queryByText('Join a Care Circle')).toBeNull();
  });
});
