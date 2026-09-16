const mockExportCareSummaryPdf = jest.fn();
jest.mock('../src/careSummaryPdf', () => ({
  exportCareSummaryPdf: (...args: unknown[]) => mockExportCareSummaryPdf(...args),
}));

import { fireEvent, render } from '@testing-library/react-native';

import { CareSummaryScreen } from '../src/screens/CareSummaryScreen';
import { LilicaRecord } from '../src/types';
import { CareCircleMember } from '../src/careCircle';

const records: LilicaRecord[] = [
  { id: 'contact-1', type: 'contact', title: 'Dr Patel', role: 'GP', createdAt: '2026-09-01T00:00:00.000Z' },
];
const members: CareCircleMember[] = [
  { membershipId: 'mem-1', displayName: 'David', role: 'organiser', relationshipType: 'Mum', isSelf: true, grantedDomains: [] },
];

beforeEach(() => {
  mockExportCareSummaryPdf.mockReset();
  mockExportCareSummaryPdf.mockResolvedValue({ ok: true, uri: 'file:///care-summary.pdf' });
});

describe('CareSummaryScreen', () => {
  it('shows a calm empty state when there is nothing to summarise yet', async () => {
    const screen = await render(<CareSummaryScreen records={[]} careCircleMembers={[]} recentActivity={[]} personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    screen.getByText(/Nothing to summarise yet/);
  });

  it('renders only the sections that have real data, never "Emergency" wording', async () => {
    const screen = await render(<CareSummaryScreen records={records} careCircleMembers={members} recentActivity={[]} personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    screen.getByText('Key contacts');
    screen.getByText('Care Circle');
    expect(screen.queryByText(/Bills & renewals/)).toBeNull();
    expect(screen.queryByText(/Emergency/i)).toBeNull();
  });

  it('tapping a record item opens the same underlying record detail', async () => {
    const onOpenRecord = jest.fn();
    const screen = await render(<CareSummaryScreen records={records} careCircleMembers={[]} recentActivity={[]} personName="Beauty" onBack={jest.fn()} onOpenRecord={onOpenRecord} />);
    await fireEvent.press(screen.getByLabelText('Dr Patel'));
    expect(onOpenRecord).toHaveBeenCalledWith('contact-1');
  });

  it('shows the real Care Circle member list, using "You" for self', async () => {
    const screen = await render(<CareSummaryScreen records={[]} careCircleMembers={members} recentActivity={[]} personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    screen.getByText('You');
    screen.getByText('Organiser');
  });

  it('never shows a "N hidden" placeholder for anything', async () => {
    const screen = await render(<CareSummaryScreen records={records} careCircleMembers={members} recentActivity={[]} personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    expect(screen.queryByText(/hidden/i)).toBeNull();
  });

  it('exports a detailed PDF from the complete authorised screen inputs', async () => {
    const screen = await render(<CareSummaryScreen records={records} careCircleMembers={members} recentActivity={[]} personName="Beauty" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Export Care Summary as PDF'));
    expect(mockExportCareSummaryPdf).toHaveBeenCalledWith({
      records,
      careCircleMembers: members,
      recentActivity: [],
      personName: 'Beauty',
    });
  });
});
