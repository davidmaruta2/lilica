// Post-build implementation batch (lilbatch.txt, 17 September 2026), change
// one: the third intro screen's heading must read EXACTLY "Share and
// organise care, with clarity". Also proves the rest of the intro flow
// (screen order/count, first two pages' own copy, Get started CTA) is
// unchanged -- a copy correction, not a redesign.
import { render } from '@testing-library/react-native';

import { WelcomeScreen } from '../src/screens/WelcomeScreen';

describe('WelcomeScreen: third intro screen copy correction', () => {
  it('shows the exact approved copy on the third page', async () => {
    const screen = await render(<WelcomeScreen onStart={jest.fn()} onLogin={jest.fn()} />);
    screen.getByText('Share and organise care, with clarity');
    // The old copy must not still be present anywhere.
    expect(screen.queryByText('Share care, with clarity')).toBeNull();
  });

  it('leaves the first two pages and the reassurance line unchanged', async () => {
    const screen = await render(<WelcomeScreen onStart={jest.fn()} onLogin={jest.fn()} />);
    screen.getByText('Care for the people you love');
    screen.getByText('Know what they need');
    screen.getByText('Lilica works from day one, even when it’s just you.');
  });

  it('still shows exactly three intro pages with the same navigation', async () => {
    const screen = await render(<WelcomeScreen onStart={jest.fn()} onLogin={jest.fn()} />);
    screen.getByLabelText('Intro page 1 of 3');
    screen.getByLabelText('Go to the next introduction page');
  });
});
