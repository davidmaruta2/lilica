import { stableUuid } from '../identifiers';
import { LilicaRecord } from '../types';
import { DomainRecord, IsoDate, IsoTime, Occurrence, RecurrenceRule } from './types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}$/;

function date(value?: string): IsoDate | undefined {
  return value && ISO_DATE.test(value) ? value as IsoDate : undefined;
}

function time(value?: string): IsoTime | undefined {
  return value && ISO_TIME.test(value) ? value as IsoTime : undefined;
}

export function domainRecordFromLilica(record: LilicaRecord, careSpaceId: string, cloudRecordId: string): DomainRecord {
  const kind: DomainRecord['kind'] = record.type === 'appointment'
    ? 'event'
    : ['task', 'bill', 'homeMatter'].includes(record.type)
      ? 'action'
      : record.type === 'document'
        ? 'document'
        : record.type === 'contact'
          ? 'contact'
          : record.type === 'update'
            ? 'update'
            : 'information';
  return {
    id: cloudRecordId,
    careSpaceId,
    kind,
    lifecycle: record.status === 'cancelled' ? 'archived' : 'active',
    actionSubtype: record.type === 'bill' ? 'bill_payment' : record.type === 'task' ? 'task' : undefined,
  };
}

export function canonicalOccurrenceForRecord(
  record: LilicaRecord,
  careSpaceId: string,
  cloudRecordId: string,
): { occurrence?: Occurrence; recurrenceRule?: RecurrenceRule } {
  const eventDate = record.type === 'appointment' ? date(record.eventDate ?? record.date) : undefined;
  const dueDate = ['task', 'bill', 'homeMatter'].includes(record.type)
    ? date(record.dueDate ?? record.date)
    : record.type === 'document'
      ? date(record.expiryDate)
      : undefined;
  const occurrenceDate = eventDate ?? dueDate;
  if (!occurrenceDate) return {};

  const sequence = 0;
  const occurrenceId = stableUuid(`phase8-occurrence|${cloudRecordId}|${sequence}`);
  const isEvent = record.type === 'appointment';
  const eventTime = isEvent ? time(record.eventTime ?? record.time) : undefined;
  const status: Occurrence['status'] = record.completed || record.status === 'completed'
    ? 'completed'
    : record.status === 'cancelled'
      ? 'cancelled'
      : isEvent
        ? 'scheduled'
        : 'open';
  const recurrenceSeriesId = record.recurrence
    ? stableUuid(`phase8-series|${cloudRecordId}`)
    : undefined;
  const recurrenceRule = record.recurrence ? {
    id: stableUuid(`phase8-rule|${cloudRecordId}|1`),
    recordId: cloudRecordId,
    careSpaceId,
    seriesId: recurrenceSeriesId,
    version: 1,
    frequency: record.recurrence.unit,
    interval: record.recurrence.interval,
    anchorDate: occurrenceDate,
    effectiveFrom: occurrenceDate,
    state: 'active' as const,
  } : undefined;

  return {
    occurrence: {
      id: occurrenceId,
      recordId: cloudRecordId,
      careSpaceId,
      kind: isEvent ? 'event' : 'action',
      status,
      timing: isEvent && eventTime
        ? { kind: 'local_datetime', date: eventDate!, time: eventTime, timezone: 'Europe/London' }
        : { kind: 'date', date: occurrenceDate },
      dueOn: isEvent ? undefined : occurrenceDate,
      sequence,
      recurrenceSeriesId,
      ruleVersion: recurrenceRule?.version,
      originalDate: occurrenceDate,
      completedAt: status === 'completed' ? record.completedAt : undefined,
    },
    recurrenceRule,
  };
}
