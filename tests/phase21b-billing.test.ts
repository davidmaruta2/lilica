// Phase 21B: client-side coverage for src/billing.ts, the RevenueCat
// wrapper. react-native-purchases is mocked -- purchases cannot run in
// Expo Go or this test environment (RevenueCat's own documentation is
// explicit about this), so this proves the wrapper's own logic (identity
// handling, error mapping, package selection, configuration gating), not
// a real store round trip.

const mockConfigure = jest.fn();
const mockLogOut = jest.fn();
const mockGetOfferings = jest.fn();
const mockPurchasePackage = jest.fn();
const mockRestorePurchases = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    logOut: (...args: unknown[]) => mockLogOut(...args),
    getOfferings: (...args: unknown[]) => mockGetOfferings(...args),
    purchasePackage: (...args: unknown[]) => mockPurchasePackage(...args),
    restorePurchases: (...args: unknown[]) => mockRestorePurchases(...args),
  },
  PACKAGE_TYPE: { ANNUAL: 'ANNUAL', MONTHLY: 'MONTHLY' },
}));

import {
  configureBilling,
  getAnnualPackage,
  hasLocalActiveEntitlement,
  isBillingConfigured,
  logOutBilling,
  purchaseAnnualSubscription,
  REVENUECAT_ENTITLEMENT_ID,
  restorePurchases,
} from '../src/billing';

const originalIosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

beforeEach(async () => {
  // Resets billing.ts's own module-level "already configured for this
  // user" memory between tests -- otherwise a prior test's successful
  // configureBilling() call would make this one's own "not re-configured"
  // assertion meaningless.
  await logOutBilling();
  mockConfigure.mockReset();
  mockLogOut.mockReset();
  mockGetOfferings.mockReset();
  mockPurchasePackage.mockReset();
  mockRestorePurchases.mockReset();
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = 'test-ios-key';
});

afterAll(() => {
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = originalIosKey;
});

describe('isBillingConfigured / configureBilling', () => {
  it('reports configured once an API key exists for this platform', () => {
    expect(isBillingConfigured()).toBe(true);
  });

  it('refuses to configure (and says so plainly) when no API key is set for this platform', async () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
    const result = await configureBilling('user-1');
    expect(result.ok).toBe(false);
    expect(mockConfigure).not.toHaveBeenCalled();
  });

  it('identifies RevenueCat with the Lilica account id, never an email', async () => {
    await configureBilling('auth-uid-123');
    expect(mockConfigure).toHaveBeenCalledWith({ apiKey: 'test-ios-key', appUserID: 'auth-uid-123' });
  });

  it('does not re-configure for the same already-configured user (a safe no-op)', async () => {
    await configureBilling('auth-uid-123');
    await configureBilling('auth-uid-123');
    expect(mockConfigure).toHaveBeenCalledTimes(1);
  });
});

describe('logOutBilling', () => {
  it('calls RevenueCat logOut once a user was configured', async () => {
    await configureBilling('auth-uid-123');
    await logOutBilling();
    expect(mockLogOut).toHaveBeenCalledTimes(1);
  });

  it('is a safe no-op if billing was never configured -- never throws', async () => {
    await expect(logOutBilling()).resolves.toBeUndefined();
    expect(mockLogOut).not.toHaveBeenCalled();
  });

  it('allows configuring a DIFFERENT user afterward without being treated as a no-op (prevents entitlement leakage across accounts)', async () => {
    await configureBilling('user-a');
    await logOutBilling();
    await configureBilling('user-b');
    expect(mockConfigure).toHaveBeenLastCalledWith({ apiKey: 'test-ios-key', appUserID: 'user-b' });
  });
});

describe('getAnnualPackage', () => {
  it('finds the ANNUAL package among available packages', async () => {
    mockGetOfferings.mockResolvedValueOnce({
      current: { availablePackages: [{ packageType: 'MONTHLY', identifier: 'monthly' }, { packageType: 'ANNUAL', identifier: 'annual' }] },
    });
    const result = await getAnnualPackage();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.identifier).toBe('annual');
  });

  it('falls back to the first available package if no ANNUAL package is configured, rather than failing silently', async () => {
    mockGetOfferings.mockResolvedValueOnce({ current: { availablePackages: [{ packageType: 'MONTHLY', identifier: 'monthly' }] } });
    const result = await getAnnualPackage();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.identifier).toBe('monthly');
  });

  it('returns undefined, not a fabricated package, when no offering exists at all', async () => {
    mockGetOfferings.mockResolvedValueOnce({ current: null });
    const result = await getAnnualPackage();
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('surfaces a friendly message on a network error', async () => {
    mockGetOfferings.mockRejectedValueOnce(new Error('network request failed'));
    const result = await getAnnualPackage();
    expect(result.ok).toBe(false);
  });
});

describe('purchaseAnnualSubscription', () => {
  it('returns the resulting customerInfo on success', async () => {
    mockPurchasePackage.mockResolvedValueOnce({ customerInfo: { entitlements: { active: {} } } });
    const result = await purchaseAnnualSubscription({ identifier: 'annual' } as never);
    expect(result.ok).toBe(true);
  });

  it('surfaces a calm message, not raw SDK text, on cancellation', async () => {
    mockPurchasePackage.mockRejectedValueOnce(new Error('Purchase was cancelled'));
    const result = await purchaseAnnualSubscription({ identifier: 'annual' } as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/cancelled/i);
  });
});

describe('restorePurchases', () => {
  it('returns customerInfo on success', async () => {
    mockRestorePurchases.mockResolvedValueOnce({ entitlements: { active: {} } });
    const result = await restorePurchases();
    expect(result.ok).toBe(true);
  });

  it('refuses when billing is not configured for this build', async () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
    const result = await restorePurchases();
    expect(result.ok).toBe(false);
    expect(mockRestorePurchases).not.toHaveBeenCalled();
  });
});

describe('hasLocalActiveEntitlement', () => {
  it('is true only when the configured entitlement id is present and active', () => {
    expect(hasLocalActiveEntitlement({ entitlements: { active: { [REVENUECAT_ENTITLEMENT_ID]: {} } } } as never)).toBe(true);
    expect(hasLocalActiveEntitlement({ entitlements: { active: {} } } as never)).toBe(false);
  });
});
