import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { colors, radius, spacing } from '../theme';

// Phase 20D, Part A (approved `\downloads\20-22.txt`): the "intentional
// archived-care management route" the brief requires (section 6) --
// archived care spaces are hidden from ordinary active-person navigation,
// but must never disappear irretrievably. Each row restores the SAME care
// space (never a replacement) via the existing restore_care_space() RPC.
export type ArchivedCareSpace = { careSpaceId: string; displayName: string };

type Props = {
  archivedSpaces: ArchivedCareSpace[];
  onBack: () => void;
  onRestore: (careSpaceId: string) => Promise<{ ok: boolean; message?: string }>;
};

export function ArchivedCareScreen({ archivedSpaces, onBack, onRestore }: Props) {
  const [busyId, setBusyId] = useState<string>();
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' }>();

  async function handleRestore(space: ArchivedCareSpace) {
    setBusyId(space.careSpaceId);
    setMessage(undefined);
    const result = await onRestore(space.careSpaceId);
    setBusyId(undefined);
    setMessage({
      text: result.ok ? `${space.displayName}'s care has been restored.` : (result.message ?? 'Something went wrong.'),
      tone: result.ok ? 'success' : 'danger',
    });
  }

  return (
    <Screen>
      <Header title="Archived care" onBack={onBack} />
      <View style={styles.content}>
        {archivedSpaces.length === 0 ? (
          <AppText variant="secondary" tone="soft">No archived care spaces.</AppText>
        ) : (
          archivedSpaces.map((space) => (
            <View key={space.careSpaceId} style={styles.row}>
              <AppText variant="bodyStrong">{space.displayName}</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Restore ${space.displayName}`}
                disabled={busyId === space.careSpaceId}
                onPress={() => void handleRestore(space)}
              >
                <AppText variant="secondary" tone="primary">{busyId === space.careSpaceId ? 'Restoring…' : 'Restore'}</AppText>
              </Pressable>
            </View>
          ))
        )}
        {message ? <AppText variant="secondary" tone={message.tone === 'danger' ? 'danger' : 'soft'}>{message.text}</AppText> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: {
    minHeight: 52,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
});
