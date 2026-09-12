// Phase 16: cloud file-byte storage for Important Document attachments.
// Device-local capture/storage (`keepAttachment()` in RecordEditor.tsx)
// is unchanged and still happens first, so a document can still be added
// while offline -- this module is what turns that local copy into a
// genuinely durable, second-device-reachable file, via the private
// `document-attachments` Storage bucket (see
// supabase/migrations/20260912100000_phase16_document_maturity.sql).
//
// Local file state (`attachment.uri`, device-only, may be absent) and
// cloud file state (`attachment.storageObjectPath`/`uploadStatus`,
// synced) are deliberately two different things -- see
// docs/PHASE_16_ARCHITECTURE.md.

import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { supabase } from './auth/client';
import { LilicaRecord, RecordAttachment } from './types';

const BUCKET = 'document-attachments';
const SIGNED_URL_TTL_SECONDS = 60 * 5;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document';
}

// Deterministic and collision-safe: stable IDs alone identify ownership,
// never a display name -- see the Phase 16 brief's storage-path
// requirements. The filename suffix is for human readability only; it is
// never itself a security boundary (RLS on the bucket is).
export function attachmentStoragePath(careSpaceId: string, recordId: string, attachment: RecordAttachment) {
  return `${careSpaceId}/${recordId}/${attachment.id}-${safeFileName(attachment.name)}`;
}

async function uploadOneAttachment(careSpaceId: string, recordId: string, attachment: RecordAttachment): Promise<RecordAttachment> {
  const storageObjectPath = attachment.storageObjectPath ?? attachmentStoragePath(careSpaceId, recordId, attachment);
  if (!attachment.uri) return { ...attachment, storageObjectPath };
  try {
    const { error: metadataError } = await supabase.rpc('upsert_record_attachment', {
      attachment_id: attachment.id,
      target_record_id: recordId,
      target_care_space_id: careSpaceId,
      attachment_kind: attachment.kind,
      attachment_display_name: attachment.name,
      attachment_mime_type: attachment.mimeType ?? null,
      attachment_size_bytes: attachment.size ?? null,
      attachment_storage_object_path: storageObjectPath,
    });
    if (metadataError) throw metadataError;

    const localFile = new File(attachment.uri);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storageObjectPath, localFile, { contentType: attachment.mimeType, upsert: true });
    if (uploadError) throw uploadError;

    const { error: statusError } = await supabase.rpc('mark_attachment_upload_status', {
      target_attachment_id: attachment.id,
      new_status: 'uploaded',
    });
    if (statusError) throw statusError;

    return { ...attachment, storageObjectPath, uploadStatus: 'uploaded' };
  } catch {
    // Never mark a cloud file as safely uploaded when it is not. Leaving
    // this attachment's status unchanged (still 'pending', or whatever it
    // already was) means the next call -- the next save, app launch, or
    // reconnection -- retries it; nothing here throws back into the
    // record save that triggered it.
    return attachment.uploadStatus === 'uploaded' ? attachment : { ...attachment, storageObjectPath, uploadStatus: 'pending' };
  }
}

// Called after a document record is saved (see App.tsx's saveRecord).
// Idempotent and safe to call on every save: an attachment already marked
// 'uploaded' is left untouched, and a client-generated attachment id makes
// a retried metadata/byte upload converge rather than duplicate. Never
// awaited by the caller -- a failed or slow upload must never block or
// delay the record save that already succeeded.
export async function queuePendingAttachmentUploads(careSpaceId: string, record: LilicaRecord): Promise<RecordAttachment[] | undefined> {
  if (record.type !== 'document' || !record.attachments?.length) return undefined;
  const pending = record.attachments.filter((attachment) => attachment.uploadStatus !== 'uploaded' && attachment.uri);
  if (pending.length === 0) return undefined;
  const uploaded = await Promise.all(pending.map((attachment) => uploadOneAttachment(careSpaceId, record.id, attachment)));
  const byId = new Map(uploaded.map((attachment) => [attachment.id, attachment]));
  return record.attachments.map((attachment) => byId.get(attachment.id) ?? attachment);
}

export type OpenAttachmentResult = { ok: true } | { ok: false; message: string };

// "View document" (brief section 9). Prefers this device's own local
// copy; a cloud-only attachment (typical on a second device, since local
// sandbox URIs never travel with a record) is downloaded on demand via a
// short-lived signed URL -- the bucket is private, so there is never a
// permanent public URL to rely on. Handled gracefully, never thrown:
// missing local copy, cloud-only file, download failure, an attachment
// that never finished uploading, and an unsupported file type (left to
// the native share sheet, which already declines gracefully) all resolve
// to a friendly message rather than a crash.
export async function openAttachment(attachment: RecordAttachment): Promise<OpenAttachmentResult> {
  try {
    let localUri = attachment.uri;
    if (localUri && !new File(localUri).exists) localUri = undefined;

    if (!localUri) {
      if (!attachment.storageObjectPath) {
        return { ok: false, message: "This document hasn't finished uploading yet -- try again once you're back online." };
      }
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(attachment.storageObjectPath, SIGNED_URL_TTL_SECONDS);
      if (error || !data?.signedUrl) {
        return { ok: false, message: 'This document could not be opened -- check your connection and try again.' };
      }
      const cacheDirectory = new Directory(Paths.cache, 'attachment-previews');
      cacheDirectory.create({ idempotent: true, intermediates: true });
      const destination = new File(cacheDirectory, `${attachment.id}-${safeFileName(attachment.name)}`);
      const downloaded = await File.downloadFileAsync(data.signedUrl, destination, { idempotent: true });
      localUri = downloaded.uri;
    }

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, message: 'Opening documents is not supported on this device.' };
    }
    await Sharing.shareAsync(localUri, attachment.mimeType ? { mimeType: attachment.mimeType } : undefined);
    return { ok: true };
  } catch {
    return { ok: false, message: 'This document could not be opened. Please try again.' };
  }
}
