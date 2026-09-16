// FAQ / How to use Lilica / Contact: three new, always-available Settings
// drawer entries (direct product-owner request). Static reference content
// only -- no new data source, no permission check. Covers the new drawer
// group, and that each screen renders real content with a working Back.
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { SettingsMenu } from '../src/components/SettingsMenu';
import { ContactScreen, SUPPORT_EMAIL } from '../src/screens/ContactScreen';
import { FaqScreen } from '../src/screens/FaqScreen';
import { HowToUseScreen } from '../src/screens/HowToUseScreen';
import { FEATURE_REQUEST_EMAIL, FeatureRequestScreen } from '../src/screens/FeatureRequestScreen';

describe('SettingsMenu: Help group (How to use Lilica, FAQ, Contact)', () => {
  const baseProps = {
    visible: true,
    section: 'menu' as const,
    onClose: jest.fn(),
    onOpenAccount: jest.fn(),
    onOpenPrivacyData: jest.fn(),
    onOpenSubscription: jest.fn(),
  };

  it('shows all Help rows and calls the real handler for each, always -- no gating', async () => {
    const onOpenHowTo = jest.fn();
    const onOpenFaq = jest.fn();
    const onOpenContact = jest.fn();
    const onOpenFeatureRequest = jest.fn();
    const screen = await render(
      <SettingsMenu {...baseProps} onOpenHowTo={onOpenHowTo} onOpenFaq={onOpenFaq} onOpenFeatureRequest={onOpenFeatureRequest} onOpenContact={onOpenContact} />,
    );
    screen.getByText('Help');
    await fireEvent.press(screen.getByLabelText('How to use Lilica'));
    expect(onOpenHowTo).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('FAQ'));
    expect(onOpenFaq).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Suggest a feature'));
    expect(onOpenFeatureRequest).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Contact'));
    expect(onOpenContact).toHaveBeenCalledTimes(1);
  });

  it('is offered even for a local-only care space (no personName, no care-summary callbacks) -- Help is never gated by sync state', async () => {
    const screen = await render(
      <SettingsMenu {...baseProps} onOpenHowTo={jest.fn()} onOpenFaq={jest.fn()} onOpenContact={jest.fn()} />,
    );
    screen.getByLabelText('How to use Lilica');
    screen.getByLabelText('FAQ');
    screen.getByLabelText('Contact');
  });
});

describe('FaqScreen', () => {
  it('shows real questions, collapsed by default, and reveals the answer on tap', async () => {
    const screen = await render(<FaqScreen onBack={jest.fn()} />);
    screen.getByText('What is a care space?');
    expect(screen.queryByText(/everything Lilica holds for one person/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('What is a care space? question'));
    screen.getByText(/everything Lilica holds for one person/);
  });

  it('answers the exact question this feature was built to answer', async () => {
    const screen = await render(<FaqScreen onBack={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('How do I remove someone I support if they no longer need it? question'));
    screen.getByText(/Remove a supported person/);
  });

  it('explains Care Summary PDF export and feature requests', async () => {
    const screen = await render(<FaqScreen onBack={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('How do I export a Care Summary? question'));
    screen.getByText(/tap Export PDF/);
    await fireEvent.press(screen.getByLabelText('How do I suggest a feature? question'));
    screen.getByText(new RegExp(FEATURE_REQUEST_EMAIL));
  });

  it('Back calls the real handler', async () => {
    const onBack = jest.fn();
    const screen = await render(<FaqScreen onBack={onBack} />);
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('HowToUseScreen', () => {
  it('shows every real destination named, in order', async () => {
    const screen = await render(<HowToUseScreen onBack={jest.fn()} />);
    screen.getByText('Home');
    screen.getByText('Calendar');
    screen.getByText('To Do');
    screen.getByText('People');
    screen.getByText('Care Circle');
    screen.getByText('Settings');
  });

  it('Back calls the real handler', async () => {
    const onBack = jest.fn();
    const screen = await render(<HowToUseScreen onBack={onBack} />);
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('ContactScreen', () => {
  it('shows the real support email, and Email us opens a real mailto: link to it -- never a fake action', async () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const screen = await render(<ContactScreen onBack={jest.fn()} />);
    screen.getByText(SUPPORT_EMAIL);
    await fireEvent.press(screen.getByText('Email us'));
    expect(openURLSpy).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`);
    openURLSpy.mockRestore();
  });

  it('Back calls the real handler', async () => {
    const onBack = jest.fn();
    const screen = await render(<ContactScreen onBack={onBack} />);
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('FeatureRequestScreen', () => {
  it('opens a pre-addressed feature-request email', async () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const screen = await render(<FeatureRequestScreen onBack={jest.fn()} />);
    await fireEvent.press(screen.getByText('Email a feature request'));
    expect(openURLSpy).toHaveBeenCalledWith(`mailto:${FEATURE_REQUEST_EMAIL}?subject=Lilica%20feature%20request`);
    openURLSpy.mockRestore();
  });
});
