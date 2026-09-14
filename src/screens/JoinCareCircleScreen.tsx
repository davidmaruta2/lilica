// Care Circle invitation & joining flow completion (`\downloads\carecircle.txt`,
// 14 September 2026): the manual invitation-CODE joining route. This is
// NOT "Request access" and there is no directory to browse -- it only
// ever resolves a code someone was already given to the SAME
// invitation the email/deep-link route would resolve, via
// resolveInvitationByCode() (a pure, minimal-preview locator). Joining
// itself is done by calling onAccept(invitationId) with EXACTLY the id
// that resolved -- the caller (App.tsx) passes the same
// handleAcceptInvitation() already used for every other acceptance
// route, so this converges on the one existing authoritative
// membership/permission machinery, never a second one.
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { TextField } from '../components/TextField';
import { CodeResolvedInvitation, DOMAIN_DESCRIPTIONS, DOMAIN_LABELS } from '../careCircle';
import { colors, radius, spacing } from '../theme';

type Result = { ok: boolean; message?: string };
type CodeResult = { ok: true; data: CodeResolvedInvitation } | { ok: false; message: string };

type Props = {
  onResolveCode: (code: string) => Promise<CodeResult>;
  // Deliberately the SAME accept function every other route uses (see
  // App.tsx's handleAcceptInvitation) -- this screen never calls
  // accept_invitation() through a separate path. Matches
  // InvitationsScreen.tsx's own Result shape exactly, since both call
  // the exact same underlying handler.
  onAccept: (invitationId: string) => Promise<Result>;
  // "Not now" from the code-entry step, or backing out of a review
  // without joining -- either way nothing was created or changed.
  onClose: () => void;
  // Called only after a REAL, server-confirmed accept succeeds.
  onJoined: () => void;
};

export function JoinCareCircleScreen({ onResolveCode, onAccept, onClose, onJoined }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [resolved, setResolved] = useState<CodeResolvedInvitation>();

  async function handleContinue() {
    if (!code.trim()) return;
    setBusy(true);
    setError(undefined);
    const result = await onResolveCode(code.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setResolved(result.data);
  }

  async function handleJoin() {
    if (!resolved) return;
    setBusy(true);
    setError(undefined);
    const result = await onAccept(resolved.invitationId);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onJoined();
  }

  if (resolved) {
    return (
      <Screen>
        <Header title="Join a Care Circle" onBack={() => setResolved(undefined)} />
        <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <AppText variant="section" tone="primary">
              You've been invited to help with {resolved.careSpaceName}'s care
            </AppText>
            <AppText variant="secondary" tone="soft">
              Invited by {resolved.invitedByDisplayName} as {resolved.role === 'contributor' ? 'a Contributor' : 'a Viewer'}
            </AppText>
            {resolved.grantedDomains.length > 0 ? (
              <View style={styles.domainList}>
                <AppText variant="secondary" tone="muted">You will have access to:</AppText>
                {resolved.grantedDomains.map((domain) => (
                  <AppText key={domain} variant="secondary" tone="soft">
                    {DOMAIN_LABELS[domain]}: {DOMAIN_DESCRIPTIONS[domain]}
                  </AppText>
                ))}
              </View>
            ) : (
              <AppText variant="secondary" tone="muted">Nothing has been shared with you yet.</AppText>
            )}
          </View>
          {error ? <AppText variant="secondary" tone="danger">{error}</AppText> : null}
          <Button label="Join Care Circle" onPress={handleJoin} disabled={busy} />
          <Button label="Not now" variant="text" onPress={onClose} disabled={busy} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Join a Care Circle" onBack={onClose} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText variant="secondary" tone="soft">
          Enter your invitation code
        </AppText>
        <TextField
          label="Invitation code"
          placeholder="ABCD-1234"
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
        />
        {error ? <AppText variant="secondary" tone="danger">{error}</AppText> : null}
        <Button label="Continue" onPress={handleContinue} disabled={busy || !code.trim()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  domainList: { gap: 2 },
});
