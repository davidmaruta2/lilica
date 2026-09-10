import { StyleSheet, View } from 'react-native';

import { ChoiceTile } from '../components/ChoiceTile';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { spacing } from '../theme';

type Props = {
  onBack: () => void;
  onSelectMyself: () => void;
  onSelectSomeoneElse: () => void;
};

export function CareForkScreen({ onBack, onSelectMyself, onSelectSomeoneElse }: Props) {
  return (
    <Screen>
      <Header onBack={onBack} />
      <View style={styles.content}>
        <AppText variant="title" centre>Whose wellbeing are you looking to support with Lilica?</AppText>
        <AppText variant="body" tone="soft" centre style={styles.supporting}>
          You can always add someone else, including yourself, later.
        </AppText>
        <View style={styles.tiles}>
          <ChoiceTile title="Myself" onPress={onSelectMyself} />
          <ChoiceTile title="Someone else" onPress={onSelectSomeoneElse} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xl,
  },
  supporting: {
    marginTop: spacing.sm,
    maxWidth: 340,
    alignSelf: 'center',
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
});
