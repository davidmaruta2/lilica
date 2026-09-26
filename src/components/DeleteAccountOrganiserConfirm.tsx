import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './Text';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors, radius, shadow, spacing } from '../theme';

// Direct product-owner decision, 26 September 2026: deleting your own
// account while you are a care space's sole active organiser used to be
// refused outright (server-side hard block, Phase 18B/21B). David's
// explicit instruction was to allow it instead, with a clear warning and
// a typed "DELETE" confirmation rather than a plain two-button alert --
// this is genuinely more destructive to explain than
// RemoveCareSpaceConfirm's own care-space removal (it also unsubscribes
// the account and ends the care circle's commercial ownership), so the
// same extra-friction pattern (a dedicated modal, not Alert.alert) is
// used here too, but with a typed word instead of a checkbox.
type Props = {
  visible: boolean;
  // Every care space this account is the sole active organiser of --
  // always at least one when this modal is shown at all.
  careSpaceNames: string[];
  busy: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const CONFIRM_WORD = 'DELETE';

export function DeleteAccountOrganiserConfirm({ visible, careSpaceNames, busy, error, onConfirm, onCancel }: Props) {
  const [typed, setTyped] = useState('');
  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD;

  function handleCancel() {
    setTyped('');
    onCancel();
  }

  const namesList = careSpaceNames.join(', ');
  const plural = careSpaceNames.length > 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={handleCancel} />
        <View style={styles.card}>
          <AppText variant="title">Delete your account?</AppText>
          <AppText variant="body" tone="soft" style={styles.body}>
            You are the organiser of {namesList}. Deleting your account unsubscribes you from Lilica and closes {plural ? 'these care circles' : 'this care circle'}.
          </AppText>
          <AppText variant="bodyStrong" tone="danger" style={styles.body}>
            This action is permanent and cannot be reversed.
          </AppText>
          <AppText variant="body" tone="soft" style={styles.body}>
            Make sure alternative arrangements are in place for the {plural ? 'people' : 'person'} you support before continuing.
          </AppText>
          <AppText variant="body" tone="soft" style={styles.body}>
            Deleting your account does NOT automatically cancel an active App Store or Google Play subscription -- manage or cancel it directly in your App Store/Google Play account settings.
          </AppText>

          <AppText variant="secondary" tone="soft" style={styles.prompt}>
            Still want to delete? Type DELETE to proceed.
          </AppText>
          <TextField
            label="Type DELETE"
            compact
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            accessibilityLabel="Type DELETE to confirm account deletion"
          />

          {error ? <AppText variant="secondary" tone="danger">{error}</AppText> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirm account deletion"
            disabled={!confirmed || busy}
            onPress={onConfirm}
            style={[styles.destructiveRow, (!confirmed || busy) && styles.destructiveRowDisabled]}
          >
            <AppText variant="bodyStrong" tone="danger" centre>{busy ? 'Deleting…' : 'Delete my account'}</AppText>
          </Pressable>
          <Button label="Cancel" variant="text" onPress={handleCancel} disabled={busy} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(36,29,28,0.4)',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.canvas,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.soft,
  },
  body: {
    lineHeight: 20,
  },
  prompt: {
    marginTop: spacing.xs,
  },
  destructiveRow: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    marginTop: spacing.xs,
  },
  destructiveRowDisabled: {
    opacity: 0.5,
  },
});
