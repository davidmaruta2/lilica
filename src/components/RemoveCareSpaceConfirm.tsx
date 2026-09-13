import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { AppText } from './Text';
import { colors, radius, shadow, spacing } from '../theme';

// Remove-supported-person: a real organiser capability that was simply
// missing until now (delete_my_account() only ever detaches memberships;
// leave_care_space()/remove_member() only ever end one membership -- see
// src/careSpaces.ts's deleteCareSpace()). This is the one, calm,
// unambiguous confirmation surface for it -- a plain Alert.alert cannot
// hold a checkbox, and this action is irreversible enough (every record,
// document, occurrence and Care Circle membership under the care space is
// permanently deleted) that a native two-button alert is not enough
// friction on its own.
type Props = {
  visible: boolean;
  careSpaceName: string;
  // How many OTHER active members (besides the organiser confirming this)
  // currently have access -- omitted or 0 when there are none, in which
  // case the collaborator-specific warning line is not shown at all
  // (never a fabricated "0 other people" line).
  collaboratorCount?: number;
  busy: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function RemoveCareSpaceConfirm({ visible, careSpaceName, collaboratorCount, busy, error, onConfirm, onCancel }: Props) {
  const [understood, setUnderstood] = useState(false);

  function handleCancel() {
    setUnderstood(false);
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={handleCancel} />
        <View style={styles.card}>
          <AppText variant="title">Remove {careSpaceName}?</AppText>
          <AppText variant="body" tone="soft" style={styles.body}>
            This permanently deletes every appointment, task, bill, document, contact, care note and update saved for {careSpaceName} -- along with their history and Care Circle -- from Lilica.
          </AppText>
          {collaboratorCount && collaboratorCount > 0 ? (
            <AppText variant="body" tone="soft" style={styles.body}>
              {collaboratorCount === 1
                ? 'The other person who currently helps will lose access too.'
                : `The ${collaboratorCount} other people who currently help will lose access too.`}
            </AppText>
          ) : null}
          <AppText variant="bodyStrong" tone="danger" style={styles.body}>
            This cannot be undone.
          </AppText>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: understood }}
            accessibilityLabel="I understand this cannot be undone"
            onPress={() => setUnderstood((current) => !current)}
            style={styles.checkboxRow}
          >
            <View style={[styles.checkbox, understood && styles.checkboxSelected]}>
              {understood ? <View style={styles.tick} /> : null}
            </View>
            <AppText variant="body" style={styles.checkboxLabel}>
              I understand this cannot be undone.
            </AppText>
          </Pressable>

          {error ? <AppText variant="secondary" tone="danger">{error}</AppText> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${careSpaceName}`}
            disabled={!understood || busy}
            onPress={onConfirm}
            style={[styles.destructiveRow, (!understood || busy) && styles.destructiveRowDisabled]}
          >
            <AppText variant="bodyStrong" tone="danger" centre>{busy ? 'Removing…' : `Remove ${careSpaceName}`}</AppText>
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
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.soft,
  },
  body: {
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
  },
  tick: {
    width: 11,
    height: 7,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.white,
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
  checkboxLabel: {
    flex: 1,
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
