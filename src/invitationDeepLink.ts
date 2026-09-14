// Care Circle invitation deep-link handling. Deliberately minimal: this
// only ever SHORTCUTS straight to the existing Invitations review screen
// when a user who is ALREADY authenticated taps an invitation link while
// Lilica is open or gets foregrounded by one. It intentionally does NOT
// add any new onboarding branch or "resume invitation across auth" state
// machine -- the existing, already-correct pending-invitation discovery
// (list_my_invitations(), checked once per signed-in owner on app
// bootstrap -- see App.tsx) is the real, authoritative fallback for
// every other case: signed-out tapping a link, installing the app fresh
// and signing in with the invited email, ignoring the link entirely and
// discovering the invitation naturally next time they open Lilica. This
// hook only ever makes the ALREADY-INSTALLED, ALREADY-SIGNED-IN case one
// tap faster; it changes nothing about who can join what -- accept_
// invitation()'s own server-side email-match check remains the sole
// authority (see src/invitationLinks.ts's own header comment).
//
// A second, INDEPENDENT `Linking.addEventListener('url', ...)` alongside
// AuthProvider's own existing one is deliberate and safe -- React
// Native's Linking emitter calls every registered subscriber for the
// same event; this one only ever acts on a URL AuthProvider's own
// handler has no interest in (an invitation link is never an auth
// callback link).
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { parseInvitationIdFromUrl } from './invitationLinks';

export function useInvitationDeepLink(): { invitationId?: string; clear: () => void } {
  const [invitationId, setInvitationId] = useState<string>();

  useEffect(() => {
    function handleUrl(url: string) {
      const id = parseInvitationIdFromUrl(url);
      if (id) setInvitationId(id);
    }

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  return { invitationId, clear: () => setInvitationId(undefined) };
}
