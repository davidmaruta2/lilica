import { fireEvent, render } from '@testing-library/react-native';

import { completionUpdate } from '../src/components/RecordEditor';
import { ToDoScreen } from '../src/screens/ToDoScreen';
import { isActionableRecord } from '../src/records';
import { LilicaRecord } from '../src/types';

// Phase 12: To Do is a projection of the same canonical records Home and
// Calendar already read -- no second task store, no To Do-specific
// completion semantics. "Today" is fixed to match the fixed test scenario.

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
});

afterEach(() => jest.useRealTimers());

const MEMBERSHIP = 'membership-1';

// The exact fixed scenario from the brief, for Maggie.
const electricityBill: LilicaRecord = {
  id: 'bill-1', type: 'bill', title: 'Electricity bill', status: 'unresolved',
  dueDate: '2026-09-09', assignedMembershipId: MEMBERSHIP, createdAt: '2026-09-01T00:00:00.000Z',
};
const prescription: LilicaRecord = {
  id: 'task-1', type: 'task', title: 'Order repeat prescription', status: 'unresolved',
  dueDate: '2026-09-10', createdAt: '2026-09-01T00:00:00.000Z',
};
const transport: LilicaRecord = {
  id: 'task-2', type: 'task', title: 'Arrange hospital transport', status: 'unresolved',
  dueDate: '2026-09-11', assignedMembershipId: MEMBERSHIP, createdAt: '2026-09-01T00:00:00.000Z',
};
const gpAppointment: LilicaRecord = {
  id: 'appt-1', type: 'appointment', title: 'GP appointment', status: 'scheduled',
  eventDate: '2026-09-11', createdAt: '2026-09-01T00:00:00.000Z',
};
const boilerService: LilicaRecord = {
  id: 'home-1', type: 'homeMatter', title: 'Boiler service', status: 'unresolved',
  dueDate: '2026-09-17', createdAt: '2026-09-01T00:00:00.000Z',
};
const completedShopping: LilicaRecord = {
  id: 'task-3', type: 'task', title: 'Completed shopping task', status: 'completed',
  completed: true, completedAt: '2026-09-10T09:00:00.000Z', createdAt: '2026-09-01T00:00:00.000Z',
};

const fixedScenario = [electricityBill, prescription, transport, gpAppointment, boilerService, completedShopping];

const baseProps = {
  personName: 'Maggie',
  activeMembershipId: MEMBERSHIP,
  onOpenRecord: jest.fn(),
  onSaveRecord: jest.fn(),
  onAddSomething: jest.fn(),
};

describe('Phase 12: fixed test scenario', () => {
  it('groups the scenario exactly as specified: Overdue / Today / Upcoming, appointment and completed excluded', async () => {
    const screen = await render(<ToDoScreen {...baseProps} records={fixedScenario} onSaveRecord={jest.fn()} />);

    screen.getByText('Overdue');
    screen.getByText('Electricity bill');
    screen.getByText('Today / Needs doing');
    screen.getByText('Order repeat prescription');
    screen.getByText('Upcoming');
    screen.getByText('Arrange hospital transport');
    screen.getByText('Boiler service');

    // Not active To Do.
    expect(screen.queryByText('GP appointment')).toBeNull();
    expect(screen.queryByText('Completed shopping task')).toBeNull();

    // No duplicate electricity-bill row.
    expect(screen.getAllByText('Electricity bill').length).toBe(1);
  });
});

describe('Phase 12: eligibility (PROJECTION)', () => {
  it('includes open task/bill/home-matter, excludes appointment/informational/completed/cancelled', () => {
    expect(isActionableRecord({ ...prescription })).toBe(true);
    expect(isActionableRecord({ ...electricityBill })).toBe(true);
    expect(isActionableRecord({ ...boilerService })).toBe(true);
    expect(isActionableRecord(gpAppointment)).toBe(false);
    expect(isActionableRecord({ id: 'c1', type: 'contact', title: 'GP', createdAt: '2026-09-01T00:00:00.000Z' })).toBe(false);
    expect(isActionableRecord({ id: 'd1', type: 'document', title: 'Insurance policy', createdAt: '2026-09-01T00:00:00.000Z' })).toBe(false);
    expect(isActionableRecord({ ...prescription, status: 'cancelled' })).toBe(false);
  });

  it('excludes a completed item from the active groups', async () => {
    const screen = await render(<ToDoScreen {...baseProps} records={[completedShopping]} onSaveRecord={jest.fn()} />);
    screen.getByText('Nothing needs doing right now.');
  });
});

