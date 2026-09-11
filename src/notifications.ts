import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
// Type-only import: erased at compile time, so it has no runtime side
// effect. The actual module is loaded lazily by notifications() below --
// see the IS_EXPO_GO comment for why a plain top-level `import` of the
// real module is exactly what crashes the app.
import type * as NotificationsModule from 'expo-notifications';

import {
  ALL_REMINDER_OFFSET_KEYS,
  applyQuietHours,
  QuietHours,
  reminderBody,
  reminderNotificationId,
  reminderOccasionsForRecord,
  reminderTitle,
  ReminderOffsetKey,
  snoozeNotificationId,
} from './reminders';
import { LilicaRecord } from './types';

// Phase 14: the thin platform boundary. Everything domain-meaningful
// (which occasions, what they say, quiet-hours policy) lives in
// reminders.ts as plain functions; this file only talks to the OS. Every
// call is guarded for web, where local scheduled notifications are not
// supported -- guards return safe no-op/unsupported results rather than
// throwing, so web export and runtime never break (brief section 46).

const SETTINGS_KEY = 'lilica:notificationSettings:v1';

// Fixed since this crash was found on a physical Android device: merely
// IMPORTING expo-notifications (not calling anything in particular)
// registers an internal push-token listener at module load time, and on
// Android under Expo Go that registration THROWS ("[runtime not ready]",
// crashing the whole app) rather than warning, because Expo Go removed
// push entirely in SDK 53. iOS only warns, which is why this previously
// looked like it "mostly worked" there. A real development build is
// unaffected (it isn't Expo Go), so this only ever downgrades the
// in-Expo-Go experience to exactly what was already documented as
// unsupported -- see docs/PHASE_14_ARCHITECTURE.md and docs/PHASE_14_QA.md.
// appOwnership (not executionEnvironment) is used deliberately: it is the
// only field that tells Expo Go apart from a dev-client build, which
// reports the same executionEnvironment but must keep full support.
const IS_EXPO_GO = Constants.appOwnership === 'expo';
const SUPPORTED = (Platform.OS === 'ios' || Platform.OS === 'android') && !IS_EXPO_GO;

// The real expo-notifications module is required lazily, and only from
// inside a call already guarded by `if (!SUPPORTED) return`, so its
// module-scope side effect never runs at all in Expo Go or on web.
let cachedNotifications: typeof NotificationsModule | undefined;
function notifications(): typeof NotificationsModule {
  if (!cachedNotifications) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedNotifications = require('expo-notifications');
  }
  return cachedNotifications as typeof NotificationsModule;
}

export type PermissionState = 'unsupported' | 'undetermined' | 'granted' | 'denied';

export type NotificationSettings = {
  // Master opt-in. False until the user explicitly turns reminders on --
  // never requested or assumed at launch/onboarding (brief section 13).
  remindersEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHours: QuietHours;
};

export const DEFAULT_QUIET_HOURS: QuietHours = { startHour: 21, startMinute: 0, endHour: 8, endMinute: 0 };

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  remindersEnabled: false,
  quietHoursEnabled: false,
  quietHours: DEFAULT_QUIET_HOURS,
};

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Foreground presentation: a calm banner, no alarm-style intrusiveness.
export function configureNotificationHandler() {
  if (!SUPPORTED) return;
  notifications().setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    void notifications().setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: notifications().AndroidImportance.DEFAULT,
      sound: undefined,
    });
  }
}

export async function getPermissionState(): Promise<PermissionState> {
  if (!SUPPORTED) return 'unsupported';
  const result = await notifications().getPermissionsAsync();
  if (result.granted) return 'granted';
  if (result.status === 'denied') return 'denied';
  return 'undetermined';
}

// Only ever called from an explicit reminder-value moment (the user turning
// reminders on, or enabling one for a record) -- never on launch or during
// unrelated onboarding (brief section 13).
export async function requestPermission(): Promise<PermissionState> {
  if (!SUPPORTED) return 'unsupported';
  const result = await notifications().requestPermissionsAsync();
  if (result.granted) return 'granted';
  if (result.status === 'denied') return 'denied';
  return 'undetermined';
}

export type ReminderNotificationData = {
  recordId: string;
  careSpaceId: string;
  offsetKey: ReminderOffsetKey;
};

async function scheduleOne(
  identifier: string,
  record: LilicaRecord,
  offsetKey: ReminderOffsetKey,
  fireAt: Date,
  careSpaceId: string,
  personName?: string,
) {
  if (!SUPPORTED) return;
  if (fireAt.getTime() <= Date.now()) return;
  const data: ReminderNotificationData = { recordId: record.id, careSpaceId, offsetKey };
  await notifications().scheduleNotificationAsync({
    identifier,
    content: {
      title: reminderTitle(record, personName),
      body: reminderBody(record, offsetKey),
      data,
    },
    trigger: { type: notifications().SchedulableTriggerInputTypes.DATE, date: fireAt, channelId: 'reminders' },
  });
}

