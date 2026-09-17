// Post-build implementation batch (lilbatch.txt, 17 September 2026), change
// three: RecordEditor's condition/medicine support -- active/closed
// lifecycle (never deletion), repeat-vs-duration medicine handling, and
// unknown/optional dates staying genuinely unknown.
import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { createRecordDraft, RecordDraft, RecordEditor } from '../src/components/RecordEditor';
import { recordDomainForType } from '../src/records';
import { LilicaRecord, LilicaRecordType } from '../src/types';

describe('Medical Log: domain classification (client mirror of the server)', () => {
  it('condition and medicine map to the health domain, same as careNote', () => {
    expect(recordDomainForType('condition')).toBe('health');
    expect(recordDomainForType('medicine')).toBe('health');
    expect(recordDomainForType('careNote')).toBe('health');
  });
});

// RecordEditor is fully controlled via its `draft` prop -- a plain no-op
// onChange would leave `canSave`/toggled fields permanently stale, since
// nothing would ever feed the updated draft back in. This tiny stateful
// wrapper is what RecordQuickEditor/FirstThingScreen already do for real
// (see tests/phase17-record-editor.test.tsx's own identical harness).
function RecordEditorHarness(props: {
  type: LilicaRecordType;
  record?: LilicaRecord;
  supportedPersonId: string;
  onSave: (record: LilicaRecord) => void;
}) {
  const [draft, setDraft] = useState<RecordDraft>(createRecordDraft(props.type, props.record));
  return <RecordEditor {...props} draft={draft} onChange={setDraft} />;
}

describe('Medical Log: diagnosed conditions', () => {
  it('creates a new active condition with no diagnosed date required', async () => {
    const onSave = jest.fn();
    const screen = await render(<RecordEditorHarness type="condition" supportedPersonId="p1" onSave={onSave} />);
    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Type 2 diabetes');
    await fireEvent.press(screen.getByText('Add condition'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: 'condition',
      title: 'Type 2 diabetes',
      diagnosedDate: undefined,
      closedAt: undefined,
    }));
  });

  it('closing a condition sets closedAt without deleting anything', async () => {
    const onSave = jest.fn();
    const record: LilicaRecord = {
      id: 'c1',
      type: 'condition',
      title: 'Asthma',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const screen = await render(<RecordEditorHarness type="condition" record={record} supportedPersonId="p1" onSave={onSave} />);
    await fireEvent.press(screen.getByText('Currently active'));
    await fireEvent.press(screen.getByText('Save changes'));
    const saved = onSave.mock.calls[0][0] as LilicaRecord;
    expect(saved.id).toBe('c1');
    expect(saved.title).toBe('Asthma');
    expect(typeof saved.closedAt).toBe('string');
  });

  it('reopening a closed condition clears closedAt', async () => {
    const onSave = jest.fn();
    const record: LilicaRecord = {
      id: 'c2',
      type: 'condition',
      title: 'Old condition',
      closedAt: '2026-06-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const screen = await render(<RecordEditorHarness type="condition" record={record} supportedPersonId="p1" onSave={onSave} />);
    screen.getByText(/Closed - no longer/);
    await fireEvent.press(screen.getByText(/Closed - no longer/));
    await fireEvent.press(screen.getByText('Save changes'));
    const saved = onSave.mock.calls[0][0] as LilicaRecord;
    expect(saved.closedAt).toBeUndefined();
  });

  it('an unknown diagnosed date is never fabricated', async () => {
    const onSave = jest.fn();
    const screen = await render(<RecordEditorHarness type="condition" supportedPersonId="p1" onSave={onSave} />);
    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Unknown-onset condition');
    await fireEvent.press(screen.getByText('Add condition'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ diagnosedDate: undefined }));
  });
});

describe('Medical Log: prescribed medicines', () => {
  it('defaults to repeat/ongoing and saves with no end date', async () => {
    const onSave = jest.fn();
    const screen = await render(<RecordEditorHarness type="medicine" supportedPersonId="p1" onSave={onSave} />);
    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Metformin');
    await fireEvent.press(screen.getByText('Add medicine'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: 'medicine',
      title: 'Metformin',
      medicineSchedule: 'repeat',
      medicineEndDate: undefined,
    }));
  });

  it('switching to a specific duration reveals an end-date field and saves the schedule', async () => {
    const onSave = jest.fn();
    const screen = await render(<RecordEditorHarness type="medicine" supportedPersonId="p1" onSave={onSave} />);
    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Antibiotic course');
    await fireEvent.press(screen.getByText('For a specific duration'));
    screen.getByText('Until'); // the end-date field is now offered
    await fireEvent.press(screen.getByText('Add medicine'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ medicineSchedule: 'duration' }));
  });

  it('closing a medicine preserves it as historical, never deleted', async () => {
    const onSave = jest.fn();
    const record: LilicaRecord = {
      id: 'm1',
      type: 'medicine',
      title: 'Ibuprofen',
      medicineSchedule: 'repeat',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const screen = await render(<RecordEditorHarness type="medicine" record={record} supportedPersonId="p1" onSave={onSave} />);
    await fireEvent.press(screen.getByText('Currently active'));
    await fireEvent.press(screen.getByText('Save changes'));
    const saved = onSave.mock.calls[0][0] as LilicaRecord;
    expect(saved.title).toBe('Ibuprofen');
    expect(typeof saved.closedAt).toBe('string');
  });
});

describe('Medical Log: never a generic completion checkbox', () => {
  it('condition/medicine never show the "Already sorted" completion control', async () => {
    for (const type of ['condition', 'medicine'] as const) {
      const draft = createRecordDraft(type);
      const screen = await render(
        <RecordEditor type={type} draft={draft} supportedPersonId="p1" onChange={jest.fn()} onSave={jest.fn()} />,
      );
      expect(screen.queryByText('Already sorted')).toBeNull();
    }
  });

  it('non-medical-log types never show the active/closed lifecycle control', async () => {
    for (const type of ['task', 'careNote'] as const) {
      const draft = createRecordDraft(type);
      const screen = await render(
        <RecordEditor type={type} draft={draft} supportedPersonId="p1" onChange={jest.fn()} onSave={jest.fn()} />,
      );
      expect(screen.queryByText('Currently active')).toBeNull();
    }
  });
});
