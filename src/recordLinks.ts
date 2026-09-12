// Phase 16: the client boundary for the record-link RPCs added in
// supabase/migrations/20260912100000_phase16_document_maturity.sql. Every
// function here is a thin, typed wrapper -- all authorisation, idempotency
// and the "never reveal a linked record the caller can't see" invariant
// live server-side. See docs/PHASE_16_ARCHITECTURE.md.

import { friendlyAuthError } from './auth/errors';
import { supabase } from './auth/client';
import { LilicaRecordType } from './types';

export type RecordLinkType = 'related_to' | 'action_for';
export type RecordLinkDirection = 'outgoing' | 'incoming';

// One row of `list_record_links()` -- the OTHER record's own minimal
// summary, never the full record (RecordDetail re-derives everything else
// it needs, via `onOpenLinkedRecord`, from the real record once opened).
export type LinkedRecordSummary = {
  linkId: string;
  linkType: RecordLinkType;
  direction: RecordLinkDirection;
  recordId: string;
  recordType: LilicaRecordType;
  title: string;
  createdAt: string;
};

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function fail(error: unknown): { ok: false; message: string } {
  return { ok: false, message: friendlyAuthError(error, 'profile') };
}

export async function listRecordLinks(recordId: string): Promise<Result<LinkedRecordSummary[]>> {
  const { data, error } = await supabase.rpc('list_record_links', { target_record_id: recordId });
  if (error) return fail(error);
  const rows = (data ?? []) as Array<{
    link_id: string;
    link_type: RecordLinkType;
    direction: RecordLinkDirection;
    other_record_id: string;
    other_record_type: LilicaRecordType;
    other_record_title: string | null;
    created_at: string;
  }>;
  return {
    ok: true,
    data: rows.map((row) => ({
      linkId: row.link_id,
      linkType: row.link_type,
      direction: row.direction,
      recordId: row.other_record_id,
      recordType: row.other_record_type,
      title: row.other_record_title ?? '',
      createdAt: row.created_at,
    })),
  };
}

export async function createRecordLink(input: {
  careSpaceId: string;
  sourceRecordId: string;
  targetRecordId: string;
  linkType: RecordLinkType;
}): Promise<Result<string>> {
  const { data, error } = await supabase.rpc('create_record_link', {
    target_care_space_id: input.careSpaceId,
    source_record_id: input.sourceRecordId,
    target_record_id: input.targetRecordId,
    link_type: input.linkType,
  });
  if (error) return fail(error);
  return { ok: true, data: data as string };
}

export async function removeRecordLink(linkId: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('remove_record_link', { target_link_id: linkId });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}
