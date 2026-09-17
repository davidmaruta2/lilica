// Post-build implementation batch (lilbatch.txt, 17 September 2026), change
// three: MedicalLogScreen's grouping (care needs / conditions / medicines,
// active vs past/closed) and multi-person isolation -- Maggie's Medical
// Log must never show Ben's records, since this screen is handed an
// already-scoped `records` array exactly like every other screen.
import { fireEvent, render } from '@testing-library/react-native';

import { MedicalLogScreen } from '../src/screens/MedicalLogScreen';
import { LilicaRecord } from '../src/types';

function record(overrides: Partial<LilicaRecord> & Pick<LilicaRecord, 'id' | 'type' | 'title'>): LilicaRecord {
  return { createdAt: '2026-01-01T00:00:00.000Z', ...overrides };
}

describe('MedicalLogScreen: sections and grouping', () => {
  const records: LilicaRecord[] = [
    record({ id: 'need-1', type: 'careNote', title: 'Help with bathing' }),
    record({ id: 'cond-active', type: 'condition', title: 'Asthma' }),
    record({ id: 'cond-closed', type: 'condition', title: 'Chickenpox', closedAt: '2020-01-01T00:00:00.000Z' }),
    record({ id: 'med-active', type: 'medicine', title: 'Metformin', medicineSchedule: 'repeat' }),
    record({ id: 'med-closed', type: 'medicine', title: 'Old antibiotic course', medicineSchedule: 'duration', closedAt: '2026-02-01T00:00:00.000Z' }),
    // Not Medical Log content -- proves it never leaks in.
    record({ id: 'appt-1', type: 'appointment', title: 'GP check-up' }),
  ];

  it('shows care needs, and active conditions/medicines, under their own headings', async () => {
    const screen = await render(
      <MedicalLogScreen personName="Maggie" isSelf={false} records={records} onBack={jest.fn()} onOpenRecord={jest.fn()} onAddType={jest.fn()} />,
    );
    screen.getByText('Care needs');
    screen.getByText('Help with bathing');
    screen.getByText('Diagnosed conditions');
    screen.getByText('Asthma');
    screen.getByText('Prescribed medicines');
    screen.getByText('Metformin');
    expect(screen.queryByText('GP check-up')).toBeNull();
  });

  it('separates closed conditions/medicines into a Past / closed group, never hidden entirely', async () => {
    const screen = await render(
      <MedicalLogScreen personName="Maggie" isSelf={false} records={records} onBack={jest.fn()} onOpenRecord={jest.fn()} onAddType={jest.fn()} />,
    );
    const pastGroups = screen.getAllByText('Past / closed');
    expect(pastGroups.length).toBe(2); // one for conditions, one for medicines
    screen.getByText('Chickenpox');
    screen.getByText('Old antibiotic course');
  });

  it('tapping a row opens that record', async () => {
    const onOpenRecord = jest.fn();
    const screen = await render(
      <MedicalLogScreen personName="Maggie" isSelf={false} records={records} onBack={jest.fn()} onOpenRecord={onOpenRecord} onAddType={jest.fn()} />,
    );
    await fireEvent.press(screen.getByText('Asthma'));
    expect(onOpenRecord).toHaveBeenCalledWith('cond-active');
  });

  it('Add routes to the correct record type per section', async () => {
    const onAddType = jest.fn();
    const screen = await render(
      <MedicalLogScreen personName="Maggie" isSelf={false} records={records} onBack={jest.fn()} onOpenRecord={jest.fn()} onAddType={onAddType} />,
    );
    await fireEvent.press(screen.getByLabelText('Add a diagnosed condition'));
    expect(onAddType).toHaveBeenCalledWith('condition');
    await fireEvent.press(screen.getByLabelText('Add a prescribed medicine'));
    expect(onAddType).toHaveBeenCalledWith('medicine');
    await fireEvent.press(screen.getByLabelText('Add a care need'));
    expect(onAddType).toHaveBeenCalledWith('careNote');
  });
});

describe('MedicalLogScreen: multi-person isolation', () => {
  it("Maggie's Medical Log never shows Ben's records", async () => {
    const maggieRecords: LilicaRecord[] = [record({ id: 'maggie-cond', type: 'condition', title: "Maggie's condition" })];
    const benRecords: LilicaRecord[] = [record({ id: 'ben-cond', type: 'condition', title: "Ben's condition" })];

    const maggieScreen = await render(
      <MedicalLogScreen personName="Maggie" isSelf={false} records={maggieRecords} onBack={jest.fn()} onOpenRecord={jest.fn()} onAddType={jest.fn()} />,
    );
    maggieScreen.getByText("Maggie's condition");
    expect(maggieScreen.queryByText("Ben's condition")).toBeNull();

    const benScreen = await render(
      <MedicalLogScreen personName="Ben" isSelf={false} records={benRecords} onBack={jest.fn()} onOpenRecord={jest.fn()} onAddType={jest.fn()} />,
    );
    benScreen.getByText("Ben's condition");
    expect(benScreen.queryByText("Maggie's condition")).toBeNull();
  });

  it('shows empty-state copy for a person with nothing recorded yet', async () => {
    const screen = await render(
      <MedicalLogScreen personName="Ben" isSelf={false} records={[]} onBack={jest.fn()} onOpenRecord={jest.fn()} onAddType={jest.fn()} />,
    );
    screen.getByText('No conditions saved yet.');
    screen.getByText('No medicines saved yet.');
  });
});
