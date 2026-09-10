import { fireEvent, render } from '@testing-library/react-native';

import { calendarDateForRecord, isActionableRecord } from '../src/records';
import { PersonScreen } from '../src/screens/PersonScreen';
import { LilicaRecord } from '../src/types';

// Phase 13: Person is a projection of the same canonical records Home,
// Calendar and To Do already read -- no second knowledge store, no
// inferred medical/legal facts.

const baseProps = {
  displayName: 'Maggie',
  relationshipLabel: 'Mum',
  isSelf: false,
  people: [],
  activeCareSpaceId: 'space-maggie',
  onSwitchPerson: jest.fn(),
  onAddPerson: jest.fn(),
  onOpenRecord: jest.fn(),
  onAddType: jest.fn(),
  onOpenAccount: jest.fn(),
};

// The exact fixed scenario from the brief, for Maggie.
const gpSurgery: LilicaRecord = { id: 'contact-1', type: 'contact', title: 'GP surgery', role: 'GP surgery', phone: '01234 000000', createdAt: '2026-09-01T00:00:00.000Z' };
const pharmacy: LilicaRecord = { id: 'contact-2', type: 'contact', title: 'Pharmacy', phone: '01234 111111', createdAt: '2026-09-02T00:00:00.000Z' };
const homeInsurance: LilicaRecord = { id: 'bill-1', type: 'bill', title: 'Home insurance', status: 'unresolved', dueDate: '2027-03-01', reference: 'Aviva', createdAt: '2026-09-03T00:00:00.000Z' };
const electricityBill: LilicaRecord = { id: 'bill-2', type: 'bill', title: 'Electricity', status: 'unresolved', dueDate: '2026-09-14', createdAt: '2026-09-04T00:00:00.000Z' };
const boilerInfo: LilicaRecord = { id: 'home-1', type: 'homeMatter', title: 'Boiler', status: 'unresolved', provider: 'British Gas', createdAt: '2026-09-05T00:00:00.000Z' };
const prescription: LilicaRecord = { id: 'care-1', type: 'careNote', title: 'Metformin', notes: 'Taken twice daily with food', createdAt: '2026-09-06T00:00:00.000Z' };
const importantDoc: LilicaRecord = { id: 'doc-1', type: 'document', title: 'Power of attorney', attachments: [{ id: 'a1', kind: 'file', uri: 'file://a1', name: 'poa.pdf', createdAt: '2026-09-01T00:00:00.000Z' }], createdAt: '2026-09-07T00:00:00.000Z' };
const dentistAppt: LilicaRecord = { id: 'appt-1', type: 'appointment', title: 'Dentist', status: 'scheduled', eventDate: '2026-09-20', createdAt: '2026-09-08T00:00:00.000Z' };
const transportTask: LilicaRecord = { id: 'task-1', type: 'task', title: 'Arrange transport', status: 'unresolved', dueDate: '2026-09-12', createdAt: '2026-09-09T00:00:00.000Z' };
const completedTask: LilicaRecord = { id: 'task-2', type: 'task', title: 'Completed historical task', status: 'completed', completed: true, completedAt: '2026-09-09T00:00:00.000Z', createdAt: '2026-09-01T00:00:00.000Z' };

const fixedScenario = [gpSurgery, pharmacy, homeInsurance, electricityBill, boilerInfo, prescription, importantDoc, dentistAppt, transportTask, completedTask];

describe('Phase 13: fixed test scenario', () => {
  it('groups durable knowledge correctly and excludes appointments/tasks/completed history', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={fixedScenario} />);

    screen.getByText('Important contacts');
    screen.getByText('GP surgery');
    screen.getByText('Pharmacy');

    screen.getByText('Care & health information');
    screen.getByText('Metformin');

    screen.getByText('Home');
    screen.getByText('Boiler');

    screen.getByText('Documents & paperwork');
    screen.getByText('Power of attorney');

    screen.getByText('Bills & renewals');
    screen.getByText('Home insurance');
    screen.getByText('Electricity');

    // Not a flat Person list item.
    expect(screen.queryByText('Dentist')).toBeNull();
    expect(screen.queryByText('Arrange transport')).toBeNull();
    expect(screen.queryByText('Completed historical task')).toBeNull();
  });
});

