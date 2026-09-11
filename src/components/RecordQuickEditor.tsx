import { useState } from 'react';

import { CareCircleMember } from '../careCircle';
import { firstItemOptions } from '../data/options';
import { LilicaRecord, LilicaRecordType } from '../types';
import { canEditRecord, RecordDetail } from './RecordDetail';
import { createRecordDraft, RecordDraft, RecordEditor } from './RecordEditor';
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
  activeMembershipId,
  careCircleMembers,
  onRequestReminderPermission,
  onSaveRecord,
  onRemoveRecord,
  onDismiss,
}: Props) {
  const record = recordId ? records.find((item) => item.id === recordId) : undefined;
  const type = record?.type ?? newType;
  const [draft, setDraft] = useState<RecordDraft | undefined>(undefined);
  // Corrective task (view/edit separation): an EXISTING record opens in
  // read-only view first -- a brand-new draft (no record yet) skips
  // straight to the editor exactly as before, since Add is a create
  // action, never something to view first. Initialised once per mount;
  // App.tsx keys this component by recordId/newType, so a different
  // target is always a fresh mount, never a stale carried-over mode.
  const [mode, setMode] = useState<'view' | 'edit'>(record ? 'view' : 'edit');

  if (!type) return null;

  const option = firstItemOptions.find((item) => item.id === type);
  const resolvedDraft = draft ?? createRecordDraft(type, record);

  return (
    <RecordSheet title={option?.title ?? 'Record'} onDismiss={onDismiss}>
      {record && mode === 'view' ? (
        <RecordDetail
          record={record}
          activeMembershipId={activeMembershipId}
          careCircleMembers={careCircleMembers}
          onEdit={canEditRecord(record, careCircleMembers) ? () => setMode('edit') : undefined}
        />
      ) : (
        <RecordEditor
          type={type}
          record={record}
          draft={resolvedDraft}
          supportedPersonId={supportedPersonId}
          activeMembershipId={activeMembershipId}
          careCircleMembers={careCircleMembers}
          onRequestReminderPermission={onRequestReminderPermission}
          onChange={setDraft}
          onSave={(savedRecord) => {
            onSaveRecord(savedRecord);
            // Editing an existing record returns to its own (now updated)
            // read-only detail, staying open -- never closing the sheet or
            // falling back to wherever it was opened from. A brand-new
            // record has no detail to return to, so creation stays exactly
            // as efficient as before: save closes the sheet.
            if (record) setMode('view');
            else onDismiss();
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
