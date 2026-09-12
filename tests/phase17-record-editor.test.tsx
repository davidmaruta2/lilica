// Phase 17: RecordEditor's document-only "Related to" and "Does anything
// need doing?" sections. Isolated component tests -- no Supabase mocking
// needed, since RecordEditor never calls recordLinks/attachments itself;
// it only calls the callback props a host (RecordQuickEditor/
// FirstThingScreen) would wire up to those. Those hosts' own wiring is
// covered separately in tests/phase17-record-quick-editor.test.tsx.

import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { createRecordDraft, RecordDraft, RecordEditor } from '../src/components/RecordEditor';
import { PickableRecord } from '../src/components/RelatedRecordPicker';
import { LilicaRecord } from '../src/types';

// A brand-new draft's title has to genuinely update (RecordEditor is
// fully controlled via its `draft` prop) for its "Add document" button
// to ever become enabled -- this tiny stateful wrapper is what
// RecordQuickEditor/FirstThingScreen already do for real; a plain no-op
// onChange would leave `canSave` permanently false.
function NewDocumentHarness(props: {
  supportedPersonId: string;
  activeMembershipId?: string;
  relatableRecords?: PickableRecord[];
  onLinkRecord?: (sourceRecordId: string, targetRecordId: string, linkType: 'related_to' | 'action_for') => void;
  onCreateLinkedTask?: (sourceRecordId: string, task: { title: string; dueDate?: string; assignedMembershipId?: string }) => void;
  onSave: (record: LilicaRecord) => void;
}) {
  const [draft, setDraft] = useState<RecordDraft>(createRecordDraft('document'));
  return <RecordEditor {...props} type="document" draft={draft} onChange={setDraft} />;
}

const document: LilicaRecord = {
  id: 'doc-1', type: 'document', title: 'Hospital appointment letter', status: 'saved',
  createdAt: '2026-09-12T00:00:00.000Z',
};

const appointment = { id: 'appt-1', title: 'Orthopaedic appointment', subtitle: '15 Sep · 10:00' };

