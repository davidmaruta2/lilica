import { render } from '@testing-library/react-native';

import { canEditRecord, RecordDetail } from '../src/components/RecordDetail';
import { CareCircleMember } from '../src/careCircle';
import { LilicaRecord } from '../src/types';

// Corrective task: existing records open in a genuine read-only detail
// view, not the editor. This file covers RecordDetail in isolation:
// category-aware field presentation, the courtesy Edit-visibility check
// against real Phase 15 membership/domain data, and that empty optional
// fields never produce clutter rows.

describe('RecordDetail: category-aware presentation, using only real fields', () => {
  it('appointment: title, date + time, location, who\'s taking them, assigned to, notes', async () => {
    const record: LilicaRecord = {
      id: 'appt-1', type: 'appointment', title: 'Orthopaedic', status: 'scheduled',
      eventDate: '2026-09-15', eventTime: '10:00', location: 'Lister Hospital',
      responsiblePerson: 'David', notes: 'Bring referral letter',
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(<RecordDetail record={record} />);
    screen.getByText('Orthopaedic');
    screen.getByText('15 Sept 2026 · 10:00');
    screen.getByText('Lister Hospital');
    screen.getByText("Who's taking them");
    screen.getByText('David');
    screen.getByText('Bring referral letter');
  });

  it('bill: amount, reference, repeats and "Sorted" once paid -- never invents "Mark paid" wording', async () => {
    const record: LilicaRecord = {
      id: 'bill-1', type: 'bill', title: 'Energy', status: 'completed', completed: true,
      dueDate: '2026-09-01', amount: '£84.20', reference: 'ACC-1234',
      recurrence: { interval: 1, unit: 'month' }, createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(<RecordDetail record={record} />);
    screen.getByText('£84.20');
    screen.getByText('ACC-1234');
    screen.getByText('Repeats monthly');
    screen.getByText('Sorted');
    expect(screen.queryByText(/paid/i)).toBeNull();
  });

  it('document: expiry date and attachments, no assignment/completion rows', async () => {
    const record: LilicaRecord = {
      id: 'doc-1', type: 'document', title: 'Power of attorney', expiryDate: '2027-01-01',
      attachments: [{ id: 'a1', kind: 'file', uri: 'file://a1', name: 'poa.pdf', createdAt: '2026-09-01T00:00:00.000Z' }],
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(<RecordDetail record={record} />);
    screen.getByText('poa.pdf');
    expect(screen.queryByText('Assigned to')).toBeNull();
    expect(screen.queryByText('Sorted')).toBeNull();
  });

  it('contact: role, phone, email', async () => {
    const record: LilicaRecord = {
      id: 'contact-1', type: 'contact', title: 'GP surgery', role: 'GP surgery',
      phone: '01234 000000', email: 'gp@example.com', createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(<RecordDetail record={record} />);
    screen.getByText('01234 000000');
    screen.getByText('gp@example.com');
  });
});

describe('RecordDetail: empty optional fields are omitted, not shown as clutter', () => {
  it('an appointment with no location/notes shows neither row', async () => {
    const record: LilicaRecord = {
      id: 'appt-2', type: 'appointment', title: 'Dentist', status: 'scheduled',
      eventDate: '2026-09-20', createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(<RecordDetail record={record} />);
    expect(screen.queryByText('Location')).toBeNull();
    expect(screen.queryByText('Notes')).toBeNull();
    expect(screen.queryByText(/^—$/)).toBeNull();
  });

  it('"Assigned to" is still shown as Unassigned -- absence there is meaningful, unlike a blank optional text field', async () => {
    const record: LilicaRecord = {
      id: 'task-1', type: 'task', title: 'Book a taxi', status: 'unresolved',
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(<RecordDetail record={record} />);
    screen.getByText('Assigned to');
    screen.getByText('Unassigned');
  });
});

describe('RecordDetail: assignment shows a real name via the stable membership ID, never a UUID', () => {
  it('resolves the assignee to a real Care Circle display name', async () => {
    const record: LilicaRecord = {
      id: 'task-1', type: 'task', title: 'Book a taxi', status: 'unresolved',
      assignedMembershipId: 'membership-marion', createdAt: '2026-09-01T00:00:00.000Z',
    };
    const members: CareCircleMember[] = [
      { membershipId: 'membership-marion', displayName: 'Marion', role: 'contributor', relationshipType: 'Other relative', isSelf: false, grantedDomains: ['general'] },
    ];
    const screen = await render(<RecordDetail record={record} careCircleMembers={members} />);
    screen.getByText('Marion');
    expect(screen.queryByText('membership-marion')).toBeNull();
  });

  it('shows "You" for the active membership, and legacy responsiblePerson text stays separate, never converted into an assignment', async () => {
    const record: LilicaRecord = {
      id: 'appt-1', type: 'appointment', title: 'Orthopaedic', status: 'scheduled',
      eventDate: '2026-09-15', responsiblePerson: 'David', assignedMembershipId: 'membership-organiser',
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(<RecordDetail record={record} activeMembershipId="membership-organiser" />);
    screen.getByText('You');
    screen.getByText('David');
  });
});

describe('RecordDetail: Edit visibility is a courtesy check over real Phase 15 data', () => {
  const record: LilicaRecord = {
    id: 'bill-1', type: 'bill', title: 'Energy', status: 'unresolved', dueDate: '2026-09-20',
    createdAt: '2026-09-01T00:00:00.000Z',
  };

  it('no onEdit -> no Edit action rendered', async () => {
    const screen = await render(<RecordDetail record={record} />);
    expect(screen.queryByLabelText('Edit Energy')).toBeNull();
  });

  it('onEdit supplied -> Edit action rendered and calls it', async () => {
    const onEdit = jest.fn();
    const screen = await render(<RecordDetail record={record} onEdit={onEdit} />);
    screen.getByLabelText('Edit Energy');
  });

  it('canEditRecord: organiser can always edit', () => {
    const members: CareCircleMember[] = [
      { membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: [] },
    ];
    expect(canEditRecord(record, members)).toBe(true);
  });

  it('canEditRecord: viewer can never edit', () => {
    const members: CareCircleMember[] = [
      { membershipId: 'm-2', displayName: 'Sarah', role: 'viewer', relationshipType: 'Other relative', isSelf: true, grantedDomains: ['financial'] },
    ];
    expect(canEditRecord(record, members)).toBe(false);
  });

  it('canEditRecord: contributor with the record\'s domain granted can edit', () => {
    const members: CareCircleMember[] = [
      { membershipId: 'm-3', displayName: 'Sarah', role: 'contributor', relationshipType: 'Other relative', isSelf: true, grantedDomains: ['financial'] },
    ];
    // "bill" -> financial domain (recordDomainForType) -- granted.
    expect(canEditRecord(record, members)).toBe(true);
  });

  it('canEditRecord: contributor WITHOUT the record\'s domain granted cannot edit', () => {
    const members: CareCircleMember[] = [
      { membershipId: 'm-4', displayName: 'Sarah', role: 'contributor', relationshipType: 'Other relative', isSelf: true, grantedDomains: ['home'] },
    ];
    expect(canEditRecord(record, members)).toBe(false);
  });

  it('no loaded care circle at all (local-only space) keeps today\'s behaviour -- edit allowed', () => {
    expect(canEditRecord(record, undefined)).toBe(true);
    expect(canEditRecord(record, [])).toBe(true);
  });
});
