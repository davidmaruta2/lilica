import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { Header, SecondaryPageCloseProvider } from '../src/components/Header';
import { FileTextIcon, TrashIcon } from '../src/components/foundationIcons';
import { SecondaryDisclosureRow, SecondaryPageIntro, SecondarySection } from '../src/components/SecondaryPage';
import { phase22Foundation } from '../src/visualFoundation';

describe('Phase 22 secondary-page foundation', () => {
  it('provides a compact accessible secondary header with a 44px back target', async () => {
    const onBack = jest.fn();
    const screen = await render(<Header title="Privacy & data" onBack={onBack} />);
    const back = screen.getByTestId('secondary-header-back');
    expect(StyleSheet.flatten(back.props.style)).toEqual(expect.objectContaining({
      width: phase22Foundation.control.minimumTouchTarget,
      height: phase22Foundation.control.minimumTouchTarget,
    }));
    fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('places the drawer close action in the secondary page header', async () => {
    const onClose = jest.fn();
    const screen = await render(
      <SecondaryPageCloseProvider onClose={onClose}>
        <Header title="Care summary" onBack={jest.fn()} />
      </SecondaryPageCloseProvider>,
    );
    screen.getByText('Care summary');
    const close = screen.getByLabelText('Close settings');
    expect(StyleSheet.flatten(close.props.style)).toEqual(expect.objectContaining({ width: 44, height: 44 }));
    fireEvent.press(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the approved grouped disclosure-row hierarchy without changing callbacks', async () => {
    const onPress = jest.fn();
    const screen = await render(
      <SecondarySection title="Documents" tone="plum">
        <SecondaryDisclosureRow icon={FileTextIcon} title="Hospital letter" description="Added 15 Sep 2026" onPress={onPress} />
      </SecondarySection>,
    );
    screen.getByText('Documents');
    fireEvent.press(screen.getByLabelText('Hospital letter'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(StyleSheet.flatten(screen.getByTestId('secondary-disclosure-row').props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('gives destructive actions an explicit accessible label and danger surface', async () => {
    const screen = await render(<SecondaryDisclosureRow icon={TrashIcon} title="Delete account" description="Permanently delete your Lilica account" destructive onPress={jest.fn()} />);
    screen.getByLabelText('Delete account');
    expect(StyleSheet.flatten(screen.getByTestId('secondary-disclosure-row').props.style).backgroundColor).toBe('#FDECEC');
  });

  it('keeps supporting copy scalable rather than forcing a single line', async () => {
    const screen = await render(<SecondaryPageIntro>Supporting copy can wrap at larger text sizes.</SecondaryPageIntro>);
    const text = screen.getByText('Supporting copy can wrap at larger text sizes.');
    expect(text.props.allowFontScaling).not.toBe(false);
    expect(text.props.numberOfLines).toBeUndefined();
  });

  it('supports non-interactive summary rows', async () => {
    const screen = await render(<SecondaryDisclosureRow title="Gillian Murphy" description="Organiser" />);
    expect(screen.queryByLabelText('Gillian Murphy')).toBeNull();
    screen.getByText('Gillian Murphy');
  });
});
