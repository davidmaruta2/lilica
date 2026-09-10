import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { createUuid } from '../identifiers';
import { formatDateForInput, toIsoDate } from '../records';
import { colors, radius, spacing } from '../theme';
import {
  LilicaRecord,
  LilicaRecordType,
  RecordAttachment,
  RecordRecurrence,
  RecordStatus,
} from '../types';
import { Button } from './Button';
import { DateTimeWheelField } from './DateTimeWheelField';
import { AppText } from './Text';
import { TextField } from './TextField';

export type RecordDraft = {
  title: string;
  date: string;
  time: string;
  expiryDate: string;
  location: string;
  responsiblePerson: string;
  provider: string;
  amount: string;
  reference: string;
  role: string;
  phone: string;
  email: string;
  notes: string;
  completed: boolean;
  recurrence?: RecordRecurrence;
  attachments: RecordAttachment[];
};

type Props = {
  type: LilicaRecordType;
  record?: LilicaRecord;
  draft: RecordDraft;
  supportedPersonId: string;
  onChange: (draft: RecordDraft) => void;
  onSave: (record: LilicaRecord) => void;
  onRemove?: () => void;
};

const titleLabels: Record<LilicaRecordType, string> = {
  appointment: "What's it for?",
  task: 'What needs doing?',
  bill: 'Provider or name',
  homeMatter: 'What needs attention?',
  document: 'Document name or type',
  contact: 'Name',
  careNote: 'What is useful to know?',
  update: 'What happened?',
};

function inputDate(date = new Date()) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function inputTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function keepAttachment(uri: string, name: string, uniqueId: string) {
  if (Platform.OS === 'web') return uri;
  const directory = new Directory(Paths.document, 'attachments');
  directory.create({ idempotent: true, intermediates: true });
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document';
  const destination = new File(directory, `${uniqueId}-${safeName}`);
  await new File(uri).copy(destination);
  return destination.uri;
}

export function createRecordDraft(type: LilicaRecordType, record?: LilicaRecord): RecordDraft {
  return {
    title: record?.title ?? '',
    date: formatDateForInput(record?.eventDate ?? record?.dueDate ?? record?.date)
      || (type === 'update' ? inputDate() : ''),
    time: record?.eventTime ?? record?.time ?? (type === 'update' ? inputTime() : ''),
    expiryDate: formatDateForInput(record?.expiryDate),
    location: record?.location ?? '',
    responsiblePerson: record?.responsiblePerson ?? '',
    provider: record?.provider ?? '',
    amount: record?.amount ?? '',
    reference: record?.reference ?? '',
    role: record?.role ?? '',
    phone: record?.phone ?? '',
    email: record?.email ?? '',
    notes: record?.notes ?? '',
    completed: record?.completed ?? false,
    recurrence: record?.recurrence,
    attachments: record?.attachments ?? [],
  };
}

function statusFor(type: LilicaRecordType, completed: boolean): RecordStatus {
  if (completed) return 'completed';
  if (type === 'appointment') return 'scheduled';
  if (type === 'task' || type === 'bill' || type === 'homeMatter') return 'unresolved';
  return 'saved';
}

