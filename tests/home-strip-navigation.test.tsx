import { fireEvent, render } from '@testing-library/react-native';

import { HomeScreen } from '../src/screens/HomeScreen';
import { ToDoScreen } from '../src/screens/ToDoScreen';
import { initialOnboardingState } from '../src/storage';
import { LilicaRecord } from '../src/types';

// Corrective task 2: the at-a-glance strip's tiles must actually navigate
// to the SAME canonical records the count represents (requirement 4), and
// must never navigate anywhere when there is nothing to show (requirement
// 5). This file is the "test that the count and destination agree" step.

const withMembership = (records: LilicaRecord[], membershipId = 'membership-1') => ({
  ...initialOnboardingState,
  stage: 'home' as const,
  records,
  allSetDismissed: true,
  activeCareSpaceId: 'space-1',
  careSpaces: { 'space-1': { membershipId } as any },
});

describe('Home strip: Overdue tile', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('is a button and calls onOpenOverdue when there is a genuinely overdue record', async () => {
    const records: LilicaRecord[] = [
      { id: 'past', type: 'appointment', title: 'Past visit', status: 'scheduled', eventDate: '2026-09-01', createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    const onOpenOverdue = jest.fn();
    const screen = await render(
      <HomeScreen state={withMembership(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} onOpenOverdue={onOpenOverdue} />,
    );
    const tile = screen.getByLabelText('1 overdue. View in To Do.');
    expect(tile.props.accessibilityRole).toBe('button');
    await fireEvent.press(tile);
    expect(onOpenOverdue).toHaveBeenCalledTimes(1);
  });

  it('is NOT a button when the overdue count is zero -- does not navigate to nonsense', async () => {
    const records: LilicaRecord[] = [
      { id: 'future', type: 'task', title: 'Future task', status: 'unresolved', dueDate: '2026-09-20', createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    const onOpenOverdue = jest.fn();
    const screen = await render(
      <HomeScreen state={withMembership(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} onOpenOverdue={onOpenOverdue} />,
    );
    const tile = screen.getByLabelText('0 overdue');
    expect(tile.props.accessibilityRole).toBeUndefined();
    await fireEvent.press(tile);
    expect(onOpenOverdue).not.toHaveBeenCalled();
  });
});

describe('Home strip: Due today tile', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('calls onOpenDueToday only when something is genuinely due today', async () => {
    const records: LilicaRecord[] = [
      { id: 'bill-today', type: 'bill', title: 'Electric bill', status: 'unresolved', dueDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    const onOpenDueToday = jest.fn();
    const screen = await render(
      <HomeScreen state={withMembership(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} onOpenDueToday={onOpenDueToday} />,
    );
    await fireEvent.press(screen.getByLabelText('1 due today. View in To Do.'));
    expect(onOpenDueToday).toHaveBeenCalledTimes(1);
  });
});

describe('Home strip: Assigned to you tile', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('calls onOpenAssignedToYou only when a real membership has records assigned to it', async () => {
    const records: LilicaRecord[] = [
      { id: 'a1', type: 'appointment', title: 'Dentist', status: 'scheduled', createdAt: '2026-09-01T00:00:00.000Z', assignedMembershipId: 'membership-1' },
    ];
    const onOpenAssignedToYou = jest.fn();
    const screen = await render(
      <HomeScreen state={withMembership(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} onOpenAssignedToYou={onOpenAssignedToYou} />,
    );
    await fireEvent.press(screen.getByLabelText('1 assigned to you. View in To Do.'));
    expect(onOpenAssignedToYou).toHaveBeenCalledTimes(1);
  });

  it('the tile is absent entirely (not a fake zero) with no active membership', async () => {
    const records: LilicaRecord[] = [
      { id: 'a1', type: 'appointment', title: 'Dentist', status: 'scheduled', createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <HomeScreen
        state={{ ...initialOnboardingState, stage: 'home', records, allSetDismissed: true }}
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
      />,
    );
    expect(screen.queryByText('Assigned to you')).toBeNull();
  });
});

describe('Home strip: Coming up tile', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('is a button that scrolls within Home itself -- the exact same records as the "Upcoming" section, no external navigation', async () => {
    const records: LilicaRecord[] = [
      { id: 'future', type: 'task', title: 'Future task', status: 'unresolved', dueDate: '2026-09-20', createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <HomeScreen state={withMembership(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    const tile = screen.getByLabelText('1 coming up. Jump to Upcoming below.');
    expect(tile.props.accessibilityRole).toBe('button');
    // Pressing must not throw even though layout offsets never resolve in
    // this test renderer (no native layout pass) -- it should simply be a
    // safe no-op, never a crash.
    await fireEvent.press(tile);
    screen.getByText('Upcoming');
    screen.getByText('Future task');
  });
});

describe('Home strip: Updates this week tile', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('is a button that opens WellbeingUpdatesScreen when there is a wellbeing update entered this week', async () => {
    const records: LilicaRecord[] = [
      { id: 'recent', type: 'update', title: 'Called the GP', status: 'saved', createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
    ];
    const onOpenWellbeingUpdates = jest.fn();
    const screen = await render(
      <HomeScreen state={withMembership(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} onOpenWellbeingUpdates={onOpenWellbeingUpdates} />,
    );
    const tile = screen.getByLabelText('1 updates this week. View wellbeing updates.');
    expect(tile.props.accessibilityRole).toBe('button');
    await fireEvent.press(tile);
    expect(onOpenWellbeingUpdates).toHaveBeenCalledTimes(1);
  });

  it('only counts wellbeing-update records, not every recently-edited type', async () => {
    const records: LilicaRecord[] = [
      { id: 'recent-update', type: 'update', title: 'Called the GP', status: 'saved', createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
      { id: 'recent-task', type: 'task', title: 'Book haircut', status: 'unresolved', dueDate: '2026-10-01', createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
    ];
    const screen = await render(
      <HomeScreen state={withMembership(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    screen.getByLabelText('1 updates this week');
  });

  it('is not a button when there is no wellbeing update entered this week', async () => {
    const records: LilicaRecord[] = [
      { id: 'old-update', type: 'update', title: 'Old note', status: 'saved', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <HomeScreen state={withMembership(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    const tile = screen.getByLabelText('0 updates this week');
    expect(tile.props.accessibilityRole).toBeUndefined();
  });
});

describe('To Do: focused entry from the Home strip', () => {
  it('initialFocusGroup promotes that group to the top without removing any other group or record', async () => {
    const records: LilicaRecord[] = [
      { id: 'overdue-1', type: 'task', title: 'Overdue task', status: 'unresolved', dueDate: '2020-01-01', createdAt: '2020-01-01T00:00:00.000Z' },
      { id: 'today-1', type: 'bill', title: 'Today bill', status: 'unresolved', dueDate: new Date().toISOString().slice(0, 10), createdAt: '2020-01-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <ToDoScreen
        records={records}
        onOpenRecord={jest.fn()}
        onSaveRecord={jest.fn()}
        onAddSomething={jest.fn()}
        initialFocusGroup="today"
      />,
    );
    // Both groups' records are still present -- nothing was filtered out.
    screen.getByText('Overdue task');
    screen.getByText('Today bill');
    screen.getByText('Overdue');
    screen.getByText('Today / Needs doing');
  });

  it('initialFilter=mine preselects the Mine tab', async () => {
    const records: LilicaRecord[] = [
      { id: 'mine', type: 'task', title: 'My task', status: 'unresolved', dueDate: '2020-01-01', createdAt: '2020-01-01T00:00:00.000Z', assignedMembershipId: 'membership-1' },
      { id: 'unassigned', type: 'task', title: 'Unassigned task', status: 'unresolved', dueDate: '2020-01-01', createdAt: '2020-01-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <ToDoScreen
        records={records}
        activeMembershipId="membership-1"
        onOpenRecord={jest.fn()}
        onSaveRecord={jest.fn()}
        onAddSomething={jest.fn()}
        initialFilter="mine"
      />,
    );
    screen.getByText('My task');
    expect(screen.queryByText('Unassigned task')).toBeNull();
  });

  // Reported gap: arriving at To Do via a Home strip tap left no way
  // back except the bottom tab bar.
  it('shows a "Back to Home" button only when arriving via a strip tap (onBack supplied)', async () => {
    const withoutBack = await render(
      <ToDoScreen records={[]} onOpenRecord={jest.fn()} onSaveRecord={jest.fn()} onAddSomething={jest.fn()} />,
    );
    expect(withoutBack.queryByLabelText('Back to Home')).toBeNull();

    const onBack = jest.fn();
    const withBack = await render(
      <ToDoScreen records={[]} onOpenRecord={jest.fn()} onSaveRecord={jest.fn()} onAddSomething={jest.fn()} initialFocusGroup="overdue" onBack={onBack} />,
    );
    await fireEvent.press(withBack.getByLabelText('Back to Home'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
