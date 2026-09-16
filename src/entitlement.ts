// Phase 21B: client boundary for commercial entitlement
// (supabase/migrations/20260914090000_phase21b_billing_entitlement.sql).
// The server remains authoritative for every mutation -- nothing here is
// ever trusted as the actual gate; this module only ever (a) reads the
// server's own current state for display purposes, (b) caches the last
// server-verified result for a bounded offline grace window so the app
// remains usable in a lift/on a flight, and (c) formats calm, truthful
// copy from that state. See docs/PHASE_21_ARCHITECTURE.md.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './auth/client';
import { friendlyAuthError } from './auth/errors';

export type EntitlementStatus =
  | 'TRIAL_ACTIVE'
  | 'TRIAL_EXPIRED'
  | 'SUBSCRIPTION_ACTIVE'
  | 'GRACE_PERIOD'
  | 'BILLING_RETRY'
  | 'SUBSCRIPTION_EXPIRED'
  | 'REVOKED'
  | 'UNKNOWN';

export type MyEntitlement = {
  status: EntitlementStatus;
  trialStartedAt: string;
  trialExpiresAt: string;
  provider?: string;
  entitlementExpiresAt?: string;
  lastVerifiedAt?: string;
};

export type CareSpaceCommercialStatus = {
  isActive: boolean;
  isCommercialOwner: boolean;
};

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const ACTIVE_STATUSES: EntitlementStatus[] = ['SUBSCRIPTION_ACTIVE', 'GRACE_PERIOD'];

// Mirrors public.user_has_active_entitlement()'s own logic exactly, for
// DISPLAY purposes only (e.g. "you can still manage care" copy shown
// while offline from a cached value) -- never used to decide whether a
// mutation is actually attempted; the server always re-checks for real.
export function isEntitlementActiveNow(entitlement: Pick<MyEntitlement, 'status' | 'trialExpiresAt'>, now = new Date()): boolean {
  if (ACTIVE_STATUSES.includes(entitlement.status)) return true;
  if (entitlement.status === 'TRIAL_ACTIVE') return new Date(entitlement.trialExpiresAt).getTime() > now.getTime();
  return false;
}