export function RecordEditor({ type, record, draft, supportedPersonId, onChange, onSave, onRemove }: Props) {
  const [attachmentError, setAttachmentError] = useState('');
  const parsedDate = draft.date ? toIsoDate(draft.date) : undefined;
  const parsedExpiry = draft.expiryDate ? toIsoDate(draft.expiryDate) : undefined;
  const dateRequired = type === 'appointment' || type === 'bill';
  const dateValid = (!dateRequired || Boolean(parsedDate)) && (!draft.date || Boolean(parsedDate));
  const expiryValid = !draft.expiryDate || Boolean(parsedExpiry);
  const canSave = draft.title.trim().length > 0 && dateValid && expiryValid;
  const usesDueDate = type === 'task' || type === 'bill' || type === 'homeMatter';
  const usesEventDate = type === 'appointment' || type === 'document' || type === 'careNote' || type === 'update';
  const supportsCompletion = type === 'task' || type === 'bill' || type === 'homeMatter';
  const supportsRecurrence = type === 'bill' || type === 'homeMatter';
  const itemName = type === 'careNote' ? 'care information' : type === 'homeMatter' ? 'home or car matter' : type;

  function change(patch: Partial<RecordDraft>) {
    onChange({ ...draft, ...patch });
  }

  function save() {
    if (!canSave) return;
    const now = new Date().toISOString();
    const newlyCompleted = draft.completed && !record?.completed;
    const confirmations = newlyCompleted
      ? [
          ...(record?.confirmationHistory ?? []),
          { status: 'completed' as const, confirmedAt: now, confirmedBy: draft.responsiblePerson.trim() || 'You' },
        ]
      : record?.confirmationHistory;

    onSave({
      id: record?.id ?? createUuid(),
      type,
      title: draft.title.trim(),
      supportedPersonId,
      status: statusFor(type, draft.completed),
      eventDate: usesEventDate ? parsedDate : undefined,
      eventTime: type === 'appointment' || type === 'update' ? draft.time.trim() || undefined : undefined,
      dueDate: usesDueDate ? parsedDate : undefined,
      expiryDate: type === 'document' ? parsedExpiry : undefined,
      location: type === 'appointment' ? draft.location.trim() || undefined : undefined,
      responsiblePerson: supportsCompletion || type === 'appointment'
        ? draft.responsiblePerson.trim() || undefined
        : undefined,
      provider: type === 'homeMatter' ? draft.provider.trim() || undefined : undefined,
      amount: type === 'bill' ? draft.amount.trim() || undefined : undefined,
      reference: type === 'bill' ? draft.reference.trim() || undefined : undefined,
      role: type === 'contact' ? draft.role.trim() || undefined : undefined,
      phone: type === 'contact' ? draft.phone.trim() || undefined : undefined,
      email: type === 'contact' ? draft.email.trim() || undefined : undefined,
      notes: draft.notes.trim() || undefined,
      recurrence: supportsRecurrence ? draft.recurrence : undefined,
      completed: supportsCompletion ? draft.completed : false,
      completedAt: newlyCompleted ? now : draft.completed ? record?.completedAt : undefined,
      confirmationHistory: confirmations,
      attachments: type === 'document' ? draft.attachments : undefined,
      createdAt: record?.createdAt ?? now,
      updatedAt: now,
    });
  }

  function confirmRemove() {
    if (!record || !onRemove) return;
    Alert.alert(
      `Remove this ${itemName}?`,
      'This removes only this item.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onRemove },
      ],
    );
  }

  function addAttachments(attachments: RecordAttachment[]) {
    const title = draft.title.trim()
      ? draft.title
      : attachments[0]?.name.replace(/\.[^.]+$/, '') ?? '';
    change({ title, attachments: [...draft.attachments, ...attachments] });
  }

  async function uploadDocument() {
    setAttachmentError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      const now = new Date().toISOString();
      const stamp = Date.now();
      const attachments = await Promise.all(result.assets.map(async (asset, index) => {
        const id = `file-${stamp}-${index}`;
        return {
          id,
          kind: 'file' as const,
          uri: await keepAttachment(asset.uri, asset.name, id),
          name: asset.name,
          mimeType: asset.mimeType,
          size: asset.size,
          createdAt: now,
        };
      }));
      addAttachments(attachments);
    } catch {
      setAttachmentError('That file could not be added. Please try again.');
    }
  }

  async function scanDocument() {
    setAttachmentError('');
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setAttachmentError('Camera access is needed to scan a document.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        cameraType: ImagePicker.CameraType.back,
        quality: 0.85,
      });
      if (result.canceled) return;
      const now = new Date().toISOString();
      const stamp = Date.now();
      const attachments = await Promise.all(result.assets.map(async (asset, index) => {
        const id = `scan-${stamp}-${index}`;
        const name = asset.fileName ?? `Document scan ${draft.attachments.length + index + 1}.jpg`;
        return {
          id,
          kind: 'scan' as const,
          uri: await keepAttachment(asset.uri, name, id),
          name,
          mimeType: asset.mimeType ?? 'image/jpeg',
          size: asset.fileSize,
          width: asset.width,
          height: asset.height,
          createdAt: now,
        };
      }));
      addAttachments(attachments);
    } catch {
      setAttachmentError('The camera could not be opened. Please try again.');
    }
  }

  return (
    <View style={styles.form}>
      <TextField compact label={titleLabels[type]} value={draft.title} onChangeText={(title) => change({ title })} />

      {type === 'document' ? (
        <View style={styles.attachments}>
          <AppText variant="secondary" tone="soft">Document</AppText>
          <View style={styles.attachmentActions}>
            <Button label="Upload file" variant="secondary" onPress={uploadDocument} style={styles.attachmentButton} />
            <Button label="Scan with camera" variant="secondary" onPress={scanDocument} style={styles.attachmentButton} />
          </View>
          {draft.attachments.map((attachment) => (
            <View key={attachment.id} style={styles.attachmentRow}>
              <View style={styles.attachmentCopy}>
                <AppText variant="bodyStrong" numberOfLines={1}>{attachment.name}</AppText>
                <AppText variant="meta" tone="muted">
                  {attachment.kind === 'scan' ? 'Camera scan' : 'Uploaded file'}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${attachment.name}`}
                hitSlop={8}
                onPress={() => change({ attachments: draft.attachments.filter((item) => item.id !== attachment.id) })}
                style={styles.removeAttachment}
              >
                <AppText variant="secondary" tone="primary">Remove</AppText>
              </Pressable>
            </View>
          ))}
          {attachmentError ? <AppText variant="secondary" tone="muted">{attachmentError}</AppText> : null}
        </View>
      ) : null}

      {type !== 'contact' ? (
        <DateTimeWheelField
          label={usesDueDate ? (type === 'bill' ? 'Due or renewal date' : 'Date or due date') : 'Date'}
          mode="date"
          value={draft.date}
          onChange={(date) => change({ date })}
          optional={!dateRequired}
        />
      ) : null}

      {type === 'appointment' || type === 'update' ? (
        <DateTimeWheelField label="Time" mode="time" value={draft.time} onChange={(time) => change({ time })} optional />
      ) : null}
      {type === 'appointment' ? (
        <>
          <TextField compact label="Location" placeholder="Optional" value={draft.location} onChangeText={(location) => change({ location })} />
          <TextField compact label="Who's taking them" placeholder="Optional" value={draft.responsiblePerson} onChangeText={(responsiblePerson) => change({ responsiblePerson })} />
        </>
      ) : null}
      {type === 'task' || type === 'bill' ? (
        <TextField compact label="Who's dealing with it" placeholder="Optional" value={draft.responsiblePerson} onChangeText={(responsiblePerson) => change({ responsiblePerson })} />
      ) : null}
      {type === 'homeMatter' ? (
        <>
          <TextField compact label="Provider or contact" placeholder="Optional" value={draft.provider} onChangeText={(provider) => change({ provider })} />
          <TextField compact label="Who's dealing with it" placeholder="Optional" value={draft.responsiblePerson} onChangeText={(responsiblePerson) => change({ responsiblePerson })} />
        </>
      ) : null}
      {type === 'bill' ? (
        <>
          <TextField compact label="Amount" placeholder="Optional" keyboardType="decimal-pad" value={draft.amount} onChangeText={(amount) => change({ amount })} />
          <TextField compact label="Reference" placeholder="Optional" value={draft.reference} onChangeText={(reference) => change({ reference })} />
        </>
      ) : null}
      {type === 'document' ? (
        <DateTimeWheelField label="Expiry date" mode="date" value={draft.expiryDate} onChange={(expiryDate) => change({ expiryDate })} optional />
      ) : null}
      {type === 'contact' ? (
        <>
          <TextField compact label="Role or relationship" placeholder="e.g. GP or family member" value={draft.role} onChangeText={(role) => change({ role })} />
          <TextField compact label="Phone" placeholder="Optional" keyboardType="phone-pad" value={draft.phone} onChangeText={(phone) => change({ phone })} />
          <TextField compact label="Email" placeholder="Optional" keyboardType="email-address" autoCapitalize="none" value={draft.email} onChangeText={(email) => change({ email })} />
        </>
      ) : null}

      {supportsRecurrence ? (
        <View style={styles.fieldGroup}>
          <AppText variant="secondary" tone="soft">Repeats</AppText>
          <View style={styles.segmented}>
            {[
              { label: 'Never', value: undefined },
              { label: 'Monthly', value: { interval: 1, unit: 'month' as const } },
              { label: 'Yearly', value: { interval: 1, unit: 'year' as const } },
            ].map((option) => {
              const selected = draft.recurrence?.unit === option.value?.unit || (!draft.recurrence && !option.value);
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => change({ recurrence: option.value })}
                  style={[styles.segment, selected && styles.segmentSelected]}
                >
                  <AppText variant="secondary" tone={selected ? 'primary' : 'soft'} centre>{option.label}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <TextField compact label="Notes" placeholder="Optional" value={draft.notes} onChangeText={(notes) => change({ notes })} multiline style={styles.notes} />

      {supportsCompletion ? (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: draft.completed }} onPress={() => change({ completed: !draft.completed })} style={styles.completion}>
          <View style={[styles.checkbox, draft.completed && styles.checkboxSelected]}>{draft.completed ? <View style={styles.tick} /> : null}</View>
          <AppText variant="bodyStrong">Already sorted</AppText>
        </Pressable>
      ) : null}

      <Button
        label={record ? 'Save changes' : `Add ${itemName}`}
        disabled={!canSave}
        onPress={save}
        style={styles.save}
      />
      {record && onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${itemName}`} onPress={confirmRemove} style={styles.removeRecord}>
          <AppText variant="secondary" tone="danger" centre>Remove this {itemName}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingBottom: spacing.xl },
  attachments: { gap: spacing.sm },
  attachmentActions: { flexDirection: 'row', gap: spacing.sm },
  attachmentButton: { flex: 1, width: 'auto', minHeight: 48, borderRadius: radius.md, paddingHorizontal: spacing.sm },
  attachmentRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  attachmentCopy: { flex: 1, gap: spacing.xxs },
  removeAttachment: { minWidth: 58, minHeight: 40, alignItems: 'flex-end', justifyContent: 'center' },
  fieldGroup: { gap: spacing.xs },
  segmented: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, overflow: 'hidden' },
  segment: { flex: 1, minHeight: 44, paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  segmentSelected: { backgroundColor: colors.primarySoft },
  notes: { minHeight: 76, paddingTop: spacing.md, textAlignVertical: 'top' },
  completion: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: colors.primary },
  tick: { width: 11, height: 7, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: colors.white, transform: [{ rotate: '-45deg' }], marginTop: -2 },
  save: { borderRadius: radius.md, marginTop: spacing.xs },
  removeRecord: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
});
