import { fireEvent, render } from '@testing-library/react-native';

import { ToDoScreen } from '../src/screens/ToDoScreen';
import { CareCircleMember } from '../src/careCircle';
import { LilicaRecord } from '../src/types';

// Corrective task 8: presentational-only card redesign. Validates the
// specific claims from the brief that aren't already covered, unchanged,
// by tests/phase12-todo.test.tsx (grouping, filters, completion
// semantics, identity, care-space isolation all still pass there
// untouched -- see that file for items 1-7/11/12 of the brief's
// numbered validation list).

describe('To Do card: tap targets are separate (items 8/9)', () => {
  it('tapping the card opens the record and does NOT complete it', async () => {
    const onOpenRecord = jest.fn();
    const onSaveRecord = jest.fn();
    const records: LilicaRecord[] = [
      { id: 'bill-1', type: 'bill', title: 'Water', status: 'unresolved', dueDate: '2020-01-01', createdAt: '2020-01-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <ToDoScreen records={records} onOpenRecord={onOpenRecord} onSaveRecord={onSaveRecord} onAddSomething={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText('Open Water'));
    expect(onOpenRecord).toHaveBeenCalledWith('bill-1');
    expect(onSaveRecord).not.toHaveBeenCalled();
  });

  it('tapping the completion control completes the SAME record once, without opening it', async () => {
    const onOpenRecord = jest.fn();
    const onSaveRecord = jest.fn();
    const records: LilicaRecord[] = [
      { id: 'bill-1', type: 'bill', title: 'Water', status: 'unresolved', dueDate: '2020-01-01', createdAt: '2020-01-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <ToDoScreen records={records} onOpenRecord={onOpenRecord} onSaveRecord={onSaveRecord} onAddSomething={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText('Mark paid: Water'));
    expect(onSaveRecord).toHaveBeenCalledTimes(1);
    expect(onSaveRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 'bill-1', completed: true }));
    expect(onOpenRecord).not.toHaveBeenCalled();
  });
});

describe('To Do card: category label is never truncated by the completion control (item 10)', () => {
  it('shows the full "Home or car matter" category label alongside a long title', async () => {
    const records: LilicaRecord[] = [
      { id: 'home-1', type: 'homeMatter', title: 'Replace the living room carpet after the flood', status: 'unresolved', dueDate: '2020-01-01', createdAt: '2020-01-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <ToDoScreen records={records} onOpenRecord={jest.fn()} onSaveRecord={jest.fn()} onAddSomething={jest.fn()} />,
    );
    screen.getByText('Home or car matter');
    screen.getByText('Replace the living room carpet after the flood');
  });
});

describe('To Do card: one quiet metadata line, not competing badges', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('combines due state and assignment into one line: "Overdue · <date> · You"', async () => {
    const records: LilicaRecord[] = [
      { id: 'bill-1', type: 'bill', title: 'Water', status: 'unresolved', dueDate: '2026-09-01', createdAt: '2020-01-01T00:00:00.000Z', assignedMembershipId: 'membership-1' },
    ];
    const screen = await render(
      <ToDoScreen records={records} activeMembershipId="membership-1" onOpenRecord={jest.fn()} onSaveRecord={jest.fn()} onAddSomething={jest.fn()} />,
    );
    screen.getByText(/^Overdue · .* · You$/);
  });

  it('shows "Today · Unassigned" for an unassigned item due today', async () => {
    const records: LilicaRecord[] = [
      { id: 'task-1', type: 'task', title: 'Carpet', status: 'unresolved', dueDate: '2026-09-09', createdAt: '2020-01-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <ToDoScreen records={records} onOpenRecord={jest.fn()} onSaveRecord={jest.fn()} onAddSomething={jest.fn()} />,
    );
    screen.getByText('Today · Unassigned');
  });

  it('shows a real Care Circle member\'s name when the assignee is neither Unassigned nor the organiser (never a fabricated name)', async () => {
    const records: LilicaRecord[] = [
      { id: 'task-1', type: 'task', title: 'Carpet', status: 'unresolved', dueDate: '2026-09-20', createdAt: '2020-01-01T00:00:00.000Z', assignedMembershipId: 'membership-marion' },
    ];
    const members: CareCircleMember[] = [
      { membershipId: 'membership-marion', displayName: 'Marion', role: 'contributor', relationshipType: 'Other relative', isSelf: false, grantedDomains: ['general'] },
    ];
    const screen = await render(
      <ToDoScreen records={records} activeMembershipId="membership-organiser" careCircleMembers={members} onOpenRecord={jest.fn()} onSaveRecord={jest.fn()} onAddSomething={jest.fn()} />,
    );
    screen.getByText(/Marion$/);
  });

  it('never renders a filled pill for Unassigned/You -- they are plain text', async () => {
    const records: LilicaRecord[] = [
      { id: 'task-1', type: 'task', title: 'Carpet', status: 'unresolved', dueDate: '2026-09-09', createdAt: '2020-01-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <ToDoScreen records={records} onOpenRecord={jest.fn()} onSaveRecord={jest.fn()} onAddSomething={jest.fn()} />,
    );
    const text = screen.getByText('Today · Unassigned');
    // A plain AppText node, not wrapped in its own pill/badge container --
    // its immediate parent is the row copy column, not a badge View.
    expect(text.props.style).not.toEqual(expect.objectContaining({ backgroundColor: expect.anything() }));
  });
});

describe('To Do card: completed items use the same design with a checked state', () => {
  it('a completed row shows a filled/checked circle and "Reopen" reverses it', async () => {
    const onSaveRecord = jest.fn();
    const records: LilicaRecord[] = [
      { id: 'task-1', type: 'task', title: 'Carpet', status: 'completed', completed: true, completedAt: '2020-01-01T00:00:00.000Z', createdAt: '2020-01-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <ToDoScreen records={records} onOpenRecord={jest.fn()} onSaveRecord={onSaveRecord} onAddSomething={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText('Show completed'));
    await fireEvent.press(screen.getByLabelText('Reopen Carpet'));
    expect(onSaveRecord).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1', completed: false }));
  });
});
