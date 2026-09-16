import { fireEvent, render } from '@testing-library/react-native';

import { ReadOnlyGate } from '../src/components/ReadOnlyGate';

// Phase 21C: the one reusable read-only/commercial-state modal. Two
// distinct variants (brief section 16/17) -- a commercial owner sees a
// genuine Subscribe route, a collaborator never sees anything implying
// their OWN subscription would help, and never sees the owner's raw
// entitlement status.

describe('ReadOnlyGate: commercial owner variant', () => {
  it('shows the approved calm copy and a real Subscribe action, never alarming language', async () => {
    const onSubscribe = jest.fn();
    const screen = await render(
      <ReadOnlyGate visible isCommercialOwner ownerEntitlementStatus="TRIAL_EXPIRED" onSubscribe={onSubscribe} onClose={jest.fn()} />,
    );
    screen.getByText('Your free period has ended');
    screen.getByText(/your information is safe/i);
    screen.getByText(/local store price/i);
    fireEvent.press(screen.getByText('View annual subscription'));
    expect(onSubscribe).toHaveBeenCalledTimes(1);
    // No alarming/urgency language anywhere in this variant.
    expect(screen.queryByText(/act now/i)).toBeNull();
    expect(screen.queryByText(/expires soon/i)).toBeNull();
  });

  it('reflects a real SUBSCRIPTION_EXPIRED status distinctly from a lapsed trial', async () => {
    const screen = await render(
      <ReadOnlyGate visible isCommercialOwner ownerEntitlementStatus="SUBSCRIPTION_EXPIRED" onSubscribe={jest.fn()} onClose={jest.fn()} />,
    );
    screen.getByText('Your subscription has ended');
  });

  it('"Not now" dismisses without acting', async () => {
    const onClose = jest.fn();
    const onSubscribe = jest.fn();
    const screen = await render(
      <ReadOnlyGate visible isCommercialOwner onSubscribe={onSubscribe} onClose={onClose} />,
    );
    fireEvent.press(screen.getByText('Not now'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubscribe).not.toHaveBeenCalled();
  });
});

describe('ReadOnlyGate: collaborator variant -- never implies their own subscription, never exposes the owner\'s billing', () => {
  it('shows only the functional read-only explanation, with no Subscribe action', async () => {
    const screen = await render(
      <ReadOnlyGate visible isCommercialOwner={false} onSubscribe={jest.fn()} onClose={jest.fn()} />,
    );
    screen.getByText('This care space is currently read-only');
    screen.getByText(/existing information is still available/i);
    expect(screen.queryByText(/subscribe/i)).toBeNull();
    expect(screen.queryByText(/your subscription/i)).toBeNull();
    expect(screen.queryByText(/£8\.99/)).toBeNull();
  });

  it('OK dismisses without any subscribe callback', async () => {
    const onClose = jest.fn();
    const onSubscribe = jest.fn();
    const screen = await render(
      <ReadOnlyGate visible isCommercialOwner={false} onSubscribe={onSubscribe} onClose={onClose} />,
    );
    fireEvent.press(screen.getByText('OK'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubscribe).not.toHaveBeenCalled();
  });
});

describe('ReadOnlyGate: never shown unless visible', () => {
  it('renders nothing observable when visible=false', async () => {
    const screen = await render(
      <ReadOnlyGate visible={false} isCommercialOwner onSubscribe={jest.fn()} onClose={jest.fn()} />,
    );
    expect(screen.queryByText('Your free period has ended')).toBeNull();
  });
});
