import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, TextStyle, ViewStyle } from 'react-native';

import { openRecordFromMeasuredRow, ToDoScreen, todoGridLayout } from '../src/screens/ToDoScreen';
import { tabAccent } from '../src/theme';
import { LilicaRecord } from '../src/types';

const onOpenRecord = jest.fn();
const onAddSomething = jest.fn();
const onOpenSettings = jest.fn();

const baseProps = {
  activeMembershipId: 'membership-me',
  onOpenRecord,
  onSaveRecord: jest.fn(),
  onAddSomething,
  onOpenSettings,
};

const records: LilicaRecord[] = [
  { id: 'overdue-mine', type: 'bill', title: 'Energy renewal', status: 'unresolved', dueDate: '2026-09-01', assignedMembershipId: 'membership-me', createdAt: '2026-09-01T00:00:00.000Z' },
  { id: 'overdue-unassigned', type: 'task', title: 'Collect prescription', status: 'unresolved', dueDate: '2026-09-02', createdAt: '2026-09-01T00:00:00.000Z' },
  { id: 'today-task', type: 'task', title: 'Take mum to lunch', status: 'unresolved', dueDate: '2026-09-09', createdAt: '2026-09-01T00:00:00.000Z' },
  { id: 'upcoming-home', type: 'homeMatter', title: 'Book boiler service', status: 'unresolved', dueDate: '2026-09-18', createdAt: '2026-09-01T00:00:00.000Z' },
  { id: 'done-task', type: 'task', title: 'Finished shopping', status: 'completed', completed: true, completedAt: '2026-09-08T12:00:00.000Z', createdAt: '2026-09-01T00:00:00.000Z' },
];

function viewStyle(node: { props: { style?: unknown } }): ViewStyle {
  return StyleSheet.flatten(node.props.style) as ViewStyle;
}

function textStyle(node: { props: { style?: unknown } }): TextStyle {
  return StyleSheet.flatten(node.props.style) as TextStyle;
}

