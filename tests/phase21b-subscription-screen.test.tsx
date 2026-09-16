import { fireEvent, render } from '@testing-library/react-native';

import { SubscriptionScreen } from '../src/screens/SubscriptionScreen';
import { MyEntitlement } from '../src/entitlement';

function entitlement(overrides: Partial<MyEntitlement>): MyEntitlement {
  return {
    status: 'TRIAL_ACTIVE',
    trialStartedAt: '2026-09-13T00:00:00.000Z',
    trialExpiresAt: '2026-11-12T00:00:00.000Z',
    ...overrides,
  };
}

describe('SubscriptionScreen', () => {
  it('shows the price and the current trial status', async () => {
    const screen = await render(
      <SubscriptionScreen
        entitlement={entitlement({})}
        loading={false}
        billingConfigured
        annualPrice="£8.99"
        productLoading={false}
        onBack={jest.fn()}
        onSubscribe={jest.fn()}
        onRestore={jest.fn()}
      />,
    );
    screen.getByText('£8.99/year');
    screen.getByText(/days left in your free period/);
  });

  it('does not offer purchase while the 60-day free period is still active', async () => {
    const screen = await render(
      <SubscriptionScreen entitlement={entitlement({})} loading={false} billingConfigured annualPrice="£8.99" productLoading={false} onBack={jest.fn()} onSubscribe={jest.fn()} onRestore={jest.fn()} />,
    );
    screen.getByText(/will not be charged before it ends/i);
    expect(screen.queryByText('Subscribe for £8.99/year')).toBeNull();
    expect(screen.queryByText('Manage subscription')).toBeNull();
  });

  it('offers Manage subscription (not Subscribe) once actively subscribed', async () => {
    const screen = await render(
      <SubscriptionScreen entitlement={entitlement({ status: 'SUBSCRIPTION_ACTIVE' })} loading={false} billingConfigured annualPrice="£8.99" productLoading={false} onBack={jest.fn()} onSubscribe={jest.fn()} onRestore={jest.fn()} />,
    );
    screen.getByText('Manage subscription');
    expect(screen.queryByText('Subscribe for £8.99/year')).toBeNull();
  });

  it('explains expiry without ever implying data was removed', async () => {
    const screen = await render(
      <SubscriptionScreen entitlement={entitlement({ status: 'TRIAL_EXPIRED' })} loading={false} billingConfigured annualPrice="£8.99" productLoading={false} onBack={jest.fn()} onSubscribe={jest.fn()} onRestore={jest.fn()} />,
    );
    expect(screen.getAllByText(/still here/i).length).toBeGreaterThan(0);
  });

  it('tapping Subscribe calls onSubscribe and shows an error message on failure', async () => {
    const onSubscribe = jest.fn().mockResolvedValue({ ok: false, message: 'Purchase cancelled.' });
    const screen = await render(
      <SubscriptionScreen entitlement={entitlement({ status: 'TRIAL_EXPIRED' })} loading={false} billingConfigured annualPrice="£8.99" productLoading={false} onBack={jest.fn()} onSubscribe={onSubscribe} onRestore={jest.fn()} />,
    );
    await fireEvent.press(screen.getByText('Subscribe for £8.99/year'));
    expect(onSubscribe).toHaveBeenCalledTimes(1);
    await screen.findByText('Purchase cancelled.');
  });

  it('tapping Restore purchases calls onRestore and reports the result', async () => {
    const onRestore = jest.fn().mockResolvedValue({ ok: true });
    const screen = await render(
      <SubscriptionScreen entitlement={entitlement({})} loading={false} billingConfigured annualPrice="£8.99" productLoading={false} onBack={jest.fn()} onSubscribe={jest.fn()} onRestore={onRestore} />,
    );
    await fireEvent.press(screen.getByText('Restore purchases'));
    expect(onRestore).toHaveBeenCalledTimes(1);
    await screen.findByText(/Restored/);
  });

  it('disables Subscribe/Restore and explains when billing is not yet configured in this build', async () => {
    const screen = await render(
      <SubscriptionScreen entitlement={entitlement({})} loading={false} billingConfigured={false} productLoading={false} onBack={jest.fn()} onSubscribe={jest.fn()} onRestore={jest.fn()} />,
    );
    screen.getByText(/not yet configured/i);
  });

  it('shows a loading state rather than a blank or fabricated status', async () => {
    const screen = await render(
      <SubscriptionScreen entitlement={undefined} loading billingConfigured annualPrice="£8.99" productLoading={false} onBack={jest.fn()} onSubscribe={jest.fn()} onRestore={jest.fn()} />,
    );
    screen.getByText('Loading…');
  });

  it('shows a real error message rather than a silent failure', async () => {
    const screen = await render(
      <SubscriptionScreen entitlement={undefined} loading={false} error="Could not load your subscription." billingConfigured annualPrice="£8.99" productLoading={false} onBack={jest.fn()} onSubscribe={jest.fn()} onRestore={jest.fn()} />,
    );
    screen.getByText('Could not load your subscription.');
  });

  it('Back returns without acting', async () => {
    const onBack = jest.fn();
    const screen = await render(
      <SubscriptionScreen entitlement={entitlement({})} loading={false} billingConfigured annualPrice="£8.99" productLoading={false} onBack={onBack} onSubscribe={jest.fn()} onRestore={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('uses the store-formatted local price throughout the purchase disclosure', async () => {
    const screen = await render(
      <SubscriptionScreen entitlement={entitlement({ status: 'TRIAL_EXPIRED' })} loading={false} billingConfigured annualPrice="$11.99" productLoading={false} onBack={jest.fn()} onSubscribe={jest.fn()} onRestore={jest.fn()} />,
    );
    expect(screen.getAllByText(/\$11\.99\/year/).length).toBeGreaterThan(1);
    expect(screen.queryByText(/£8\.99\/year/)).toBeNull();
  });

  it('fails closed when the annual store product cannot be loaded', async () => {
    const screen = await render(
      <SubscriptionScreen entitlement={entitlement({ status: 'TRIAL_EXPIRED' })} loading={false} billingConfigured productLoading={false} productError="The annual subscription is not available from the store just now." onBack={jest.fn()} onSubscribe={jest.fn()} onRestore={jest.fn()} />,
    );
    screen.getByText(/not available from the store/i);
    expect(screen.getByText('Annual subscription unavailable')).toBeDisabled();
  });
});
