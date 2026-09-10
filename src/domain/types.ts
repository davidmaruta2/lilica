export type IsoDate = `${number}-${number}-${number}`;
export type IsoTime = `${number}:${number}`;

export type RecordKind = 'information' | 'event' | 'action' | 'document' | 'contact' | 'update';
export type RecordLifecycle = 'active' | 'archived';
export type OccurrenceStatus =
  | 'open'
  | 'scheduled'
  | 'awaiting_confirmation'
  | 'completed'
  | 'cancelled'
  | 'missed';

export type OccurrenceTiming =
  | { kind: 'none' }
  | { kind: 'date'; date: IsoDate }
  | { kind: 'local_datetime'; date: IsoDate; time: IsoTime; timezone: string }
  | { kind: 'instant'; instant: string; timezone?: string };

export type DomainRecord = {
  id: string;
  careSpaceId: string;
  kind: RecordKind;
  lifecycle: RecordLifecycle;
  actionSubtype?: 'bill_payment' | 'renewal' | 'task';
};

export type Occurrence = {
  id: string;
  recordId: string;
  careSpaceId: string;
  kind: 'action' | 'event';
  status: OccurrenceStatus;
  timing?: OccurrenceTiming;
  dueOn?: IsoDate;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
  sequence?: number;
  recurrenceKey?: string;
  recurrenceSeriesId?: string;
  ruleVersion?: number;
  originalDate?: IsoDate;
  completedAt?: string;
};

export type RecurrenceRule = {
  id: string;
  recordId: string;
  careSpaceId: string;
  seriesId?: string;
  version: number;
  frequency: 'week' | 'month' | 'year';
  interval: number;
  anchorDate: IsoDate;
  effectiveFrom: IsoDate;
  state: 'active' | 'paused' | 'stopped';
};

export type RecordLink = {
  id: string;
  sourceRecordId: string;
  targetRecordId: string;
  type: 'action_for' | 'transport_for' | 'follow_up_to' | 'renews' | 'documents' | 'contact_for' | 'result_of' | 'related_to';
  datePolicy: { type: 'manual' } | { type: 'relative'; daysBefore: number };
};

export type AssignmentStatus = 'assigned' | 'accepted' | 'declined' | 'removed' | 'completed';

export type Assignment = {
  id: string;
  careSpaceId: string;
  recordId?: string;
  occurrenceId?: string;
  assigneeType: 'membership' | 'external_contact';
  membershipId?: string;
  externalContactId?: string;
  status: AssignmentStatus;
  displayNameSnapshot: string;
  assignedByMembershipId: string;
  assignedAt: string;
  acceptedAt?: string;
  declinedAt?: string;
  removedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CareSpaceContact = {
  id: string;
  careSpaceId: string;
  displayName: string;
  relationshipOrRole?: string;
  createdAt: string;
};

export type PermissionSet = {
  canView: boolean;
  canEdit: boolean;
  canComplete: boolean;
};

export type ActivityEvent = {
  id: string;
  occurrenceId: string;
  actorMembershipId: string;
  verb: 'completed' | 'cancelled' | 'reopened' | 'marked_missed';
  occurredAt: string;
};

export type Confirmation = {
  id: string;
  occurrenceId: string;
  actorMembershipId: string;
  claim: 'completed';
  source: 'user_assertion';
  confirmedAt: string;
};

export type SemanticOperation =
  | { id: string; entityId: string; kind: 'complete' | 'cancel' }
  | { id: string; entityId: string; kind: 'set_field'; field: string; value: unknown };
