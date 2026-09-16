// Phase 21B: unit coverage for the RevenueCat webhook's pure logic
// (supabase/functions/entitlement-webhook/mapping.ts). The Edge Function
// itself (index.ts) has not been deployed or exercised end-to-end in this
// environment -- no live RevenueCat project/webhook exists yet -- but its
// event-mapping and signature-verification logic is fully testable and
// tested here, since neither uses a Deno-only API.

import { mapEvent, RevenueCatEvent, verifySignature } from '../supabase/functions/entitlement-webhook/mapping';

function event(overrides: Partial<RevenueCatEvent>): RevenueCatEvent {
  return { id: 'evt-1', type: 'INITIAL_PURCHASE', app_user_id: 'user-1', ...overrides };
}

describe('mapEvent', () => {
  it('maps INITIAL_PURCHASE to SUBSCRIPTION_ACTIVE / purchase_verified', () => {
    expect(mapEvent(event({ type: 'INITIAL_PURCHASE' }))).toEqual({ status: 'SUBSCRIPTION_ACTIVE', eventType: 'purchase_verified' });
  });

  it('maps RENEWAL and other continuing-subscription events to SUBSCRIPTION_ACTIVE / renewed', () => {
    for (const type of ['RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE', 'SUBSCRIPTION_EXTENDED', 'REFUND_REVERSED', 'TRANSFER']) {
      expect(mapEvent(event({ type }))).toEqual({ status: 'SUBSCRIPTION_ACTIVE', eventType: 'renewed' });
    }
  });

  it('maps a BILLING_ISSUE with an active provider grace window to GRACE_PERIOD, never derived client-side', () => {
    expect(mapEvent(event({ type: 'BILLING_ISSUE', grace_period_expiration_at_ms: Date.now() + 86_400_000 })))
      .toEqual({ status: 'GRACE_PERIOD', eventType: 'grace_period_entered' });
  });

  it('maps a BILLING_ISSUE with no grace window to BILLING_RETRY', () => {
    expect(mapEvent(event({ type: 'BILLING_ISSUE' }))).toEqual({ status: 'BILLING_RETRY', eventType: 'grace_period_entered' });
  });

  it('maps EXPIRATION to SUBSCRIPTION_EXPIRED / expired', () => {
    expect(mapEvent(event({ type: 'EXPIRATION' }))).toEqual({ status: 'SUBSCRIPTION_EXPIRED', eventType: 'expired' });
  });

  it('CANCELLATION alone does not change status yet -- access ends at the later EXPIRATION, not the cancellation itself', () => {
    expect(mapEvent(event({ type: 'CANCELLATION' }))).toBeUndefined();
  });

  it('an event type this integration does not act on is acknowledged (undefined), not an error', () => {
    expect(mapEvent(event({ type: 'TEST' }))).toBeUndefined();
    expect(mapEvent(event({ type: 'SUBSCRIBER_ALIAS' }))).toBeUndefined();
    expect(mapEvent(event({ type: 'EXPERIMENT_ENROLLMENT' }))).toBeUndefined();
  });
});

describe('verifySignature', () => {
  const secret = 'test-webhook-secret';
  const body = '{"api_version":"1.0","event":{"id":"evt-1","type":"INITIAL_PURCHASE","app_user_id":"user-1"}}';
  const timestamp = 1_789_166_400;
  const nowMs = timestamp * 1000;

  async function sign(payload: string, key: string): Promise<string> {
    const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const bytes = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function header(payload = body, key = secret, signedAt = timestamp): Promise<string> {
    return `t=${signedAt},v1=${await sign(`${signedAt}.${payload}`, key)}`;
  }

  it('accepts RevenueCat\'s timestamped, correctly-signed header', async () => {
    expect(await verifySignature(body, await header(), secret, nowMs)).toBe(true);
  });

  it('rejects a missing signature header outright', async () => {
    expect(await verifySignature(body, null, secret, nowMs)).toBe(false);
  });

  it('rejects a signature computed with the wrong secret', async () => {
    expect(await verifySignature(body, await header(body, 'wrong-secret'), secret, nowMs)).toBe(false);
  });

  it('rejects a signature that does not match a tampered body', async () => {
    const signature = await header();
    const tamperedBody = body.replace('user-1', 'user-2');
    expect(await verifySignature(tamperedBody, signature, secret, nowMs)).toBe(false);
  });

  it('rejects a well-formed but incorrect signature of the same length', async () => {
    const real = await sign(`${timestamp}.${body}`, secret);
    const wrong = real.slice(0, -2) + (real.slice(-2) === '00' ? '11' : '00');
    expect(await verifySignature(body, `t=${timestamp},v1=${wrong}`, secret, nowMs)).toBe(false);
  });

  it('rejects a valid signature with a stale timestamp to prevent replay', async () => {
    const staleTimestamp = timestamp - 301;
    expect(await verifySignature(body, await header(body, secret, staleTimestamp), secret, nowMs)).toBe(false);
  });

  it('rejects legacy bare signatures and malformed headers', async () => {
    expect(await verifySignature(body, await sign(body, secret), secret, nowMs)).toBe(false);
    expect(await verifySignature(body, 't=not-a-time,v1=abc', secret, nowMs)).toBe(false);
  });
});
