import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { AppText } from './Text';
import { colors, radius, shadow, spacing } from '../theme';

// Phase 20D: the archive-specific counterpart to ReadOnlyGate.tsx --
// deliberately its own component with its own calm wording (brief section
// 7: "Do NOT reuse billing/read-only wording. Archive is a different
// reason for read-only state.") Shown only in direct response to an
// explicit tap on a gated mutation entry point, never proactively.
type Props = {
  visible: boolean;
  personName?: string;
  canRestore: boolean;
  onRestore: () => void;
  onClose: () => void;
};

export function ArchivedGate({ visible, personName, canRestore, onRestore, onClose }: Props) {
  const name = personName || 'This person';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <AppText variant="title">{name}'s care is archived</AppText>
          <AppText variant="body" tone="soft" style={styles.body}>
            Everything saved is still here and safe to look at, but adding or changing things is paused while care is archived.
          </AppText>
          {canRestore ? (
            <>
              <Button label={`Restore ${name}'s care`} onPress={onRestore} />
              <Button label="Not now" variant="text" onPress={onClose} />
            </>
          ) : (
            <Button label="OK" onPress={onClose} />
          )}
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
});