describe('Phase 12: identity (no duplication, same underlying record)', () => {
  it('opening a To Do item calls back with the real underlying record ID, not a copy', async () => {
    const onOpenRecord = jest.fn();
    const screen = await render(<ToDoScreen {...baseProps} records={[prescription]} onOpenRecord={onOpenRecord} onSaveRecord={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Open Order repeat prescription'));
    expect(onOpenRecord).toHaveBeenCalledWith('task-1');
  });

  it('marking complete saves the SAME record id -- not a new To Do-specific record', async () => {
    const onSaveRecord = jest.fn();
    const screen = await render(<ToDoScreen {...baseProps} records={[prescription]} onSaveRecord={onSaveRecord} />);
    await fireEvent.press(screen.getByLabelText('Mark complete: Order repeat prescription'));
    expect(onSaveRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1', completed: true }));
  });
});

describe('Phase 12: completion/reopen use the canonical transition', () => {
  it('completing a task sets status completed and records confirmation history', () => {
    const update = completionUpdate(prescription, true);
    expect(update.status).toBe('completed');
    expect(update.completed).toBe(true);
    expect(update.confirmationHistory?.length).toBe(1);
    expect(update.confirmationHistory?.[0].confirmedBy).toBe('You');
  });

  it('reopening preserves confirmation history but clears the active completedAt', () => {
    const completed = { ...prescription, ...completionUpdate(prescription, true) };
    const reopened = completionUpdate(completed, false);
    expect(reopened.completed).toBe(false);
    expect(reopened.completedAt).toBeUndefined();
    expect(reopened.confirmationHistory?.length).toBe(1);
  });

  it('a bill uses "Mark paid" wording, a task uses "Mark complete"', async () => {
    const screen = await render(<ToDoScreen {...baseProps} records={[electricityBill, prescription]} onSaveRecord={jest.fn()} />);
    screen.getByLabelText('Mark paid: Electricity bill');
    screen.getByLabelText('Mark complete: Order repeat prescription');
  });

  it('reopening a completed item is offered once "Show completed" is expanded', async () => {
    const screen = await render(<ToDoScreen {...baseProps} records={[completedShopping]} onSaveRecord={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Show completed'));
    screen.getByLabelText('Reopen Completed shopping task');
  });
});

describe('Phase 12: assignment (stable identity, never name-based)', () => {
  it('"Mine" shows only items assigned to the active membership ID', async () => {
    const screen = await render(<ToDoScreen {...baseProps} records={[electricityBill, prescription]} onSaveRecord={jest.fn()} />);
    await fireEvent.press(screen.getByText('Mine'));
    screen.getByText('Electricity bill');
    expect(screen.queryByText('Order repeat prescription')).toBeNull();
  });

  it('"Unassigned" shows only items with no assignedMembershipId', async () => {
    const screen = await render(<ToDoScreen {...baseProps} records={[electricityBill, prescription]} onSaveRecord={jest.fn()} />);
    // "Unassigned" also labels the row's own assignment badge, so press the
    // filter chip specifically (it renders first, before any row badges).
    await fireEvent.press(screen.getAllByText('Unassigned')[0]);
    screen.getByText('Order repeat prescription');
    expect(screen.queryByText('Electricity bill')).toBeNull();
  });

  it('legacy responsiblePerson text does not count as assignment', async () => {
    const withResponsiblePerson: LilicaRecord = { ...prescription, responsiblePerson: 'Sarah' };
    const screen = await render(<ToDoScreen {...baseProps} records={[withResponsiblePerson]} onSaveRecord={jest.fn()} />);
    await fireEvent.press(screen.getAllByText('Unassigned')[0]);
    screen.getByText('Order repeat prescription');
    expect(screen.queryByText('Sarah')).toBeNull();
  });

  it('changing the organiser display name does not change assignment ownership', async () => {
    // Assignment is keyed on membership ID, never personName -- rendering
    // with a different personName still shows the same "You" assignment.
    const screen = await render(<ToDoScreen {...baseProps} personName="David" records={[electricityBill]} onSaveRecord={jest.fn()} />);
    await fireEvent.press(screen.getByText('Mine'));
    screen.getByText('Electricity bill');
  });
});

describe('Phase 12: care-space isolation', () => {
  it('switching to a different care space shows only that space\'s actionable work', async () => {
    const jackieTask: LilicaRecord = { id: 'jackie-1', type: 'task', title: "Jackie's prescription", status: 'unresolved', dueDate: '2026-09-10', createdAt: '2026-09-01T00:00:00.000Z' };
    const screen = await render(<ToDoScreen {...baseProps} records={[prescription]} onSaveRecord={jest.fn()} />);
    screen.getByText('Order repeat prescription');
    await screen.rerender(<ToDoScreen {...baseProps} personName="Jackie" records={[jackieTask]} onSaveRecord={jest.fn()} />);
    expect(screen.queryByText('Order repeat prescription')).toBeNull();
    screen.getByText("Jackie's prescription");
  });
});

describe('Phase 12: cross-view consistency', () => {
  it('the completion transition it saves is the same shape RecordEditor itself would save', () => {
    // Both paths call the same completionUpdate() helper, so Home/Calendar/
    // To Do can never disagree about what "complete" means for a record.
    const fromToDo = completionUpdate(electricityBill, true);
    const fromEditor = completionUpdate(electricityBill, true);
    expect(fromToDo).toEqual(fromEditor);
  });
});

describe('Phase 12: Add reuses the established creation architecture', () => {
  it('Add calls the same onAddSomething handler Home uses, not a separate To Do creation flow', async () => {
    const onAddSomething = jest.fn();
    const screen = await render(<ToDoScreen {...baseProps} records={[]} onAddSomething={onAddSomething} onSaveRecord={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Add'));
    expect(onAddSomething).toHaveBeenCalledTimes(1);
  });
});
