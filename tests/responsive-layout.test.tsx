import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { Screen } from '../src/components/Screen';
import { EmailAuthScreen } from '../src/screens/EmailAuthScreen';
import { FirstThingScreen } from '../src/screens/FirstThingScreen';
import { InterestsScreen } from '../src/screens/InterestsScreen';
import { RelationshipScreen } from '../src/screens/RelationshipScreen';
import { spacing } from '../src/theme';

function flattenedStyle(node: { props: Record<string, any> }): ViewStyle {
  return StyleSheet.flatten(node.props.style as ViewStyle) as ViewStyle;
}

describe('responsive onboarding composition', () => {
  it('uses native top and bottom safe-area edges around content and footer', async () => {
    const screen = await render(<Screen footer={<View />}><View /></Screen>);

    expect(screen.getByTestId('screen-safe-area').props.edges).toEqual({
      top: 'additive',
      right: 'off',
      bottom: 'additive',
      left: 'off',
    });
  });

  it.each([
    ['email-content', <EmailAuthScreen onBack={jest.fn()} onContinue={jest.fn()} />],
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
  ])('lets %s consume and balance the available height', async (testID, component) => {
    const screen = await render(component);
    const style = flattenedStyle(screen.getByTestId(testID as string));

    expect(style.flex).toBe(1);
    expect(style.justifyContent).toBe('center');
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
