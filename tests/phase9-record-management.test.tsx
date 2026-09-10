import { fireEvent, render } from '@testing-library/react-native';

import { createRecordDraft, RecordEditor } from '../src/components/RecordEditor';
import { FirstThingScreen } from '../src/screens/FirstThingScreen';

// Phase 9: everyday add & record management. The category-gateway/list/
// add/edit architecture itself (zero/one/multiple records, list-before-edit,
// remove-only-selected-ID) was already implemented and is covered by
// tests/phase1-ui.characterization.test.tsx. These tests cover exactly what
// Phase 9 added: the everyday-vs-onboarding copy variant, and the stable-
// identity Assigned-to control that replaces name/email-based assignment.

const baseProps = {
  interests: [] as never[],
  personName: 'Margaret',
  supportedPersonId: 'person-1',
  onBack: jest.fn(),
  onSaveRecord: jest.fn(),
  onRemoveRecord: jest.fn(),
  onFinish: jest.fn(),
  onSkip: jest.fn(),
};

describe('Phase 9: everyday vs onboarding copy', () => {
  it('shows first-time onboarding copy by default', async () => {
    const screen = await render(<FirstThingScreen {...baseProps} records={[]} />);
    screen.getByText("Let's get Margaret organised.");
    screen.getByText("I'll add things later");
  });

  it('shows everyday-management copy when reached from Home after setup is already complete', async () => {
    const screen = await render(<FirstThingScreen {...baseProps} records={[]} everyday />);
    screen.getByText("Margaret's records");
    screen.getByText('Back to Home');
    expect(() => screen.getByText("Let's get Margaret organised.")).toThrow();
  });

  it('does not change the category-gateway/list/add/edit architecture in everyday mode', async () => {
    const appointment = { id: 'a1', type: 'appointment' as const, title: 'Dentist', createdAt: '2026-09-10T00:00:00Z' };
    const screen = await render(<FirstThingScreen {...baseProps} records={[appointment]} everyday />);
    await fireEvent.press(screen.getByLabelText('Open Appointment'));
    screen.getByText('Dentist');
  });
});

describe('Category gateway: saved-count badge, not an "Added" label', () => {
  // A category box is revisited repeatedly to add more records, so "Added"
  // wrongly implied it was now complete/done. A count badge shows how many
  // are actually saved without implying the category is finished.
  it('shows a count badge with the number of saved records, not the word Added', async () => {
    const appointments = [
      { id: 'a1', type: 'appointment' as const, title: 'Dentist', createdAt: '2026-09-10T00:00:00Z' },
      { id: 'a2', type: 'appointment' as const, title: 'GP', createdAt: '2026-09-10T00:00:00Z' },
    ];
    const screen = await render(<FirstThingScreen {...baseProps} records={appointments} everyday />);
    screen.getByLabelText('2 saved');
    expect(() => screen.getByText('Added')).toThrow();
  });

  it('keeps the Add affordance alongside the count badge, since the box is revisited to add more', async () => {
    const appointments = [
      { id: 'a1', type: 'appointment' as const, title: 'Dentist', createdAt: '2026-09-10T00:00:00Z' },
    ];
    const screen = await render(<FirstThingScreen {...baseProps} records={appointments} everyday />);
    screen.getByLabelText('1 saved');
    expect(screen.getAllByText('Add').length).toBeGreaterThan(0);
  });

  it('still shows the Add affordance when a category has no saved records', async () => {
    const screen = await render(<FirstThingScreen {...baseProps} records={[]} everyday />);
    expect(screen.getAllByText('Add').length).toBeGreaterThan(0);
  });
});

describe('Phase 9: stable-identity assignment control', () => {
  it('does not render an Assigned-to control when no active membership is available (no fabricated care circle)', async () => {
    const draft = createRecordDraft('appointment');
    const screen = await render(
      <RecordEditor type="appointment" draft={draft} supportedPersonId="person-1" onChange={jest.fn()} onSave={jest.fn()} />,
    );
    expect(screen.queryByText('Assigned to')).toBeNull();
  });

  it('offers only Unassigned and You, and stores a stable membership ID rather than a display name', async () => {
    const draft = createRecordDraft('appointment');
    const onChange = jest.fn();
    const screen = await render(
      <RecordEditor
        type="appointment"
        draft={draft}
        supportedPersonId="person-1"
        activeMembershipId="membership-abc-123"
        onChange={onChange}
        onSave={jest.fn()}
      />,
    );

    screen.getByText('Assigned to');
    screen.getByText('Unassigned');
    const you = screen.getByText('You');
    await fireEvent.press(you);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ assignedMembershipId: 'membership-abc-123' }));
  });

  it('returns to Unassigned without ever writing a display name as identity', async () => {
    const draft = { ...createRecordDraft('appointment'), assignedMembershipId: 'membership-abc-123' };
    const onChange = jest.fn();
    const screen = await render(
      <RecordEditor
        type="appointment"
        draft={draft}
        supportedPersonId="person-1"
        activeMembershipId="membership-abc-123"
        onChange={onChange}
        onSave={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByText('Unassigned'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ assignedMembershipId: undefined }));
  });

  it('keeps the legacy free-text responsibility field independent of the new assignment control', async () => {
    const draft = { ...createRecordDraft('task'), responsiblePerson: 'Sarah', assignedMembershipId: 'membership-abc-123', title: 'Call the plumber' };
    const onSave = jest.fn();
    const screen = await render(
      <RecordEditor
        type="task"
        draft={draft}
        supportedPersonId="person-1"
        activeMembershipId="membership-abc-123"
        onChange={jest.fn()}
        onSave={onSave}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Add task' }));

    // Both fields are present and neither overwrites the other: the legacy
    // free-text note and the new stable-identity assignment coexist.
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      responsiblePerson: 'Sarah',
      assignedMembershipId: 'membership-abc-123',
    }));
  });

  it('only offers assignment for appointment/task/bill/homeMatter, matching where responsibility already applies', async () => {
    const draft = createRecordDraft('contact');
    const screen = await render(
      <RecordEditor
        type="contact"
        draft={draft}
        supportedPersonId="person-1"
        activeMembershipId="membership-abc-123"
        onChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.queryByText('Assigned to')).toBeNull();
  });
});
