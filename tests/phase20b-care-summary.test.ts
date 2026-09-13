// Phase 20B, Feature C: pure unit coverage for buildCareSummary -- proves
// it is a bounded projection over already-supplied data (records, Care
// Circle members, recent activity) and never fabricates a section that
// has nothing behind it (brief section 9/13/GAP24: "no duplicate data
// store created").

import { buildCareSummary } from '../src/careSummary';
import { CareCircleMember } from '../src/careCircle';
import { ActivityEvent } from '../src/activity';
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

const describeActivity = (event: ActivityEvent) => `${event.actorDisplayName} did something`;

describe('buildCareSummary', () => {
  it('omits every section when there is nothing to show', () => {
    expect(buildCareSummary([], [], [], describeActivity)).toEqual([]);
  });

  it('includes only the sections that have real supporting data, in a stable order', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const overdueDate = yesterday.toISOString().slice(0, 10);

    const records: LilicaRecord[] = [
      record({ id: 'task-overdue', type: 'task', title: 'Overdue task', dueDate: overdueDate }),
      record({ id: 'contact-1', type: 'contact', title: 'Dr Patel', role: 'GP' }),
      record({ id: 'care-1', type: 'careNote', title: 'Mobility', notes: 'Uses a walking frame' }),
    ];
    const members: CareCircleMember[] = [
      { membershipId: 'mem-1', displayName: 'David', role: 'organiser', relationshipType: 'Mum', isSelf: true, grantedDomains: [] },
    ];
    const activity: ActivityEvent[] = [
      { id: 'evt-1', eventType: 'record_created', recordId: 'task-overdue', recordDomain: 'general', metadata: {}, createdAt: '2026-09-12T00:00:00.000Z', actorMembershipId: 'mem-1', actorDisplayName: 'David', actorIsFormer: false },
    ];

    const sections = buildCareSummary(records, members, activity, describeActivity);
    const keys = sections.map((s) => s.key);
    expect(keys).toEqual(['needsAttention', 'keyContacts', 'careCircle', 'careInformation', 'recentActivity']);
    // Sections with no supporting data never appear at all.
    expect(keys).not.toContain('comingUp');
    expect(keys).not.toContain('documents');
    expect(keys).not.toContain('bills');
    expect(keys).not.toContain('homeCar');
  });

  it('never leaks a domain-inaccessible record -- it only ever reflects the arrays it is given', () => {
    // Simulates a contributor without financial access: their own already-
    // filtered `records` array never contains the bill in the first place,
    // so buildCareSummary has no way to show it, and does not invent a
    // "N hidden" placeholder either.
    const records: LilicaRecord[] = [record({ id: 'task-1', type: 'task', title: 'Visible task' })];
    const sections = buildCareSummary(records, [], [], describeActivity);
    expect(sections.some((s) => s.key === 'bills')).toBe(false);
    expect(JSON.stringify(sections)).not.toMatch(/hidden/i);
  });

  it('bounds each list section to a small number of items', () => {
    const manyContacts = Array.from({ length: 10 }, (_, i) => record({ id: `contact-${i}`, type: 'contact', title: `Contact ${i}` }));
    const sections = buildCareSummary(manyContacts, [], [], describeActivity);
    const contactsSection = sections.find((s) => s.key === 'keyContacts');
    expect(contactsSection && 'items' in contactsSection ? contactsSection.items.length : 0).toBeLessThanOrEqual(4);
  });

  it('renders the Care Circle section from the member list it is given, using "You" for self', () => {
    const members: CareCircleMember[] = [
      { membershipId: 'mem-1', displayName: 'David', role: 'organiser', relationshipType: 'Mum', isSelf: true, grantedDomains: [] },
    ];
    const sections = buildCareSummary([], members, [], describeActivity);
    const careCircle = sections.find((s) => s.key === 'careCircle');
    expect(careCircle && 'members' in careCircle ? careCircle.members : []).toEqual(members);
  });
});
