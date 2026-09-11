// Phase 15: client-side coverage for the care-circle boundary. The real
// authorisation/idempotency/assignment-visibility invariants are enforced
// server-side and covered by supabase/tests/database/phase15_care_circle.test.sql
// (pgTAP, run via `npm run validate:backend`) -- this file only proves the
// client wraps those RPCs correctly and that recordDomainForType() mirrors
// the server's record_domain_for_type() exactly.

import { recordDomainForType } from '../src/records';

const mockRpc = jest.fn();

jest.mock('../src/auth/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

import {
  acceptInvitation,
  changeMemberRole,
  declineInvitation,
  inviteMember,
  leaveCareSpace,
  listCareSpaceInvitations,
  listCareSpaceMembers,
  listMyInvitations,
  removeMember,
  revokeInvitation,
} from '../src/careCircle';

describe('Phase 15: recordDomainForType mirrors record_domain_for_type()', () => {
  it('maps every record type to the exact server-side domain', () => {
    expect(recordDomainForType('careNote')).toBe('health');
    expect(recordDomainForType('bill')).toBe('financial');
    expect(recordDomainForType('homeMatter')).toBe('home');
    expect(recordDomainForType('document')).toBe('documents');
    for (const type of ['appointment', 'task', 'contact', 'update'] as const) {
      expect(recordDomainForType(type)).toBe('general');
    }
  });
});

describe('Phase 15: care circle RPC wrappers', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('listCareSpaceMembers maps snake_case rows to camelCase members', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          membership_id: 'm1',
          display_name: 'Cara',
          role: 'contributor',
          relationship_type: 'Other relative',
          relationship_label: 'Cousin',
          is_self: false,
          granted_domains: ['general', 'home'],
        },
      ],
      error: null,
    });
    const result = await listCareSpaceMembers('space-1');
    expect(mockRpc).toHaveBeenCalledWith('list_care_space_members', { target_care_space_id: 'space-1' });
    expect(result).toEqual({
      ok: true,
      data: [
        {
          membershipId: 'm1',
          displayName: 'Cara',
          role: 'contributor',
          relationshipType: 'Other relative',
          relationshipLabel: 'Cousin',
          isSelf: false,
          grantedDomains: ['general', 'home'],
        },
      ],
    });
  });

  it('surfaces a friendly error when the RPC fails, never throwing', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('permission denied') });
    const result = await listCareSpaceMembers('space-1');
    expect(result.ok).toBe(false);
  });

  it('inviteMember sends an explicit role and domain grant list -- never a default that widens access', async () => {
    mockRpc.mockResolvedValue({ data: {}, error: null });
    await inviteMember({
      careSpaceId: 'space-1',
      email: 'friend@example.test',
      role: 'viewer',
      grantedDomains: ['general'],
      relationshipType: 'Other relative',
      relationshipLabel: 'Neighbour',
    });
    expect(mockRpc).toHaveBeenCalledWith('invite_member', expect.objectContaining({
      target_care_space_id: 'space-1',
      invitee_email_input: 'friend@example.test',
      member_role: 'viewer',
      granted_domains: ['general'],
      member_relationship_type: 'Other relative',
      member_relationship_label: 'Neighbour',
    }));
  });

  it('acceptInvitation/declineInvitation/revokeInvitation call their own RPC only', async () => {
    mockRpc.mockResolvedValue({ data: 'membership-1', error: null });
    await acceptInvitation('inv-1');
    expect(mockRpc).toHaveBeenLastCalledWith('accept_invitation', expect.objectContaining({ target_invitation_id: 'inv-1' }));

    mockRpc.mockResolvedValue({ data: null, error: null });
    await declineInvitation('inv-1');
    expect(mockRpc).toHaveBeenLastCalledWith('decline_invitation', { target_invitation_id: 'inv-1' });

    await revokeInvitation('inv-1');
    expect(mockRpc).toHaveBeenLastCalledWith('revoke_invitation', { target_invitation_id: 'inv-1' });
  });

  it('changeMemberRole/removeMember/leaveCareSpace call their own RPC only', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await changeMemberRole({ membershipId: 'm1', role: 'viewer', grantedDomains: ['general'] });
    expect(mockRpc).toHaveBeenLastCalledWith('change_member_role', {
      target_membership_id: 'm1',
      new_role: 'viewer',
      new_granted_domains: ['general'],
    });

    await removeMember('m1');
    expect(mockRpc).toHaveBeenLastCalledWith('remove_member', { target_membership_id: 'm1' });

    await leaveCareSpace('space-1');
    expect(mockRpc).toHaveBeenLastCalledWith('leave_care_space', { target_care_space_id: 'space-1' });
  });

  it('listMyInvitations and listCareSpaceInvitations map their rows', async () => {
    mockRpc.mockResolvedValue({
      data: [{
        id: 'inv-1',
        care_space_id: 'space-1',
        care_space_name: 'Jackie',
        invited_by_display_name: 'Olu',
        role: 'contributor',
        relationship_type: 'Other relative',
        relationship_label: 'Cousin',
        granted_domains: ['general'],
        created_at: '2026-09-11T00:00:00.000Z',
        expires_at: '2026-09-25T00:00:00.000Z',
      }],
      error: null,
    });
    const mine = await listMyInvitations();
    expect(mine.ok && mine.data[0].careSpaceName).toBe('Jackie');

    mockRpc.mockResolvedValue({
      data: [{
        id: 'inv-1',
        invitee_email: 'friend@example.test',
        role: 'viewer',
        relationship_type: 'Someone else',
        relationship_label: 'Friend',
        granted_domains: [],
        status: 'pending',
        created_at: '2026-09-11T00:00:00.000Z',
        expires_at: '2026-09-25T00:00:00.000Z',
      }],
      error: null,
    });
    const forSpace = await listCareSpaceInvitations('space-1');
    expect(forSpace.ok && forSpace.data[0].inviteeEmail).toBe('friend@example.test');
  });
});

