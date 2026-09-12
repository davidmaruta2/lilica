import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { openAttachment, queuePendingAttachmentUploads } from '../attachments';
import { CareCircleMember } from '../careCircle';
import { firstItemOptions } from '../data/options';
import { createUuid } from '../identifiers';
import { createRecordLink, LinkedRecordSummary, listRecordLinks, removeRecordLink } from '../recordLinks';
import { isLinkableRecordType, linkPickerSummary } from '../records';
import { LilicaRecord, LilicaRecordType } from '../types';
import { canEditRecord, RecordDetail, RelatedRecordEntry } from './RecordDetail';
import { createRecordDraft, RecordDraft, RecordEditor, RecordEditorHandle } from './RecordEditor';
import { RecordSheet } from './RecordSheet';

// Bug fix: opening a record from Home/Calendar/To Do/Care Circle/Wellbeing
// updates used to route through FirstThingScreen -- a completely different
// full screen, with its own header, background and category-gateway list
// ("Beauty's records") -- just to reuse its editor. That extra screen was
// what actually sat behind the sheet: on open it had to mount before the
// sheet appeared, and on close it had to unmount back to whichever tab the
// user actually came from, and BOTH of those swaps are what read as a
// "flash" (the wrong screen briefly visible, not just an animation
// timing issue). Neither an `instant` flag on the sheet nor fixing its
// drag gesture could remove that, because the underlying screen swap was
// still genuinely happening underneath.
//
// This component is the fix: it reuses the exact same RecordSheet +
// RecordEditor pairing FirstThingScreen already uses for its own editor,
// but mounts directly as an overlay on top of whichever screen is already
// showing -- Home, Calendar, To Do or Care Circle never unmount, so there
// is nothing behind the sheet to flash to in the first place.
type Props = {
  records: LilicaRecord[];
  // Open this existing record for editing.
  recordId?: string;
  // Open a NEW draft of this category instead (Person's per-section Add
  // links). Only one of recordId/newType is ever set at once.
  newType?: LilicaRecordType;
  supportedPersonId: string;
  // Phase 17: the active care space's stable id -- needed for record-link
  // and cloud-attachment RPCs, both of which are always care-space-scoped.
  careSpaceId: string;
  activeMembershipId?: string;
  careCircleMembers?: CareCircleMember[];
  onRequestReminderPermission?: () => Promise<boolean>;
  onSaveRecord: (record: LilicaRecord) => void;
  onRemoveRecord: (recordId: string) => void;
  onDismiss: () => void;
};

