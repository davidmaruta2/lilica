// Phase 17: RecordQuickEditor's actual wiring of the Phase 16 foundation
// into a real host -- link creation/removal, linked-task creation,
// in-sheet navigation between linked records, View document, and
// document-save upload queuing. src/recordLinks.ts and src/attachments.ts
// are mocked at the module boundary (their own internals are already
// covered by tests/phase16-record-links.test.ts and
// tests/phase16-attachments.test.ts and the pgTAP suite) -- this file
// only proves RecordQuickEditor calls them correctly and reacts to their
// results correctly.

const mockListRecordLinks = jest.fn();
const mockCreateRecordLink = jest.fn();
const mockRemoveRecordLink = jest.fn();
jest.mock('../src/recordLinks', () => ({
  listRecordLinks: (...args: unknown[]) => mockListRecordLinks(...args),
  createRecordLink: (...args: unknown[]) => mockCreateRecordLink(...args),
  removeRecordLink: (...args: unknown[]) => mockRemoveRecordLink(...args),
}));

const mockQueuePendingAttachmentUploads = jest.fn();
const mockOpenAttachment = jest.fn();
jest.mock('../src/attachments', () => ({
  queuePendingAttachmentUploads: (...args: unknown[]) => mockQueuePendingAttachmentUploads(...args),
  openAttachment: (...args: unknown[]) => mockOpenAttachment(...args),
}));

import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { RecordQuickEditor } from '../src/components/RecordQuickEditor';
import { LilicaRecord } from '../src/types';

const document: LilicaRecord = {
  id: 'doc-1', type: 'document', title: 'Hospital appointment letter', status: 'saved',
  createdAt: '2026-09-12T00:00:00.000Z',
  attachments: [{ id: 'att-1', kind: 'file', name: 'hospital-letter.pdf', uri: 'file:///local/hospital-letter.pdf', createdAt: '2026-09-12T00:00:00.000Z' }],
};

const appointment: LilicaRecord = {
  id: 'appt-1', type: 'appointment', title: 'Orthopaedic appointment', status: 'scheduled',
  eventDate: '2026-09-15', eventTime: '10:00', createdAt: '2026-09-01T00:00:00.000Z',
};

const baseProps = {
  supportedPersonId: 'person-1',
  careSpaceId: 'space-1',
  onSaveRecord: jest.fn(),
  onRemoveRecord: jest.fn(),
  onDismiss: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListRecordLinks.mockResolvedValue({ ok: true, data: [] });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('RecordQuickEditor: link creation/removal', () => {
  it('picking a related record on an EXISTING document calls createRecordLink with this care space', async () => {
    mockCreateRecordLink.mockResolvedValue({ ok: true, data: 'link-1' });
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[document, appointment]} recordId="doc-1" />,
    );
    await fireEvent.press(screen.getByLabelText('Edit Hospital appointment letter'));
    await fireEvent.press(screen.getByLabelText('Link something'));
    await fireEvent.press(screen.getByLabelText('Link to Orthopaedic appointment'));
    expect(mockCreateRecordLink).toHaveBeenCalledWith({
      careSpaceId: 'space-1', sourceRecordId: 'doc-1', targetRecordId: 'appt-1', linkType: 'related_to',
    });
  });

  it('removing a link calls removeRecordLink and it disappears from the editor', async () => {
    mockListRecordLinks.mockResolvedValue({
      ok: true,
      data: [{ linkId: 'link-1', linkType: 'related_to', direction: 'outgoing', recordId: 'appt-1', recordType: 'appointment', title: 'Orthopaedic appointment', createdAt: '2026-09-12T00:00:00.000Z' }],
    });
    mockRemoveRecordLink.mockResolvedValue({ ok: true, data: undefined });
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[document, appointment]} recordId="doc-1" />,
    );
    await fireEvent.press(screen.getByLabelText('Edit Hospital appointment letter'));
    await waitFor(() => screen.getByText('Orthopaedic appointment'));
    await fireEvent.press(screen.getByLabelText('Remove link to Orthopaedic appointment'));
    expect(mockRemoveRecordLink).toHaveBeenCalledWith('link-1');
    await waitFor(() => expect(screen.queryByText('Orthopaedic appointment')).toBeNull());
  });
});

