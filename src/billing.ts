// Phase 21B: the RevenueCat client boundary. Wraps react-native-purchases
// (verified compatible: current SDK 10.9.1, peer requirement react-native
// >= 0.73.0 -- Lilica is on 0.86 -- checked against the package's own
// published peerDependencies before installing, not guessed). RevenueCat
// drives the native StoreKit 2 / Google Play Billing purchase sheet and
// performs authoritative store-side verification; this module never
// itself decides entitlement -- it only ever (a) identifies the current
// Lilica account to RevenueCat using a stable auth.uid()-derived id, never
// an email address, and (b) surfaces purchase/restore results back to the
// caller, who re-fetches the SERVER's own entitlements row afterward
// (src/entitlement.ts) rather than trusting this module's own return
// value as authoritative.
//
// IMPORTANT LIMITATION, stated plainly rather than glossed over: purchases
// do not work in Expo Go (RevenueCat's own documentation is explicit about
// this -- it lacks the native APIs the SDK requires). None of the
// functions below can be exercised end-to-end in this environment; they
// are written against the SDK's own current published API surface and
// typecheck correctly, but the actual purchase/restore/webhook round trip
// requires a development build, sandbox App Store Connect/Google Play
// Console products, and a real RevenueCat project -- none of which exist
// yet. See docs/PHASE_21_ARCHITECTURE.md's "External configuration still
// required" section for the exact list of what the product owner must set
// up outside this repository before this can be physically tested.

import Purchases, { CustomerInfo, PACKAGE_TYPE, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

// The one logical entitlement RevenueCat is configured with (brief
// section 17) -- must match the entitlement identifier configured in the
// RevenueCat dashboard exactly. Documented, not guessed: see
// docs/PHASE_21_ARCHITECTURE.md's RevenueCat configuration section.
export const REVENUECAT_ENTITLEMENT_ID = 'lilica_active';

// API keys are per-platform and per-RevenueCat-project -- genuinely
// external configuration, never hardcoded here. Read from Expo public env
// vars (EXPO_PUBLIC_* is the established convention this project already
// uses for the Supabase URL/key -- see .env.local) so a missing key fails
// loudly (isBillingConfigured() below) rather than silently using a fake
// value. Read lazily (a function, not a module-load-time constant) so
// this always reflects the current environment rather than whatever was
// present at the moment this module first happened to be imported.
function currentApiKey(): string | undefined {
  return Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
}

let configuredForUserId: string | undefined;

export function isBillingConfigured(): boolean {
  return Boolean(currentApiKey());
}

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

function friendlyBillingError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/network/i.test(message)) return 'Could not reach the App Store/Google Play just now. Check your connection and try again.';
  if (/cancel/i.test(message)) return 'Purchase cancelled.';
  return 'Something went wrong with the purchase. Please try again.';
}

// Called once the Lilica account is known (after sign-in) -- identifies
// this device's RevenueCat session with Lilica's own stable auth.uid(),
// never an email address (brief section 27/19), so a purchase can never
// attach to the wrong Lilica account. Configuring twice for the SAME user
// is a safe no-op; switching to a DIFFERENT user without an intervening
// logOutBilling() would be a real identity-leakage bug, so callers must
// always log out first (see App.tsx's own sign-out path).
export async function configureBilling(userId: string): Promise<Result<void>> {
  const apiKey = currentApiKey();
  if (!apiKey) return { ok: false, message: 'Subscriptions are not configured yet in this build.' };
  if (configuredForUserId === userId) return { ok: true, data: undefined };
  try {
    Purchases.configure({ apiKey, appUserID: userId });
    configuredForUserId = userId;
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, message: friendlyBillingError(error) };
  }
}

// Must be called on sign-out, before a different account might configure
// billing on the same device -- otherwise a second Lilica account signing
// in afterward could inherit the first account's cached RevenueCat
// identity/entitlement (brief section 19's explicit account-switching
// requirement).
export async function logOutBilling(): Promise<void> {
  if (!configuredForUserId) return;
  try {
    await Purchases.logOut();
  } catch {
    // Already logged out, or never truly configured -- not an error the
    // sign-out flow should ever fail on.
  } finally {
    configuredForUserId = undefined;
  }
}

export async function getAnnualPackage(): Promise<Result<PurchasesPackage | undefined>> {
  if (!isBillingConfigured()) return { ok: false, message: 'Subscriptions are not configured yet in this build.' };
  try {
    const offerings = await Purchases.getOfferings();
    const current: PurchasesOffering | null = offerings.current;
    const annual = current?.availablePackages.find((pkg) => pkg.packageType === PACKAGE_TYPE.ANNUAL) ?? current?.availablePackages[0];
    return { ok: true, data: annual };
  } catch (error) {
    return { ok: false, message: friendlyBillingError(error) };
  }
}

export async function purchaseAnnualSubscription(pkg: PurchasesPackage): Promise<Result<CustomerInfo>> {
  try {
    const result = await Purchases.purchasePackage(pkg);
    return { ok: true, data: result.customerInfo };
  } catch (error) {
    return { ok: false, message: friendlyBillingError(error) };
  }
}

export async function restorePurchases(): Promise<Result<CustomerInfo>> {
  if (!isBillingConfigured()) return { ok: false, message: 'Subscriptions are not configured yet in this build.' };
  try {
    const info = await Purchases.restorePurchases();
    return { ok: true, data: info };
  } catch (error) {
    return { ok: false, message: friendlyBillingError(error) };
  }
}

// A quick, purely-local (no extra network call) read of the entitlement
// RevenueCat itself already believes is active -- used only for an
// OPTIMISTIC "activating your subscription…" transition immediately after
// a purchase, never as the authoritative answer. The real answer always
// comes from re-fetching the server's own entitlements row (src/entitlement.ts's
// getMyEntitlement()) once the webhook has landed.
export function hasLocalActiveEntitlement(customerInfo: CustomerInfo): boolean {
  return Boolean(customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_ID]);
}
