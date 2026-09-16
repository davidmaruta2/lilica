import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, TextStyle, ViewStyle } from 'react-native';

import { Header } from '../src/components/Header';
import { FoundationIcon } from '../src/components/FoundationIcon';
import { SearchIcon } from '../src/components/foundationIcons';
import { PrimaryTabHeader } from '../src/components/PrimaryTabHeader';
import { SettingsCogButton } from '../src/components/SettingsCogButton';
import { TabBar } from '../src/components/TabBar';
import { AppText } from '../src/components/Text';
import { CalendarScreen } from '../src/screens/CalendarScreen';
import { phase22Foundation } from '../src/visualFoundation';

function textStyle(node: { props: { style?: unknown } }): TextStyle {
  return StyleSheet.flatten(node.props.style) as TextStyle;
}

function viewStyle(node: { props: { style?: unknown } }): ViewStyle {
  return StyleSheet.flatten(node.props.style) as ViewStyle;
}

function countNativeType(node: any, type: string): number {
  if (!node) return 0;
  if (Array.isArray(node)) return node.reduce((total, child) => total + countNativeType(child, type), 0);
  return (node.type === type ? 1 : 0) + countNativeType(node.children, type);
}

describe('Phase 22 production typography', () => {
  it.each([
    ['Lilica', 'wordmark', 'Fraunces_800ExtraBold', '800'],
    ['Page title', 'title', 'InterTight_700Bold', '700'],
    ['Section', 'section', 'InterTight_700Bold', '700'],
    ['Record', 'bodyStrong', 'InterTight_600SemiBold', '600'],
    ['Body', 'body', 'Inter_400Regular', '400'],
    ['Supporting', 'secondary', 'Inter_400Regular', '400'],
    ['Control', 'button', 'Inter_600SemiBold', '600'],
    ['Metadata', 'meta', 'Inter_500Medium', '500'],
  ] as const)('%s uses the approved shared role', async (label, variant, family, weight) => {
    const screen = await render(<AppText variant={variant}>{label}</AppText>);
    const style = textStyle(screen.getByText(label));
    expect(style.fontFamily).toBe(family);
    expect(style.fontWeight).toBe(weight);
    expect(style.letterSpacing).toBe(0);
  });
});

describe('Phase 22 production navigation controls', () => {
  it('uses a prominent Lucide Settings icon inside a 44px target', async () => {
    const screen = await render(<SettingsCogButton onPress={jest.fn()} />);
    expect(countNativeType(screen.toJSON(), 'RNSVGSvgView')).toBe(1);
    expect(viewStyle(screen.getByTestId('settings-cog-icon')).width).toBe(28);
    expect(viewStyle(screen.getByTestId('settings-cog-icon')).height).toBe(28);
    expect(viewStyle(screen.getByRole('button', { name: 'Settings' })).width).toBe(phase22Foundation.control.minimumTouchTarget);
    expect(viewStyle(screen.getByRole('button', { name: 'Settings' })).height).toBe(phase22Foundation.control.minimumTouchTarget);
  });

  it('keeps a long primary heading scalable beside the restrained utility target', async () => {
    const screen = await render(
      <PrimaryTabHeader title="A longer supported person heading" supporting="Supporting context can wrap." onOpenSettings={jest.fn()} />,
    );
    expect(screen.getByText('A longer supported person heading').props.allowFontScaling).toBe(true);
    expect(screen.getByText('Supporting context can wrap.').props.allowFontScaling).toBe(true);
    expect(viewStyle(screen.getByTestId('primary-tab-header')).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('uses the Lucide Back icon while preserving the Header callback', async () => {
    const onBack = jest.fn();
    const screen = await render(<Header title="Account" onBack={onBack} />);
    expect(countNativeType(screen.toJSON(), 'RNSVGSvgView')).toBe(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders all four Lucide tab icons and preserves tab selection', async () => {
    const onChange = jest.fn();
    const screen = await render(<TabBar active="home" onChange={onChange} />);
    expect(countNativeType(screen.toJSON(), 'RNSVGSvgView')).toBe(4);
    expect(screen.getByRole('tab', { name: 'Home' }).props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(screen.getByRole('tab', { name: 'Calendar' }));
    expect(onChange).toHaveBeenCalledWith('calendar');
  });

  it('renders the shared Lucide Search icon', async () => {
    const screen = await render(<FoundationIcon icon={SearchIcon} role="utility" />);
    expect(countNativeType(screen.toJSON(), 'RNSVGSvgView')).toBe(1);
  });

  it('keeps Calendar month navigation at the approved minimum target', async () => {
    const screen = await render(<CalendarScreen records={[]} onOpenRecord={jest.fn()} />);
    for (const label of ['Previous month', 'Next month']) {
      const style = viewStyle(screen.getByRole('button', { name: label }));
      expect(style.width).toBe(44);
      expect(style.height).toBe(44);
    }
  });
});
