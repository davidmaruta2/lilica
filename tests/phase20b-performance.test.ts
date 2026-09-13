// Phase 20B, brief section 40: "test with 500 records, 100+ historical
// activity events, 20 contacts, multiple supported people." A real
// on-device performance/feel measurement requires physical hardware and
// is out of scope for this environment (see docs/PHASE_20_QA.md) -- this
// is the code-level proxy: prove searchRecords/buildCareSummary complete
// quickly and stay correctly bounded at roughly this phase's own stated
// data volume, so a genuine performance regression would show up here
// even though real-device scroll/render feel cannot be measured this way.

import { searchRecords } from '../src/search';
import { buildCareSummary } from '../src/careSummary';
import { ActivityEvent } from '../src/activity';
import { LilicaRecord, LilicaRecordType } from '../src/types';

const TYPES: LilicaRecordType[] = ['appointment', 'task', 'bill', 'homeMatter', 'document', 'contact', 'careNote', 'update'];

function manyRecords(count: number): LilicaRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `rec-${i}`,
    type: TYPES[i % TYPES.length],
    title: `Record number ${i} about a GP appointment`,
    notes: i % 7 === 0 ? 'Mentions penicillin allergy specifically' : undefined,
    dueDate: i % 5 === 0 ? '2026-09-20' : undefined,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }));
}

function manyActivityEvents(count: number): ActivityEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `evt-${i}`,
    eventType: 'record_created',
    recordId: `rec-${i}`,
    recordDomain: 'general',
    metadata: { title: `Record number ${i}` },
    createdAt: new Date(Date.now() - i * 60_000).toISOString(),
    actorMembershipId: 'mem-1',
    actorDisplayName: 'David',
    actorIsFormer: false,
  }));
}

describe('Phase 20B performance smoke test (code-level proxy for physical device QA)', () => {
  it('searchRecords stays fast and correct at 500 records / 20 contacts', () => {
    const records = [...manyRecords(500), ...Array.from({ length: 20 }, (_, i) => ({
      id: `contact-${i}`, type: 'contact' as const, title: `Contact ${i}`, phone: `0${i}`.padStart(11, '0'), createdAt: '2026-09-01T00:00:00.000Z',
    }))];
    const start = Date.now();
    const results = searchRecords(records, 'penicillin allergy');
    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(200);
    expect(results.length).toBeGreaterThan(0);
  });

  it('buildCareSummary stays fast and bounded at 500 records / 100+ activity events', () => {
    const start = Date.now();
    const sections = buildCareSummary(manyRecords(500), [], manyActivityEvents(150), (e) => e.metadata.title ?? 'event');
    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(200);
    // Every section stays a small, bounded list -- never a dump of all 500
    // records or all 150 activity events onto one screen.
    for (const section of sections) {
      if ('items' in section) expect(section.items.length).toBeLessThanOrEqual(5);
    }
  });

  it('two supported people\'s record sets stay isolated at this volume (no cross-person leakage in the client projection itself)', () => {
    const beauty = manyRecords(300).map((r) => ({ ...r, id: `beauty-${r.id}` }));
    const jackie = manyRecords(300).map((r) => ({ ...r, id: `jackie-${r.id}`, title: `Jackie only: ${r.title}` }));
    const beautyResults = searchRecords(beauty, 'GP appointment');
    expect(beautyResults.every((group) => group.matches.every((m) => m.record.id.startsWith('beauty-')))).toBe(true);
    const jackieResults = searchRecords(jackie, 'GP appointment');
    expect(jackieResults.every((group) => group.matches.every((m) => m.record.id.startsWith('jackie-')))).toBe(true);
  });
});