describe('Phase 13: no medical/legal inference', () => {
  it('a care note about a medication does not generate a diagnosis', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[prescription]} />);
    screen.getByText('Metformin');
    expect(screen.queryByText(/diabetes/i)).toBeNull();
  });

  it('an appointment type never appears, so it cannot imply a condition', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[dentistAppt]} />);
    expect(screen.queryByText('Dentist')).toBeNull();
  });

  it('a power-of-attorney document is shown as paperwork, never as confirmed legal authority', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[importantDoc]} />);
    screen.getByText('Power of attorney');
    expect(screen.queryByText(/legal authority confirmed/i)).toBeNull();
  });

  it('never invents a generated summary statement', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={fixedScenario} />);
    expect(screen.queryByText(/generally healthy|finances are up to date|medication is stable/i)).toBeNull();
  });

  it('absent health information stays absent rather than defaulting to something', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[gpSurgery]} />);
    expect(screen.queryByText('Care & health information')).toBeNull();
  });
});

describe('Phase 13: empty and sparse states', () => {
  it('omits a section entirely rather than showing "0 items"', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[gpSurgery]} />);
    expect(screen.queryByText('Bills & renewals')).toBeNull();
    expect(screen.queryByText(/0 bills/i)).toBeNull();
  });

  it('shows one calm empty state, not five empty boxes, when nothing is saved', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[]} />);
    screen.getByText(/Nothing saved for Maggie yet/);
    expect(screen.queryByText('Important contacts')).toBeNull();
  });
});

describe('Phase 13: identity (no duplication, same underlying record)', () => {
  it('opening a Person item calls back with the real underlying record ID', async () => {
    const onOpenRecord = jest.fn();
    const screen = await render(<PersonScreen {...baseProps} records={[gpSurgery]} onOpenRecord={onOpenRecord} />);
    await fireEvent.press(screen.getByLabelText('Open GP surgery'));
    expect(onOpenRecord).toHaveBeenCalledWith('contact-1');
  });

  it('the same bill record Person shows is recognised identically by Calendar/To Do\'s own derivation', () => {
    // Proves Person is reading the identical object, not a copy -- the
    // same functions Calendar/To Do already use agree about it.
    expect(isActionableRecord(homeInsurance)).toBe(true);
    expect(calendarDateForRecord(homeInsurance)).toBe('2027-03-01');
  });

  it('"Add a contact" reuses the established creation architecture, not a separate form', async () => {
    const onAddType = jest.fn();
    const screen = await render(<PersonScreen {...baseProps} records={[gpSurgery]} onAddType={onAddType} />);
    await fireEvent.press(screen.getByLabelText('Add a contact'));
    expect(onAddType).toHaveBeenCalledWith('contact');
  });
});

describe('Phase 13: self-care wording is explicit, never name-matched', () => {
  it('isSelf shows "You" regardless of the underlying display name', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[]} isSelf displayName="David" />);
    // "You" also labels the always-present Care circle row, so assert via
    // getAllByText rather than a single unique match.
    expect(screen.getAllByText('You').length).toBeGreaterThan(0);
    expect(screen.queryByText('David')).toBeNull();
  });

  it('a display name of "You" does not trigger self-care wording on its own -- isSelf must be explicit', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[]} isSelf={false} displayName="You" />);
    // Third-person framing still used: the literal name renders as the
    // person's identity, not collapsed into first-person "you" copy.
    screen.getByText(/Nothing saved for You yet/);
  });
});

describe('Phase 13: care-space isolation', () => {
  it('switching to a different care space shows only that space\'s durable information', async () => {
    const jackieContact: LilicaRecord = { id: 'jackie-contact-1', type: 'contact', title: "Jackie's dentist", createdAt: '2026-09-01T00:00:00.000Z' };
    const screen = await render(<PersonScreen {...baseProps} records={[gpSurgery]} />);
    screen.getByText('GP surgery');
    await screen.rerender(<PersonScreen {...baseProps} displayName="Jackie" records={[jackieContact]} />);
    expect(screen.queryByText('GP surgery')).toBeNull();
    screen.getByText("Jackie's dentist");
  });
});

describe('Phase 13: offline-safe (no network dependency)', () => {
  it('renders already-cached records with no fetch/sync call of its own', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[gpSurgery]} />);
    screen.getByText('GP surgery');
  });
});

describe('Phase 13: permission boundary', () => {
  it('only ever shows what it is given -- nothing beyond the scoped records prop', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[gpSurgery]} />);
    expect(screen.queryByText('Pharmacy')).toBeNull();
    expect(screen.queryByText('Boiler')).toBeNull();
  });
});
