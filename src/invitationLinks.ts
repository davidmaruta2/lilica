// Care Circle invitation delivery: the ONE canonical invitation link
// format, shared by email content, native Share, and deep-link parsing
// (App.tsx) -- never duplicated or re-derived elsewhere.
//
// The invitation's own `id` (care_space_invitations.id, a server-owned
// gen_random_uuid()) IS the secure, single-use token -- no separate
// token column was added. It is already: cryptographically unguessable
// (Postgres v4 UUID, 122 bits of randomness, never sequential), server-
// owned (the client never chooses or sees it before the row exists),
// tied to exactly one invitation row, naturally single-use (the row's
// own `status` moves to 'accepted'/'declined'/'revoked'/'expired' and
// every RPC that consumes it checks that status first), and never
// encodes role/domains/care-space identity itself -- the URL only ever
// RESOLVES an invitation; accept_invitation() reads the authoritative
// role/domains/care-space from the row server-side, never from anything
// the client could have supplied. See docs/REVISION_LOG.md's Care Circle
// invitation-delivery entry for the full reasoning behind not adding a
// second token column.
const INVITE_WEB_BASE = 'https://lilica.co.uk/invite';
const INVITE_APP_SCHEME_BASE = 'lilica://invite';

// ROUTING DECISION (14 September 2026, see docs/REVISION_LOG.md): the
// web link carries the invitation id as a QUERY PARAMETER, not a path
// segment. This is the one and only canonical web format -- it was
// changed from an earlier path-segment design specifically to avoid
// depending on GitHub Pages' 404.html SPA-fallback trick, which served
// the correct page body but left the real HTTP status at 404. A 404 is
// a genuine risk for an email link (corporate link-scanners and some
// webmail preview crawlers judge a link by its status code), while
// /invite/?id=<id> is a real static file (public/invite/index.html)
// that returns a genuine 200 on every static host, no server-side
// routing required. The custom-scheme app link below is unaffected --
// it never touches an HTTP server, so it keeps its simpler path form.
// Care Circle invitation & joining flow completion (`\downloads\carecircle.txt`,
// 14 September 2026): the invite CODE (a human-friendly locator for the
// SAME invitation, never a second security model -- see
// supabase/migrations/20260916140000_invitation_code.sql) travels
// alongside the id as a second, optional query parameter, purely so the
// landing page can show it as a fallback for someone who can't complete
// the app hand-off. Carrying it here is no different in risk from
// carrying the id -- neither can accept an invitation by itself; only
// accept_invitation()'s own unchanged identity check can.
export function invitationWebUrl(invitationId: string, inviteCode?: string): string {
  const base = `${INVITE_WEB_BASE}/?id=${invitationId}`;
  return inviteCode ? `${base}&code=${inviteCode}` : base;
}

export function invitationAppUrl(invitationId: string): string {
  return `${INVITE_APP_SCHEME_BASE}/${invitationId}`;
}

// Parses either the canonical https://lilica.co.uk/invite/?id=<id> web
// link or a lilica://invite/<id> custom-scheme link into the invitation
// id it names -- returns undefined for anything else (an unrelated deep
// link, or a malformed one), never a guess. A legacy path-segment web
// link (/invite/<id>) is still recognised as a harmless fallback in
// case one is ever followed, even though nothing generates that form
// anymore.
export function parseInvitationIdFromUrl(url: string): string | undefined {
  const queryMatch = url.match(/[?&]id=([0-9a-fA-F-]{36})(?:[&#]|$)/);
  if (queryMatch) return queryMatch[1];
  const pathMatch = url.match(/\/invite\/([0-9a-fA-F-]{36})(?:[/?#]|$)/);
  return pathMatch?.[1];
}
