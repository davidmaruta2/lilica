// To Do background visual-regression correction (12 September 2026):
// physical QA found the olive background ending well above the bottom
// tab bar on a short/empty To Do list, exposing a large plain cream
// rectangle beneath it, and found the gradient itself reading as "a
// large flat dark block, then a late fade". Both are layout/distribution
// issues, not a colour choice -- this file proves the fix without a
// screenshot: ScreenBackdrop's opt-in `stretch`/`stops` props behave
// correctly, and every other screen (which passes neither) is completely
// unaffected.
import { render } from '@testing-library/react-native';
import { processColor, View } from 'react-native';

// expo-linear-gradient resolves colour props to native numeric colour
// values by render time (via processColor) -- compare against that same
// conversion rather than the original hex strings.
function processed(hexColors: string[]) {
  return hexColors.map((hex) => processColor(hex));
}

import { ScreenBackdrop } from '../src/components/ScreenBackdrop';

describe('ScreenBackdrop: To Do background correction (opt-in only)', () => {
  it('without `stretch`, the wrapper is not force-grown -- every screen but To Do is untouched', async () => {
    const screen = await render(
      <ScreenBackdrop deep="#000000" tint="#ffffff" gap={8}>
        <View testID="child" />
      </ScreenBackdrop>,
    );
    const wrapper = screen.getByTestId('child').parent;
    expect(wrapper?.props.style).not.toEqual(expect.arrayContaining([expect.objectContaining({ flex: 1 })]));
  });

  it('with `stretch`, the gradient itself requests flex: 1 (no fixed height) so it fills a short/empty content area all the way down to the tab bar', async () => {
    const screen = await render(
      <ScreenBackdrop deep="#000000" tint="#ffffff" gap={8} stretch>
        <View testID="child" />
      </ScreenBackdrop>,
    );
    const gradient = screen.getByTestId('screen-backdrop-gradient');
    const flattened = [gradient.props.style].flat(Infinity);
    expect(flattened).toEqual(expect.arrayContaining([expect.objectContaining({ flex: 1 })]));
    // No fixed-height box anywhere in a stretched instance's style.
    expect(flattened.some((entry) => entry && typeof entry === 'object' && 'height' in entry)).toBe(false);
  });

  it('without `stops`, the default two-stop deep/tint fade at 0.78 is unchanged (Home/Calendar/People)', async () => {
    const screen = await render(
      <ScreenBackdrop deep="#111111" tint="#eeeeee" gap={8}>
        <View testID="child" />
      </ScreenBackdrop>,
    );
    const gradient = screen.getByTestId('screen-backdrop-gradient');
    expect(gradient.props.locations).toEqual([0, 0.78, 1]);
    expect(gradient.props.colors).toEqual(processed(['#111111', '#111111', '#eeeeee']));
  });

  it('with `stops`, a custom multi-stop distribution renders exactly as given, and the flat fill below it matches the LAST stop (no seam)', async () => {
    const stops = [
      { color: '#62764F', location: 0 },
      { color: '#62764F', location: 0.08 },
      { color: '#8D9660', location: 0.45 },
      { color: '#DCE2C8', location: 0.75 },
      { color: '#EDF0DC', location: 1 },
    ];
    const screen = await render(
      <ScreenBackdrop deep="#62764F" tint="#DCE2C8" gap={8} stops={stops}>
        <View testID="child" />
      </ScreenBackdrop>,
    );
    const gradient = screen.getByTestId('screen-backdrop-gradient');
    expect(gradient.props.locations).toEqual(stops.map((stop) => stop.location));
    expect(gradient.props.colors).toEqual(processed(stops.map((stop) => stop.color)));

    const wrapper = screen.getByTestId('child').parent;
    const flattened = [wrapper?.props.style].flat(Infinity);
    expect(flattened).toEqual(expect.arrayContaining([expect.objectContaining({ backgroundColor: '#EDF0DC' })]));
  });
});
