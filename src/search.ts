// Phase 20B, Feature B: unified current-person search. Purely client-side,
// no schema, no new RPC, no vector database, no embeddings, no AI, no
// external search service -- reads exactly the same authorised
// active-care-space record projection every other screen (Home/Calendar/
// To Do/People) already holds in memory, per this phase's "one source of
// truth, multiple projections" principle. Since that array is already
// scoped by the server's own domain-grant RLS (a record this device never
// had permission to sync never appears in it in the first place), search
// never needs to re-apply permission filtering itself -- there is nothing
// inaccessible in the data it searches. See docs/PHASE_20_ARCHITECTURE.md.

import { LilicaRecord, LilicaRecordType } from './types';

export type SearchGroupKey = LilicaRecordType;

export type SearchMatch = {
  record: LilicaRecord;
  // The single field the query actually matched, shown as a restrained
  // one-line snippet -- never the whole notes field, never an internal
  // field (id/uri/storage path/attachment metadata are never searched or
  // shown).
  matchedField?: string;
};

export type SearchResultGroup = {
  type: SearchGroupKey;
  label: string;
  matches: SearchMatch[];
};

// Mirrors the 8 canonical record categories 1:1, in the same order the
// rest of the app already presents them -- see docs/PHASE_20_ARCHITECTURE.md
// section on search result grouping for why this is not further split or
// merged (e.g. "To Do" here means task records specifically, distinct from
// Bills & renewals/Home & Car, matching the brief's own section 17 list).
export const SEARCH_GROUP_LABELS: Record<SearchGroupKey, string> = {
  appointment: 'Appointments',
  task: 'To Do',
  bill: 'Bills & renewals',
  homeMatter: 'Home & Car',
  document: 'Documents',
  contact: 'Contacts',
  careNote: 'Care information',
  update: 'Updates',
  // Medical Log (lilbatch.txt, 17 September 2026): searchable exactly like
  // every other record type, through the same existing generic search --
  // no new search logic of its own.
  condition: 'Diagnosed conditions',
  medicine: 'Prescribed medicines',
};

const GROUP_ORDER: SearchGroupKey[] = ['appointment', 'task', 'bill', 'homeMatter', 'document', 'contact', 'careNote', 'condition', 'medicine', 'update'];

// Punctuation-insensitive, case-insensitive partial match -- deliberately
// simple (brief section 16: prefer the simplest architecture that works at
// Lilica's own record volume; no fuzzy-matching library, no ranking model).
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

// Fields visible to the user already, per record type -- never an id, a
// storage path, a signed URL, or any other technical/internal field.
function searchableFields(record: LilicaRecord): { field: string; value: string }[] {
  const fields: { field: string; value: string }[] = [
    { field: 'title', value: record.title ?? '' },
    { field: 'notes', value: record.notes ?? '' },
  ];
  if (record.location) fields.push({ field: 'location', value: record.location });
  if (record.provider) fields.push({ field: 'provider', value: record.provider });
  if (record.reference) fields.push({ field: 'reference', value: record.reference });
  if (record.role) fields.push({ field: 'role', value: record.role });
  if (record.phone) fields.push({ field: 'phone', value: record.phone });
  if (record.email) fields.push({ field: 'email', value: record.email });
  if (record.amount) fields.push({ field: 'amount', value: record.amount });
  if (record.responsiblePerson) fields.push({ field: 'responsiblePerson', value: record.responsiblePerson });
  return fields;
}

function matchRecord(record: LilicaRecord, normalizedQuery: string): SearchMatch | undefined {
  for (const { field, value } of searchableFields(record)) {
    if (!value) continue;
    if (normalize(value).includes(normalizedQuery)) {
      return { record, matchedField: field === 'title' ? undefined : value };
    }
  }
  return undefined;
}

// Empty/whitespace-only query returns no groups at all (an explicit empty
// state, not "everything") -- see SearchScreen for how that renders.
export function searchRecords(records: LilicaRecord[], queryRaw: string): SearchResultGroup[] {
  const normalizedQuery = normalize(queryRaw);
  if (!normalizedQuery) return [];

  const byType = new Map<SearchGroupKey, SearchMatch[]>();
  for (const record of records) {
    if (record.status === 'cancelled') continue;
    const match = matchRecord(record, normalizedQuery);
    if (!match) continue;
    const bucket = byType.get(record.type) ?? [];
    bucket.push(match);
    byType.set(record.type, bucket);
  }

  return GROUP_ORDER
    .filter((type) => (byType.get(type)?.length ?? 0) > 0)
    .map((type) => ({
      type,
      label: SEARCH_GROUP_LABELS[type],
      matches: (byType.get(type) ?? []).sort((a, b) => (b.record.updatedAt ?? b.record.createdAt).localeCompare(a.record.updatedAt ?? a.record.createdAt)),
    }));
}
