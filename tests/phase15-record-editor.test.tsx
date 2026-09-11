import { fireEvent, render } from '@testing-library/react-native';

import { createRecordDraft, RecordEditor } from '../src/components/RecordEditor';
import { CareCircleMember } from '../src/careCircle';

// Phase 15: the record editor's assignment selector, once real care-circle
// members exist, offers everyone with visibility into this record's domain
// -- never someone who plainly cannot see it. The server (apply_record_
// mutation, see supabase/tests/database/phase15_care_circle.test.sql) is
// what actually enforces this; this file only proves the client does not
// even OFFER a forbidden assignee.

const organiser: CareCircleMember = {
  membershipId: 'm-organiser',
  displayName: 'Olu',
  role: 'organiser',
  relationshipType: 'Myself',
  isSelf: true,
  grantedDomains: [],
};

const contributorWithHome: CareCircleMember = {
  membershipId: 'm-contributor',
  displayName: 'Cara',
  role: 'contributor',
  relationshipType: 'Other relative',
  relationshipLabel: 'Cousin',
  isSelf: false,
  grantedDomains: ['home'],
};

const viewerWithGeneral: CareCircleMember = {
  membershipId: 'm-viewer',
  displayName: 'Vic',
  role: 'viewer',
  relationshipType: 'Someone else',
  relationshipLabel: 'Neighbour',
  isSelf: false,
  grantedDomains: ['general'],
};

describe('Phase 15: real assignment selector', () => {
  it('a financial-domain record (bill) only offers the organiser -- no one else has financial access', async () => {
    const draft = createRecordDraft('bill');
    const screen = await render(
      <RecordEditor
        type="bill"
        draft={draft}
        supportedPersonId="person-1"
        activeMembershipId="m-organiser"
        careCircleMembers={[organiser, contributorWithHome, viewerWithGeneral]}
        onChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    screen.getByText('You');
    expect(screen.queryByText('Cara')).toBeNull();
    expect(screen.queryByText('Vic')).toBeNull();
  });

  it('a home-domain record (homeMatter) offers the organiser and the contributor granted home access', async () => {
    const draft = createRecordDraft('homeMatter');
    const screen = await render(
      <RecordEditor
        type="homeMatter"
        draft={draft}
        supportedPersonId="person-1"
        activeMembershipId="m-organiser"
        careCircleMembers={[organiser, contributorWithHome, viewerWithGeneral]}
        onChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    screen.getByText('You');
    screen.getByText('Cara');
    expect(screen.queryByText('Vic')).toBeNull();
  });

  it('selecting a real member stores their membership ID, never their display name', async () => {
    const draft = createRecordDraft('homeMatter');
    const onChange = jest.fn();
    const screen = await render(
      <RecordEditor
        type="homeMatter"
        draft={draft}
        supportedPersonId="person-1"
        activeMembershipId="m-organiser"
        careCircleMembers={[organiser, contributorWithHome]}
        onChange={onChange}
        onSave={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByText('Cara'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ assignedMembershipId: 'm-contributor' }));
  });

  it('falls back to You-only when no care circle has loaded yet, unchanged from Phase 9', async () => {
    const draft = createRecordDraft('appointment');
    const screen = await render(
      <RecordEditor
        type="appointment"
        draft={draft}
        supportedPersonId="person-1"
        activeMembershipId="m-organiser"
        onChange={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    screen.getByText('You');
  });
});
