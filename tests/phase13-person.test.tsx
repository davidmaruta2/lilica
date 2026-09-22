const mockResolveAvatarUrl = jest.fn();
jest.mock('../src/profileAvatar', () => ({
  resolveAvatarUrl: (...args: unknown[]) => mockResolveAvatarUrl(...args),
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CareCircleMember } from '../src/careCircle';
import { HomeScreen } from '../src/screens/HomeScreen';
import { PersonScreen } from '../src/screens/PersonScreen';
import { initialOnboardingState } from '../src/storage';

beforeEach(() => {
  mockResolveAvatarUrl.mockReset();
  mockResolveAvatarUrl.mockResolvedValue(undefined);
});

// Corrective task 10: People used to repeat Home's own record-category
// dashboard (bills, home matters, documents, care notes) under a
// different heading, giving it no distinct purpose. It now centres on
// the things Home/Calendar/To Do genuinely don't cover: the people
// supported, the real care circle, Lilica Chat (Phase 23), and
// (unchanged, still a placeholder) Ask Lilica. This supersedes the old
// Phase 13 five-section design that used to be tested here.
//
// Phase 23: Key contacts moved out of this page and into the Settings
// drawer (see tests/phase23-settings-key-contacts.test.tsx for its new
// coverage there) -- this page no longer accepts a `records` prop at all,
// and every test here that used to assert Key contacts behaviour was
// removed rather than adapted, since that behaviour no longer exists on
// this screen.

const baseProps = {
  displayName: 'Maggie',
  relationshipLabel: 'Mum',
  isSelf: false,
  people: [],
  activeCareSpaceId: 'space-maggie',
  onSwitchPerson: jest.fn(),
  onAddPerson: jest.fn(),
  onOpenSettings: jest.fn(),
};

describe('Corrective task 10, section 1: supported people', () => {
  it('shows the currently supported person, and switching is still the existing PersonSwitcher', async () => {
    const screen = await render(<PersonScreen {...baseProps} />);
    screen.getByText('Person being supported');
    screen.getByLabelText('Switch person, currently Maggie');
  });

  it('the switch affordance is only shown when there is more than one supported person', async () => {
    const single = await render(<PersonScreen {...baseProps} people={[]} />);
    // getByLabelText still resolves (it's the whole card's tap target),
    // but the chevron/switch cue itself is scoped to people.length > 1 --
    // covered structurally rather than by a brittle style assertion.
    single.getByLabelText('Switch person, currently Maggie');
  });

  // Real product-owner report (14 September 2026, physical QA): a
  // contributor viewing this exact card saw "Maggie" with "Brother"
  // directly underneath -- their OWN relationship to Maggie, entered by
  // the organiser when inviting them, but reading as if it described
  // Maggie herself. The product owner's own words: "id suggest not
  // displaying relationship as it would be weird to see Maggie -
  // neighbour". Removed from this card entirely, and from the
  // PersonSwitcher list for the same reason.
  it('never shows the relationship label on the supported-person card, however it was entered', async () => {
    const screen = await render(<PersonScreen {...baseProps} />);
    screen.getByText('Maggie');
    expect(screen.queryByText('Mum')).toBeNull();
  });
});

describe('Corrective task 10, section 2: Care circle -- real memberships, never fabricated', () => {
  it('shows a real "You"/"Organiser" preview when there are no real memberships yet (e.g. a local-only care space)', async () => {
    const screen = await render(<PersonScreen {...baseProps} careCircleMembers={[]} />);
    screen.getByText('Care circle');
    screen.getByText('You');
    screen.getByText('Organiser');
  });

  it('shows real members with their real name and role as separate lines, never a placeholder', async () => {
    const members: CareCircleMember[] = [
      { membershipId: 'm-organiser', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: ['general'] },
      { membershipId: 'm-sarah', displayName: 'Sarah', role: 'contributor', relationshipType: 'Other relative', relationshipLabel: 'Family member', isSelf: false, grantedDomains: ['general'] },
    ];
    const screen = await render(<PersonScreen {...baseProps} careCircleMembers={members} />);
    screen.getByText('You');
    screen.getByText('Organiser');
    screen.getByText('Sarah');
    screen.getByText('Contributor');
  });

  it('"Manage" opens the existing Care Circle management screen, unchanged', async () => {
    const onOpenCareCircle = jest.fn();
    const screen = await render(<PersonScreen {...baseProps} onOpenCareCircle={onOpenCareCircle} />);
    await fireEvent.press(screen.getByLabelText('Manage Care Circle'));
    expect(onOpenCareCircle).toHaveBeenCalledTimes(1);
  });
});

describe('Phase 20B: Care summary and Recent activity entry points', () => {
  it('"Care summary" is not shown for a local-only care space, exactly like "Manage"', async () => {
    const screen = await render(<PersonScreen {...baseProps} />);
    expect(screen.queryByLabelText('View exportable care summary')).toBeNull();
    expect(screen.queryByLabelText('View recent activity')).toBeNull();
  });

  it('"Care summary" opens the new Care Summary screen', async () => {
    const onOpenCareSummary = jest.fn();
    const screen = await render(<PersonScreen {...baseProps} onOpenCareSummary={onOpenCareSummary} />);
    await fireEvent.press(screen.getByLabelText('View exportable care summary'));
    expect(onOpenCareSummary).toHaveBeenCalledTimes(1);
  });

  it('"Recent activity" opens the new Recent Activity screen', async () => {
    const onOpenRecentActivity = jest.fn();
    const screen = await render(<PersonScreen {...baseProps} onOpenRecentActivity={onOpenRecentActivity} />);
    await fireEvent.press(screen.getByLabelText('View recent activity'));
    expect(onOpenRecentActivity).toHaveBeenCalledTimes(1);
  });
});

// Phase 23 slice 1: Lilica Chat card, immediately beneath Care circle.
// Omitted entirely (no onOpenChat) for a local-only care space, exactly
// the same availability-guard pattern as Care summary/Manage above.
describe('Phase 23 slice 1: Lilica Chat card', () => {
  it('is not shown at all when onOpenChat is not supplied (local-only care space)', async () => {
    const screen = await render(<PersonScreen {...baseProps} />);
    expect(screen.queryByText('Lilica Chat')).toBeNull();
  });

  it('shows the empty state when there is no preview text yet', async () => {
    const screen = await render(<PersonScreen {...baseProps} onOpenChat={jest.fn()} />);
    screen.getByText('Lilica Chat');
    screen.getByText('Message everyone in your Care Circle');
  });

  it('shows a real preview line and unread badge count when supplied', async () => {
    const screen = await render(
      <PersonScreen {...baseProps} onOpenChat={jest.fn()} chatUnreadCount={3} chatPreviewText="Sarah: Picking up the prescription" />,
    );
    screen.getByText('Sarah: Picking up the prescription');
    screen.getByText('3');
  });

  it('shows "9+" rather than the real count once unread messages exceed 9', async () => {
    const screen = await render(<PersonScreen {...baseProps} onOpenChat={jest.fn()} chatUnreadCount={14} />);
    screen.getByText('9+');
    expect(screen.queryByText('14')).toBeNull();
  });

  it('shows no badge at all when there are no unread messages', async () => {
    const screen = await render(<PersonScreen {...baseProps} onOpenChat={jest.fn()} chatUnreadCount={0} />);
    screen.getByLabelText('Lilica Chat');
    expect(screen.queryByLabelText(/unread/)).toBeNull();
  });

  it('tapping the card opens the chat thread', async () => {
    const onOpenChat = jest.fn();
    const screen = await render(<PersonScreen {...baseProps} onOpenChat={onOpenChat} chatUnreadCount={2} />);
    await fireEvent.press(screen.getByLabelText('Lilica Chat, 2 unread'));
    expect(onOpenChat).toHaveBeenCalledTimes(1);
  });
});

describe('Phase 23 slice 2: "Message privately" wired from the Care circle member popup', () => {
  it('tapping "Message privately" for a real member calls onOpenDirectChat with that member', async () => {
    const onOpenDirectChat = jest.fn();
    const members: CareCircleMember[] = [
      { membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: ['general'] },
      { membershipId: 'm-2', displayName: 'Sarah', role: 'contributor', relationshipType: 'Other relative', isSelf: false, grantedDomains: ['general'] },
    ];
    const screen = await render(<PersonScreen {...baseProps} careCircleMembers={members} onOpenDirectChat={onOpenDirectChat} />);
    await fireEvent.press(screen.getByLabelText('View details for Sarah'));
    await fireEvent.press(screen.getByLabelText('Message Sarah privately'));
    expect(onOpenDirectChat).toHaveBeenCalledWith(members[1]);
  });

  it('is not offered at all for a local-only care space (onOpenDirectChat omitted)', async () => {
    const members: CareCircleMember[] = [
      { membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: ['general'] },
      { membershipId: 'm-2', displayName: 'Sarah', role: 'contributor', relationshipType: 'Other relative', isSelf: false, grantedDomains: ['general'] },
    ];
    const screen = await render(<PersonScreen {...baseProps} careCircleMembers={members} />);
    await fireEvent.press(screen.getByLabelText('View details for Sarah'));
    expect(screen.queryByLabelText('Message Sarah privately')).toBeNull();
  });

  // Direct product-owner decision (23 September 2026): the avatar-row
  // "Chat" link (added 22 September) was removed as redundant -- the
  // popup's "Message" button is the one and only way to DM from an
  // avatar. Regression guard against it quietly coming back.
  it('never shows a direct "Chat" link beneath an avatar -- the popup\'s Message button is the only avatar-DM entry point', async () => {
    const members: CareCircleMember[] = [
      { membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: ['general'] },
      { membershipId: 'm-2', displayName: 'Sarah', role: 'contributor', relationshipType: 'Other relative', isSelf: false, grantedDomains: ['general'] },
    ];
    const screen = await render(<PersonScreen {...baseProps} careCircleMembers={members} onOpenDirectChat={jest.fn()} />);
    expect(screen.queryByLabelText('Chat with Sarah')).toBeNull();
  });
});

describe('Corrective task 10, section 4: Ask Lilica moved from Home to People', () => {
  it('People shows the Ask Lilica placeholder', async () => {
    const screen = await render(<PersonScreen {...baseProps} />);
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
    const screen = await render(<PersonScreen {...baseProps} isSelf displayName="David" />);
    // "You" also labels the always-present Care circle row, so assert via
    // getAllByText rather than a single unique match.
    expect(screen.getAllByText('You').length).toBeGreaterThan(0);
    expect(screen.queryByText('David')).toBeNull();
  });
});

describe('Corrective task 10: care-space isolation', () => {
  it('switching to a different care space shows only that space\'s real care circle members', async () => {
    const maggieMembers: CareCircleMember[] = [
      { membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: ['general'] },
      { membershipId: 'm-2', displayName: 'Sarah', role: 'contributor', relationshipType: 'Other relative', isSelf: false, grantedDomains: ['general'] },
    ];
    const jackieMembers: CareCircleMember[] = [
      { membershipId: 'm-3', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: ['general'] },
    ];
    const screen = await render(<PersonScreen {...baseProps} careCircleMembers={maggieMembers} />);
    screen.getByText('Sarah');
    await screen.rerender(<PersonScreen {...baseProps} displayName="Jackie" careCircleMembers={jackieMembers} />);
    expect(screen.queryByText('Sarah')).toBeNull();
    screen.getByText('Jackie');
  });
});

describe('People-screen final implementation: Care Circle preview is bounded', () => {
  const eightMembers: CareCircleMember[] = Array.from({ length: 8 }, (_, index) => ({
    membershipId: `m-${index + 1}`,
    displayName: `Member ${index + 1}`,
    role: 'contributor' as const,
    relationshipType: 'Other relative' as const,
    isSelf: index === 0,
    grantedDomains: ['general'] as const,
  }));

  it('shows at most three named members plus a real "+N More" tile', async () => {
    const screen = await render(<PersonScreen {...baseProps} careCircleMembers={eightMembers} />);
    screen.getByText('You');
    screen.getByText('Member 2');
    screen.getByText('Member 3');
    expect(screen.queryByText('Member 4')).toBeNull();
    screen.getByText('+5');
    screen.getByText('More');
  });

  it('shows exactly the members available when there are three or fewer, with no "+N More" tile', async () => {
    const twoMembers: CareCircleMember[] = [
      { membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: ['general'] },
      { membershipId: 'm-2', displayName: 'Sarah', role: 'viewer', relationshipType: 'Other relative', isSelf: false, grantedDomains: ['general'] },
    ];
    const screen = await render(<PersonScreen {...baseProps} careCircleMembers={twoMembers} />);
    screen.getByText('You');
    screen.getByText('Sarah');
    expect(screen.queryByText(/More/)).toBeNull();
  });

  it('offers exactly ONE management action ("Manage"), never a separate Invite action', async () => {
    const onOpenCareCircle = jest.fn();
    const screen = await render(<PersonScreen {...baseProps} careCircleMembers={eightMembers} onOpenCareCircle={onOpenCareCircle} />);
    screen.getByText('Manage');
    expect(screen.queryByText(/Invite/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Manage Care Circle'));
    expect(onOpenCareCircle).toHaveBeenCalledTimes(1);
  });

  it('tapping a member avatar softly pops out their real details, using real data only -- never their relationship to the supported person (14 September 2026 product-owner report: reads like it describes the supported person, not the viewer)', async () => {
    const members: CareCircleMember[] = [
      { membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: ['general'] },
      { membershipId: 'm-2', displayName: 'Sarah', role: 'viewer', relationshipType: 'Other relative', relationshipLabel: 'Aunt', isSelf: false, grantedDomains: ['general', 'health'] },
    ];
    const screen = await render(<PersonScreen {...baseProps} careCircleMembers={members} />);
    await fireEvent.press(screen.getByLabelText('View details for Sarah'));
    expect(screen.queryByText('Aunt')).toBeNull();
    expect(screen.getAllByText('Viewer').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByLabelText('Close member details'));
  });

  // Reported gap: a user set a real profile picture in Account, but
  // their own "You" avatar in the Care circle preview kept showing the
  // initial letter -- CareCircleMember has no avatarPath of its own, so
  // nothing ever resolved it. Now the caller's own avatarPath is
  // resolved and shown for their own tile/popup only.
  it('shows the real profile photo for "You" once selfAvatarPath is set, elsewhere still the initial', async () => {
    mockResolveAvatarUrl.mockResolvedValue('https://signed.example/avatar.jpg');
    const members: CareCircleMember[] = [
      { membershipId: 'm-1', displayName: 'David', role: 'organiser', relationshipType: 'Myself', isSelf: true, grantedDomains: ['general'] },
      { membershipId: 'm-2', displayName: 'Sarah', role: 'viewer', relationshipType: 'Other relative', isSelf: false, grantedDomains: ['general'] },
    ];
    const screen = await render(<PersonScreen {...baseProps} careCircleMembers={members} selfAvatarPath="user-1/avatar.jpg" />);
    expect(mockResolveAvatarUrl).toHaveBeenCalledWith('user-1/avatar.jpg');
    await waitFor(() => screen.getByLabelText('View details for You'));
    // "You"'s initial letter is replaced by the real photo -- "S" for
    // Sarah (who has no avatar available) still shows as before.
    expect(screen.queryByText('D')).toBeNull();
    screen.getByText('S');
  });
});
