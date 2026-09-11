import { useState } from 'react';

import { CareCircleMember } from '../careCircle';
import { firstItemOptions } from '../data/options';
import { LilicaRecord, LilicaRecordType } from '../types';
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

  if (!type) return null;

  const option = firstItemOptions.find((item) => item.id === type);
  const resolvedDraft = draft ?? createRecordDraft(type, record);

  return (
    <RecordSheet title={option?.title ?? 'Record'} onDismiss={onDismiss}>
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
          onDismiss();
        }}
        onRemove={record ? () => {
          onRemoveRecord(record.id);
          onDismiss();
        } : undefined}
      />
    </RecordSheet>
  );
}
