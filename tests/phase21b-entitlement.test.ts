// Phase 21B: client-side coverage for src/entitlement.ts. The real
// authoritative enforcement lives server-side and is proven by
// supabase/tests/database/phase21b_entitlement.test.sql (pgTAP) -- this
// file proves the client's own display logic (day counts, calm copy) and
// its RPC/cache wrapping are correct, and that this module never invents
// an entitlement value beyond what the server or a recent cache returned.

const mockFrom = jest.fn();
const mockRpc = jest.fn();
jest.mock('../src/auth/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args), rpc: (...args: unknown[]) => mockRpc(...args) },
}));

// No explicit AsyncStorage mock needed -- jest-expo's own preset already
// provides a real in-memory implementation (see
// tests/phase18-document-cleanup-queue.test.ts's identical, established
// pattern), so the cache functions below are exercised against genuine
// get/set/remove behaviour, not a hand-rolled stand-in.
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  cacheCommercialStatus,
  clearCommercialStatusCacheForOwner,
  daysRemaining,
  describeEntitlement,
  getCareSpaceCommercialStatus,
  getMyEntitlement,
  isEntitlementActiveNow,
  MyEntitlement,
  readCachedCommercialStatus,
  transferCommercialOwnership,
} from '../src/entitlement';

beforeEach(async () => {
  mockFrom.mockReset();
  mockRpc.mockReset();
  await AsyncStorage.clear();
});

function entitlement(overrides: Partial<MyEntitlement>): MyEntitlement {
  return {
    status: 'TRIAL_ACTIVE',
    trialStartedAt: '2026-09-13T00:00:00.000Z',
    trialExpiresAt: '2026-11-12T00:00:00.000Z',
    ...overrides,
  };
}

describe('isEntitlementActiveNow', () => {
  it('is active for SUBSCRIPTION_ACTIVE and GRACE_PERIOD regardless of trial dates', () => {
    expect(isEntitlementActiveNow(entitlement({ status: 'SUBSCRIPTION_ACTIVE', trialExpiresAt: '2020-01-01T00:00:00.000Z' }))).toBe(true);
    expect(isEntitlementActiveNow(entitlement({ status: 'GRACE_PERIOD', trialExpiresAt: '2020-01-01T00:00:00.000Z' }))).toBe(true);
  });

  it('is active for TRIAL_ACTIVE only while trial_expires_at is still in the future', () => {
    const now = new Date('2026-10-01T00:00:00.000Z');
    expect(isEntitlementActiveNow(entitlement({ status: 'TRIAL_ACTIVE', trialExpiresAt: '2026-11-12T00:00:00.000Z' }), now)).toBe(true);
    expect(isEntitlementActiveNow(entitlement({ status: 'TRIAL_ACTIVE', trialExpiresAt: '2026-09-20T00:00:00.000Z' }), now)).toBe(false);
  });

  it('is never active for any other status', () => {
    for (const status of ['TRIAL_EXPIRED', 'BILLING_RETRY', 'SUBSCRIPTION_EXPIRED', 'REVOKED', 'UNKNOWN'] as const) {
      expect(isEntitlementActiveNow(entitlement({ status }))).toBe(false);
    }
  });
});

describe('daysRemaining', () => {
  it('computes whole days remaining, rounding up', () => {
    const now = new Date('2026-09-13T00:00:00.000Z');
    expect(daysRemaining('2026-09-14T00:00:00.000Z', now)).toBe(1);
    expect(daysRemaining('2026-09-14T01:00:00.000Z', now)).toBe(2);
  });

  it('never returns a negative number once expired', () => {
    const now = new Date('2026-09-20T00:00:00.000Z');
    expect(daysRemaining('2026-09-13T00:00:00.000Z', now)).toBe(0);
  });
});

describe('describeEntitlement', () => {
  const now = new Date('2026-09-13T00:00:00.000Z');

  it('describes a trial with days remaining, singular vs plural', () => {
    expect(describeEntitlement(entitlement({ status: 'TRIAL_ACTIVE', trialExpiresAt: '2026-09-14T00:00:00.000Z' }), now)).toBe('1 day left in your free period');
    expect(describeEntitlement(entitlement({ status: 'TRIAL_ACTIVE', trialExpiresAt: '2026-11-12T00:00:00.000Z' }), now)).toMatch(/^\d+ days left in your free period$/);
  });

  it('describes trial expiry calmly, without suggesting data was removed', () => {
    const copy = describeEntitlement(entitlement({ status: 'TRIAL_EXPIRED' }), now);
    expect(copy).toMatch(/still here/i);
    expect(copy).not.toMatch(/deleted|removed|lost/i);
  });

  it('never uses fake urgency or countdown-style wording', () => {
    const copy = describeEntitlement(entitlement({ status: 'TRIAL_ACTIVE', trialExpiresAt: '2026-09-14T00:00:00.000Z' }), now);
    expect(copy).not.toMatch(/hurry|last chance|act now|expiring soon!/i);
  });

  it('describes an active subscription with its real renewal date when known', () => {
    const copy = describeEntitlement(entitlement({ status: 'SUBSCRIPTION_ACTIVE', entitlementExpiresAt: '2027-09-13T00:00:00.000Z' }), now);
    expect(copy).toContain('£8.99/year');
    expect(copy).toContain('2027');
  });

  it('describes grace period without alarming the user', () => {
    const copy = describeEntitlement(entitlement({ status: 'GRACE_PERIOD' }), now);
    expect(copy).toMatch(/keep using lilica/i);
  });
});

