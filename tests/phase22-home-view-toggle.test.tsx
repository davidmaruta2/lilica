import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, ViewStyle } from 'react-native';

import { HomeScreen } from '../src/screens/HomeScreen';
import { initialOnboardingState } from '../src/storage';
import { LilicaRecord, OnboardingState } from '../src/types';

const todayRecords: LilicaRecord[] = [
  { id: 'appointment', type: 'appointment', title: 'Dentist', status: 'scheduled', eventDate: '2026-09-15', eventTime: '10:30', createdAt: '2026-09-01T00:00:00.000Z' },
  { id: 'task', type: 'task', title: 'Collect prescription', status: 'unresolved', dueDate: '2026-09-10', createdAt: '2026-09-01T00:00:00.000Z' },
];

function stateFor(name: string, records = todayRecords): OnboardingState {
  return {
    ...initialOnboardingState,
    stage: 'home',
    supportedPersonName: name,
    records,
    allSetDismissed: true,
  };
}

function styleOf(node: { props: { style?: unknown } }): ViewStyle {
  return StyleSheet.flatten(node.props.style) as ViewStyle;
}

const baseProps = {
  onAddSomething: jest.fn(),
  onDismissAllSet: jest.fn(),
  onOpenRecord: jest.fn(),
};

describe('Phase 22 Home closure: Today List/Grid view toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('defaults to the existing two-column Grid presentation', async () => {
    const screen = await render(<HomeScreen {...baseProps} state={stateFor('Ben')} />);

    expect(screen.getByLabelText('Show as grid').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('Show as list').props.accessibilityState).toEqual({ selected: false });
    screen.getByTestId('home-record-grid');
    screen.getByTestId('home-record-card-appointment');
    screen.getByTestId('home-record-card-task');
  });

  it('shows the identical Today records in compact List mode and opens through the existing callback', async () => {
    const onOpenRecord = jest.fn();
    const screen = await render(<HomeScreen {...baseProps} state={stateFor('Ben')} onOpenRecord={onOpenRecord} />);

    await fireEvent.press(screen.getByLabelText('Show as list'));
    expect(screen.getByLabelText('Show as list').props.accessibilityState).toEqual({ selected: true });
    screen.getByTestId('home-record-list-today');
    screen.getByTestId('home-record-list-row-appointment');
    screen.getByTestId('home-record-list-row-task');
    screen.getByText('Dentist');
    screen.getByText('Collect prescription');

    await fireEvent.press(screen.getByLabelText('Open Dentist'));
    expect(onOpenRecord).toHaveBeenCalledWith('appointment');
  });

  it('restores the physically approved Grid presentation immediately', async () => {
    const screen = await render(<HomeScreen {...baseProps} state={stateFor('Ben')} />);
    await fireEvent.press(screen.getByLabelText('Show as list'));
    await fireEvent.press(screen.getByLabelText('Show as grid'));

    expect(screen.getByLabelText('Show as grid').props.accessibilityState).toEqual({ selected: true });
    screen.getByTestId('home-record-grid');
    screen.getByTestId('home-record-card-appointment');
  });

  it('keeps the session-local view through ordinary rerenders and supported-person changes', async () => {
    const screen = await render(<HomeScreen {...baseProps} state={stateFor('Ben')} />);
    await fireEvent.press(screen.getByLabelText('Show as list'));

    const maggiesRecords: LilicaRecord[] = [
      { id: 'maggie-task', type: 'task', title: 'Maggie task', status: 'unresolved', dueDate: '2026-09-15', createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    await screen.rerender(<HomeScreen {...baseProps} state={stateFor('Maggie', maggiesRecords)} />);

    expect(screen.getByLabelText('Show as list').props.accessibilityState).toEqual({ selected: true });
    screen.getByTestId('home-record-list-row-maggie-task');
    expect(screen.queryByText('Dentist')).toBeNull();
  });

  it('uses truthful selected state, 44px targets, and never persists a view change', async () => {
    const setItem = jest.spyOn(AsyncStorage, 'setItem');
    const screen = await render(<HomeScreen {...baseProps} state={stateFor('Ben')} />);

    expect(styleOf(screen.getByLabelText('Show as list')).width).toBe(44);
    expect(styleOf(screen.getByLabelText('Show as list')).height).toBe(44);
    expect(styleOf(screen.getByLabelText('Show as grid')).width).toBe(44);
    expect(styleOf(screen.getByLabelText('Show as grid')).height).toBe(44);

    await fireEvent.press(screen.getByLabelText('Show as list'));
    expect(screen.getByLabelText('Show as list').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('Show as grid').props.accessibilityState).toEqual({ selected: false });
    expect(setItem).not.toHaveBeenCalled();
  });
});
