// Phase 20B, Feature B: pure unit coverage for searchRecords -- no schema,
// no RPC, so this is the entire test surface for its own logic (screen-
// level navigation/offline/switch-person behaviour is covered separately
// in tests/phase20b-search-screen.test.tsx).

import { searchRecords } from '../src/search';
import { LilicaRecord } from '../src/types';

function record(overrides: Partial<LilicaRecord>): LilicaRecord {
  return {
    id: overrides.id ?? 'r1',
    type: 'task',
    title: 'Untitled',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('searchRecords', () => {
  const records: LilicaRecord[] = [
    record({ id: 'appt-1', type: 'appointment', title: 'GP appointment', location: 'Riverside surgery' }),
    record({ id: 'task-1', type: 'task', title: 'Collect prescription' }),
    record({ id: 'bill-1', type: 'bill', title: 'Water bill', reference: 'ACC-4521' }),
    record({ id: 'home-1', type: 'homeMatter', title: 'Boiler service' }),
    record({ id: 'doc-1', type: 'document', title: 'Hospital letter', notes: 'Discharge summary, keep safe' }),
    record({ id: 'contact-1', type: 'contact', title: 'Dr Patel', role: 'GP', phone: '01234 567890' }),
    record({ id: 'care-1', type: 'careNote', title: 'Mobility', notes: 'Uses a walking frame' }),
    record({ id: 'update-1', type: 'update', title: "Beauty's good day" }),
    record({ id: 'cancelled-1', type: 'task', title: 'Cancelled water task', status: 'cancelled' }),
  ];

  it('returns nothing for an empty or whitespace-only query', () => {
    expect(searchRecords(records, '')).toEqual([]);
    expect(searchRecords(records, '   ')).toEqual([]);
  });

  it('finds an appointment match', () => {
    const groups = searchRecords(records, 'gp appointment');
    expect(groups.find((g) => g.type === 'appointment')?.matches.map((m) => m.record.id)).toEqual(['appt-1']);
  });

  it('finds a task ("To Do") match', () => {
    const groups = searchRecords(records, 'prescription');
    expect(groups.find((g) => g.type === 'task')?.label).toBe('To Do');
  });

  it('finds a bill match, including by its reference field', () => {
    expect(searchRecords(records, 'ACC-4521').find((g) => g.type === 'bill')?.matches[0].record.id).toBe('bill-1');
  });

  it('finds a Home & Car match', () => {
    expect(searchRecords(records, 'boiler').find((g) => g.type === 'homeMatter')).toBeDefined();
  });

  it('finds a document match, including by its notes field', () => {
    expect(searchRecords(records, 'discharge summary').find((g) => g.type === 'document')?.matches[0].record.id).toBe('doc-1');
  });

  it('finds a contact match by name, role or phone', () => {
    expect(searchRecords(records, 'dr patel').find((g) => g.type === 'contact')).toBeDefined();
    expect(searchRecords(records, '01234 567890').find((g) => g.type === 'contact')).toBeDefined();
  });

  it('finds a care information match', () => {
    expect(searchRecords(records, 'walking frame').find((g) => g.type === 'careNote')).toBeDefined();
  });

  it('finds an update match', () => {
    expect(searchRecords(records, "good day").find((g) => g.type === 'update')).toBeDefined();
  });

  it('is case-insensitive', () => {
    expect(searchRecords(records, 'WATER BILL').find((g) => g.type === 'bill')).toBeDefined();
  });

  it('matches partially, mid-word', () => {
    expect(searchRecords(records, 'prescri').find((g) => g.type === 'task')).toBeDefined();
  });

  it('is punctuation-insensitive', () => {
    expect(searchRecords(records, 'acc 4521').find((g) => g.type === 'bill')).toBeDefined();
  });

  it('returns no groups when nothing matches', () => {
    expect(searchRecords(records, 'nonexistent xyz')).toEqual([]);
  });

  it('never matches a cancelled record', () => {
    expect(searchRecords(records, 'cancelled water task')).toEqual([]);
  });

  it('never searches or exposes internal fields such as id/uri/storage paths', () => {
    const withAttachment = [record({
      id: 'doc-2', type: 'document', title: 'Report',
      attachments: [{ id: 'att-1', kind: 'file', name: 'report.pdf', createdAt: '2026-09-01T00:00:00.000Z', storageObjectPath: 'space-1/doc-2/secretpath.pdf' }],
    })];
    expect(searchRecords(withAttachment, 'secretpath')).toEqual([]);
    expect(searchRecords(withAttachment, 'doc-2')).toEqual([]);
  });

  it('only shows groups that actually have a match', () => {
    const groups = searchRecords(records, 'gp appointment');
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe('appointment');
  });
});
