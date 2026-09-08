import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { OptionRow } from '../components/OptionRow';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { firstItemOptions } from '../data/options';
import { colors, radius, spacing } from '../theme';
import { FirstItemType, Interest } from '../types';

type Props = {
  interests: Interest[];
  personName?: string;
  onBack: () => void;
  onSelect: (type: FirstItemType) => void;
  onSkip: () => void;
};

export function FirstThingScreen({ interests, personName, onBack, onSelect, onSkip }: Props) {
  const relevantOptions = firstItemOptions.filter(
    (option) => option.id !== 'careNote' || interests.includes('careInfo'),
  );
  const ordered = [...relevantOptions].sort((a, b) => {
    const aScore = a.interest && interests.includes(a.interest) ? 0 : 1;
    const bScore = b.interest && interests.includes(b.interest) ? 0 : 1;
    return aScore - bScore;
  });

  return (
    <Screen
      backgroundColor={colors.creamStage}
      footer={<Button label="I'll do this later" variant="text" onPress={onSkip} />}
    >
      <Header onBack={onBack} />
      <View style={styles.focusMark}>
        <View style={styles.checkStem} />
        <View style={styles.checkArm} />
      </View>
      <View style={styles.prompt}>
        <AppText variant="title" centre>What would help today?</AppText>
        <AppText variant="body" tone="soft" centre style={styles.supporting}>
          Add one useful thing for {personName || 'them'}.
        </AppText>
      </View>
      <View style={styles.options}>
        {ordered.map((option) => (
          <OptionRow key={option.id} title={option.title} onPress={() => onSelect(option.id)} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  supporting: { marginTop: spacing.sm },
  prompt: { alignItems: 'center' },
  focusMark: {
    width: 104,
    height: 104,
    borderRadius: radius.pill,
    backgroundColor: colors.oliveSoft,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  checkStem: {
    position: 'absolute',
    width: 13,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    transform: [{ rotate: '42deg' }],
    right: 30,
    top: 22,
  },
  checkArm: {
    position: 'absolute',
    width: 13,
    height: 31,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    transform: [{ rotate: '-42deg' }],
    left: 32,
    top: 47,
  },
  options: {
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
});
