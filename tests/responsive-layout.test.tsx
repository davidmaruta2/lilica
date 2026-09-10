import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { StyleSheet, View, ViewStyle } from 'react-native';

import appConfig from '../app.json';

import { Screen } from '../src/components/Screen';
import { Button } from '../src/components/Button';
import { DateTimeWheelField } from '../src/components/DateTimeWheelField';
import { RecordSheet } from '../src/components/RecordSheet';
import { EmailAuthScreen } from '../src/screens/EmailAuthScreen';
import { FirstThingScreen } from '../src/screens/FirstThingScreen';
import { InterestsScreen } from '../src/screens/InterestsScreen';
import { RelationshipScreen } from '../src/screens/RelationshipScreen';
import { WelcomeScreen } from '../src/screens/WelcomeScreen';
import { keyboardAvoidingBehavior, keyboardDismissMode } from '../src/keyboard';
import { spacing } from '../src/theme';

function flattenedStyle(node: { props: Record<string, any> }): ViewStyle {
  return StyleSheet.flatten(node.props.style as ViewStyle) as ViewStyle;
}

function hasAncestor(node: { parent: any }, ancestor: unknown): boolean {
  let current = node.parent;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

describe('responsive onboarding composition', () => {
  it('keeps the Welcome header inside the native top safe area', async () => {
    const screen = await render(<WelcomeScreen onStart={jest.fn()} onLogin={jest.fn()} />);

    expect(screen.getByTestId('welcome-safe-area').props.edges).toEqual({
      top: 'additive',
      right: 'off',
      bottom: 'additive',
      left: 'off',
    });
  });

  it('uses native top and bottom safe-area edges around content and footer', async () => {
    const screen = await render(<Screen footer={<View />}><View /></Screen>);

    expect(screen.getByTestId('screen-safe-area').props.edges).toEqual({
      top: 'additive',
      right: 'off',
      bottom: 'additive',
      left: 'off',
    });
    expect(flattenedStyle(screen.getByTestId('screen-scroll-view')).flex).toBe(1);
    expect(flattenedStyle(screen.getByTestId('screen-scroll-content')).flexGrow).toBe(1);
    expect(hasAncestor(screen.getByTestId('screen-footer'), screen.getByTestId('screen-scroll-view'))).toBe(true);
    expect(keyboardAvoidingBehavior('android')).toBeUndefined();
    expect(keyboardAvoidingBehavior('ios')).toBe('padding');
    expect(keyboardDismissMode('android')).toBe('on-drag');
    expect(keyboardDismissMode('ios')).toBe('interactive');
    expect(appConfig.expo.android.softwareKeyboardLayoutMode).toBe('resize');
  });

  it.each([
    [
      'relationship-content',
      <RelationshipScreen
        onBack={jest.fn()}
        onSelect={jest.fn()}
        onContinue={jest.fn()}
      />,
    ],
    [
      'interests-content',
      <InterestsScreen
        selected={[]}
        personName="David"
        onBack={jest.fn()}
        onToggle={jest.fn()}
        onContinue={jest.fn()}
        onSkip={jest.fn()}
      />,
    ],
  ])('lets %s consume height from a natural top position', async (testID, component) => {
    const screen = await render(component);
    const style = flattenedStyle(screen.getByTestId(testID as string));

    expect(style.flex).toBe(1);
    expect(style.justifyContent).toBe('flex-start');
  });

  it('keeps command labels on one line when Android text is enlarged', async () => {
    const screen = await render(<Button label="Skip for now" onPress={jest.fn()} />);
    const label = screen.getByText('Skip for now');

    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.adjustsFontSizeToFit).toBe(true);
    expect(flattenedStyle(screen.getByRole('button')).width).toBe('100%');
  });

  it('uses independent date wheels without opening a text keyboard', async () => {
    const onDateChange = jest.fn();
    const dateScreen = await render(<DateTimeWheelField label="Date" mode="date" value="15/09/2026" onChange={onDateChange} />);
    expect(() => dateScreen.getByPlaceholderText('DD/MM/YYYY')).toThrow();
    await fireEvent.press(dateScreen.getByRole('button', { name: 'Date: 15/09/2026' }));
    await waitFor(() => dateScreen.getByTestId('date-wheel-selector'));
    expect(flattenedStyle(dateScreen.getByTestId('date-picker-sheet')).minHeight).toBe(344);
    expect(dateScreen.getByTestId('day-wheel').props.initialScrollIndex).toBe(14);
    expect(dateScreen.getByTestId('month-wheel').props.initialScrollIndex).toBe(8);
    expect(dateScreen.getByTestId('year-wheel').props.initialScrollIndex).toBe(126);
    await fireEvent(dateScreen.getByTestId('day-wheel'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 19 * 44 } } });
    await fireEvent.press(dateScreen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(dateScreen.queryByTestId('date-wheel-selector')).toBeNull());
    expect(onDateChange).not.toHaveBeenCalled();
    await dateScreen.unmount();
  });

  it('commits the selected date only when Done is pressed', async () => {
    const onDateChange = jest.fn();
    const dateScreen = await render(<DateTimeWheelField label="Date" mode="date" value="15/09/2026" onChange={onDateChange} />);
    await fireEvent.press(dateScreen.getByRole('button', { name: 'Date: 15/09/2026' }));
    await waitFor(() => dateScreen.getByTestId('date-wheel-selector'));
    await fireEvent(dateScreen.getByTestId('day-wheel'), 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: 19 * 44 } } });
    await fireEvent.press(dateScreen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(dateScreen.queryByTestId('date-wheel-selector')).toBeNull());
    expect(onDateChange).toHaveBeenCalledWith('20/09/2026');
    await dateScreen.unmount();
  });

  it('uses 24-hour and minute wheels without opening a text keyboard', async () => {
    const timeScreen = await render(<DateTimeWheelField label="Time" mode="time" value="00:00" onChange={jest.fn()} optional />);
    expect(() => timeScreen.getByPlaceholderText('HH:MM')).toThrow();
    await fireEvent.press(timeScreen.getByRole('button', { name: 'Time: 00:00' }));
    await waitFor(() => timeScreen.getByTestId('time-wheel-selector'));
    expect(timeScreen.getByTestId('hour-wheel').props.initialScrollIndex).toBe(0);
    expect(timeScreen.getByTestId('minute-wheel').props.initialScrollIndex).toBe(0);
    await fireEvent.press(timeScreen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(timeScreen.queryByTestId('time-wheel-selector')).toBeNull());
    await timeScreen.unmount();
  });

  it('starts the account form near the top and leaves it scrollable above the keyboard', async () => {
    const screen = await render(<EmailAuthScreen mode="create" onBack={jest.fn()} onSubmit={jest.fn()} onVerificationRequired={jest.fn()} onAuthenticated={jest.fn()} onForgotPassword={jest.fn()} />);
    const style = flattenedStyle(screen.getByTestId('email-content'));

    expect(style.flex).toBe(1);
    expect(style.justifyContent).toBe('flex-start');
    expect(screen.getByText('Email')).toBeOnTheScreen();
    expect(screen.getByText('Password')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeOnTheScreen();
  });

  it('keeps the Login fields and CTA in one scrollable keyboard region', async () => {
    const screen = await render(<EmailAuthScreen mode="login" onBack={jest.fn()} onSubmit={jest.fn()} onVerificationRequired={jest.fn()} onAuthenticated={jest.fn()} onForgotPassword={jest.fn()} />);
    const email = screen.getByPlaceholderText('you@example.com');
    const password = screen.getByPlaceholderText('At least 8 characters');
    const footer = screen.getByTestId('screen-footer');
    const scroll = screen.getByTestId('screen-scroll-view');

    expect(email.props.returnKeyType).toBe('next');
    expect(email.props.blurOnSubmit).toBe(false);
    expect(password.props.secureTextEntry).toBe(true);
    expect(hasAncestor(password, scroll)).toBe(true);
    expect(hasAncestor(footer, scroll)).toBe(true);
    expect(screen.getByRole('button', { name: 'Log in' })).toBeOnTheScreen();
  });

  it('keeps record editor fields in a keyboard-aware scroll region', async () => {
    const screen = await render(
      <RecordSheet title="Add appointment" onDismiss={jest.fn()}>
        <View testID="record-editor-fields" />
      </RecordSheet>,
    );
    const scroll = screen.getByTestId('record-sheet-scroll-view');

    expect(hasAncestor(screen.getByTestId('record-editor-fields'), scroll)).toBe(true);
    expect(screen.getByTestId('record-sheet-keyboard-avoiding-view')).toBeOnTheScreen();
    expect(['interactive', 'on-drag']).toContain(scroll.props.keyboardDismissMode);
  });

  it('lets the interests carousel use the screen gutters', async () => {
    const screen = await render(
      <InterestsScreen
        selected={[]}
        personName="David"
        onBack={jest.fn()}
        onToggle={jest.fn()}
        onContinue={jest.fn()}
        onSkip={jest.fn()}
      />,
    );

    expect(flattenedStyle(screen.getByTestId('interests-carousel')).marginHorizontal).toBe(-spacing.lg);
  });

  it('starts the record stack near the intro and derives trailing space from its measured height', async () => {
    const screen = await render(
      <FirstThingScreen
        interests={[]}
        personName="David"
        supportedPersonId="person-david"
        records={[]}
        onBack={jest.fn()}
        onSaveRecord={jest.fn()}
        onRemoveRecord={jest.fn()}
        onFinish={jest.fn()}
        onSkip={jest.fn()}
      />,
    );
    const stack = screen.getByTestId('first-thing-record-stack');

    await fireEvent(stack, 'layout', { nativeEvent: { layout: { height: 500 } } });

    const contentStyle = StyleSheet.flatten(
      screen.getByTestId('first-thing-record-stack').props.contentContainerStyle,
    );
    expect(contentStyle.paddingTop).toBe(spacing.sm);
    expect(contentStyle.paddingBottom).toBe(382);
  });
});
