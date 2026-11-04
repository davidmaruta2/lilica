import { render } from '@testing-library/react-native';

import { SubscriptionScreen } from '../src/screens/SubscriptionScreen';

const mockTrack = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/activationEvents', () => ({
  trackActivationEvent: (...args: unknown[]) => mockTrack(...args),
  trackActivationEventForCurrentUser: (...args: unknown[]) => mockTrack(...args),
}));

describe('activation event wiring', () => {
  beforeEach(() => mockTrack.mockClear());

  it('records paywall_viewed once when the Subscription screen opens, with the name only', async () => {
    await render(
      <SubscriptionScreen
        entitlement={{ status: 'TRIAL_ACTIVE', trialStartedAt: '2026-09-13T00:00:00.000Z', trialExpiresAt: '2026-11-12T00:00:00.000Z' }}
        loading={false}
        billingConfigured
        annualPrice="£8.99"
        productLoading={false}
        onBack={jest.fn()}
        onSubscribe={jest.fn()}
        onRestore={jest.fn()}
      />,
    );
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith('paywall_viewed');
  });
});
