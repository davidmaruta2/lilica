// Phase 20D, Part E: proves the FINAL approved drawer structure (brief
// `\downloads\20-22.txt` section 37/51) -- the "[Name]'s care" group now
// also carries Documents and Manage [Name]'s care, above the unchanged
// Account group, with Help preserved. Dynamic person switching and
// local-only omission are covered by tests/settings-drawer-person-care
// .test.tsx already; this file covers what's new.
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

describe('Settings drawer: final Phase 20D person-scoped structure', () => {
  it('the "[Name]\'s care" group contains Care Summary, Recent Activity, Documents and Manage [Name]\'s care, in that order', async () => {
    const screen = await render(
      <SettingsMenu
        {...baseProps}
        personName="Maggie"
        onOpenCareSummary={jest.fn()}
        onOpenRecentActivity={jest.fn()}
        onOpenDocuments={jest.fn()}
        onOpenManageCare={jest.fn()}
      />,
    );
    screen.getByText("Maggie's care");
    screen.getByLabelText('Care Summary');
    screen.getByLabelText('Recent Activity');
    screen.getByLabelText('Documents');
    screen.getByLabelText("Manage Maggie's care");
  });

  it('Documents and Manage are each independently omitted when their own callback is not offered -- never a fabricated destination', async () => {
    const screen = await render(
      <SettingsMenu {...baseProps} personName="Maggie" onOpenCareSummary={jest.fn()} onOpenRecentActivity={jest.fn()} />,
    );
    expect(screen.queryByLabelText('Documents')).toBeNull();
    expect(screen.queryByLabelText("Manage Maggie's care")).toBeNull();
  });

  it('Manage [Name]\'s care calls its own real handler', async () => {
    const onOpenManageCare = jest.fn();
    const screen = await render(
      <SettingsMenu {...baseProps} personName="Maggie" onOpenDocuments={jest.fn()} onOpenManageCare={onOpenManageCare} />,
    );
    await fireEvent.press(screen.getByLabelText("Manage Maggie's care"));
    expect(onOpenManageCare).toHaveBeenCalledTimes(1);
  });

  it('Documents calls its own real handler', async () => {
    const onOpenDocuments = jest.fn();
    const screen = await render(
      <SettingsMenu {...baseProps} personName="Maggie" onOpenDocuments={onOpenDocuments} onOpenManageCare={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText('Documents'));
    expect(onOpenDocuments).toHaveBeenCalledTimes(1);
  });

  it('Archived care is offered only when this account has at least one archived care space', async () => {
    const withoutArchived = await render(<SettingsMenu {...baseProps} personName="Maggie" />);
    expect(withoutArchived.queryByLabelText('Archived care')).toBeNull();

    const onOpenArchivedCare = jest.fn();
    const withArchived = await render(<SettingsMenu {...baseProps} personName="Maggie" onOpenArchivedCare={onOpenArchivedCare} />);
    await fireEvent.press(withArchived.getByLabelText('Archived care'));
    expect(onOpenArchivedCare).toHaveBeenCalledTimes(1);
  });

  it('the Account group (Account, Privacy & data, Subscription, Care Circle) and Help group (How to use Lilica, FAQ, Contact) are both completely preserved', async () => {
    const screen = await render(
      <SettingsMenu
        {...baseProps}
        personName="Maggie"
        onOpenCareSummary={jest.fn()}
        onOpenRecentActivity={jest.fn()}
        onOpenDocuments={jest.fn()}
        onOpenManageCare={jest.fn()}
        onOpenCareCircle={jest.fn()}
      />,
    );
    screen.getByLabelText('Account');
    screen.getByLabelText('Care Circle');
    screen.getByLabelText('Privacy & data');
    screen.getByLabelText('Subscription');
    screen.getByLabelText('How to use Lilica');
    screen.getByLabelText('FAQ');
    screen.getByLabelText('Contact');
  });
});
