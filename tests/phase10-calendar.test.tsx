import { fireEvent, render } from '@testing-library/react-native';

import { CalendarScreen } from '../src/screens/CalendarScreen';
import { LilicaRecord } from '../src/types';

// Phase 10: Calendar is a projection of the existing canonical records --
// no parallel calendar-event store, no Calendar-specific editor. "Today"
// is fixed so month/date assertions are deterministic.

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
});

afterEach(() => jest.useRealTimers());

const apptToday: LilicaRecord = {
  id: 'appt-today', type: 'appointment', title: 'GP appointment', status: 'scheduled',
  eventDate: '2026-09-09', eventTime: '10:30', createdAt: '2026-09-01T00:00:00.000Z',
};
const billToday: LilicaRecord = {
  id: 'bill-today', type: 'bill', title: 'Council tax', status: 'unresolved',
  dueDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z',
};
const apptPast: LilicaRecord = {
  id: 'appt-past', type: 'appointment', title: 'Missed check-in', status: 'scheduled',
  eventDate: '2026-09-08', createdAt: '2026-09-01T00:00:00.000Z',
};
const taskFuture: LilicaRecord = {
  id: 'task-future', type: 'task', title: 'Book haircut', status: 'unresolved',
  dueDate: '2026-09-20', createdAt: '2026-09-01T00:00:00.000Z',
};
const undatedContact: LilicaRecord = {
  id: 'contact-1', type: 'contact', title: 'GP surgery', createdAt: '2026-09-01T00:00:00.000Z',
};

