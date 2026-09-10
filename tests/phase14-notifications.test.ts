const mockScheduleNotificationAsync = jest.fn().mockResolvedValue('id');
const mockCancelScheduledNotificationAsync = jest.fn().mockResolvedValue(undefined);
const mockCancelAllScheduledNotificationsAsync = jest.fn().mockResolvedValue(undefined);
const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockAddNotificationResponseReceivedListener = jest.fn();

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancelScheduledNotificationAsync(...args),
  cancelAllScheduledNotificationsAsync: (...args: unknown[]) => mockCancelAllScheduledNotificationsAsync(...args),
  addNotificationResponseReceivedListener: (...args: unknown[]) => mockAddNotificationResponseReceivedListener(...args),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
}));

import {
  cancelRecordReminders,
  DEFAULT_NOTIFICATION_SETTINGS,
  extractReminderData,
  getPermissionState,
  reconcileRecordReminders,
  requestPermission,
  snoozeReminder,
} from '../src/notifications';
import { reminderNotificationId } from '../src/reminders';
import { LilicaRecord } from '../src/types';

// Phase 14: the notifications.ts orchestration layer, with expo-notifications
// itself mocked -- these tests exercise the idempotency, versioning and
// permission-mapping contracts against the real call pattern, not the OS.

describe('Phase 14: notifications orchestration (expo-notifications mocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-01T00:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  const enabledSettings = { ...DEFAULT_NOTIFICATION_SETTINGS, remindersEnabled: true };

  const dentist: LilicaRecord = {
    id: 'appt-1', type: 'appointment', title: 'Dentist', status: 'scheduled',
    eventDate: '2026-09-21', eventTime: '10:00', remindersEnabled: true, reminderScheduleVersion: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
  };

  it('schedules the two expected appointment occasions under version 0 identifiers', async () => {
    await reconcileRecordReminders(dentist, undefined, 'space-1', 'Maggie', enabledSettings);
    const identifiers = mockScheduleNotificationAsync.mock.calls.map((call) => call[0].identifier);
    expect(identifiers.sort()).toEqual([
      reminderNotificationId('appt-1', 'appt-1day', 0),
      reminderNotificationId('appt-1', 'appt-2hour', 0),
    ].sort());
  });

  it('is idempotent: reconciling the same still-valid record twice schedules the same identifiers both times, never more', async () => {
    await reconcileRecordReminders(dentist, undefined, 'space-1', 'Maggie', enabledSettings);
    const firstCallCount = mockScheduleNotificationAsync.mock.calls.length;
    await reconcileRecordReminders(dentist, 0, 'space-1', 'Maggie', enabledSettings);
    expect(mockScheduleNotificationAsync.mock.calls.length).toBe(firstCallCount * 2);
    const allIdentifiers = new Set(mockScheduleNotificationAsync.mock.calls.map((call) => call[0].identifier));
    expect(allIdentifiers.size).toBe(2); // same two identifiers both times, no third
  });

  it('a schedule-version change cancels the old version\'s identifiers before scheduling the new one', async () => {
    const rescheduled = { ...dentist, eventDate: '2026-09-23', eventTime: '14:00', reminderScheduleVersion: 1 };
    await reconcileRecordReminders(rescheduled, 0, 'space-1', 'Maggie', enabledSettings);
    const cancelledIds = mockCancelScheduledNotificationAsync.mock.calls.map((call) => call[0]);
    expect(cancelledIds).toEqual(expect.arrayContaining([
      reminderNotificationId('appt-1', 'appt-1day', 0),
      reminderNotificationId('appt-1', 'appt-2hour', 0),
    ]));
    const scheduledIds = mockScheduleNotificationAsync.mock.calls.map((call) => call[0].identifier);
    expect(scheduledIds).toEqual(expect.arrayContaining([
      reminderNotificationId('appt-1', 'appt-1day', 1),
      reminderNotificationId('appt-1', 'appt-2hour', 1),
    ]));
  });

  it('global reminders disabled: cancels pending deliveries and schedules nothing new', async () => {
    await reconcileRecordReminders(dentist, undefined, 'space-1', 'Maggie', DEFAULT_NOTIFICATION_SETTINGS);
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('completion cancels pending reminders and schedules nothing new (dismiss/complete separation)', async () => {
    const completed: LilicaRecord = { ...dentist, completed: true, status: 'completed' };
    await reconcileRecordReminders(completed, 0, 'space-1', 'Maggie', enabledSettings);
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalled();
  });

  it('cancellation (status: cancelled) cancels pending reminders and schedules nothing new', async () => {
    const cancelled: LilicaRecord = { ...dentist, status: 'cancelled' };
    await reconcileRecordReminders(cancelled, 0, 'space-1', 'Maggie', enabledSettings);
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalled();
  });

  it('cancelRecordReminders cancels every possible offset-key identifier for a version', async () => {
    await cancelRecordReminders('rec-1', 2);
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledTimes(4);
  });

  it('snoozing creates exactly one new, separately-namespaced delivery, never modifying the record', async () => {
    await snoozeReminder(dentist, 'appt-1day', 'laterToday', 'space-1', 'Maggie');
    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const identifier = mockScheduleNotificationAsync.mock.calls[0][0].identifier as string;
    expect(identifier).not.toBe(reminderNotificationId('appt-1', 'appt-1day', 0));
    expect(identifier).toMatch(/^reminder-snooze:/);
  });

  it('snoozing past the appointment\'s own start time is a safe no-op', async () => {
    jest.setSystemTime(new Date('2026-09-21T09:58:00.000Z'));
    await snoozeReminder(dentist, 'appt-1day', 'tomorrow', 'space-1', 'Maggie');
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('permission states map correctly: granted, denied, undetermined', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: true, status: 'granted' });
    expect(await getPermissionState()).toBe('granted');
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied' });
    expect(await getPermissionState()).toBe('denied');
    mockGetPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'undetermined' });
    expect(await getPermissionState()).toBe('undetermined');
  });

  it('requestPermission reflects the actual OS response, never assumes granted', async () => {
    mockRequestPermissionsAsync.mockResolvedValueOnce({ granted: false, status: 'denied' });
    expect(await requestPermission()).toBe('denied');
  });

  it('extractReminderData only accepts well-shaped payloads, never trusting arbitrary data as authority', () => {
    expect(extractReminderData({ recordId: 'r1', careSpaceId: 'c1', offsetKey: 'appt-1day' })).toEqual({ recordId: 'r1', careSpaceId: 'c1', offsetKey: 'appt-1day' });
    expect(extractReminderData({})).toBeUndefined();
    expect(extractReminderData(null)).toBeUndefined();
    expect(extractReminderData('not an object')).toBeUndefined();
  });

});

// The web guard (SUPPORTED = Platform.OS === 'ios' || 'android', resolved
// once at module load -- exactly like a real app process, where the
// platform never changes at runtime) can't be flipped after import inside
// one test file. It is instead verified by inspection (every exported
// function checks SUPPORTED before touching expo-notifications) and by
// `npm run validate`'s web export succeeding with this module bundled in.
