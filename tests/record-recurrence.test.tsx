import { fireEvent, render } from '@testing-library/react-native';

import { createRecordDraft, RecordEditor } from '../src/components/RecordEditor';

// Product-owner request: Repeats offers Weekly/Bi-weekly/Monthly/6-monthly/
// Annually as a horizontally scrollable row of pills, not a fixed three-way
// segmented control with a separate "Never" chip. No recurrence is expressed
// by nothing being selected -- tapping the active pill again clears it.

describe('Repeats: horizontal Weekly/Bi-weekly/Monthly/6-monthly/Annually pills', () => {
  it('offers all five options and none are selected by default', async () => {
    const draft = createRecordDraft('bill');
    const screen = await render(
      <RecordEditor type="bill" draft={draft} supportedPersonId="person-1" onChange={jest.fn()} onSave={jest.fn()} />,
    );
    for (const label of ['Weekly', 'Bi-weekly', 'Monthly', '6-monthly', 'Annually']) {
      screen.getByText(label);
    }
    expect(screen.queryByText('Never')).toBeNull();
  });

  it('selecting Bi-weekly stores interval 2 / unit week, distinct from Weekly', async () => {
    const draft = createRecordDraft('bill');
    const onChange = jest.fn();
    const screen = await render(
      <RecordEditor type="bill" draft={draft} supportedPersonId="person-1" onChange={onChange} onSave={jest.fn()} />,
    );
    await fireEvent.press(screen.getByText('Bi-weekly'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ recurrence: { interval: 2, unit: 'week' } }));
  });

  it('selecting 6-monthly stores interval 6 / unit month, distinct from Monthly', async () => {
    const draft = createRecordDraft('bill');
    const onChange = jest.fn();
    const screen = await render(
      <RecordEditor type="bill" draft={draft} supportedPersonId="person-1" onChange={onChange} onSave={jest.fn()} />,
    );
    await fireEvent.press(screen.getByText('6-monthly'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ recurrence: { interval: 6, unit: 'month' } }));
  });

  it('tapping the already-selected option again clears recurrence instead of requiring a separate Never', async () => {
    const draft = { ...createRecordDraft('bill'), recurrence: { interval: 1, unit: 'year' as const } };
    const onChange = jest.fn();
    const screen = await render(
      <RecordEditor type="bill" draft={draft} supportedPersonId="person-1" onChange={onChange} onSave={jest.fn()} />,
    );
    await fireEvent.press(screen.getByText('Annually'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ recurrence: undefined }));
  });
});