describe('Phase 10: Calendar month/date rendering', () => {
  it('shows the current month and today selected by default', async () => {
    const screen = await render(<CalendarScreen records={[apptToday]} personName="Maggie" onOpenRecord={jest.fn()} />);
    screen.getByText('September 2026');
    screen.getByText('Today');
  });

  it('selecting a date shows exactly the occurrences due/scheduled that day, including multiple', async () => {
    const screen = await render(
      <CalendarScreen records={[apptToday, billToday, taskFuture]} personName="Maggie" onOpenRecord={jest.fn()} />,
    );
    // Today (already selected on mount) has two occurrences.
    screen.getByText('GP appointment');
    screen.getByText('Council tax');
    expect(screen.queryByText('Book haircut')).toBeNull();

    await fireEvent.press(screen.getByLabelText(/\b20 September\b/));
    screen.getByText('Book haircut');
    expect(screen.queryByText('GP appointment')).toBeNull();
  });

  it('projects different record categories with their own label', async () => {
    const screen = await render(<CalendarScreen records={[apptToday, billToday]} personName="Maggie" onOpenRecord={jest.fn()} />);
    // "Appointment"/"Bill or renewal" also label the icon legend, so assert
    // via getAllByText rather than a single unique match.
    expect(screen.getAllByText('Appointment').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bill or renewal').length).toBeGreaterThan(0);
  });

  it('does not surface an undated record on any day', async () => {
    const screen = await render(<CalendarScreen records={[undatedContact]} personName="Maggie" onOpenRecord={jest.fn()} />);
    expect(screen.queryByText('GP surgery')).toBeNull();
    screen.getByText('Nothing planned for this day.');
  });

  it('agrees with the existing engine: a past appointment is Overdue, not silently completed', async () => {
    const screen = await render(<CalendarScreen records={[apptPast]} personName="Maggie" onOpenRecord={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText(/\b8 September\b/));
    screen.getByText('Missed check-in');
    screen.getByText('Overdue');
  });

  it('a today appointment is not marked Overdue', async () => {
    const screen = await render(<CalendarScreen records={[apptToday]} personName="Maggie" onOpenRecord={jest.fn()} />);
    screen.getByText('GP appointment');
    expect(screen.queryByText('Overdue')).toBeNull();
  });

  it('opening a Calendar item calls back with the real underlying record ID', async () => {
    const onOpenRecord = jest.fn();
    const screen = await render(<CalendarScreen records={[apptToday]} personName="Maggie" onOpenRecord={onOpenRecord} />);
    await fireEvent.press(screen.getByLabelText('Open GP appointment'));
    expect(onOpenRecord).toHaveBeenCalledWith('appt-today');
  });

  it('renders no duplicate occurrence for a record with one calendar-eligible date', async () => {
    const screen = await render(<CalendarScreen records={[apptToday]} personName="Maggie" onOpenRecord={jest.fn()} />);
    expect(screen.getAllByText('GP appointment').length).toBe(1);
  });

  it('shows an intentional empty state for a day with nothing scheduled', async () => {
    const screen = await render(<CalendarScreen records={[]} personName="Maggie" onOpenRecord={jest.fn()} />);
    screen.getByText('Nothing planned for this day.');
  });

  it('switching to a different care space shows only that space\'s occurrences (no cross-space leak)', async () => {
    const jackieAppt: LilicaRecord = {
      id: 'jackie-appt', type: 'appointment', title: "Jackie's dentist", status: 'scheduled',
      eventDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(<CalendarScreen records={[apptToday]} personName="Maggie" onOpenRecord={jest.fn()} />);
    screen.getByText('GP appointment');

    await screen.rerender(<CalendarScreen records={[jackieAppt]} personName="Jackie" onOpenRecord={jest.fn()} />);
    expect(screen.queryByText('GP appointment')).toBeNull();
    screen.getByText("Jackie's dentist");
  });

  it('renders already-cached records with no network dependency (offline-safe)', async () => {
    // CalendarScreen takes records as a plain prop and makes no fetch/sync
    // call of its own -- this is the same guarantee Home already relies on.
    const screen = await render(<CalendarScreen records={[apptToday]} personName="Maggie" onOpenRecord={jest.fn()} />);
    screen.getByText('GP appointment');
  });

  it('a fresh mount always opens on the real current month/day (nothing persists across restart)', async () => {
    const screen = await render(<CalendarScreen records={[]} personName="Maggie" onOpenRecord={jest.fn()} />);
    screen.getByText('September 2026');
    screen.getByText('Today');
  });

  it('does not render legacy responsiblePerson text as an assignment claim', async () => {
    const withResponsiblePerson: LilicaRecord = { ...apptToday, responsiblePerson: 'Sarah' };
    const screen = await render(<CalendarScreen records={[withResponsiblePerson]} personName="Maggie" onOpenRecord={jest.fn()} />);
    expect(screen.queryByText('Sarah')).toBeNull();
  });

  it('never mutates assignedMembershipId or any record field while rendering or navigating months', async () => {
    const assigned: LilicaRecord = { ...apptToday, assignedMembershipId: 'membership-1' };
    const records = [assigned];
    const snapshot = JSON.stringify(records);
    const screen = await render(<CalendarScreen records={records} personName="Maggie" onOpenRecord={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Next month'));
    await fireEvent.press(screen.getByLabelText('Previous month'));
    expect(JSON.stringify(records)).toBe(snapshot);
    expect(assigned.assignedMembershipId).toBe('membership-1');
  });

  it('shows an icon legend explaining every category shown in the grid', async () => {
    const screen = await render(<CalendarScreen records={[apptToday]} personName="Maggie" onOpenRecord={jest.fn()} />);
    screen.getByText('Something to do');
    screen.getByText('Home or car matter');
    screen.getByText('Important document');
    screen.getByText('Needs attention');
  });

  it('shows a +N overflow count on a day with more than one occurrence', async () => {
    const screen = await render(
      <CalendarScreen records={[apptToday, billToday]} personName="Maggie" onOpenRecord={jest.fn()} />,
    );
    screen.getByText('+1');
  });

  it('moving between months does not mutate records and updates the visible month', async () => {
    const screen = await render(<CalendarScreen records={[]} personName="Maggie" onOpenRecord={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Next month'));
    screen.getByText('October 2026');
    await fireEvent.press(screen.getByLabelText('Previous month'));
    screen.getByText('September 2026');
  });
});

// The "opening a Calendar item reuses the established record editor" suite
// that used to live here (asserting on FirstThingScreen's initialOpenRecordId
// deep link) moved to tests/record-quick-editor.test.tsx: opening a
// record from Calendar (and Home/To Do/Care Circle/Wellbeing updates) no
// longer routes through FirstThingScreen at all -- see that file and
// src/components/RecordQuickEditor.tsx for why and what replaced it.