export function RecordQuickEditor({
  records,
  recordId,
  newType,
  supportedPersonId,
  careSpaceId,
  activeMembershipId,
  careCircleMembers,
  onRequestReminderPermission,
  onSaveRecord,
  onRemoveRecord,
  onDismiss,
}: Props) {
  // Phase 17: link navigation ("Document -> Orthopaedic appointment ->
  // Appointment Detail") stays inside this SAME sheet -- retargeting which
  // record is open, rather than closing and reopening a different one.
  // Starts at whatever the caller originally asked to open.
  const [activeRecordId, setActiveRecordId] = useState(recordId);
  const record = activeRecordId ? records.find((item) => item.id === activeRecordId) : undefined;
  const type = record?.type ?? newType;
  const [draft, setDraft] = useState<RecordDraft | undefined>(undefined);
  // Corrective task (view/edit separation): an EXISTING record opens in
  // read-only view first -- a brand-new draft (no record yet) skips
  // straight to the editor exactly as before, since Add is a create
  // action, never something to view first. Initialised once per mount;
  // App.tsx keys this component by recordId/newType, so a different
  // target is always a fresh mount, never a stale carried-over mode.
  const [mode, setMode] = useState<'view' | 'edit'>(record ? 'view' : 'edit');
  const editorRef = useRef<RecordEditorHandle>(null);
  // Explicit product direction: closing the sheet (Done, backdrop tap or
  // swipe) should save pending valid changes first -- see RecordSheet's
  // onBeforeDismiss. For a brand-new record, that save's own onSave
  // handler must NOT also call onDismiss directly (as the plain Save/Add
  // button press still does) -- RecordSheet's own closing animation is
  // already under way at that point, and calling onDismiss immediately
  // would unmount this component mid-animation, skipping it entirely.
  // This flag is the one signal distinguishing "closing" from "the user
  // pressed Save/Add" -- both call the exact same onSave.
  const closingViaSheet = useRef(false);

  // Phase 17: this record's own persisted links (see
  // src/recordLinks.ts's list_record_links -- already filtered
  // server-side to what this account may see). Re-fetched whenever the
  // record actually open here changes; a brand-new, unsaved draft has no
  // id to fetch links for yet.
  const [links, setLinks] = useState<LinkedRecordSummary[]>([]);
  useEffect(() => {
    if (!record) { setLinks([]); return; }
    let cancelled = false;
    listRecordLinks(record.id).then((result) => {
      if (!cancelled && result.ok) setLinks(result.data);
    });
    return () => { cancelled = true; };
  }, [record?.id]);

  if (!type) return null;

  const option = firstItemOptions.find((item) => item.id === type);
  const resolvedDraft = draft ?? createRecordDraft(type, record);

  // Phase 17: resolve each link to the OTHER record's full data from the
  // already-loaded, already-care-space-scoped `records` list -- never a
  // second fetch. A link whose other side isn't present locally (a rare
  // cache-staleness edge case) is simply omitted, never a broken row.
  const relatedRecords: RelatedRecordEntry[] = links.flatMap((link) => {
    const other = records.find((item) => item.id === link.recordId);
    return other ? [{ linkId: link.linkId, linkType: link.linkType, direction: link.direction, record: other }] : [];
  });

  const relatableRecords = records
    .filter((item) => item.id !== record?.id && item.status !== 'cancelled' && isLinkableRecordType(item.type))
    .map(linkPickerSummary);

  async function afterDocumentSaved(savedRecord: LilicaRecord) {
    if (savedRecord.type !== 'document') return;
    const uploaded = await queuePendingAttachmentUploads(careSpaceId, savedRecord);
    if (uploaded) onSaveRecord({ ...savedRecord, attachments: uploaded });
  }

  return (
    <RecordSheet
      title={option?.title ?? 'Record'}
      onDismiss={onDismiss}
      onBeforeDismiss={mode === 'edit' ? () => {
        closingViaSheet.current = true;
        editorRef.current?.save();
      } : undefined}
    >
      {record && mode === 'view' ? (
        <RecordDetail
          record={record}
          activeMembershipId={activeMembershipId}
          careCircleMembers={careCircleMembers}
          onEdit={canEditRecord(record, careCircleMembers) ? () => setMode('edit') : undefined}
          relatedRecords={relatedRecords}
          onOpenLinkedRecord={(targetId) => {
            setActiveRecordId(targetId);
            setMode('view');
          }}
          onViewDocument={(attachmentId) => {
            const attachment = record.attachments?.find((item) => item.id === attachmentId);
            if (!attachment) return;
            void openAttachment(attachment).then((result) => {
              if (!result.ok) Alert.alert('Could not open document', result.message);
            });
          }}
        />
      ) : (
        <RecordEditor
          ref={editorRef}
          type={type}
          record={record}
          draft={resolvedDraft}
          supportedPersonId={supportedPersonId}
          activeMembershipId={activeMembershipId}
          careCircleMembers={careCircleMembers}
          onRequestReminderPermission={onRequestReminderPermission}
          onChange={setDraft}
          relatableRecords={relatableRecords}
          existingLinks={links.filter((link) => link.linkType === 'related_to' && link.direction === 'outgoing')}
          onLinkRecord={(sourceId, targetId, linkType) => {
            void createRecordLink({ careSpaceId, sourceRecordId: sourceId, targetRecordId: targetId, linkType }).then((result) => {
              if (result.ok && record?.id === sourceId) {
                listRecordLinks(sourceId).then((refreshed) => { if (refreshed.ok) setLinks(refreshed.data); });
              }
            });
          }}
          onUnlinkRecord={(linkId) => {
            void removeRecordLink(linkId).then((result) => {
              if (result.ok) setLinks((current) => current.filter((item) => item.linkId !== linkId));
            });
          }}
          onCreateLinkedTask={(sourceId, task) => {
            const now = new Date().toISOString();
            const taskRecord: LilicaRecord = {
              id: createUuid(),
              type: 'task',
              title: task.title,
              supportedPersonId,
              status: 'unresolved',
              dueDate: task.dueDate,
              assignedMembershipId: task.assignedMembershipId,
              completed: false,
              createdAt: now,
              updatedAt: now,
            };
            onSaveRecord(taskRecord);
            void createRecordLink({ careSpaceId, sourceRecordId: taskRecord.id, targetRecordId: sourceId, linkType: 'action_for' }).then((result) => {
              if (result.ok && record?.id === sourceId) {
                listRecordLinks(sourceId).then((refreshed) => { if (refreshed.ok) setLinks(refreshed.data); });
              }
            });
          }}
          onSave={(savedRecord) => {
            onSaveRecord(savedRecord);
            void afterDocumentSaved(savedRecord);
            // Editing an existing record returns to its own (now updated)
            // read-only detail, staying open -- never closing the sheet or
            // falling back to wherever it was opened from. A brand-new
            // record has no detail to return to, so creation stays exactly
            // as efficient as before when explicitly saved via the
            // Save/Add button; when saved by closing instead, the sheet's
            // own closing animation (already in progress) owns calling
            // onDismiss once it finishes.
            if (record) {
              setActiveRecordId(record.id);
              setMode('view');
            } else if (!closingViaSheet.current) onDismiss();
          }}
          onRemove={record ? () => {
            onRemoveRecord(record.id);
            onDismiss();
          } : undefined}
        />
      )}
    </RecordSheet>
  );
}
