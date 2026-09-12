// Phase 17: the "+ Link something" picker used by RecordEditor's optional
// "Related to" section. Shows only records already scoped to the current
// care space by the caller (RecordQuickEditor/FirstThingScreen) -- this
// component never queries or filters by care space itself, and never
// shows a UUID, database type or raw domain name; each row is the same
// human-readable summary RecordDetail/Calendar/To Do already build from
// canonical fields.

import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { AppText } from './Text';

export type PickableRecord = {
  id: string;
  title: string;
  subtitle?: string;
};

type Props = {
  visible: boolean;
  records: PickableRecord[];
  onSelect: (recordId: string) => void;
  onClose: () => void;
};

export function RelatedRecordPicker({ visible, records, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <AppText variant="section">Link something</AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
            <AppText variant="secondary" tone="primary">Close</AppText>
          </Pressable>
        </View>
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {records.length > 0 ? records.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Link to ${item.title}`}
              onPress={() => onSelect(item.id)}
              style={styles.row}
            >
              <View style={styles.rowCopy}>
                <AppText variant="bodyStrong" numberOfLines={1}>{item.title}</AppText>
                {item.subtitle ? <AppText variant="secondary" tone="soft" numberOfLines={1}>{item.subtitle}</AppText> : null}
              </View>
            </Pressable>
          )) : (
            <AppText variant="secondary" tone="soft" style={styles.empty}>
              Nothing else to link to yet.
            </AppText>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(36,29,28,0.32)' },
  sheet: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: '18%',
    maxHeight: '64%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { flexGrow: 0 },
  row: {
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowCopy: { gap: 2 },
  empty: { paddingVertical: spacing.lg, textAlign: 'center' },
});
