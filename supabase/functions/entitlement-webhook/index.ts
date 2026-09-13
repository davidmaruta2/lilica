// Phase 21B: the ONE server-side entry point for RevenueCat's own webhook
// (which itself aggregates Apple App Store Server Notifications V2 and
// Google Real-time Developer Notifications -- this function never parses
// either platform's native notification format directly, per
// docs/PHASE_21_ARCHITECTURE.md's recommendation to use a subscription-
// management service rather than two separate direct integrations).
//
// Field names and event types below are taken directly from RevenueCat's
// own current "Event Types and Fields" documentation
// (https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields),
// consulted while writing this file -- not guessed or remembered.
//
// IMPORTANT LIMITATION, stated plainly: this function has not been
// deployed or exercised against a real RevenueCat webhook delivery in
// this environment (no RevenueCat project/webhook exists yet -- see
// docs/PHASE_21_ARCHITECTURE.md's "External configuration still
// required" section). It is written against RevenueCat's own documented
// payload shape and signature mechanism, and its request-handling logic
// (signature check, idempotency, status mapping) has real unit-style
// coverage in tests/phase21b-webhook-mapping.test.ts for the pure parts
// that can be tested without a live Deno/Edge Functions runtime -- but
// the actual HTTP round trip is unverified end-to-end.
//
// Deploy with: npx supabase functions deploy entitlement-webhook --project-ref <lilica-development ref>
// Required secrets (set via `npx supabase secrets set`, never committed):
//   REVENUECAT_WEBHOOK_SECRET  -- the HMAC signing secret shown once when
//     webhook signing is enabled in the RevenueCat dashboard.
//   SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL -- already available to every
//     Edge Function automatically; used here to call apply_entitlement_update()
//     with service-role privileges (the only role that may call it -- see
//     the migration's own revoke-from-authenticated).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mapEvent, RevenueCatEvent, verifySignature } from './mapping.ts';

type RevenueCatWebhookPayload = {
  api_version: string;
  event: RevenueCatEvent;
};

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('entitlement-webhook: REVENUECAT_WEBHOOK_SECRET is not configured');
    return new Response('Not configured', { status: 500 });
  }

  const rawBody = await req.text();
  const signatureValid = await verifySignature(rawBody, req.headers.get('x-revenuecat-signature'), webhookSecret);
  if (!signatureValid) {
    // Never trusts an unsigned/wrongly-signed request -- brief section
    // 29's own webhook-spoofing threat, mitigated here.
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: RevenueCatWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = payload.event;
  if (!event?.app_user_id || !event.type || !event.id) {
    return new Response('Malformed event', { status: 400 });
  }

  const mapped = mapEvent(event);
  if (!mapped) {
    // Acknowledged, no entitlement change -- e.g. a CANCELLATION (see
    // mapEvent's own comment) or an event type this integration does not
    // act on.
    return new Response('ok', { status: 200 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('entitlement-webhook: Supabase service credentials are not available');
    return new Response('Not configured', { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // app_user_id is exactly the Lilica auth.uid() this device identified
  // RevenueCat with (see src/billing.ts's configureBilling()) -- never an
  // email address, never derived here.
  const { error } = await supabase.rpc('apply_entitlement_update', {
    target_user_id: event.app_user_id,
    new_status: mapped.status,
    new_provider: 'revenuecat',
    new_provider_app_user_id: event.app_user_id,
    new_entitlement_expires_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
    event_type: mapped.eventType,
    provider_event_id: event.id,
    event_metadata: { revenueCatEventType: event.type, store: event.store ?? null },
  });

  if (error) {
    console.error('entitlement-webhook: apply_entitlement_update failed', error);
    // A 500 tells RevenueCat to retry -- safe, since apply_entitlement_update()
    // is idempotent on provider_event_id (a retried delivery of the SAME
    // event never double-applies).
    return new Response('Internal error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
});
