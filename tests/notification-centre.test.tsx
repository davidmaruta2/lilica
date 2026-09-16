import AsyncStorage from '@react-native-async-storage/async-storage';
import { render } from '@testing-library/react-native';

import { ActivityEvent } from '../src/activity';
import { NotificationBellButton } from '../src/components/NotificationBellButton';
import {
  buildNotificationCentreItems,
  loadNotificationLastViewedAt,
  saveNotificationLastViewedAt,
  unreadNotificationCount,
} from '../src/notificationCentre';
import { LilicaRecord } from '../src/types';

const now = new Date('2026-09-16T12:00:00');

const records: LilicaRecord[] = [
  { id: 'overdue', type: 'task', title: 'Collect prescription', status: 'unresolved', dueDate: '2026-09-15', remindersEnabled: true, createdAt: '2026-09-01T09:00:00.000Z' },
  { id: 'appointment', type: 'appointment', title: 'Dentist', status: 'unresolved', eventDate: '2026-09-16', eventTime: '14:00', remindersEnabled: true, createdAt: '2026-09-01T09:00:00.000Z' },
];

const activity: ActivityEvent[] = [
  {
    id: 'other-change',
    eventType: 'record_created',
    recordId: 'appointment',
    recordDomain: 'health',
    metadata: { title: 'Dentist', recordType: 'appointment' },
    createdAt: '2026-09-16T11:30:00.000Z',
    actorMembershipId: 'membership-other',
    actorDisplayName: 'Gillian',
    actorIsFormer: false,
  },
];

describe('notification centre model', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('combines Care Circle activity, overdue attention and fired reminders without duplicating an overdue reminder', () => {
    const items = buildNotificationCentreItems({
      records,
      activity,
      activeMembershipId: 'membership-me',
      personName: 'Ben',
      remindersEnabled: true,
      now,
    });

    expect(items.map((item) => item.kind)).toEqual(['careCircle', 'reminder', 'overdue']);
    expect(items.find((item) => item.kind === 'careCircle')?.body).toContain('Gillian');
    expect(items.find((item) => item.kind === 'overdue')?.body).toBe('Collect prescription needs attention for Ben');
    expect(items.filter((item) => item.recordId === 'overdue')).toHaveLength(1);
  });

  it('counts only items newer than the scoped last-viewed marker', () => {
    const items = buildNotificationCentreItems({ records, activity, activeMembershipId: 'membership-me', remindersEnabled: true, now });
    expect(unreadNotificationCount(items)).toBe(3);
    expect(unreadNotificationCount(items, '2026-09-16T11:00:00.000Z')).toBe(1);
    expect(unreadNotificationCount(items, '2026-09-16T12:01:00.000Z')).toBe(0);
  });

  it('persists read state independently by account and care space', async () => {
    await saveNotificationLastViewedAt('owner-a', 'care-a', '2026-09-16T12:00:00.000Z');
    expect(await loadNotificationLastViewedAt('owner-a', 'care-a')).toBe('2026-09-16T12:00:00.000Z');
    expect(await loadNotificationLastViewedAt('owner-a', 'care-b')).toBeUndefined();
    expect(await loadNotificationLastViewedAt('owner-b', 'care-a')).toBeUndefined();
  });
});

describe('NotificationBellButton', () => {
  it('shows the unread badge and exposes the count in its accessible label', async () => {
    const screen = await render(<NotificationBellButton count={7} onPress={jest.fn()} />);
    screen.getByTestId('notification-badge');
    screen.getByRole('button', { name: 'Notifications, 7 unread' });
  });

  it('omits the badge when everything has been viewed', async () => {
    const screen = await render(<NotificationBellButton count={0} onPress={jest.fn()} />);
    expect(screen.queryByTestId('notification-badge')).toBeNull();
    screen.getByRole('button', { name: 'Notifications' });
  });
});
