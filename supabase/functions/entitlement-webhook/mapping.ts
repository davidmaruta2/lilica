// Phase 21B: the pure, runtime-agnostic parts of the RevenueCat webhook
// handler -- deliberately split out from index.ts (which uses Deno-only
// globals: Deno.serve, Deno.env, and the esm.sh Supabase client import)
// so this logic can be unit-tested under Jest/Node directly, exactly like
// every other pure logic module in this codebase (src/records.ts,
// src/reminders.ts, etc.), rather than left untested because its caller
// happens to run on Deno. Imported by index.ts via a relative `./mapping.ts`
// specifier (Deno requires the explicit extension); the same file is
// imported extension-less from tests/phase21b-webhook-mapping.test.ts,
// which is how Jest's own module resolution already works for every other
// TypeScript file in this project.

export type RevenueCatEvent = {
  id: string;
  type: string;
  app_user_id: string;
  expiration_at_ms?: number;
  grace_period_expiration_at_ms?: number;
  cancel_reason?: string;
  expiration_reason?: string;
  store?: string;
};

export type EntitlementStatus =
  | 'TRIAL_ACTIVE' | 'TRIAL_EXPIRED' | 'SUBSCRIPTION_ACTIVE' | 'GRACE_PERIOD'
  | 'BILLING_RETRY' | 'SUBSCRIPTION_EXPIRED' | 'REVOKED' | 'UNKNOWN';

// Maps a RevenueCat event (field names/event types taken directly from
// RevenueCat's own current "Event Types and Fields" documentation,
// consulted while writing this) to the entitlement status it implies and
// the entitlement_events.event_type it should be logged as. Returns
// undefined for an event this integration deliberately does not act on.
export function mapEvent(event: RevenueCatEvent): { status: EntitlementStatus; eventType: string } | undefined {
  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
    case 'SUBSCRIPTION_EXTENDED':
    case 'REFUND_REVERSED':
    case 'TRANSFER':
      return { status: 'SUBSCRIPTION_ACTIVE', eventType: event.type === 'INITIAL_PURCHASE' ? 'purchase_verified' : 'renewed' };
    case 'BILLING_ISSUE':
      // grace_period_expiration_at_ms present means the store itself is
      // still within its own grace window (brief section 32: respect
      // provider-verified grace, never derive it client-side).
      return { status: event.grace_period_expiration_at_ms ? 'GRACE_PERIOD' : 'BILLING_RETRY', eventType: 'grace_period_entered' };
    case 'CANCELLATION':
      // Stops future auto-renewal but does NOT immediately end the
      // current paid period (brief section 31) -- the actual access
      // change happens at EXPIRATION below.
      return undefined;
    case 'EXPIRATION':
      return { status: 'SUBSCRIPTION_EXPIRED', eventType: 'expired' };
    default:
      return undefined;
  }
}

// RevenueCat signs `<unix timestamp>.<raw request body>` and sends the
// timestamp/signature pair as `t=...,v1=...`. The timestamp check prevents
// a captured, valid delivery from being replayed outside a short clock-skew
// window; provider event IDs remain the separate idempotency boundary.
export async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!signatureHeader) return false;
  const fields = signatureHeader.split(',').map((field) => field.trim());
  const timestampText = fields.find((field) => field.startsWith('t='))?.slice(2);
  const signatures = fields.filter((field) => field.startsWith('v1=')).map((field) => field.slice(3));
  if (!timestampText || signatures.length === 0 || !/^\d+$/.test(timestampText)) return false;
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Math.floor(nowMs / 1000) - timestamp) > 300) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestampText}.${rawBody}`));
  const computed = Array.from(new Uint8Array(signatureBytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return signatures.some((candidate) => {
    if (!/^[a-f0-9]+$/i.test(candidate) || computed.length !== candidate.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i += 1) diff |= computed.charCodeAt(i) ^ candidate.toLowerCase().charCodeAt(i);
    return diff === 0;
  });
}
