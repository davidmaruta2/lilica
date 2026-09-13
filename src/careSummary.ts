// Phase 20B, Feature C: Care summary. A pure projection over data Lilica
// already knows -- records already loaded for this care space, the same
// Care Circle member list People's own preview already reads, and the
// same Recent Activity events Feature A already fetches. No new schema,
// no new record type, no duplicate data store (brief sections 23/29/37).
//
// Deliberately distinct from Home (docs/PHASE_20_ARCHITECTURE.md /
// phase20.txt section 27): Home answers "what needs my attention right
// now"; this answers "if I needed to understand this person's care
// situation quickly, what would I need to know" -- so it favours context,
// continuity, people and important information over an actionable-work
// worklist, and every section is capped/bounded, never a full record dump.
//
// Permissions: every input array here (records, careCircleMembers,
// activity) is ALREADY filtered to what the current user is authorised to
// see, by the same mechanisms Home/People/Recent Activity already rely on
// -- this module does no separate re-filtering and never renders a "N
// hidden items" count (brief section 25's explicit prohibition), it simply
// omits a section when there is nothing to show in it.

import { ActivityEvent } from './activity';
import { CareCircleMember } from './careCircle';
import { deriveRecordState, formatDateForDisplay, calendarDateForRecord, isActionableRecord } from './records';
import { LilicaRecord } from './types';

export type SummaryItem = {
  id: string;
  title: string;
  subtitle?: string;
};

export type CareSummarySection =
  | { key: 'needsAttention'; title: string; items: SummaryItem[] }
  | { key: 'comingUp'; title: string; items: SummaryItem[] }
  | { key: 'keyContacts'; title: string; items: SummaryItem[] }
  | { key: 'careCircle'; title: string; members: CareCircleMember[] }
  | { key: 'careInformation'; title: string; items: SummaryItem[] }
  | { key: 'documents'; title: string; items: SummaryItem[] }
  | { key: 'bills'; title: string; items: SummaryItem[] }
  | { key: 'homeCar'; title: string; items: SummaryItem[] }
  | { key: 'recentActivity'; title: string; items: SummaryItem[] };

const SECTION_ITEM_LIMIT = 5;
const CONTACT_LIMIT = 4;

function toItem(record: LilicaRecord, subtitle?: string): SummaryItem {
  return { id: record.id, title: record.title, subtitle };
}

function dateSubtitle(record: LilicaRecord): string | undefined {
  const date = calendarDateForRecord(record) ?? record.dueDate ?? record.date;
  return formatDateForDisplay(date);
}

export function buildCareSummary(
  records: LilicaRecord[],
  careCircleMembers: CareCircleMember[],
  recentActivity: ActivityEvent[],
  describeActivity: (event: ActivityEvent) => string,
): CareSummarySection[] {
  const active = records.filter((record) => record.status !== 'cancelled');
  const derived = active.map((record) => ({ record, state: deriveRecordState(record) }));

  const needsAttention = derived
    .filter(({ record, state }) => isActionableRecord(record) && (state.overdue || state.dueToday))
    .sort((a, b) => (a.state.overdue === b.state.overdue ? 0 : a.state.overdue ? -1 : 1))
    .slice(0, SECTION_ITEM_LIMIT)
    .map(({ record }) => toItem(record, dateSubtitle(record)));

  const comingUp = derived
    .filter(({ state }) => state.upcoming)
    .sort((a, b) => (calendarDateForRecord(a.record) ?? '').localeCompare(calendarDateForRecord(b.record) ?? ''))
    .slice(0, SECTION_ITEM_LIMIT)
    .map(({ record }) => toItem(record, dateSubtitle(record)));

  const keyContacts = active
    .filter((record) => record.type === 'contact')
    .slice(0, CONTACT_LIMIT)
    .map((record) => toItem(record, [record.role, record.phone].filter(Boolean).join(' · ') || undefined));

  const careInformation = active
    .filter((record) => record.type === 'careNote')
    .slice(0, SECTION_ITEM_LIMIT)
    .map((record) => toItem(record, record.notes?.slice(0, 80)));

  const documents = active
    .filter((record) => record.type === 'document')
    .slice(0, SECTION_ITEM_LIMIT)
    .map((record) => toItem(record, record.expiryDate ? `Expires ${formatDateForDisplay(record.expiryDate)}` : undefined));

  const bills = derived
    .filter(({ record, state }) => record.type === 'bill' && !state.completed)
    .slice(0, SECTION_ITEM_LIMIT)
    .map(({ record }) => toItem(record, dateSubtitle(record)));

  const homeCar = derived
    .filter(({ record, state }) => record.type === 'homeMatter' && !state.completed)
    .slice(0, SECTION_ITEM_LIMIT)
    .map(({ record }) => toItem(record, dateSubtitle(record)));

  const recentActivityItems = recentActivity
    .slice(0, SECTION_ITEM_LIMIT)
    .map((event) => ({ id: event.id, title: describeActivity(event), subtitle: formatDateForDisplay(event.createdAt.slice(0, 10)) }));

  const sections: CareSummarySection[] = [];
  if (needsAttention.length > 0) sections.push({ key: 'needsAttention', title: 'Needs attention', items: needsAttention });
  if (comingUp.length > 0) sections.push({ key: 'comingUp', title: 'Coming up', items: comingUp });
  if (keyContacts.length > 0) sections.push({ key: 'keyContacts', title: 'Key contacts', items: keyContacts });
  if (careCircleMembers.length > 0) sections.push({ key: 'careCircle', title: 'Care Circle', members: careCircleMembers });
  if (careInformation.length > 0) sections.push({ key: 'careInformation', title: 'Important care information', items: careInformation });
  if (documents.length > 0) sections.push({ key: 'documents', title: 'Important documents', items: documents });
  if (bills.length > 0) sections.push({ key: 'bills', title: 'Bills & renewals', items: bills });
  if (homeCar.length > 0) sections.push({ key: 'homeCar', title: 'Home & Car', items: homeCar });
  if (recentActivityItems.length > 0) sections.push({ key: 'recentActivity', title: 'Recent activity', items: recentActivityItems });
  return sections;
}
