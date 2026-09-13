// Phase 20D, Part D (approved `\downloads\20-22.txt`): Documents is a pure
// client-side PROJECTION over the existing record_attachments table (Phase
// 16) -- no new document entity, no new schema, no new permission model.
// A plain select respects exactly the same RLS the attachment's own
// domain-grant already governs (confirmed by inspection of
// supabase/migrations/20260912100000_phase16_document_maturity.sql's own
// "members with domain read access can list attachments" policy before
// writing this) -- a user can never see a document here they couldn't
// already reach through its parent record.

import { supabase } from './auth/client';
import { friendlyAuthError } from './auth/errors';

export type CareSpaceDocument = {
  id: string;
  displayName: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: string;
  recordId: string;
  recordTitle: string;
};

type Row = {
  id: string;
  display_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  record_id: string;
  records: { title: string } | { title: string }[] | null;
};

function recordTitle(row: Row): string {
  const joined = Array.isArray(row.records) ? row.records[0] : row.records;
  return joined?.title ?? 'Untitled';
}

export async function listCareSpaceDocuments(careSpaceId: string): Promise<
  { ok: true; data: CareSpaceDocument[] } | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from('record_attachments')
    .select('id, display_name, mime_type, size_bytes, created_at, record_id, records(title)')
    .eq('care_space_id', careSpaceId)
    .is('deleted_at', null)
    // Default: newest first (brief section 32) -- no filtering/sorting UI
    // in this v1, deliberately.
    .order('created_at', { ascending: false });

  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };

  return {
    ok: true,
    data: ((data ?? []) as Row[]).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      mimeType: row.mime_type ?? undefined,
      sizeBytes: row.size_bytes ?? undefined,
      createdAt: row.created_at,
      recordId: row.record_id,
      recordTitle: recordTitle(row),
    })),
  };
}
