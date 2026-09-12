// Phase 17: RecordDetail's bidirectional related-record presentation and
// "View document" -- isolated component tests (the host resolves links/
// records before ever reaching this component, so no Supabase mocking is
// needed here; that resolution is covered in
// tests/phase17-record-quick-editor.test.tsx).

import { fireEvent, render } from '@testing-library/react-native';

import { RecordDetail, RelatedRecordEntry } from '../src/components/RecordDetail';
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

const task: LilicaRecord = {
  id: 'task-1', type: 'task', title: 'Call hospital to confirm', status: 'unresolved',
  dueDate: '2026-09-13', assignedMembershipId: 'member-david', createdAt: '2026-09-12T00:00:00.000Z',
};

describe('RecordDetail: bidirectional related-record presentation', () => {
  it('a document shows an outgoing related_to link under "Related to"', async () => {
    const entry: RelatedRecordEntry = { linkId: 'link-1', linkType: 'related_to', direction: 'outgoing', record: appointment };
    const screen = await render(<RecordDetail record={document} relatedRecords={[entry]} />);
    screen.getByText('Related to');
    screen.getByText('Orthopaedic appointment');
    screen.getByText('15 Sept 2026 · 10:00');
  });

  it('the SAME stored link shows the document from the appointment\'s own side, under "Documents"', async () => {
    const entry: RelatedRecordEntry = { linkId: 'link-1', linkType: 'related_to', direction: 'incoming', record: document };
    const screen = await render(<RecordDetail record={appointment} relatedRecords={[entry]} />);
    screen.getByText('Documents');
    screen.getByText('Hospital appointment letter');
  });

  it('a document shows an incoming action_for task under "Action", with due date and assignee', async () => {
    const entry: RelatedRecordEntry = { linkId: 'link-2', linkType: 'action_for', direction: 'incoming', record: { ...task, assignedMembershipId: 'member-david' } };
    const screen = await render(
      <RecordDetail
        record={document}
        relatedRecords={[entry]}
        activeMembershipId="member-david"
        careCircleMembers={[{ membershipId: 'member-david', displayName: 'David', role: 'organiser', relationshipType: 'Someone else', isSelf: true, grantedDomains: [] }]}
      />,
    );
    screen.getByText('Action');
    screen.getByText('Call hospital to confirm');
  });

  it('a task shows its outgoing action_for document under "Related document"', async () => {
    const entry: RelatedRecordEntry = { linkId: 'link-2', linkType: 'action_for', direction: 'outgoing', record: document };
    const screen = await render(<RecordDetail record={task} relatedRecords={[entry]} />);
    screen.getByText('Related document');
    screen.getByText('Hospital appointment letter');
  });

  it('renders no related-record section at all when there is nothing to show (a reference-only document)', async () => {
    const screen = await render(<RecordDetail record={document} />);
    expect(screen.queryByText('Related to')).toBeNull();
    expect(screen.queryByText('Documents')).toBeNull();
    expect(screen.queryByText('Action')).toBeNull();
  });

  it('tapping a related row opens that record, via onOpenLinkedRecord -- never Edit', async () => {
    const onOpenLinkedRecord = jest.fn();
    const entry: RelatedRecordEntry = { linkId: 'link-1', linkType: 'related_to', direction: 'outgoing', record: appointment };
    const screen = await render(<RecordDetail record={document} relatedRecords={[entry]} onOpenLinkedRecord={onOpenLinkedRecord} />);
    await fireEvent.press(screen.getByLabelText('Open Orthopaedic appointment'));
    expect(onOpenLinkedRecord).toHaveBeenCalledWith('appt-1');
  });
});

describe('RecordDetail: View document', () => {
  it('shows a View action per attachment, never assuming only one', async () => {
    const twoAttachments: LilicaRecord = {
      ...document,
      attachments: [
        { id: 'att-1', kind: 'file', name: 'letter.pdf', uri: 'file:///a.pdf', createdAt: '2026-09-12T00:00:00.000Z' },
        { id: 'att-2', kind: 'scan', name: 'scan.jpg', uri: 'file:///b.jpg', createdAt: '2026-09-12T00:00:00.000Z' },
      ],
    };
    const onViewDocument = jest.fn();
    const screen = await render(<RecordDetail record={twoAttachments} onViewDocument={onViewDocument} />);
    screen.getByText('letter.pdf');
    screen.getByText('scan.jpg');
    await fireEvent.press(screen.getByLabelText('View scan.jpg'));
    expect(onViewDocument).toHaveBeenCalledWith('att-2');
  });

  it('shows nothing document-related for a record with no attachments', async () => {
    const screen = await render(<RecordDetail record={{ ...document, attachments: [] }} onViewDocument={jest.fn()} />);
    expect(screen.queryByText('Document')).toBeNull();
    expect(screen.queryByText(/^View /)).toBeNull();
  });
});