describe('RecordQuickEditor: linked-task creation', () => {
  it('"Does anything need doing?" on an existing document creates a real task AND an action_for link', async () => {
    mockCreateRecordLink.mockResolvedValue({ ok: true, data: 'link-2' });
    const onSaveRecord = jest.fn();
    const screen = await render(
      <RecordQuickEditor {...baseProps} onSaveRecord={onSaveRecord} records={[document]} recordId="doc-1" />,
    );
    await fireEvent.press(screen.getByLabelText('Edit Hospital appointment letter'));
    await fireEvent.press(screen.getByText('Yes — add something to do'));
    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Call hospital to confirm');
    await fireEvent.press(screen.getByText('Add this task'));

    expect(onSaveRecord).toHaveBeenCalledWith(expect.objectContaining({ type: 'task', title: 'Call hospital to confirm' }));
    const taskId = onSaveRecord.mock.calls[0][0].id;
    expect(mockCreateRecordLink).toHaveBeenCalledWith({
      careSpaceId: 'space-1', sourceRecordId: taskId, targetRecordId: 'doc-1', linkType: 'action_for',
    });
  });
});

describe('RecordQuickEditor: in-sheet link navigation', () => {
  it('opening a linked record retargets the SAME sheet, without closing it', async () => {
    // A realistic list_record_links() responds relative to whichever id
    // is actually queried -- the document sees the appointment as
    // outgoing; the appointment (once navigated to) sees the document as
    // incoming. A mock that ignored the argument would wrongly show the
    // appointment linked to itself.
    mockListRecordLinks.mockImplementation(async (recordId: string) => ({
      ok: true,
      data: recordId === 'doc-1'
        ? [{ linkId: 'link-1', linkType: 'related_to', direction: 'outgoing', recordId: 'appt-1', recordType: 'appointment', title: 'Orthopaedic appointment', createdAt: '2026-09-12T00:00:00.000Z' }]
        : [{ linkId: 'link-1', linkType: 'related_to', direction: 'incoming', recordId: 'doc-1', recordType: 'document', title: 'Hospital appointment letter', createdAt: '2026-09-12T00:00:00.000Z' }],
    }));
    const onDismiss = jest.fn();
    const screen = await render(
      <RecordQuickEditor {...baseProps} onDismiss={onDismiss} records={[document, appointment]} recordId="doc-1" />,
    );
    await waitFor(() => screen.getByText('Related to'));
    await fireEvent.press(screen.getByLabelText('Open Orthopaedic appointment'));
    // Now on the appointment's own detail -- the same stored link shows
    // the document from this side, under "Documents" (never a second,
    // duplicate reverse link row).
    await waitFor(() => screen.getByText('Documents'));
    screen.getByText('Hospital appointment letter');
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('RecordQuickEditor: View document', () => {
  it('taps through to openAttachment for the tapped attachment', async () => {
    mockOpenAttachment.mockResolvedValue({ ok: true });
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[document]} recordId="doc-1" />,
    );
    await fireEvent.press(screen.getByLabelText('View hospital-letter.pdf'));
    expect(mockOpenAttachment).toHaveBeenCalledWith(document.attachments![0]);
  });

  it('shows a friendly alert when opening fails, never a raw error', async () => {
    mockOpenAttachment.mockResolvedValue({ ok: false, message: 'This document could not be opened. Please try again.' });
    const screen = await render(
      <RecordQuickEditor {...baseProps} records={[document]} recordId="doc-1" />,
    );
    await fireEvent.press(screen.getByLabelText('View hospital-letter.pdf'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Could not open document', 'This document could not be opened. Please try again.'));
  });
});

describe('RecordQuickEditor: attachment upload queuing on save', () => {
  it('queues pending attachment uploads after a document saves', async () => {
    mockQueuePendingAttachmentUploads.mockResolvedValue(undefined);
    const onSaveRecord = jest.fn();
    const screen = await render(
      <RecordQuickEditor {...baseProps} onSaveRecord={onSaveRecord} records={[document]} recordId="doc-1" />,
    );
    await fireEvent.press(screen.getByLabelText('Edit Hospital appointment letter'));
    await fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockQueuePendingAttachmentUploads).toHaveBeenCalledWith('space-1', expect.objectContaining({ id: 'doc-1' })));
  });
});
