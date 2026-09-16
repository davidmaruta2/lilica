import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { DOMAIN_DESCRIPTIONS, DOMAIN_LABELS, MyInvitation } from '../careCircle';
import { colors, radius, spacing } from '../theme';

type Result = { ok: boolean; message?: string };

// Same joining as JoinCareCircleScreen.tsx's own local copy -- "Maggie" |
// "Maggie and Ben" | "Maggie, Ben and Jackie".
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'someone';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

type Props = {
  invitations: MyInvitation[];
  // Both resolve once the server call completes; the screen shows the
  // error inline and leaves the invitation in the list on failure rather
  // than guessing it succeeded. Multi-person Care Circle invitation scope
  // (`\downloads\perm.txt`, 15 September 2026): each callback receives
  // the WHOLE invitation row so the caller (App.tsx) can dispatch to
  // accept_invitation()/decline_invitation() for a legacy row or
  // accept_invitation_group()/decline_invitation_group() for a grouped
  // one -- this screen owns none of that decision, isGroupInvitation()
  // is the one shared source of truth for which case applies.
  onAccept: (invitation: MyInvitation) => Promise<Result>;
  onDecline: (invitation: MyInvitation) => Promise<Result>;
  // "Not now" -- leaves every invitation exactly as it is (still pending,
  // still fully visible next time) and returns to normal use.
  onClose: () => void;
};

export function InvitationsScreen({ invitations, onAccept, onDecline, onClose }: Props) {
  const [busyId, setBusyId] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handle(invitation: MyInvitation, action: (invitation: MyInvitation) => Promise<Result>) {
    setBusyId(invitation.id);
    const result = await action(invitation);
    setBusyId(undefined);
    if (!result.ok) {
      setErrors((current) => ({ ...current, [invitation.id]: result.message ?? 'Something went wrong. Try again.' }));
    } else {
      setErrors((current) => {
        const { [invitation.id]: _removed, ...rest } = current;
        return rest;
      });
    }
  }

  return (
    <Screen>
      <Header title="Invitations" onBack={onClose} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText variant="secondary" tone="soft">
          {invitations.length === 1
            ? "You've been invited to help with someone's care."
            : "You've been invited to help with someone's care in more than one place."}
        </AppText>

        {invitations.map((invitation) => (
          <View key={invitation.id} style={styles.card}>
            {/* Multi-person Care Circle invitation scope (`\downloads\perm.txt`,
                15 September 2026): a grouped invitation lists EVERY
                selected person here, as one invitation -- the invitee
                must understand acceptance concerns all of them (brief
                section 11), never just the first name. */}
            <AppText variant="body" tone="primary">
              {invitation.careSpaceNames.length > 1 ? joinNames(invitation.careSpaceNames) : invitation.careSpaceNames[0]}
            </AppText>
            <AppText variant="secondary" tone="soft">
              Invited by {invitation.invitedByDisplayName} as {invitation.role === 'contributor' ? 'a Contributor' : 'a Viewer'}
            </AppText>
            {invitation.grantedDomains.length > 0 ? (
              <View style={styles.domainList}>
                <AppText variant="secondary" tone="muted">What you'll be able to see:</AppText>
                {invitation.grantedDomains.map((domain) => (
                  <AppText key={domain} variant="secondary" tone="soft">
                    {DOMAIN_LABELS[domain]}: {DOMAIN_DESCRIPTIONS[domain]}
                  </AppText>
                ))}
              </View>
            ) : (
              <AppText variant="secondary" tone="muted">Nothing has been shared with you yet.</AppText>
            )}
            {errors[invitation.id] ? (
              <AppText variant="secondary" tone="danger">{errors[invitation.id]}</AppText>
            ) : null}
            <View style={styles.actions}>
              <Button
                label="Accept"
                onPress={() => handle(invitation, onAccept)}
                disabled={busyId === invitation.id}
                style={styles.actionButton}
              />
              <Button
                label="Decline"
                variant="secondary"
                onPress={() => handle(invitation, onDecline)}
                disabled={busyId === invitation.id}
                style={styles.actionButton}
              />
            </View>
          </View>
        ))}

        <Button label="Not now" variant="text" onPress={onClose} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.line,
  },
  domainList: {
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionButton: {
    flex: 1,
  },
});
