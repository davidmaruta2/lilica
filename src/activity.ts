// Phase 20B: the client boundary for care_space_activity/list_recent_activity
// (supabase/migrations/20260913120000_phase20b_activity_search_summary.sql).
// A thin, typed wrapper -- all permission filtering, actor-identity
// resolution and idempotency live server-side, exactly like every other
// RPC wrapper in this codebase (see src/careCircle.ts). Never fabricates or
// re-derives an event client-side; only ever renders what the server
// already proved happened.

import { supabase } from './auth/client';
import { friendlyAuthError } from './auth/errors';
import { LilicaRecordType } from './types';

export type ActivityEventType =
  | 'record_created'
  | 'record_completed'
  | 'record_reopened'
  | 'assignment_changed'
  | 'date_changed'
  | 'document_uploaded'
  | 'member_joined'
  | 'member_left'
  | 'member_removed';

export type ActivityMetadata = {
  recordType?: LilicaRecordType;
  title?: string;
  assignedMembershipId?: string;
  attachmentName?: string;
};

export type ActivityEvent = {
  id: string;
  eventType: ActivityEventType;
  recordId?: string;
  recordDomain: string;
  metadata: ActivityMetadata;
  createdAt: string;
  actorMembershipId: string;
  actorDisplayName: string;
  actorIsFormer: boolean;
};

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const PAGE_SIZE = 20;

export async function listRecentActivity(
  careSpaceId: string,
  beforeCreatedAt?: string,
): Promise<Result<{ events: ActivityEvent[]; hasMore: boolean }>> {
  const { data, error } = await supabase.rpc('list_recent_activity', {
    target_care_space_id: careSpaceId,
    before_created_at: beforeCreatedAt ?? null,
    page_size: PAGE_SIZE,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  const rows = (data ?? []) as Array<{
    id: string;
    event_type: ActivityEventType;
    record_id: string | null;
    record_domain: string;
    metadata: ActivityMetadata | null;
    created_at: string;
    actor_membership_id: string;
    actor_display_name: string;
    actor_is_former: boolean;
  }>;
  return {
    ok: true,
    data: {
      events: rows.map((row) => ({
        id: row.id,
        eventType: row.event_type,
        recordId: row.record_id ?? undefined,
        recordDomain: row.record_domain,
        metadata: row.metadata ?? {},
        createdAt: row.created_at,
        actorMembershipId: row.actor_membership_id,
        actorDisplayName: row.actor_display_name,
        actorIsFormer: row.actor_is_former,
      })),
      // A full page came back -- there is likely more. Not a guarantee (an
      // exact-page-size final page reads the same), but the same accepted
      // approximation every other "load more" pattern in this codebase
      // uses; the worst case is one harmless extra "View more" tap that
      // then shows nothing new.
      hasMore: rows.length >= PAGE_SIZE,
    },
  };
}

// Truthful, calm, non-social-media wording per docs/PHASE_20_ARCHITECTURE.md
// -- never invents a detail the event's own metadata doesn't contain.
export function describeActivityEvent(event: ActivityEvent): string {
  const who = event.actorIsFormer ? `${event.actorDisplayName} (former member)` : event.actorDisplayName;
  const title = event.metadata.title?.trim();
  switch (event.eventType) {
    case 'record_created':
      return title ? `${who} added "${title}"` : `${who} added something new`;
    case 'record_completed':
      return event.metadata.recordType === 'bill'
        ? (title ? `${who} marked "${title}" paid` : `${who} marked a bill paid`)
        : (title ? `${who} completed "${title}"` : `${who} completed something`);
    case 'record_reopened':
      return title ? `${who} reopened "${title}"` : `${who} reopened something`;
    case 'assignment_changed':
      return title ? `${who} changed who's assigned to "${title}"` : `${who} changed an assignment`;
    case 'date_changed':
      return title ? `${who} changed the date on "${title}"` : `${who} changed a date`;
    case 'document_uploaded':
      return event.metadata.attachmentName
        ? `${who} uploaded "${event.metadata.attachmentName}"`
        : `${who} uploaded a document`;
    case 'member_joined':
      return `${event.actorDisplayName} joined the Care Circle`;
    case 'member_left':
      return `${who} left the Care Circle`;
    case 'member_removed':
      return `${who} was removed from the Care Circle`;
    default:
      return `${who} made a change`;
  }
}
