// Direct product-owner request, 26 September 2026: "all key care circle
// actions in one place, coherent, logical" -- superseding the previous
// design (a separate "Join a Care Circle" row, always shown regardless
// of onOpenCareCircle -- see this file's git history for that version).
// "Care Circle" is now the ONE row, always offered; App.tsx decides
// whether it opens the full CareCircleScreen or a first-time
// JoinCareCircleScreen based on real account state -- this test file
// only proves the drawer's own row, not that branching (covered by
// App.tsx-level tests instead, since SettingsMenu itself no longer
// knows the difference).
import { fireEvent, render } from '@testing-library/react-native';

import { SettingsMenu } from '../src/components/SettingsMenu';

describe('Settings drawer: one "Care Circle" row, always reachable', () => {
  it('is offered even when the account has no care space of its own', async () => {
    const onOpenCareCircle = jest.fn();
    const screen = await render(
      <SettingsMenu
        visible
        section="menu"
        onClose={jest.fn()}
        onOpenAccount={jest.fn()}
        onOpenCareCircle={onOpenCareCircle}
        onOpenPrivacyData={jest.fn()}
        onOpenSubscription={jest.fn()}
        onOpenHowTo={jest.fn()}
        onOpenFaq={jest.fn()}
        onOpenContact={jest.fn()}
      />,
    );
    // getByLabelText (the row's own accessibilityLabel), not getByText --
    // "Care Circle" is also the group heading text above this row, so a
    // plain text match is ambiguous between the two.
    await fireEvent.press(screen.getByLabelText('Care Circle'));
    expect(onOpenCareCircle).toHaveBeenCalledTimes(1);
  });

  it('never renders a separate "Join a Care Circle" row any more -- joining lives inside the one Care Circle destination', async () => {
    const screen = await render(
      <SettingsMenu
        visible
        section="menu"
        onClose={jest.fn()}
        onOpenAccount={jest.fn()}
        onOpenCareCircle={jest.fn()}
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
