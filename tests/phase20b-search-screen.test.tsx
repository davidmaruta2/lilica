import { fireEvent, render } from '@testing-library/react-native';

import { SearchScreen } from '../src/screens/SearchScreen';
import { LilicaRecord } from '../src/types';

const records: LilicaRecord[] = [
  { id: 'appt-1', type: 'appointment', title: 'GP appointment', createdAt: '2026-09-01T00:00:00.000Z' },
  { id: 'task-1', type: 'task', title: 'Collect prescription', createdAt: '2026-09-01T00:00:00.000Z' },
];

describe('SearchScreen', () => {
  it('shows an initial helper state, not results, before anything is typed', async () => {
    const screen = await render(<SearchScreen records={records} personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    screen.getByText(/Search for anything already saved for Beauty/);
  });

  it('typing a query shows matching grouped results', async () => {
    const screen = await render(<SearchScreen records={records} personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Search'), 'prescription');
    screen.getByText('To Do');
    screen.getByText('Collect prescription');
  });

  it('shows a real no-results state for a query that matches nothing', async () => {
    const screen = await render(<SearchScreen records={records} personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Search'), 'nonexistent xyz');
    screen.getByText(/Nothing matches "nonexistent xyz"/);
  });

  it('opening a result calls back with the real record id, reusing the shared record-open path', async () => {
    const onOpenRecord = jest.fn();
    const screen = await render(<SearchScreen records={records} personName="Beauty" onBack={jest.fn()} onOpenRecord={onOpenRecord} />);
    await fireEvent.changeText(screen.getByLabelText('Search'), 'GP');
    await fireEvent.press(screen.getByLabelText('Open GP appointment'));
    expect(onOpenRecord).toHaveBeenCalledWith('appt-1');
  });

  it('Clear resets the query back to the initial helper state', async () => {
    const screen = await render(<SearchScreen records={records} personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Search'), 'prescription');
    await fireEvent.press(screen.getByLabelText('Clear search'));
    screen.getByText(/Search for anything already saved for Beauty/);
  });

  it('Back returns without acting', async () => {
    const onBack = jest.fn();
    const screen = await render(<SearchScreen records={records} onBack={onBack} onOpenRecord={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('search4.txt: Home -> Search interaction requirements', () => {
  it('the screen title uses the current supported person\'s first name -- "Search [FirstName]"', async () => {
    const screen = await render(<SearchScreen records={records} personName="Maggie" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    screen.getByText('Search Maggie');
  });

  it('the search field is set to receive focus automatically on open, so the keyboard opens without a second tap', async () => {
    const screen = await render(<SearchScreen records={records} personName="Maggie" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    expect(screen.getByLabelText('Search').props.autoFocus).toBe(true);
  });
});
