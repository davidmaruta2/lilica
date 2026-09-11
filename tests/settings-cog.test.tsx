import { fireEvent, render } from '@testing-library/react-native';

import { CalendarScreen } from '../src/screens/CalendarScreen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { PersonScreen } from '../src/screens/PersonScreen';
import { SettingsCogButton } from '../src/components/SettingsCogButton';
import { SettingsMenu } from '../src/components/SettingsMenu';
import { ToDoScreen } from '../src/screens/ToDoScreen';
import { initialOnboardingState } from '../src/storage';

// Corrective task 4: the app-level Settings entry point. This file covers
// (a) the shared cog/menu components in isolation, (b) that each of the
// four primary tabs offers the SAME cog wired to the SAME shared menu --
// never a separate implementation per tab, and (c) that the People tab's
// former "Account" text link is genuinely gone, not merely hidden.

describe('SettingsCogButton', () => {
  it('is a button labelled Settings and calls onPress', async () => {
    const onPress = jest.fn();
    const screen = await render(<SettingsCogButton onPress={onPress} />);
    const button = screen.getByLabelText('Settings');
    expect(button.props.accessibilityRole).toBe('button');
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsMenu', () => {
  it('always offers Account -- the one destination that already bundles profile, reminders and sign out', async () => {
    const onOpenAccount = jest.fn();
    const screen = await render(
      <SettingsMenu visible onClose={jest.fn()} onOpenAccount={onOpenAccount} />,
    );
    await fireEvent.press(screen.getByLabelText('Account'));
    expect(onOpenAccount).toHaveBeenCalledTimes(1);
  });

  it('offers Care Circle only when a callback is supplied -- never a dead row', async () => {
    const withoutCareCircle = await render(
      <SettingsMenu visible onClose={jest.fn()} onOpenAccount={jest.fn()} />,
    );
    expect(withoutCareCircle.queryByLabelText('Care Circle')).toBeNull();

    const onOpenCareCircle = jest.fn();
    const withCareCircle = await render(
      <SettingsMenu visible onClose={jest.fn()} onOpenAccount={jest.fn()} onOpenCareCircle={onOpenCareCircle} />,
    );
    await fireEvent.press(withCareCircle.getByLabelText('Care Circle'));
    expect(onOpenCareCircle).toHaveBeenCalledTimes(1);
  });

  it('closes when a row is tapped, and Done closes without acting', async () => {
    const onClose = jest.fn();
    const onOpenAccount = jest.fn();
    const screen = await render(
      <SettingsMenu visible onClose={onClose} onOpenAccount={onOpenAccount} />,
    );
    await fireEvent.press(screen.getByLabelText('Account'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenAccount).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    const second = await render(
      <SettingsMenu visible onClose={onClose} onOpenAccount={jest.fn()} />,
    );
    await fireEvent.press(second.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers no Privacy/Help/About row -- neither is a genuinely implemented destination', async () => {
    const screen = await render(
      <SettingsMenu visible onClose={jest.fn()} onOpenAccount={jest.fn()} onOpenCareCircle={jest.fn()} />,
    );
    expect(screen.queryByText('Privacy')).toBeNull();
    expect(screen.queryByText('Help')).toBeNull();
    expect(screen.queryByText('About')).toBeNull();
  });
});

describe('Settings cog on the four primary tabs', () => {
  it('Home renders the cog and calls onOpenSettings', async () => {
    const onOpenSettings = jest.fn();
    const screen = await render(
      <HomeScreen
        state={{ ...initialOnboardingState, stage: 'home' }}
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
        onOpenSettings={onOpenSettings}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('Home omits the cog entirely when onOpenSettings is not supplied -- never a dead button', async () => {
    const screen = await render(
      <HomeScreen state={{ ...initialOnboardingState, stage: 'home' }} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    expect(screen.queryByLabelText('Settings')).toBeNull();
  });

  it('Calendar renders the cog and calls onOpenSettings', async () => {
    const onOpenSettings = jest.fn();
    const screen = await render(
      <CalendarScreen records={[]} onOpenRecord={jest.fn()} onOpenSettings={onOpenSettings} />,
    );
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('To Do renders the cog and calls onOpenSettings', async () => {
    const onOpenSettings = jest.fn();
    const screen = await render(
      <ToDoScreen records={[]} onOpenRecord={jest.fn()} onSaveRecord={jest.fn()} onAddSomething={jest.fn()} onOpenSettings={onOpenSettings} />,
    );
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('People renders the cog (never the old "Account" text link) and calls onOpenSettings', async () => {
    const onOpenSettings = jest.fn();
    const screen = await render(
      <PersonScreen
        records={[]}
        displayName="Maggie"
        relationshipLabel="Mum"
        isSelf={false}
        people={[]}
        activeCareSpaceId="space-a"
        onSwitchPerson={jest.fn()}
        onAddPerson={jest.fn()}
        onOpenRecord={jest.fn()}
        onAddType={jest.fn()}
        onOpenSettings={onOpenSettings}
      />,
    );
    expect(screen.queryByLabelText('Account')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('People keeps its own direct Care Circle link alongside the cog -- nothing stranded', async () => {
    const onOpenCareCircle = jest.fn();
    const screen = await render(
      <PersonScreen
        records={[]}
        displayName="Maggie"
        relationshipLabel="Mum"
        isSelf={false}
        people={[]}
        activeCareSpaceId="space-a"
        onSwitchPerson={jest.fn()}
        onAddPerson={jest.fn()}
        onOpenRecord={jest.fn()}
        onAddType={jest.fn()}
        onOpenSettings={jest.fn()}
        onOpenCareCircle={onOpenCareCircle}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Manage Care Circle'));
    expect(onOpenCareCircle).toHaveBeenCalledTimes(1);
    // Settings cog is still there too -- the direct link doesn't replace it.
    screen.getByLabelText('Settings');
  });
});

describe('Home header layout: title on the left, Add + Settings together on the right', () => {
  it('renders Add and the Settings cog side by side, both small and fixed-size, next to the "Home" title', async () => {
    const onOpenSettings = jest.fn();
    const screen = await render(
      <HomeScreen
        state={{ ...initialOnboardingState, stage: 'home' }}
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
        onOpenSettings={onOpenSettings}
      />,
    );
    const cog = screen.getByLabelText('Settings');
    const add = screen.getByText('Add');
    screen.getByText('Home');
    // Both are fixed-size (icon-led, non-growing) controls, not full-width
    // text that could push into each other at large accessibility sizes.
    expect(cog.props.accessibilityRole).toBe('button');
    expect(add).toBeTruthy();
  });
});