describe('getMyEntitlement', () => {
  it('maps a row to camelCase fields', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        maybeSingle: async () => ({
          data: {
            status: 'TRIAL_ACTIVE', trial_started_at: '2026-09-13T00:00:00.000Z', trial_expires_at: '2026-11-12T00:00:00.000Z',
            provider: null, entitlement_expires_at: null, last_verified_at: null,
          },
          error: null,
        }),
      }),
    });
    const result = await getMyEntitlement();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      status: 'TRIAL_ACTIVE', trialStartedAt: '2026-09-13T00:00:00.000Z', trialExpiresAt: '2026-11-12T00:00:00.000Z',
      provider: undefined, entitlementExpiresAt: undefined, lastVerifiedAt: undefined,
    });
  });

  it('returns undefined data (not an error) when no row exists yet', async () => {
    mockFrom.mockReturnValue({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) });
    const result = await getMyEntitlement();
    expect(result).toEqual({ ok: true, data: undefined });
  });
});

describe('getCareSpaceCommercialStatus', () => {
  it('maps the single-row RPC result', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ is_active: true, is_commercial_owner: false }], error: null });
    const result = await getCareSpaceCommercialStatus('space-1');
    expect(mockRpc).toHaveBeenCalledWith('get_care_space_commercial_status', { target_care_space_id: 'space-1' });
    expect(result).toEqual({ ok: true, data: { isActive: true, isCommercialOwner: false } });
  });

  it('returns undefined (never fabricates a value) when the caller is not a member -- an empty result', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const result = await getCareSpaceCommercialStatus('space-1');
    expect(result).toEqual({ ok: true, data: undefined });
  });
});

describe('transferCommercialOwnership', () => {
  it('calls the RPC with the right arguments', async () => {
    mockRpc.mockResolvedValueOnce({ error: null });
    const result = await transferCommercialOwnership('space-1', 'membership-2');
    expect(mockRpc).toHaveBeenCalledWith('transfer_care_space_commercial_ownership', {
      target_care_space_id: 'space-1', new_owner_membership_id: 'membership-2',
    });
    expect(result.ok).toBe(true);
  });
});

describe('offline-grace commercial-status cache', () => {
  it('reports "none" before anything has ever been cached', async () => {
    expect(await readCachedCommercialStatus('owner-1', 'space-1')).toEqual({ state: 'none' });
  });

  it('reports "fresh" within the 72-hour grace window', async () => {
    const verifiedAt = new Date('2026-09-13T00:00:00.000Z');
    await cacheCommercialStatus('owner-1', 'space-1', { isActive: true, isCommercialOwner: true });
    const soonAfter = new Date(verifiedAt.getTime() + 60 * 60 * 1000); // +1 hour
    const result = await readCachedCommercialStatus('owner-1', 'space-1', soonAfter);
    expect(result.state).toBe('fresh');
  });

  it('reports "stale" once the 72-hour grace window has passed', async () => {
    await cacheCommercialStatus('owner-1', 'space-1', { isActive: true, isCommercialOwner: true });
    const muchLater = new Date(Date.now() + 73 * 60 * 60 * 1000);
    const result = await readCachedCommercialStatus('owner-1', 'space-1', muchLater);
    expect(result.state).toBe('stale');
  });

  it('is scoped per care space and per owner -- never leaks one care space status into another read', async () => {
    await cacheCommercialStatus('owner-1', 'space-1', { isActive: true, isCommercialOwner: true });
    expect(await readCachedCommercialStatus('owner-1', 'space-2')).toEqual({ state: 'none' });
    expect(await readCachedCommercialStatus('owner-2', 'space-1')).toEqual({ state: 'none' });
  });

  it('clearCommercialStatusCacheForOwner removes only that owner\'s own cached rows', async () => {
    await cacheCommercialStatus('owner-1', 'space-1', { isActive: true, isCommercialOwner: true });
    await cacheCommercialStatus('owner-2', 'space-1', { isActive: false, isCommercialOwner: false });
    await clearCommercialStatusCacheForOwner('owner-1');
    expect(await readCachedCommercialStatus('owner-1', 'space-1')).toEqual({ state: 'none' });
    expect((await readCachedCommercialStatus('owner-2', 'space-1')).state).not.toBe('none');
  });
});
