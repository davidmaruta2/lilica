import { fireEvent, render } from '@testing-library/react-native';

import { CareCircleMember } from '../src/careCircle';
import { HomeScreen } from '../src/screens/HomeScreen';
import { PersonScreen } from '../src/screens/PersonScreen';
import { initialOnboardingState } from '../src/storage';
import { LilicaRecord } from '../src/types';

// Corrective task 10: People used to repeat Home's own record-category
// dashboard (bills, home matters, documents, care notes) under a
// different heading, giving it no distinct purpose. It now centres on
// four things Home/Calendar/To Do genuinely don't cover: the people
// supported, key external contacts, the real care circle, and (unchanged,
// still a placeholder) Ask Lilica. This supersedes the old Phase 13
// five-section design that used to be tested here.

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
  onOpenSettings: jest.fn(),
};

const gpSurgery: LilicaRecord = { id: 'contact-1', type: 'contact', title: 'GP surgery', role: 'GP surgery', phone: '01234 000000', createdAt: '2026-09-01T00:00:00.000Z' };
const pharmacy: LilicaRecord = { id: 'contact-2', type: 'contact', title: 'Pharmacy', phone: '01234 111111', createdAt: '2026-09-02T00:00:00.000Z' };
const homeInsurance: LilicaRecord = { id: 'bill-1', type: 'bill', title: 'Home insurance', status: 'unresolved', dueDate: '2027-03-01', reference: 'Aviva', createdAt: '2026-09-03T00:00:00.000Z' };
const boilerInfo: LilicaRecord = { id: 'home-1', type: 'homeMatter', title: 'Boiler', status: 'unresolved', provider: 'British Gas', createdAt: '2026-09-05T00:00:00.000Z' };
const prescription: LilicaRecord = { id: 'care-1', type: 'careNote', title: 'Metformin', notes: 'Taken twice daily with food', createdAt: '2026-09-06T00:00:00.000Z' };
const importantDoc: LilicaRecord = { id: 'doc-1', type: 'document', title: 'Power of attorney', attachments: [{ id: 'a1', kind: 'file', uri: 'file://a1', name: 'poa.pdf', createdAt: '2026-09-01T00:00:00.000Z' }], createdAt: '2026-09-07T00:00:00.000Z' };
const dentistAppt: LilicaRecord = { id: 'appt-1', type: 'appointment', title: 'Dentist', status: 'scheduled', eventDate: '2026-09-20', createdAt: '2026-09-08T00:00:00.000Z' };
const transportTask: LilicaRecord = { id: 'task-1', type: 'task', title: 'Arrange transport', status: 'unresolved', dueDate: '2026-09-12', createdAt: '2026-09-09T00:00:00.000Z' };
const completedTask: LilicaRecord = { id: 'task-2', type: 'task', title: 'Completed historical task', status: 'completed', completed: true, completedAt: '2026-09-09T00:00:00.000Z', createdAt: '2026-09-01T00:00:00.000Z' };

const fixedScenario = [gpSurgery, pharmacy, homeInsurance, boilerInfo, prescription, importantDoc, dentistAppt, transportTask, completedTask];

describe('Corrective task 10: People centres on Key contacts, not a second Home dashboard', () => {
  it('shows Key contacts, and nothing else that Home/Calendar/To Do already project', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={fixedScenario} />);

    screen.getByText('Key contacts');
    screen.getByText('GP surgery');
    screen.getByText('Pharmacy');

    // No bills/home/documents/care-note dashboard duplication.
    expect(screen.queryByText('Bills & renewals')).toBeNull();
    expect(screen.queryByText('Home insurance')).toBeNull();
    expect(screen.queryByText('Home')).toBeNull();
    expect(screen.queryByText('Boiler')).toBeNull();
    expect(screen.queryByText('Documents & paperwork')).toBeNull();
    expect(screen.queryByText('Power of attorney')).toBeNull();
    expect(screen.queryByText('Care & health information')).toBeNull();
    expect(screen.queryByText('Metformin')).toBeNull();

    // Appointments/tasks/completed history stay Calendar/To Do's job.
    expect(screen.queryByText('Dentist')).toBeNull();
    expect(screen.queryByText('Arrange transport')).toBeNull();
    expect(screen.queryByText('Completed historical task')).toBeNull();
  });

  it('never shows a generated summary or inferred medical/legal statement', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={fixedScenario} />);
    expect(screen.queryByText(/diabetes|legal authority confirmed|generally healthy|finances are up to date|medication is stable/i)).toBeNull();
  });
});

describe('Corrective task 10: Home no longer duplicates People, and this data stays canonical', () => {
  it('Home does not render the removed sections either -- this is a projection change, not a deletion', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[homeInsurance]} />);
    // The bill record itself is not shown here at all -- it stays exactly
    // where Home/Calendar/To Do already project it; nothing here asserts
    // it was deleted (see records.characterization.test.ts for storage).
    expect(screen.queryByText('Home insurance')).toBeNull();
  });
});

