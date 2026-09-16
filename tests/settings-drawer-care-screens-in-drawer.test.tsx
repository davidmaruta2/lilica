// Phase 20C regression coverage for person-scoped pages that remain in the
// drawer. Recent Activity later moved to the primary-tab notification bell;
// these tests now also protect its removal from the drawer.
import { useState } from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { SettingsMenu } from '../src/components/SettingsMenu';

type Tab = 'home' | 'calendar' | 'todo' | 'people';
type Section = 'menu' | 'careSummary' | 'account' | 'privacyData';

function Harness({ initialTab, personName = 'Maggie' }: { initialTab: Tab; personName?: string }) {
  const [activeTab] = useState<Tab>(initialTab);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsSection, setSettingsSection] = useState<Section>('menu');

  return (
    <>
      {/* The "underlying app" -- exactly as App.tsx's own tab content
          renders behind the drawer, untouched by anything the drawer does. */}
      <Text>{`route:${activeTab}:${personName}`}</Text>
      <Text accessibilityLabel="Open Settings" onPress={() => setShowSettingsMenu(true)}>Settings</Text>
      <SettingsMenu
        visible={showSettingsMenu}
        section={settingsSection}
        personName={personName}
        onClose={() => { setShowSettingsMenu(false); setSettingsSection('menu'); }}
        onOpenAccount={() => setSettingsSection('account')}
        onOpenPrivacyData={() => setSettingsSection('privacyData')}
        onOpenSubscription={jest.fn()}
        onOpenHowTo={jest.fn()}
        onOpenFaq={jest.fn()} onOpenContact={jest.fn()}
        onOpenCareSummary={() => setSettingsSection('careSummary')}
      >
        {/* Mirrors App.tsx's real children switch: the two new branches
            sit ahead of the pre-existing 'account'/'privacyData' ones,
            rendering in-drawer exactly the same way. */}
        {settingsSection === 'careSummary' ? (
          <>
            <Text accessibilityLabel="Care Summary body">{`${personName}'s Care Summary`}</Text>
            <Text accessibilityLabel="Care Summary back" onPress={() => setSettingsSection('menu')}>Back</Text>
          </>
        ) : settingsSection === 'account' ? (
          <>
            <Text accessibilityLabel="Account body">Account body</Text>
            <Text accessibilityLabel="Account back" onPress={() => setSettingsSection('menu')}>Back</Text>
          </>
        ) : settingsSection === 'privacyData' ? (
          <>
            <Text accessibilityLabel="Privacy body">Privacy & data body</Text>
            <Text accessibilityLabel="Privacy back" onPress={() => setSettingsSection('menu')}>Back</Text>
          </>
        ) : null}
      </SettingsMenu>
    </>
  );
}

describe('Settings drawer: Care Summary / Recent Activity render IN-DRAWER, never a new page', () => {
  it('Care Summary opens inside the drawer -- the underlying route never changes, and back returns to the drawer root', async () => {
    const screen = await render(<Harness initialTab="home" />);
    screen.getByText('route:home:Maggie');
    await fireEvent.press(screen.getByLabelText('Open Settings'));
    await fireEvent.press(screen.getByLabelText('Care Summary'));
    screen.getByLabelText('Care Summary body');
    screen.getByText('route:home:Maggie'); // untouched the whole time -- no navigation away from home occurred
    expect(screen.queryByLabelText('Care Summary')).toBeNull(); // the drawer's own row list is gone, replaced by the body -- proves it's the SAME surface, not a second one stacked on top
    await fireEvent.press(screen.getByLabelText('Care Summary back'));
    screen.getByLabelText('Care Summary'); // back at the Settings root list, still inside the drawer
  });

  it('Recent Activity is no longer offered by the drawer because the notification bell owns it', async () => {
    const screen = await render(<Harness initialTab="calendar" />);
    await fireEvent.press(screen.getByLabelText('Open Settings'));
    expect(screen.queryByLabelText('Recent Activity')).toBeNull();
    screen.getByText('route:calendar:Maggie');
  });

  it('a full round trip through Care Summary, then closing, restores the underlying route exactly', async () => {
    const screen = await render(<Harness initialTab="todo" personName="Ben" />);
    await fireEvent.press(screen.getByLabelText('Open Settings'));
    await fireEvent.press(screen.getByLabelText('Care Summary'));
    await fireEvent.press(screen.getByLabelText('Care Summary back'));
    await fireEvent.press(screen.getByLabelText('Close settings'));
    screen.getByText('route:todo:Ben');
  });

  it('switching the active person updates which person the drawer body describes -- no stale scope left behind', async () => {
    const screen = await render(<Harness initialTab="people" personName="Jackie" />);
    await fireEvent.press(screen.getByLabelText('Open Settings'));
    await fireEvent.press(screen.getByLabelText('Care Summary'));
    screen.getByText("Jackie's Care Summary");
  });
});
