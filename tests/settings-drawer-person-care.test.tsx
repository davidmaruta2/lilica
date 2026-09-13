// Phase 20C (approved Option 2): the Settings drawer becomes a small
// hybrid -- a person-scoped "[Name]'s care" group (Care Summary, Recent
// Activity) above the existing, unchanged Account group. Both rows route
// to the SAME existing App.tsx state (showCareSummary/showRecentActivity)
// People's own links already use -- no new screen, no new state. This
// file proves the drawer's own new group; App.tsx's actual wiring is
// exercised end-to-end by the existing settings-navigation.test.tsx
// pattern for the Account group, unaffected by this change.

import { fireEvent, render } from '@testing-library/react-native';

import { SettingsMenu } from '../src/components/SettingsMenu';

const baseProps = {
  visible: true,
  section: 'menu' as const,
  onClose: jest.fn(),
  onOpenAccount: jest.fn(),
  onOpenPrivacyData: jest.fn(),
  onOpenSubscription: jest.fn(),
  onOpenHowTo: jest.fn(),
  onOpenFaq: jest.fn(),
  onOpenContact: jest.fn(),
};

describe('SettingsMenu: person-scoped "[Name]\'s care" group', () => {
  it('shows the dynamic person-name heading and both rows when both are available', async () => {
    const onOpenCareSummary = jest.fn();
    const onOpenRecentActivity = jest.fn();
    const screen = await render(
      <SettingsMenu {...baseProps} personName="Maggie" onOpenCareSummary={onOpenCareSummary} onOpenRecentActivity={onOpenRecentActivity} />,
    );
    screen.getByText("Maggie's care");
    await fireEvent.press(screen.getByLabelText('Care Summary'));
    expect(onOpenCareSummary).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Recent Activity'));
    expect(onOpenRecentActivity).toHaveBeenCalledTimes(1);
  });

  it('the group label updates for a different supported person -- no hard-coded name, no stale label', async () => {
    const screen = await render(
      <SettingsMenu {...baseProps} personName="Beauty" onOpenCareSummary={jest.fn()} onOpenRecentActivity={jest.fn()} />,
    );
    screen.getByText("Beauty's care");
    expect(screen.queryByText("Maggie's care")).toBeNull();

    await screen.rerender(
      <SettingsMenu {...baseProps} personName="Jackie" onOpenCareSummary={jest.fn()} onOpenRecentActivity={jest.fn()} />,
    );
    screen.getByText("Jackie's care");
    expect(screen.queryByText("Beauty's care")).toBeNull();
  });

  it('is omitted entirely for a local-only care space (both callbacks undefined) -- reusing the existing careCircleAvailable guard, never a fabricated destination', async () => {
    const screen = await render(<SettingsMenu {...baseProps} personName="Maggie" />);
    expect(screen.queryByText("Maggie's care")).toBeNull();
    expect(screen.queryByLabelText('Care Summary')).toBeNull();
    expect(screen.queryByLabelText('Recent Activity')).toBeNull();
  });

  it('the existing Account group (Account, Privacy & data, Subscription, and Care Circle when available) is completely unaffected', async () => {
    const onOpenCareCircle = jest.fn();
    const screen = await render(
      <SettingsMenu {...baseProps} personName="Maggie" onOpenCareSummary={jest.fn()} onOpenRecentActivity={jest.fn()} onOpenCareCircle={onOpenCareCircle} />,
    );
    expect(screen.getAllByText('Account').length).toBeGreaterThan(0);
    screen.getByLabelText('Account');
    screen.getByLabelText('Care Circle');
    screen.getByLabelText('Privacy & data');
    screen.getByLabelText('Subscription');
  });

  it('falls back to a generic label when no person name is available at all', async () => {
    const screen = await render(
      <SettingsMenu {...baseProps} onOpenCareSummary={jest.fn()} onOpenRecentActivity={jest.fn()} />,
    );
    screen.getByText('This care space');
  });
});
