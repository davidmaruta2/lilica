// Phase 20D, Part D: Documents -- a pure projection over record_attachments.
// Answers "show me [Name]'s documents" for the first time.
const mockListCareSpaceDocuments = jest.fn();
jest.mock('../src/documents', () => ({
  listCareSpaceDocuments: (...args: unknown[]) => mockListCareSpaceDocuments(...args),
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { DocumentsScreen } from '../src/screens/DocumentsScreen';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DocumentsScreen', () => {
  it('shows the real calm empty state when nothing has been added', async () => {
    mockListCareSpaceDocuments.mockResolvedValue({ ok: true, data: [] });
    const screen = await render(<DocumentsScreen careSpaceId="space-1" personName="Maggie" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    await waitFor(() => screen.getByText('No documents have been added for Maggie yet.'));
  });

  it('lists every document, newest first (as returned), with its parent-record context', async () => {
    mockListCareSpaceDocuments.mockResolvedValue({
      ok: true,
      data: [
        { id: 'doc-1', displayName: 'blue-badge.pdf', mimeType: 'application/pdf', sizeBytes: 102400, createdAt: '2026-09-01T00:00:00Z', recordId: 'record-1', recordTitle: 'Blue Badge application' },
        { id: 'doc-2', displayName: 'prescription.jpg', createdAt: '2026-09-10T00:00:00Z', recordId: 'record-2', recordTitle: 'Repeat prescription' },
      ],
    });
    const screen = await render(<DocumentsScreen careSpaceId="space-1" personName="Maggie" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    await waitFor(() => screen.getByText('blue-badge.pdf'));
    screen.getByText('prescription.jpg');
    screen.getByText(/Blue Badge application/);
  });

  it('tapping a document opens its PARENT RECORD via the existing route, not a new document-detail architecture', async () => {
    mockListCareSpaceDocuments.mockResolvedValue({
      ok: true,
      data: [{ id: 'doc-1', displayName: 'blue-badge.pdf', createdAt: '2026-09-01T00:00:00Z', recordId: 'record-1', recordTitle: 'Blue Badge application' }],
    });
    const onOpenRecord = jest.fn();
    const screen = await render(<DocumentsScreen careSpaceId="space-1" personName="Maggie" onBack={jest.fn()} onOpenRecord={onOpenRecord} />);
    await waitFor(() => screen.getByLabelText('Open blue-badge.pdf'));
    await fireEvent.press(screen.getByLabelText('Open blue-badge.pdf'));
    expect(onOpenRecord).toHaveBeenCalledWith('record-1');
  });

  it('shows the real failure message, never a fake empty state', async () => {
    mockListCareSpaceDocuments.mockResolvedValue({ ok: false, message: 'You are offline.' });
    const screen = await render(<DocumentsScreen careSpaceId="space-1" personName="Maggie" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    await waitFor(() => screen.getByText('You are offline.'));
  });

  it('a local-only care space (no careSpaceId) shows the empty state without ever calling the network read', async () => {
    const screen = await render(<DocumentsScreen careSpaceId={undefined} personName="Maggie" onBack={jest.fn()} onOpenRecord={jest.fn()} />);
    await waitFor(() => screen.getByText('No documents have been added for Maggie yet.'));
    expect(mockListCareSpaceDocuments).not.toHaveBeenCalled();
  });

  it('Back calls the real handler', async () => {
    mockListCareSpaceDocuments.mockResolvedValue({ ok: true, data: [] });
    const onBack = jest.fn();
    const screen = await render(<DocumentsScreen careSpaceId="space-1" onBack={onBack} onOpenRecord={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