describe('Phase 22 Batch 5 correction: approved To Do contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('uses the approved matte steel-blue identity', () => {
    expect(tabAccent.todo).toEqual({ deep: '#4B6285', tint: '#D6E0E9' });
  });

  it('defaults to accessible List view with compact grouped rows', async () => {
    const screen = await render(<ToDoScreen {...baseProps} records={records} />);

    expect(screen.getByLabelText('List view').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('Grid view').props.accessibilityState).toEqual({ selected: false });
    expect(viewStyle(screen.getByLabelText('To Do view')).overflow).toBe('hidden');
    expect(viewStyle(screen.getByLabelText('List view')).backgroundColor).toBe('#FFFFFF');
    screen.getByTestId('todo-list-overdue');
    screen.getByTestId('todo-list-today');
    screen.getByTestId('todo-list-upcoming');
    screen.getByTestId('todo-bottom-clearance');
    expect(viewStyle(screen.getByTestId('todo-tile-overdue-mine')).minHeight).toBe(64);
    expect(viewStyle(screen.getByTestId('todo-list-overdue')).gap).toBe(8);
    expect(viewStyle(screen.getByTestId('todo-tile-overdue-mine')).borderRadius).toBe(10);
    expect(viewStyle(screen.getByTestId('todo-tile-overdue-mine')).shadowOpacity).toBe(0.07);
    expect(viewStyle(screen.getByTestId('todo-tile-overdue-mine')).elevation).toBe(2);
    expect(viewStyle(screen.getByTestId('todo-group-overdue')).backgroundColor).toBe('#ECEFF2');
    expect(viewStyle(screen.getByTestId('todo-tile-overdue-mine')).backgroundColor).toBe('#FFFFFF');
    expect(viewStyle(screen.getByTestId('todo-icon-overdue-mine')).backgroundColor).toBe('#E46E77');
    expect(viewStyle(screen.getByLabelText('All')).backgroundColor).toBe('#C71742');
  });

  it('switches presentation only and keeps the same grouped task data', async () => {
    const screen = await render(<ToDoScreen {...baseProps} records={records} />);
    const titles = ['Energy renewal', 'Collect prescription', 'Take mum to lunch', 'Book boiler service'];
    titles.forEach((title) => expect(screen.getAllByText(title)).toHaveLength(1));

    await fireEvent.press(screen.getByLabelText('Grid view'));
    expect(screen.getByLabelText('Grid view').props.accessibilityState).toEqual({ selected: true });
    screen.getByTestId('todo-grid-overdue');
    screen.getByTestId('todo-grid-today');
    screen.getByTestId('todo-grid-upcoming');
    expect(viewStyle(screen.getByTestId('todo-tile-overdue-mine')).shadowOpacity).toBe(0.07);
    expect(viewStyle(screen.getByTestId('todo-tile-overdue-mine')).elevation).toBe(2);
    titles.forEach((title) => expect(screen.getAllByText(title)).toHaveLength(1));

    await fireEvent.press(screen.getByLabelText('List view'));
    screen.getByTestId('todo-list-overdue');
  });

  it('keeps view state session-local and defaults a new screen session back to List', async () => {
    const first = await render(<ToDoScreen {...baseProps} records={records} />);
    await fireEvent.press(first.getByLabelText('Grid view'));
    expect(first.getByLabelText('Grid view').props.accessibilityState).toEqual({ selected: true });
    await first.unmount();

    const next = await render(<ToDoScreen {...baseProps} records={records} />);
    expect(next.getByLabelText('List view').props.accessibilityState).toEqual({ selected: true });
  });

  it('preserves All, Mine and Unassigned semantics in both views', async () => {
    const screen = await render(<ToDoScreen {...baseProps} records={records} />);

    await fireEvent.press(screen.getByLabelText('Mine'));
    screen.getByText('Energy renewal');
    expect(screen.queryByText('Collect prescription')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Grid view'));
    screen.getByText('Energy renewal');
    expect(screen.queryByText('Collect prescription')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Unassigned'));
    screen.getByText('Collect prescription');
    expect(screen.queryByText('Energy renewal')).toBeNull();
  });

  it('preserves open, Add and Settings callbacks', async () => {
    const screen = await render(<ToDoScreen {...baseProps} records={records} />);
    await fireEvent.press(screen.getByLabelText('Open Energy renewal'));
    await fireEvent.press(screen.getByLabelText('Add'));
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(onOpenRecord).toHaveBeenCalledWith('overdue-mine');
    expect(onAddSomething).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('passes the tapped row position so its editor can expand from that tile', async () => {
    const row = {
      measureInWindow(callback: (x: number, y: number, width: number, height: number) => void) {
        callback(24, 420, 342, 68);
      },
    };
    openRecordFromMeasuredRow(row as any, 'overdue-mine', onOpenRecord);
    expect(onOpenRecord).toHaveBeenCalledWith('overdue-mine', { x: 24, y: 420, width: 342, height: 68 });
  });

  it('retains completed Show/Hide behaviour in the same section system', async () => {
    const screen = await render(<ToDoScreen {...baseProps} records={records} />);
    expect(screen.queryByText('Finished shopping')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Show completed'));
    screen.getByTestId('todo-group-completed');
    screen.getByTestId('todo-list-completed');
    screen.getByText('Finished shopping');
    await fireEvent.press(screen.getByLabelText('Hide completed'));
    expect(screen.queryByText('Finished shopping')).toBeNull();
  });

  it('allows long titles and enlarged text to reflow, while Grid falls back to one column', async () => {
    const title = 'Arrange a longer hospital transport journey and confirm every collection detail';
    const longRecord: LilicaRecord = { id: 'long-task', type: 'task', title, status: 'unresolved', dueDate: '2026-09-18', createdAt: '2026-09-01T00:00:00.000Z' };
    const screen = await render(<ToDoScreen {...baseProps} records={[longRecord]} />);
    const titleNode = screen.getByText(title);
    expect(titleNode.props.allowFontScaling).toBe(true);
    expect(titleNode.props.numberOfLines).toBeUndefined();
    expect(textStyle(titleNode).fontSize).toBe(17);
    expect(todoGridLayout(390, 1).columns).toBe(2);
    expect(todoGridLayout(320, 1).columns).toBe(1);
    expect(todoGridLayout(390, 1.3).columns).toBe(1);
  });
});
