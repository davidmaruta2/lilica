// Care Circle invitation delivery: the ONE server-side entry point that
// actually sends a real transactional invitation email, via Resend
// (chosen because Lilica's existing Supabase Auth verification/password-
// reset emails already send through the same Resend account -- reusing
// the already-verified relationship rather than introducing a second
// provider). See docs/REVISION_LOG.md for the full provider-selection
// reasoning.
//
// The sending credential (RESEND_API_KEY) lives ONLY here, as a Supabase
// Edge Function secret -- never in client source, app.json, an Expo
// public env var, AsyncStorage, or this repository. Set via:
//   npx supabase secrets set RESEND_API_KEY=<key> --project-ref <ref>
//
// Authorization is deliberately NOT re-derived here -- the incoming
// request's own Authorization header (the CALLER's own Supabase access
// token, forwarded by the client exactly as it already authenticates
// every other request) is used to build a user-scoped Supabase client.
// Reading the invitation row through THAT client means the existing
// `care_space_invitations_select_organiser` RLS policy is the one and
// only authority check -- this function trusts nothing the client claims
// about which care space or invitation it owns; if the row doesn't come
// back, the caller was never authorised to send it, full stop. No
// service-role key is used or needed.
//
// IMPORTANT LIMITATION, stated plainly: this function has not been
// deployed or exercised against a real send in this environment as of
// writing -- lilica.co.uk's own domain verification in Resend was still
// in progress when this was written. Its pure content-generation logic
// (email-content.ts) has real unit-test coverage
// (tests/invitation-email-content.test.ts); the actual HTTP round trip
// to Resend, and genuine delivery to a real inbox, are unverified until
// the product owner physically tests it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildInvitationEmail } from './email-content.ts';

const FROM_ADDRESS = 'Lilica <invitations@lilica.co.uk>';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse({ ok: false, message: 'Method not allowed' }, 405);

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('send-invitation-email: RESEND_API_KEY is not configured');
    return jsonResponse({ ok: false, message: "Email sending isn't set up yet." }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ ok: false, message: 'Authentication required' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    console.error('send-invitation-email: SUPABASE_URL/SUPABASE_ANON_KEY missing from the function environment');
    return jsonResponse({ ok: false, message: 'Server misconfigured' }, 500);
  }

  // A user-scoped client, never service-role -- see the header comment.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  let body: { invitationId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, message: 'Invalid request body' }, 400);
  }
  const invitationId = body.invitationId;
  if (!invitationId) return jsonResponse({ ok: false, message: 'invitationId is required' }, 400);

  const { data: invitation, error: invitationError } = await userClient
    .from('care_space_invitations')
    .select('id, care_space_id, invitee_email, status, invited_by_membership_id, invite_code')
    .eq('id', invitationId)
    .maybeSingle();

  if (invitationError || !invitation) {
    // RLS denies the read outright for anyone but an active organiser of
    // this care space -- this is genuinely "not found" from the caller's
    // own point of view, not merely "not authorised", by design (never
    // confirm an invitation id's existence to someone who isn't
    // authorised to act on it).
    return jsonResponse({ ok: false, message: 'Invitation not found' }, 404);
  }
  if (invitation.status !== 'pending') {
    return jsonResponse({ ok: false, message: 'This invitation is no longer pending' }, 409);
  }

  const { data: supportedPerson } = await userClient
    .from('supported_people')
    .select('display_name')
    .eq('care_space_id', invitation.care_space_id)
    .maybeSingle();

  const { data: inviterMembership } = await userClient
    .from('care_space_memberships')
    .select('user_id')
    .eq('id', invitation.invited_by_membership_id)
    .maybeSingle();

  let inviterName = 'Someone';
  if (inviterMembership?.user_id) {
    const { data: inviterProfile } = await userClient
      .from('profiles')
      .select('display_name')
      .eq('id', inviterMembership.user_id)
      .maybeSingle();
    if (inviterProfile?.display_name) inviterName = inviterProfile.display_name;
  }

  const personFirstName = (supportedPerson?.display_name ?? 'someone').trim().split(/\s+/)[0] || 'someone';
  // Query-param form, not a path segment -- see docs/REVISION_LOG.md's
  // 14 September 2026 routing-decision entry and src/invitationLinks.ts.
  const joinUrl = `https://lilica.co.uk/invite/?id=${invitation.id}&code=${invitation.invite_code}`;
  const { subject, html, text } = buildInvitationEmail({ inviterName, personFirstName, joinUrl, inviteCode: invitation.invite_code });

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [invitation.invitee_email],
      subject,
      html,
      text,
    }),
  });

  if (!resendResponse.ok) {
    const errorBody = await resendResponse.text().catch(() => '');
    console.error('send-invitation-email: Resend rejected the request', resendResponse.status, errorBody);
    // Distinguish "invitation created" from "email delivery request
    // accepted" (brief section 29) -- this function only ever confirms
    // the LATTER, and only once Resend's own API has genuinely accepted
    // the send request, never mailbox delivery itself (no provider can
    // guarantee that).
    return jsonResponse({ ok: false, message: "The invitation was created, but the email couldn't be sent." }, 502);
  }

  // Server-authoritative delivery state (14 September 2026 final
  // architectural closure): record the genuine send ONLY now, after
  // Resend has actually accepted it -- never before, never on a failed
  // send above. This is what makes "Invitation emailed." survive app
  // restart/reinstall/device change -- it lives on the invitation row
  // itself, not in local device storage. A failure to record this
  // (unexpected, since the same organiser session already passed the
  // RLS-equivalent check reading the invitation above) is logged but
  // does not turn a genuinely successful send into a reported failure --
  // the email really was sent either way.
  const { error: recordError } = await userClient.rpc('record_invitation_email_sent', { target_invitation_id: invitation.id });
  if (recordError) {
    console.error('send-invitation-email: email sent, but recording delivery state failed', recordError);
  }

  return jsonResponse({ ok: true }, 200);
});
