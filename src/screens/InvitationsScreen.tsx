import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { DOMAIN_LABELS, MyInvitation } from '../careCircle';
import { colors, radius, spacing } from '../theme';

type Result = { ok: boolean; message?: string };

type Props = {
  invitations: MyInvitation[];
  // Both resolve once the server call completes; the screen shows the
  // error inline and leaves the invitation in the list on failure rather
  // than guessing it succeeded.
  onAccept: (invitationId: string) => Promise<Result>;
  onDecline: (invitationId: string) => Promise<Result>;
  // "Not now" -- leaves every invitation exactly as it is (still pending,
  // still fully visible next time) and returns to normal use.
  onClose: () => void;
};

export function InvitationsScreen({ invitations, onAccept, onDecline, onClose }: Props) {
  const [busyId, setBusyId] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handle(invitationId: string, action: (id: string) => Promise<Result>) {
    setBusyId(invitationId);
    const result = await action(invitationId);
    setBusyId(undefined);
    if (!result.ok) {
      setErrors((current) => ({ ...current, [invitationId]: result.message ?? 'Something went wrong. Try again.' }));
    } else {
      setErrors((current) => {
        const { [invitationId]: _removed, ...rest } = current;
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
            <AppText variant="body" tone="primary">{invitation.careSpaceName}</AppText>
            <AppText variant="secondary" tone="soft">
              Invited by {invitation.invitedByDisplayName} as {invitation.role === 'contributor' ? 'a Contributor' : 'a Viewer'}
              {invitation.relationshipLabel ? ` (${invitation.relationshipLabel})` : ''}
            </AppText>
            <AppText variant="secondary" tone="muted">
              {invitation.grantedDomains.length > 0
                ? `You'll be able to see: ${invitation.grantedDomains.map((domain) => DOMAIN_LABELS[domain]).join(', ')}`
                : "Nothing has been shared with you yet."}
            </AppText>
            {errors[invitation.id] ? (
              <AppText variant="secondary" tone="danger">{errors[invitation.id]}</AppText>
            ) : null}
            <View style={styles.actions}>
              <Button
                label="Accept"
                onPress={() => handle(invitation.id, onAccept)}
                disabled={busyId === invitation.id}
                style={styles.actionButton}
              />
              <Button
                label="Decline"
                variant="secondary"
                onPress={() => handle(invitation.id, onDecline)}
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
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
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
