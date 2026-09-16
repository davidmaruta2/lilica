const mockPrintToFileAsync = jest.fn();
const mockSharingAvailable = jest.fn();
const mockShareAsync = jest.fn();

jest.mock('expo-print', () => ({
  printToFileAsync: (...args: unknown[]) => mockPrintToFileAsync(...args),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: (...args: unknown[]) => mockSharingAvailable(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

import { buildCareSummaryPdfHtml, exportCareSummaryPdf } from '../src/careSummaryPdf';
import { LilicaRecord } from '../src/types';

const records: LilicaRecord[] = [
  { id: 'task-1', type: 'task', title: 'Collect <prescription>', status: 'unresolved', dueDate: '2026-09-15', notes: 'Bring ID', createdAt: '2026-09-01T09:00:00.000Z' },
  ...Array.from({ length: 6 }, (_, index): LilicaRecord => ({
    id: `contact-${index}`,
    type: 'contact',
    title: `Contact ${index + 1}`,
    role: 'Clinician',
    phone: `0100${index}`,
    status: 'saved',
    createdAt: '2026-09-01T09:00:00.000Z',
  })),
];

const input = {
  records,
  careCircleMembers: [],
  recentActivity: [],
  personName: 'Ben',
  generatedAt: new Date('2026-09-16T12:00:00.000Z'),
};

beforeEach(() => {
  mockPrintToFileAsync.mockReset();
  mockSharingAvailable.mockReset();
  mockShareAsync.mockReset();
  mockSharingAvailable.mockResolvedValue(true);
  mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///care-summary.pdf' });
  mockShareAsync.mockResolvedValue(undefined);
});

describe('Care Summary PDF', () => {
  it('uses the complete authorised input rather than the bounded on-screen preview', () => {
    const html = buildCareSummaryPdfHtml(input);
    expect(html).toContain("Ben's care summary");
    expect(html).toContain('Contact 6');
    expect(html).toContain('Collect &lt;prescription&gt;');
    expect(html).toContain('Private and sensitive');
    expect(html).toContain('Errand or activity');
  });

  it('renders locally and opens the native PDF share sheet', async () => {
    const result = await exportCareSummaryPdf(input);
    expect(result).toEqual({ ok: true, uri: 'file:///care-summary.pdf' });
    expect(mockPrintToFileAsync).toHaveBeenCalledWith({ html: expect.stringContaining("Ben's care summary") });
    expect(mockShareAsync).toHaveBeenCalledWith('file:///care-summary.pdf', expect.objectContaining({ mimeType: 'application/pdf' }));
  });

  it('fails honestly when device sharing is unavailable', async () => {
    mockSharingAvailable.mockResolvedValue(false);
    await expect(exportCareSummaryPdf(input)).resolves.toEqual({ ok: false, message: 'Saving PDF reports is not supported on this device.' });
    expect(mockPrintToFileAsync).not.toHaveBeenCalled();
  });
});
