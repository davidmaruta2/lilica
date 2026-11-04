import React from 'react';
import { render } from '@testing-library/react-native';

import { MyEntitlement } from '../src/entitlement';
import { HomeScreen } from '../src/screens/HomeScreen';
import { initialOnboardingState } from '../src/storage';
import {
  trialNotice,
  trialNotificationBody,
  trialNotificationDates,
  trialNotificationIdentifier,
} from '../src/trialPrompt';

const NOW = new Date('2026-12-01T09:00:00Z');

function trial(daysFromNow: number, status: MyEntitlement['status'] = 'TRIAL_ACTIVE'): MyEntitlement {
  return {
    status,
    trialStartedAt: '2026-10-01T00:00:00Z',
    trialExpiresAt: new Date(NOW.getTime() + daysFromNow * 86_400_000).toISOString(),
  };
}

describe('trialNotice', () => {
  it('is hidden for most of the free period', () => {
    expect(trialNotice(trial(40), NOW)).toBeUndefined();
    expect(trialNotice(trial(15), NOW)).toBeUndefined();
  });

  it('appears in the last 14 days with calm copy and no urgency words', () => {
    const notice = trialNotice(trial(14), NOW);
    expect(notice?.message).toBe('Your free period ends in 14 days. Everything you have added stays here.');
    expect(notice?.message).not.toMatch(/hurry|last chance|expires|don't miss/i);
    expect(trialNotice(trial(1), NOW)?.message).toBe('Your free period ends tomorrow. Everything you have added stays here.');
  });

  it('never shows for anyone who is not on an active free period', () => {
    expect(trialNotice(undefined, NOW)).toBeUndefined();
    expect(trialNotice(trial(5, 'SUBSCRIPTION_ACTIVE'), NOW)).toBeUndefined();
    expect(trialNotice(trial(5, 'TRIAL_EXPIRED'), NOW)).toBeUndefined();
    expect(trialNotice(trial(-1), NOW)).toBeUndefined();
  });
});

describe('trialNotificationDates', () => {
  it('schedules 7 and 2 days before expiry at 10:00 local, future only', () => {
    const dates = trialNotificationDates(trial(30), NOW);
    expect(dates.map((d) => d.daysBefore)).toEqual([7, 2]);
    for (const { at } of dates) {
      expect(at.getHours()).toBe(10);
      expect(at.getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it('skips dates already in the past and returns nothing outside an active trial', () => {
    expect(trialNotificationDates(trial(4), NOW).map((d) => d.daysBefore)).toEqual([2]);
    expect(trialNotificationDates(trial(1), NOW)).toEqual([]);
    expect(trialNotificationDates(trial(30, 'SUBSCRIPTION_ACTIVE'), NOW)).toEqual([]);
    expect(trialNotificationDates(undefined, NOW)).toEqual([]);
  });

  it('uses stable identifiers and health-free text', () => {
    expect(trialNotificationIdentifier(7)).toBe('trial-ending-7');
    expect(trialNotificationBody(7)).toBe('Your Lilica free period ends in 7 days.');
    expect(trialNotificationBody(2)).not.toMatch(/medic|health|condition|appointment/i);
  });
});

describe('Home trial notice', () => {
  const state = { ...initialOnboardingState, stage: 'home' as const, supportedPersonName: 'Margaret' };

  it('renders the notice and routes the action when supplied', async () => {
    const onOpen = jest.fn();
    const screen = await render(
      <HomeScreen state={state} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()}
        trialNotice={{ message: 'Your free period ends in 10 days. Everything you have added stays here.', actionLabel: 'See options' }}
        onOpenTrialOptions={onOpen} />,
    );
    screen.getByTestId('home-trial-notice');
    screen.getByText('Your free period ends in 10 days. Everything you have added stays here.');
    screen.getByText('See options');
  });

  it('renders nothing when there is no notice', async () => {
    const screen = await render(<HomeScreen state={state} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />);
    expect(screen.queryByTestId('home-trial-notice')).toBeNull();
  });
});
