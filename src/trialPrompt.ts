// Growth item 1: calm, optional heads-up before the 60-day free period
// ends. Pure functions plus one thin notification scheduler. Entitlement
// itself stays server-authoritative (see src/entitlement.ts) - nothing
// here ever decides access, it only decides what to *say* and when.
//
// Rules carried over from the billing brief: no countdown badge, no fake
// urgency, no health information in any notification text, and
// notification permission is NEVER requested here (it is only ever
// requested at a reminder-value moment - see src/notifications.ts).

import { daysRemaining, MyEntitlement } from './entitlement';

// The Home notice appears for the last two weeks of the free period.
export const TRIAL_NOTICE_WINDOW_DAYS = 14;
// Local notifications fire this many days before the free period ends.
export const TRIAL_NOTIFICATION_DAYS_BEFORE = [7, 2] as const;
const NOTIFICATION_HOUR_LOCAL = 10;

export type TrialNotice = { message: string; actionLabel: string };

export function trialNotice(entitlement: MyEntitlement | undefined, now = new Date()): TrialNotice | undefined {
  if (!entitlement || entitlement.status !== 'TRIAL_ACTIVE') return undefined;
  const days = daysRemaining(entitlement.trialExpiresAt, now);
  if (days <= 0 || days > TRIAL_NOTICE_WINDOW_DAYS) return undefined;
  const message = days === 1
    ? 'Your free period ends tomorrow. Everything you have added stays here.'
    : `Your free period ends in ${days} days. Everything you have added stays here.`;
  return { message, actionLabel: 'See options' };
}

export function trialNotificationIdentifier(daysBefore: number): string {
  return `trial-ending-${daysBefore}`;
}

// Fire times in local time, only those still in the future.
export function trialNotificationDates(entitlement: MyEntitlement | undefined, now = new Date()): { daysBefore: number; at: Date }[] {
  if (!entitlement || entitlement.status !== 'TRIAL_ACTIVE') return [];
  const expires = new Date(entitlement.trialExpiresAt);
  if (Number.isNaN(expires.getTime())) return [];
  const result: { daysBefore: number; at: Date }[] = [];
  for (const daysBefore of TRIAL_NOTIFICATION_DAYS_BEFORE) {
    const at = new Date(expires.getTime());
    at.setDate(at.getDate() - daysBefore);
    at.setHours(NOTIFICATION_HOUR_LOCAL, 0, 0, 0);
    if (at.getTime() > now.getTime()) result.push({ daysBefore, at });
  }
  return result;
}

export function trialNotificationBody(daysBefore: number): string {
  return daysBefore === 1
    ? 'Your Lilica free period ends tomorrow.'
    : `Your Lilica free period ends in ${daysBefore} days.`;
}