describe('RecordEditor: "Related to" (new document, deferred to Save)', () => {
  it('picking a candidate stages it locally, without linking before Save', async () => {
    const onLinkRecord = jest.fn();
    const onSave = jest.fn();
    const screen = await render(
      <NewDocumentHarness
        supportedPersonId="person-1"
        relatableRecords={[appointment]}
        onLinkRecord={onLinkRecord}
        onSave={onSave}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Link something'));
    await fireEvent.press(screen.getByLabelText(`Link to ${appointment.title}`));
    screen.getByText(appointment.title); // staged, shown as already picked
    expect(onLinkRecord).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Hospital letter');
    await fireEvent.press(screen.getByText('Add document'));
    expect(onLinkRecord).toHaveBeenCalledWith(expect.any(String), 'appt-1', 'related_to');
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('removing a staged pick before Save never links it', async () => {
    const onLinkRecord = jest.fn();
    const screen = await render(
      <NewDocumentHarness
        supportedPersonId="person-1"
        relatableRecords={[appointment]}
        onLinkRecord={onLinkRecord}
        onSave={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Link something'));
    await fireEvent.press(screen.getByLabelText(`Link to ${appointment.title}`));
    await fireEvent.press(screen.getByLabelText(`Remove link to ${appointment.title}`));
    expect(screen.queryByText(appointment.title)).toBeNull();

    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Hospital letter');
    await fireEvent.press(screen.getByText('Add document'));
    expect(onLinkRecord).not.toHaveBeenCalled();
  });
});

describe('RecordEditor: "Related to" (existing document, immediate)', () => {
  it('picking a candidate links it immediately, before any Save', async () => {
    const onLinkRecord = jest.fn();
    const screen = await render(
      <RecordEditor
        type="document"
        record={document}
        draft={createRecordDraft('document', document)}
        supportedPersonId="person-1"
        relatableRecords={[appointment]}
        onLinkRecord={onLinkRecord}
        onChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Link something'));
    await fireEvent.press(screen.getByLabelText(`Link to ${appointment.title}`));
    expect(onLinkRecord).toHaveBeenCalledWith('doc-1', 'appt-1', 'related_to');
  });

  it('shows existing links with a Remove action calling onUnlinkRecord immediately', async () => {
    const onUnlinkRecord = jest.fn();
    const screen = await render(
      <RecordEditor
        type="document"
        record={document}
        draft={createRecordDraft('document', document)}
        supportedPersonId="person-1"
        existingLinks={[{ linkId: 'link-1', linkType: 'related_to', direction: 'outgoing', recordId: 'appt-1', recordType: 'appointment', title: 'Orthopaedic appointment', createdAt: '2026-09-12T00:00:00.000Z' }]}
        onUnlinkRecord={onUnlinkRecord}
        onChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    screen.getByText('Orthopaedic appointment');
    await fireEvent.press(screen.getByLabelText('Remove link to Orthopaedic appointment'));
    expect(onUnlinkRecord).toHaveBeenCalledWith('link-1');
  });
});

describe('RecordEditor: "Does anything need doing?"', () => {
  it('defaults to No -- saving a document never creates a task by default', async () => {
    const onCreateLinkedTask = jest.fn();
    const screen = await render(
      <NewDocumentHarness
        supportedPersonId="person-1"
        onCreateLinkedTask={onCreateLinkedTask}
        onSave={jest.fn()}
      />,
    );
    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Hospital letter');
    await fireEvent.press(screen.getByText('Add document'));
    expect(onCreateLinkedTask).not.toHaveBeenCalled();
  });

  it('choosing Yes on a NEW document defers task creation to the main Save button', async () => {
    const onCreateLinkedTask = jest.fn();
    const onSave = jest.fn();
    const screen = await render(
      <NewDocumentHarness
        supportedPersonId="person-1"
        activeMembershipId="member-1"
        onCreateLinkedTask={onCreateLinkedTask}
        onSave={onSave}
      />,
    );
    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Hospital letter');
    await fireEvent.press(screen.getByText('Yes — add something to do'));
    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Call hospital to confirm');
    expect(onCreateLinkedTask).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Add document'));
    expect(onCreateLinkedTask).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ title: 'Call hospital to confirm', assignedMembershipId: 'member-1' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('choosing Yes but leaving the title blank creates no task', async () => {
    const onCreateLinkedTask = jest.fn();
    const screen = await render(
      <NewDocumentHarness
        supportedPersonId="person-1"
        onCreateLinkedTask={onCreateLinkedTask}
        onSave={jest.fn()}
      />,
    );
    await fireEvent.changeText(screen.getAllByDisplayValue('')[0], 'Hospital letter');
    await fireEvent.press(screen.getByText('Yes — add something to do'));
    await fireEvent.press(screen.getByText('Add document'));
    expect(onCreateLinkedTask).not.toHaveBeenCalled();
  });

  it('on an EXISTING document, "Add this task" fires immediately, separately from the record\'s own Save', async () => {
    const onCreateLinkedTask = jest.fn();
    const onSave = jest.fn();
    const screen = await render(
      <RecordEditor
        type="document"
        record={document}
        draft={createRecordDraft('document', document)}
        supportedPersonId="person-1"
        onCreateLinkedTask={onCreateLinkedTask}
        onChange={jest.fn()}
        onSave={onSave}
      />,
    );
    await fireEvent.press(screen.getByText('Yes — add something to do'));
    const titleField = screen.getAllByDisplayValue('').find((_, index) => index === 0)!;
    await fireEvent.changeText(titleField, 'Call hospital to confirm');
    await fireEvent.press(screen.getByText('Add this task'));
    expect(onCreateLinkedTask).toHaveBeenCalledWith('doc-1', expect.objectContaining({ title: 'Call hospital to confirm' }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
