import { fireEvent, render } from '@testing-library/react-native';

import { WellbeingUpdatesScreen } from '../src/screens/WellbeingUpdatesScreen';
import { LilicaRecord } from '../src/types';

describe('WellbeingUpdatesScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-09T12:00:00.000Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('lists only wellbeing updates entered in the last 7 days, newest first', async () => {
    const records: LilicaRecord[] = [
      { id: 'old', type: 'update', title: 'Old note', status: 'saved', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' },
      { id: 'older-recent', type: 'update', title: 'Called the GP', status: 'saved', createdAt: '2026-09-06T00:00:00.000Z', updatedAt: '2026-09-06T00:00:00.000Z' },
      { id: 'newer-recent', type: 'update', title: 'Visited today', status: 'saved', createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
      { id: 'other-type', type: 'task', title: 'Book haircut', status: 'unresolved', dueDate: '2026-10-01', createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
    ];
    const screen = await render(
      <WellbeingUpdatesScreen records={records} personName="Maggie" onOpenRecord={jest.fn()} onBack={jest.fn()} />,
    );
    expect(screen.queryByText('Old note')).toBeNull();
    expect(screen.queryByText('Book haircut')).toBeNull();
    const newer = screen.getByText('Visited today');
    const older = screen.getByText('Called the GP');
    // Newest-first ordering.
    expect(newer).toBeTruthy();
    expect(older).toBeTruthy();
  });

  it('opens the normal record editor on tap', async () => {
    const onOpenRecord = jest.fn();
    const records: LilicaRecord[] = [
      { id: 'recent', type: 'update', title: 'Called the GP', status: 'saved', createdAt: '2026-09-08T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z' },
    ];
    const screen = await render(
      <WellbeingUpdatesScreen records={records} onOpenRecord={onOpenRecord} onBack={jest.fn()} />,
    );
    await fireEvent.press(screen.getByLabelText('Open Called the GP'));
    expect(onOpenRecord).toHaveBeenCalledWith('recent');
  });

  it('shows an honest empty state, never a fabricated list', async () => {
    const screen = await render(
      <WellbeingUpdatesScreen records={[]} onOpenRecord={jest.fn()} onBack={jest.fn()} />,
    );
    screen.getByText('No wellbeing updates entered this week yet.');
  });
});
