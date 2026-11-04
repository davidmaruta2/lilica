// Growth plan item 5: privacy-safe first-party activation events.
// Server side: supabase/migrations/20261104090000_activation_events.sql.
//
// Deliberately tiny and deliberately unable to carry data: an event is just
// a name from a fixed list. No record, person, care-space or free-text
// value can be attached, there is no third-party SDK, and every failure is
// swallowed so tracking can never affect the app.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from './auth/client';

export type ActivationEventName =
  | 'account_ready'
  | 'person_added'
  | 'first_record_added'
  | 'invite_created'
  | 'care_summary_created'
  | 'paywall_viewed'
  | 'trial_notice_viewed'
  | 'review_prompt_shown';

const STORAGE_PREFIX = 'lilica.activationEvents.v1.';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

async function readSent(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

async function writeSent(userId: string, sent: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify([...sent]));
  } catch {
    // Local bookkeeping only; the server is idempotent anyway.
  }
}

// Fire-and-forget. Each event is attempted until the server has accepted it
// once per user per device; the server also ignores repeats, so a reinstall
// or a second device is harmless.
export async function trackActivationEvent(userId: string | undefined, eventName: ActivationEventName): Promise<void> {
  if (!userId) return;
  try {
    const sent = await readSent(userId);
    if (sent.has(eventName)) return;
    const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;
    const version = Constants.expoConfig?.version ?? null;
    const { error } = await supabase.rpc('log_activation_event', {
      p_event_name: eventName,
      p_platform: platform,
      p_app_version: version,
    });
    if (error) return;
    sent.add(eventName);
    await writeSent(userId, sent);
  } catch {
    // Never let measurement affect the app.
  }
}

// For call sites that live below the UI layer and do not know the user id.
export async function trackActivationEventForCurrentUser(eventName: ActivationEventName): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    await trackActivationEvent(data.session?.user.id, eventName);
  } catch {
    // Never let measurement affect the app.
  }
}