async function cancelIfScheduled(identifier: string) {
  if (!SUPPORTED) return;
  try {
    await notifications().cancelScheduledNotificationAsync(identifier);
  } catch {
    // Nothing was scheduled under this identifier -- not an error.
  }
}

// Cancels every identifier a record could plausibly still hold under a
// given schedule version. Safe to call even when nothing is scheduled.
export async function cancelRecordReminders(recordId: string, version: number) {
  await Promise.all(ALL_REMINDER_OFFSET_KEYS.map((key) => cancelIfScheduled(reminderNotificationId(recordId, key, version))));
}

// The one reconciliation entry point (brief sections 19-21): call this
// after ANY save, completion, cancellation or removal of a reminder-
// eligible record. It cancels whatever the previous schedule version may
// have left pending, then -- only if the record is still eligible, not
// completed/cancelled, and reminders are enabled both globally and for
// this record -- schedules fresh occasions under the new version.
// Idempotent: calling it twice with the same inputs leaves the same set of
// scheduled notifications, never duplicates.
export async function reconcileRecordReminders(
  record: LilicaRecord,
  previousScheduleVersion: number | undefined,
  careSpaceId: string,
  personName: string | undefined,
  settings: NotificationSettings,
) {
  if (!SUPPORTED) return;
  const currentVersion = record.reminderScheduleVersion ?? 0;
  if (previousScheduleVersion !== undefined && previousScheduleVersion !== currentVersion) {
    await cancelRecordReminders(record.id, previousScheduleVersion);
  }
  await cancelRecordReminders(record.id, currentVersion);

  if (!settings.remindersEnabled) return;
  const occasions = reminderOccasionsForRecord(record);
  await Promise.all(occasions.map((occasion) => {
    const fireAt = settings.quietHoursEnabled ? applyQuietHours(occasion.fireAt, settings.quietHours) : occasion.fireAt;
    const identifier = reminderNotificationId(record.id, occasion.key, currentVersion);
    return scheduleOne(identifier, record, occasion.key, fireAt, careSpaceId, personName);
  }));
}

// A small, restrained snooze set (brief section 22) -- never a full
// alarm-clock interface. Creates one new, separately-namespaced delivery;
// never modifies the record's own due/event date.
export type SnoozeOption = 'laterToday' | 'tomorrow';

// The record's own natural ceiling for a snooze: an appointment's start
// time, or the end of the due date for a date-only item. Snoozing past this
// point would no longer make sense (brief section 22).
function snoozeCeiling(record: LilicaRecord): Date | undefined {
  if (record.type === 'appointment') {
    const date = record.eventDate ?? record.date;
    if (!date) return undefined;
    const [year, month, day] = date.split('-').map(Number);
    const time = record.eventTime ?? record.time;
    if (time) {
      const [hour, minute] = time.split(':').map(Number);
      if (!Number.isNaN(hour) && !Number.isNaN(minute)) return new Date(year, month - 1, day, hour, minute);
    }
    return new Date(year, month - 1, day, 23, 59);
  }
  const date = record.dueDate ?? record.date;
  if (!date) return undefined;
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59);
}

export async function snoozeReminder(
  record: LilicaRecord,
  offsetKey: ReminderOffsetKey,
  option: SnoozeOption,
  careSpaceId: string,
  personName: string | undefined,
) {
  if (!SUPPORTED) return;
  const now = new Date();
  const fireAt = option === 'laterToday'
    ? new Date(now.getTime() + 3 * 60 * 60 * 1000)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
  const ceiling = snoozeCeiling(record);
  if (ceiling && fireAt.getTime() >= ceiling.getTime()) return;
  const identifier = snoozeNotificationId(record.id, offsetKey, record.reminderScheduleVersion ?? 0, now.getTime());
  await scheduleOne(identifier, record, offsetKey, fireAt, careSpaceId, personName);
}

// The global mute (brief section 24): cancels every pending local
// notification outright. A blunt but correct instrument for "turn
// reminders off entirely" -- individual per-record reminders are re-derived
// and rescheduled the next time each record is saved with reminders back on.
export async function disableAllReminders() {
  if (!SUPPORTED) return;
  await notifications().cancelAllScheduledNotificationsAsync();
}

export function extractReminderData(data: unknown): ReminderNotificationData | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const value = data as Partial<ReminderNotificationData>;
  if (typeof value.recordId === 'string' && typeof value.careSpaceId === 'string' && typeof value.offsetKey === 'string') {
    return { recordId: value.recordId, careSpaceId: value.careSpaceId, offsetKey: value.offsetKey as ReminderOffsetKey };
  }
  return undefined;
}

export function addNotificationResponseListener(handler: (data: ReminderNotificationData) => void) {
  if (!SUPPORTED) return { remove: () => undefined };
  const subscription = notifications().addNotificationResponseReceivedListener((response) => {
    const data = extractReminderData(response.notification.request.content.data);
    if (data) handler(data);
  });
  return subscription;
}
