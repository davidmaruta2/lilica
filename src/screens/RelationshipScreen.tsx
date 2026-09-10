import { useRef } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { relationships } from '../data/options';
import { colors, radius, spacing } from '../theme';
import { Relationship, SupportedPersonDraft } from '../types';

type Props = {
  people?: SupportedPersonDraft[];
  collapsed?: boolean;
  addingOne?: boolean;
  selected?: Relationship;
  onBack: () => void;
  onToggle?: (relationship: Relationship) => void;
  onSelect?: (relationship: Relationship) => void;
  onDone?: () => void;
  onContinue: () => void;
  onAddAnother?: () => void;
};

const ITEM_HEIGHT = 66;

export function RelationshipScreen({
  people = [],
  collapsed = false,
  addingOne = false,
  selected,
  onBack,
  onToggle,
  onSelect,
  onDone,
  onContinue,
  onAddAnother,
}: Props) {
  const list = useRef<FlatList<Relationship>>(null);
  const selectedTypes = people.map((person) => person.relationshipType);

  function choose(relationship: Relationship) {
    (onToggle ?? onSelect)?.(relationship);
  }

  if (collapsed) {
    return (
      <Screen footer={<Button label="Continue" disabled={people.length === 0} onPress={onContinue} />}>
        <Header onBack={onBack} />
        <View style={styles.prompt}>
          <AppText variant="title" centre>Who are you helping?</AppText>
        </View>
        <View style={styles.summary}>
          {people.map((person) => (
            <View key={person.draftId} style={styles.summaryRow}>
              <View style={styles.summaryMark}><View style={styles.tick} /></View>
              <AppText variant="bodyStrong">{person.relationshipLabel || person.relationshipType}</AppText>
            </View>
          ))}
          <Button label="+ Add another person" variant="text" onPress={onAddAnother ?? (() => undefined)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll={false}
      footer={<Button label="Done" disabled={addingOne ? !selected : people.length === 0} onPress={onDone ?? onContinue} />}
    >
      <Header onBack={onBack} />
      <View testID="relationship-content" style={styles.content}>
        <View style={styles.prompt}>
          <AppText variant="title" centre>Who are you helping?</AppText>
          <AppText variant="body" tone="soft" centre style={styles.supporting}>
            {addingOne ? 'Choose another person to add.' : 'Choose everyone you help. You can add the same relationship again later.'}
          </AppText>
        </View>
        <View style={styles.wheelFrame}>
          <View pointerEvents="none" style={styles.selectionBand} />
          <FlatList
            ref={list}
            testID="relationship-carousel"
            data={relationships}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.wheelContent}
            showsVerticalScrollIndicator={false}
            snapToInterval={ITEM_HEIGHT}
            decelerationRate="fast"
            renderItem={({ item }) => {
              const isSelected = selected === item || (!addingOne && selectedTypes.includes(item));
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={item}
                  onPress={() => choose(item)}
                  style={({ pressed }) => [styles.option, isSelected && styles.optionSelected, pressed && styles.pressed]}
                >
                  <AppText variant="section" tone={isSelected ? 'primary' : 'soft'}>{item}</AppText>
                  <View style={[styles.check, isSelected && styles.checkSelected]}>
                    {isSelected ? <View style={styles.tick} /> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        </View>
        <AppText variant="secondary" tone="soft" centre>
          {people.length === 0 ? 'Select at least one person' : `${people.length} ${people.length === 1 ? 'person' : 'people'} selected`}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'flex-start', paddingTop: spacing.xl, paddingBottom: spacing.lg },
  prompt: { alignItems: 'center', marginTop: spacing.lg },
  supporting: { maxWidth: 340, marginTop: spacing.sm },
  wheelFrame: { height: ITEM_HEIGHT * 3.6, marginVertical: spacing.xl, overflow: 'hidden' },
  wheelContent: { paddingVertical: ITEM_HEIGHT * 1.3 },
  selectionBand: { position: 'absolute', zIndex: -1, left: 0, right: 0, top: ITEM_HEIGHT * 1.3, height: ITEM_HEIGHT, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  option: { height: ITEM_HEIGHT, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: 0.58 },
  optionSelected: { opacity: 1 },
  pressed: { opacity: 0.78 },
  check: { width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { width: 12, height: 7, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderColor: colors.white, transform: [{ rotate: '-45deg' }], marginTop: -2 },
  summary: { marginTop: spacing.xl, gap: spacing.sm },
  summaryRow: { minHeight: 60, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryMark: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