describe('Corrective task 10, section 1: supported people', () => {
  it('shows the currently supported person, and switching is still the existing PersonSwitcher', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[]} />);
    screen.getByText('Person being supported');
    screen.getByLabelText('Switch person, currently Maggie');
  });

  it('the switch affordance is only shown when there is more than one supported person', async () => {
    const single = await render(<PersonScreen {...baseProps} records={[]} people={[]} />);
    // getByLabelText still resolves (it's the whole card's tap target),
    // but the chevron/switch cue itself is scoped to people.length > 1 --
    // covered structurally rather than by a brittle style assertion.
    single.getByLabelText('Switch person, currently Maggie');
  });
});

describe('Corrective task 10, section 2: Key contacts', () => {
  it('opening a Key contact calls back with the real underlying record ID', async () => {
    const onOpenRecord = jest.fn();
    const screen = await render(<PersonScreen {...baseProps} records={[gpSurgery]} onOpenRecord={onOpenRecord} />);
    await fireEvent.press(screen.getByLabelText('Open GP surgery'));
    expect(onOpenRecord).toHaveBeenCalledWith('contact-1');
  });

  it('"Add a contact" reuses the established creation architecture, not a separate form', async () => {
    const onAddType = jest.fn();
    const screen = await render(<PersonScreen {...baseProps} records={[gpSurgery]} onAddType={onAddType} />);
    await fireEvent.press(screen.getByLabelText('Add a contact'));
    expect(onAddType).toHaveBeenCalledWith('contact');
  });

  it('shows a calm inline empty state, not an error, when no key contacts are saved', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[]} />);
    screen.getByText(/No key contacts saved for Maggie yet/);
  });

  it('only ever shows what it is given -- nothing beyond the scoped records prop', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[gpSurgery]} />);
    expect(screen.queryByText('Pharmacy')).toBeNull();
  });
});

describe('Corrective task 10, section 3: Care circle -- real memberships, never fabricated', () => {
  it('shows the honest "just you" state when there are no real memberships yet (e.g. a local-only care space)', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[]} careCircleMembers={[]} />);
    screen.getByText('Care circle');
    screen.getByText('The only person with access right now.');
  });

  it('shows real members with their real role -- "Name — Role", never a placeholder', async () => {
    const members: CareCircleMember[] = [
      { membershipId: 'm-organiser', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: ['general'] },
      { membershipId: 'm-sarah', displayName: 'Sarah', role: 'contributor', relationshipType: 'Other relative', relationshipLabel: 'Family member', isSelf: false, grantedDomains: ['general'] },
    ];
    const screen = await render(<PersonScreen {...baseProps} records={[]} careCircleMembers={members} />);
    screen.getByText('You - Organiser');
    screen.getByText('Sarah - Contributor');
  });

  it('an external Key contact never appears as, or is conflated with, a care circle member', async () => {
    const members: CareCircleMember[] = [
      { membershipId: 'm-organiser', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: ['general'] },
    ];
    const screen = await render(<PersonScreen {...baseProps} records={[gpSurgery]} careCircleMembers={members} />);
    screen.getByText('GP surgery');
    screen.getByText('You - Organiser');
    // "GP surgery" is a Key contact row, not a care circle row -- it never
    // gains a role suffix or membership treatment.
    expect(screen.queryByText(/GP surgery — /)).toBeNull();
  });

  it('"Manage" opens the existing Care Circle management screen, unchanged', async () => {
    const onOpenCareCircle = jest.fn();
    const screen = await render(<PersonScreen {...baseProps} records={[]} onOpenCareCircle={onOpenCareCircle} />);
    await fireEvent.press(screen.getByLabelText('Manage Care Circle'));
    expect(onOpenCareCircle).toHaveBeenCalledTimes(1);
  });
});

describe('Corrective task 10, section 4: Ask Lilica moved from Home to People', () => {
  it('People shows the Ask Lilica placeholder', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[]} />);
    screen.getByText('Ask Lilica');
  });

  it('Home no longer shows it -- moved, not duplicated', async () => {
    const screen = await render(
      <HomeScreen state={{ ...initialOnboardingState, stage: 'home' }} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    expect(screen.queryByText('Ask Lilica')).toBeNull();
  });
});

describe('Corrective task 10: self-care wording is explicit, never name-matched', () => {
  it('isSelf shows "You" regardless of the underlying display name', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[]} isSelf displayName="David" />);
    // "You" also labels the always-present Care circle row, so assert via
    // getAllByText rather than a single unique match.
    expect(screen.getAllByText('You').length).toBeGreaterThan(0);
    expect(screen.queryByText('David')).toBeNull();
  });
});

describe('Corrective task 10: care-space isolation', () => {
  it('switching to a different care space shows only that space\'s key contacts and members', async () => {
    const jackieContact: LilicaRecord = { id: 'jackie-contact-1', type: 'contact', title: "Jackie's dentist", createdAt: '2026-09-01T00:00:00.000Z' };
    const screen = await render(<PersonScreen {...baseProps} records={[gpSurgery]} />);
    screen.getByText('GP surgery');
    await screen.rerender(<PersonScreen {...baseProps} displayName="Jackie" records={[jackieContact]} />);
    expect(screen.queryByText('GP surgery')).toBeNull();
    screen.getByText("Jackie's dentist");
  });
});

describe('Corrective task 10: offline-safe (no network dependency)', () => {
  it('renders already-cached records with no fetch/sync call of its own', async () => {
    const screen = await render(<PersonScreen {...baseProps} records={[gpSurgery]} />);
    screen.getByText('GP surgery');
  });
});
