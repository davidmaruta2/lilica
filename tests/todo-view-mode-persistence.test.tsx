// Real bug, 22 September 2026: To Do's grid/list choice lived only in
// useState, and App.tsx remounts the whole screen every time the tab
// becomes active, so it silently reset to 'list' every single time. Fixed
// by persisting the choice to AsyncStorage (the same "repo-wide real
// in-memory mock" convention other tests already use, see
// tests/biometric-lock.test.ts).
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ToDoScreen } from '../src/screens/ToDoScreen';
import { LilicaRecord } from '../src/types';

const record: LilicaRecord = {
  id: 'task-1', type: 'task', title: 'Order repeat prescription', status: 'unresolved',
  dueDate: '2026-09-10', createdAt: '2026-09-01T00:00:00.000Z',
};

const baseProps = {
  records: [record],
  onOpenRecord: jest.fn(),
  onSaveRecord: jest.fn(),
  onAddSomething: jest.fn(),
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-10T12:00:00.000Z'));
  return AsyncStorage.clear();
});

afterEach(() => jest.useRealTimers());

describe('To Do view mode persists across remounts (tab switches)', () => {
  it('defaults to list view with nothing stored', async () => {
    const screen = await render(<ToDoScreen {...baseProps} />);
    expect(screen.getByLabelText('List view').props.accessibilityState.selected).toBe(true);
  });

  it('choosing Grid view is saved, and survives a full remount', async () => {
    const first = await render(<ToDoScreen {...baseProps} />);
    await fireEvent.press(first.getByLabelText('Grid view'));
    await waitFor(async () => expect(await AsyncStorage.getItem('lilica_todo_view_mode')).toBe('grid'));
    first.unmount();

    // A fresh mount, exactly what App.tsx's remount-on-tab-switch produces.
    const second = await render(<ToDoScreen {...baseProps} />);
    await waitFor(() => expect(second.getByLabelText('Grid view').props.accessibilityState.selected).toBe(true));
  });
});
