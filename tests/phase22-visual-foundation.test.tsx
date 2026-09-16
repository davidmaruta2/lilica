import { fireEvent, render } from '@testing-library/react-native';

import { FoundationIcon } from '../src/components/FoundationIcon';
import { Phase22FoundationPreview } from '../src/components/Phase22FoundationPreview';
import { phase22Foundation, phase22Typography } from '../src/visualFoundation';

describe('Phase 22 visual foundation', () => {
  it('defines compact, readable type roles with zero tracking', () => {
    expect(phase22Typography.wordmark.fontFamily).toBe('Fraunces_800ExtraBold');
    expect(phase22Typography.pageTitle.fontFamily).toBe('InterTight_700Bold');
    expect(phase22Typography.body.fontFamily).toBe('Inter_400Regular');
    expect(phase22Typography.body.fontSize).toBeGreaterThanOrEqual(16);
    expect(Object.values(phase22Typography).every((role) => role.letterSpacing === 0)).toBe(true);
  });

  it('keeps icon sizing optically consistent and touch targets accessible', () => {
    expect(FoundationIcon).toBeDefined();
    expect(phase22Foundation.iconSize.bottomNavigation).toBe(24);
    expect(phase22Foundation.control.minimumTouchTarget).toBeGreaterThanOrEqual(44);
  });

  it('renders the isolated reference preview without changing a production route', async () => {
    const screen = await render(<Phase22FoundationPreview />);
    expect(screen.getByTestId('phase22-foundation-preview')).toBeTruthy();
    expect(screen.getByText("David's week")).toBeTruthy();
    expect(screen.getByText('Dentist check-up')).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
    expect(screen.getByLabelText('Go back')).toBeTruthy();

    const larger = screen.getByLabelText('Use larger preview text');
    expect(larger.props.accessibilityState.selected).toBe(false);
    await fireEvent.press(larger);
    expect(screen.getByLabelText('Use larger preview text').props.accessibilityState.selected).toBe(true);
  });
});
