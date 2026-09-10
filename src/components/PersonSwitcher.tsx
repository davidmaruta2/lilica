import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, shadow, spacing } from '../theme';
import { LocalCareSpaceState } from '../types';
import { AppText } from './Text';
import { Button } from './Button';

export function PersonSwitcher({ visible, people, activeId, onClose, onSelect, onAdd }: {
  visible: boolean;
  people: LocalCareSpaceState[];
  activeId?: string;
  onClose: () => void;
  onSelect: (careSpaceId: string) => void;
  onAdd: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close person switcher" style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <AppText variant="section">People you're helping</AppText>
          <View style={styles.list}>
            {people.map((person) => {
              const selected = person.careSpaceId === activeId;
              return (
                <Pressable
                  key={person.careSpaceId}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => { onSelect(person.careSpaceId); onClose(); }}
                  style={[styles.row, selected && styles.selected]}
                >
                  <View style={styles.copy}>
                    <AppText variant="bodyStrong">{person.displayName}</AppText>
                    <AppText variant="secondary" tone="soft">{person.relationshipLabel || person.relationshipType}</AppText>
                  </View>
                  {selected ? <View style={styles.check}><View style={styles.tick} /></View> : null}
                </Pressable>
              );
            })}
          </View>
          <Button label="+ Add another person" variant="text" onPress={() => { onClose(); onAdd(); }} />
          <Button label="Done" variant="secondary" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(36,29,28,0.35)' },
  sheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surface, gap: spacing.md, ...shadow.soft },
  list: { gap: spacing.xs },
  row: { minHeight: 62, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  copy: { flex: 1 },
  check: { width: 26, height: 26, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 11, height: 7, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: colors.white, transform: [{ rotate: '-45deg' }], marginTop: -2 },
});
