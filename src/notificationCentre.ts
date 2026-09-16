import AsyncStorage from '@react-native-async-storage/async-storage';

import { ActivityEvent, describeActivityEvent } from './activity';
import { deriveRecordState, isActionableRecord } from './records';
import { isReminderEligible, reminderBody, ReminderOffsetKey } from './reminders';
import { LilicaRecord } from './types';

export type NotificationCentreKind = 'activity' | 'careCircle' | 'reminder' | 'overdue';

export type NotificationCentreItem = {
  id: string;
  kind: NotificationCentreKind;
  title: string;
  body: string;
  occurredAt: string;
  recordId?: string;
};

type BuildInput = {
  records: LilicaRecord[];
  activity: ActivityEvent[];
  activeMembershipId?: string;
  personName?: string;
  remindersEnabled: boolean;
  now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_HISTORY_MS = 7 * DAY_MS;

function parseLocalDate(date?: string, time?: string): Date | undefined {
  if (!date) return undefined;
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  if (time) {
    const [hour, minute] = time.split(':').map(Number);
    if (!Number.isNaN(hour) && !Number.isNaN(minute)) return new Date(year, month - 1, day, hour, minute);
  }
  return new Date(year, month - 1, day);
}

function reminderTimeline(record: LilicaRecord): { key: ReminderOffsetKey; fireAt: Date }[] {
  if (!isReminderEligible(record) || !record.remindersEnabled) return [];
  if (record.type === 'appointment') {
    const start = parseLocalDate(record.eventDate ?? record.date, record.eventTime ?? record.time);
    if (!start) return [];
    return [
      { key: 'appt-1day', fireAt: new Date(start.getTime() - DAY_MS) },
      { key: 'appt-2hour', fireAt: new Date(start.getTime() - (2 * 60 * 60 * 1000)) },
    ];
  }
  const due = parseLocalDate(record.dueDate ?? record.date);
  if (!due) return [];
  return [
    { key: 'dateOnly-3day', fireAt: new Date(due.getTime() - (3 * DAY_MS)) },
    { key: 'dateOnly-dueDay', fireAt: new Date(due.getFullYear(), due.getMonth(), due.getDate(), 9, 0) },
  ];
}

function overdueStartedAt(record: LilicaRecord): Date | undefined {
  const due = parseLocalDate(record.dueDate ?? record.date);
  if (!due) return undefined;
  return new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1);
}

export function buildNotificationCentreItems({
  records,
  activity,
  activeMembershipId,
  personName,
  remindersEnabled,
  now = new Date(),
}: BuildInput): NotificationCentreItem[] {
  const items: NotificationCentreItem[] = activity.map((event) => {
    const byAnotherMember = Boolean(activeMembershipId && event.actorMembershipId !== activeMembershipId);
    return {
      id: `activity:${event.id}`,
      kind: byAnotherMember ? 'careCircle' : 'activity',
      title: byAnotherMember ? 'Care Circle update' : 'Recent activity',
      body: describeActivityEvent(event),
      occurredAt: event.createdAt,
      recordId: event.recordId,
    };
  });

  for (const record of records) {
    const overdue = isActionableRecord(record) && deriveRecordState(record, now).overdue;
    if (overdue) {
      const occurredAt = overdueStartedAt(record);
      if (occurredAt && occurredAt.getTime() <= now.getTime()) {
        items.push({
          id: `overdue:${record.id}:${occurredAt.toISOString()}`,
          kind: 'overdue',
          title: 'Overdue',
          body: `${record.title} needs attention${personName ? ` for ${personName}` : ''}`,
          occurredAt: occurredAt.toISOString(),
          recordId: record.id,
        });
      }
    }

    if (overdue || !remindersEnabled) continue;
    const latest = reminderTimeline(record)
      .filter((occasion) => occasion.fireAt.getTime() <= now.getTime() && occasion.fireAt.getTime() >= now.getTime() - REMINDER_HISTORY_MS)
      .sort((left, right) => right.fireAt.getTime() - left.fireAt.getTime())[0];
    if (!latest) continue;
    items.push({
      id: `reminder:${record.id}:${latest.key}:${latest.fireAt.toISOString()}`,
      kind: 'reminder',
      title: 'Reminder',
      body: reminderBody(record, latest.key),
      occurredAt: latest.fireAt.toISOString(),
      recordId: record.id,
    });
  }

  return items.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export function unreadNotificationCount(items: NotificationCentreItem[], lastViewedAt?: string): number {
  if (!lastViewedAt) return items.length;
  return items.filter((item) => item.occurredAt > lastViewedAt).length;
}

function storageKey(ownerId: string, careSpaceId: string) {
  return `lilica:notificationCentre:lastViewed:v1:${ownerId}:${careSpaceId}`;
}

export async function loadNotificationLastViewedAt(ownerId: string, careSpaceId: string): Promise<string | undefined> {
  return (await AsyncStorage.getItem(storageKey(ownerId, careSpaceId))) ?? undefined;
}

export async function saveNotificationLastViewedAt(ownerId: string, careSpaceId: string, viewedAt: string): Promise<void> {
  await AsyncStorage.setItem(storageKey(ownerId, careSpaceId), viewedAt);
}
