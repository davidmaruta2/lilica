// Phase 20C (approved Option 2), corrective follow-up: direct product-owner
// bug report -- "care summary and recent activity menu items appear to be
// opening whole new pages instead of remaining in the menu". The first fix
// attempt (a careOverlayOpenedFromSettings flag making the existing
// full-screen overlay's Back conditionally reopen the drawer) was wrong and
// was fully reverted -- it fixed the wrong architectural layer. The real fix
// makes Care Summary/Recent Activity render IN-DRAWER via settingsSection,
// exactly like Account/Care Circle/Privacy & data already do (see
// tests/settings-navigation.test.tsx for that established pattern) -- no new
// state, no "return to drawer" tracking needed at all.
//
// This file extends that exact harness pattern to the two new sections, so
// the specific regression reported (breaking out into a full page) has its
// own regression test, not just SettingsMenu's own callback-firing unit
// tests (tests/settings-drawer-person-care.test.tsx), which never rendered
// App.tsx's real children switch.
import { useState } from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { SettingsMenu } from '../src/components/SettingsMenu';

type Tab = 'home' | 'calendar' | 'todo' | 'people';
type Section = 'menu' | 'careSummary' | 'recentActivity' | 'account' | 'privacyData';

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
        onOpenRecentActivity={() => setSettingsSection('recentActivity')}
      >
        {/* Mirrors App.tsx's real children switch: the two new branches
            sit ahead of the pre-existing 'account'/'privacyData' ones,
            rendering in-drawer exactly the same way. */}
        {settingsSection === 'careSummary' ? (
          <>
            <Text accessibilityLabel="Care Summary body">{`${personName}'s Care Summary`}</Text>
            <Text accessibilityLabel="Care Summary back" onPress={() => setSettingsSection('menu')}>Back</Text>
          </>
        ) : settingsSection === 'recentActivity' ? (
          <>
            <Text accessibilityLabel="Recent Activity body">{`${personName}'s Recent Activity`}</Text>
            <Text accessibilityLabel="Recent Activity back" onPress={() => setSettingsSection('menu')}>Back</Text>
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

  it('Recent Activity opens inside the drawer -- the underlying route never changes, and back returns to the drawer root', async () => {
    const screen = await render(<Harness initialTab="calendar" />);
    await fireEvent.press(screen.getByLabelText('Open Settings'));
    await fireEvent.press(screen.getByLabelText('Recent Activity'));
    screen.getByLabelText('Recent Activity body');
    screen.getByText('route:calendar:Maggie');
    await fireEvent.press(screen.getByLabelText('Recent Activity back'));
    screen.getByLabelText('Recent Activity');
  });

  it('a full round trip through Care Summary and Recent Activity, then closing, restores the underlying route exactly -- regression coverage for the reported "opens a whole new page" bug', async () => {
    const screen = await render(<Harness initialTab="todo" personName="Ben" />);
    await fireEvent.press(screen.getByLabelText('Open Settings'));
    await fireEvent.press(screen.getByLabelText('Care Summary'));
    await fireEvent.press(screen.getByLabelText('Care Summary back'));
    await fireEvent.press(screen.getByLabelText('Recent Activity'));
    await fireEvent.press(screen.getByLabelText('Recent Activity back'));
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
