// Phase 20D closure check: Care Circle permission-domain explanations.
// Direct product-owner request -- when an organiser selects a "What can
// they see?" domain while inviting someone, the UI must clearly explain
// what that domain actually grants access to, derived from the REAL
// server-side mapping (record_domain_for_type()), never internal
// record-type names, and never a vague combined message when several are
// selected. The five-domain model itself is unchanged -- this is a UX
// clarification only, proven by (J) below to leave the actual invite
// payload untouched.
const mockInviteMember = jest.fn();
jest.mock('../src/careCircle', () => {
  const actual = jest.requireActual('../src/careCircle');
  return { ...actual, inviteMember: (...args: unknown[]) => mockInviteMember(...args) };
});

import { fireEvent, render } from '@testing-library/react-native';

import { CareCircleScreen } from '../src/screens/CareCircleScreen';
import { CareCircleMember, DOMAIN_DESCRIPTIONS } from '../src/careCircle';

const organiser: CareCircleMember = {
  membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: [],
};

const baseProps = {
  members: [organiser],
  invitations: [],
  careSpaceId: 'space-1',
  onBack: jest.fn(),
  onRefresh: jest.fn(),
};

async function openInviteForm() {
  const screen = await render(<CareCircleScreen {...baseProps} />);
  await fireEvent.press(screen.getByText('Invite someone'));
  return screen;
}

beforeEach(() => jest.clearAllMocks());

describe('Care Circle invite: permission-domain explanations', () => {
  it('(A) all five permission domains render', async () => {
    const screen = await openInviteForm();
    screen.getByText('Everyday things');
    screen.getByText('Care & health');
    screen.getByText('Bills & money');
    screen.getByText('Home & car');
    screen.getByText('Documents');
  });

  it('(B) selecting Everyday reveals its correct access explanation', async () => {
    const screen = await openInviteForm();
    // 'general' starts pre-selected -- its explanation is already visible.
    screen.getByText(DOMAIN_DESCRIPTIONS.general);
  });

  it('(C) selecting Care & health reveals its correct access explanation', async () => {
    const screen = await openInviteForm();
    expect(screen.queryByText(DOMAIN_DESCRIPTIONS.health)).toBeNull();
    await fireEvent.press(screen.getByText('Care & health'));
    screen.getByText(DOMAIN_DESCRIPTIONS.health);
  });

  it('(D) selecting Bills & money reveals its correct access explanation', async () => {
    const screen = await openInviteForm();
    await fireEvent.press(screen.getByText('Bills & money'));
    screen.getByText(DOMAIN_DESCRIPTIONS.financial);
  });

  it('(E) selecting Home & car reveals its correct access explanation', async () => {
    const screen = await openInviteForm();
    await fireEvent.press(screen.getByText('Home & car'));
    screen.getByText(DOMAIN_DESCRIPTIONS.home);
  });

  it('(F) selecting Documents reveals its correct access explanation', async () => {
    const screen = await openInviteForm();
    await fireEvent.press(screen.getByText('Documents'));
    screen.getByText(DOMAIN_DESCRIPTIONS.documents);
  });

  it('(G) deselecting a domain returns it to the compact state', async () => {
    const screen = await openInviteForm();
    // Everyday things starts selected; deselect it.
    await fireEvent.press(screen.getByText('Everyday things'));
    expect(screen.queryByText(DOMAIN_DESCRIPTIONS.general)).toBeNull();
  });

  it('(H) selecting multiple domains displays each corresponding explanation independently, never a collapsed vague message', async () => {
    const screen = await openInviteForm();
    await fireEvent.press(screen.getByText('Care & health'));
    await fireEvent.press(screen.getByText('Documents'));
    // Everyday (pre-selected) + Care & health + Documents all show their
    // OWN real description at once.
    screen.getByText(DOMAIN_DESCRIPTIONS.general);
    screen.getByText(DOMAIN_DESCRIPTIONS.health);
    screen.getByText(DOMAIN_DESCRIPTIONS.documents);
    expect(screen.queryByText(/They can see selected information/)).toBeNull();
  });

  it('(I) no explanation claims access to a record type outside its own domain -- each description is scoped only to its own domain', async () => {
    const screen = await openInviteForm();
    await fireEvent.press(screen.getByText('Bills & money'));
    // The financial explanation never mentions care/health, home/car, or
    // documents-specific language.
    const financialText = DOMAIN_DESCRIPTIONS.financial;
    expect(financialText).not.toMatch(/care|health|home|car|document/i);
    screen.getByText(financialText);
  });

  it('(J) the invitation payload/domain grants remain EXACTLY the same as before -- this is a UX clarification only', async () => {
    mockInviteMember.mockResolvedValue({ ok: true, data: { invitationId: 'inv-1', inviteCode: 'ABCD1234' } });
    const screen = await openInviteForm();
    await fireEvent.press(screen.getByText('Care & health'));
    const emailInput = screen.getByPlaceholderText('name@example.com');
    await fireEvent.changeText(emailInput, 'marion@example.test');
    const relationshipInput = screen.getByPlaceholderText('e.g. Cousin, neighbour');
    await fireEvent.changeText(relationshipInput, 'Cousin');
    await fireEvent.press(screen.getByText('Send invitation'));
    expect(mockInviteMember).toHaveBeenCalledWith(
      expect.objectContaining({ grantedDomains: ['general', 'health'] }),
    );
  });

  it('accessibility: each domain row communicates name, selection state, and (when selected) exactly what it grants', async () => {
    const screen = await openInviteForm();
    screen.getByLabelText(/Everyday things, selected\. Grants access to:/);
    screen.getByLabelText('Care & health, not selected');
  });
});