export function daysRemaining(expiresAtIso: string, now = new Date()): number {
  const ms = new Date(expiresAtIso).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

// Calm, truthful, non-alarmist copy (brief sections 24/25/26) -- never a
// countdown badge, never fake urgency. Used by the Subscription Settings
// surface and by the one restrained explanation shown when a gated
// mutation is actually attempted.
export function describeEntitlement(entitlement: MyEntitlement, now = new Date()): string {
  switch (entitlement.status) {
    case 'TRIAL_ACTIVE': {
      const days = daysRemaining(entitlement.trialExpiresAt, now);
      return days === 1 ? '1 day left in your free period' : `${days} days left in your free period`;
    }
    case 'TRIAL_EXPIRED':
      return 'Your free period has ended. Everything you’ve added is still here. Subscribe annually to continue adding and managing care.';
    case 'SUBSCRIPTION_ACTIVE':
      return entitlement.entitlementExpiresAt
        ? `Lilica Annual · renews ${new Date(entitlement.entitlementExpiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
        : 'Lilica Annual · Active';
    case 'GRACE_PERIOD':
      return 'There was a problem with your last payment - we’ll try again shortly. You can keep using Lilica in the meantime.';
    case 'BILLING_RETRY':
      return 'We couldn’t confirm your subscription. Please check your payment method.';
    case 'SUBSCRIPTION_EXPIRED':
      return 'Your subscription has ended. Everything you’ve added is still here. Subscribe annually to continue.';
    case 'REVOKED':
      return 'Your subscription is no longer active. Everything you’ve added is still here.';
    default:
      return 'Reconnect to confirm your subscription.';
  }
}

export async function getMyEntitlement(): Promise<Result<MyEntitlement | undefined>> {
  const { data, error } = await supabase.from('entitlements').select('*').maybeSingle();
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  if (!data) return { ok: true, data: undefined };
  const row = data as {
    status: EntitlementStatus;
    trial_started_at: string;
    trial_expires_at: string;
    provider: string | null;
    entitlement_expires_at: string | null;
    last_verified_at: string | null;
  };
  return {
    ok: true,
    data: {
      status: row.status,
      trialStartedAt: row.trial_started_at,
      trialExpiresAt: row.trial_expires_at,
      provider: row.provider ?? undefined,
      entitlementExpiresAt: row.entitlement_expires_at ?? undefined,
      lastVerifiedAt: row.last_verified_at ?? undefined,
    },
  };
}

// Brief section 41's own explicit minimal-disclosure requirement: a
// collaborator learns only whether the SPECIFIC care space is actively
// manageable right now, and whether they themselves are its commercial
// owner -- never another account's entitlement detail.
export async function getCareSpaceCommercialStatus(careSpaceId: string): Promise<Result<CareSpaceCommercialStatus | undefined>> {
  const { data, error } = await supabase.rpc('get_care_space_commercial_status', { target_care_space_id: careSpaceId });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  const rows = (data ?? []) as Array<{ is_active: boolean; is_commercial_owner: boolean }>;
  if (rows.length === 0) return { ok: true, data: undefined };
  return { ok: true, data: { isActive: rows[0].is_active, isCommercialOwner: rows[0].is_commercial_owner } };
}

export async function transferCommercialOwnership(careSpaceId: string, newOwnerMembershipId: string): Promise<Result<void>> {
  const { error } = await supabase.rpc('transfer_care_space_commercial_ownership', {
    target_care_space_id: careSpaceId,
    new_owner_membership_id: newOwnerMembershipId,
  });
  if (error) return { ok: false, message: friendlyAuthError(error, 'profile') };
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------
// Offline grace cache (brief section 16/18 of the Phase 21A proposal):
// the last server-verified commercial status for the active care space,
// with a bounded 72-hour window. Purely advisory -- read only to decide
// whether to show a proactive "subscribe to continue" prompt before even
// attempting a mutation while offline; the server is always the actual
// authority once a request can reach it.
// ---------------------------------------------------------------------

const OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000;
const CACHE_KEY_PREFIX = 'lilica:commercial-status-cache:v1:';

type CachedCommercialStatus = CareSpaceCommercialStatus & { verifiedAt: string };

function cacheKey(ownerId: string, careSpaceId: string): string {
  return `${CACHE_KEY_PREFIX}${ownerId}:${careSpaceId}`;
}

export async function cacheCommercialStatus(ownerId: string, careSpaceId: string, status: CareSpaceCommercialStatus): Promise<void> {
  const record: CachedCommercialStatus = { ...status, verifiedAt: new Date().toISOString() };
  await AsyncStorage.setItem(cacheKey(ownerId, careSpaceId), JSON.stringify(record));
}

export type CachedCommercialStatusResult =
  | { state: 'fresh' | 'stale'; status: CareSpaceCommercialStatus; verifiedAt: string }
  | { state: 'none' };

export async function readCachedCommercialStatus(ownerId: string, careSpaceId: string, now = new Date()): Promise<CachedCommercialStatusResult> {
  const raw = await AsyncStorage.getItem(cacheKey(ownerId, careSpaceId));
  if (!raw) return { state: 'none' };
  try {
    const parsed = JSON.parse(raw) as CachedCommercialStatus;
    const ageMs = now.getTime() - new Date(parsed.verifiedAt).getTime();
    return {
      state: ageMs <= OFFLINE_GRACE_MS ? 'fresh' : 'stale',
      status: { isActive: parsed.isActive, isCommercialOwner: parsed.isCommercialOwner },
      verifiedAt: parsed.verifiedAt,
    };
  } catch {
    return { state: 'none' };
  }
}

// Reused by src/localData.ts's clearLocalDataForOwner() -- this cache is
// per-owner local state like every other cache in this app, and must be
// removed on the same "clear this device"/post-account-deletion cleanup
// path, not left behind as an orphaned key.
export async function clearCommercialStatusCacheForOwner(ownerId: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const ownerKeys = keys.filter((key) => key.startsWith(`${CACHE_KEY_PREFIX}${ownerId}:`));
  if (ownerKeys.length > 0) await AsyncStorage.multiRemove(ownerKeys);
}
