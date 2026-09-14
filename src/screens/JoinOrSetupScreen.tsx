// Care Circle invitation & joining flow completion (`\downloads\carecircle.txt`,
// 14 September 2026): the ONE authorised onboarding change -- a small
// routing fork shown only to a genuinely new user (see App.tsx's
// initialPersonStage()), immediately before the existing careFork
// screen it used to jump straight to. Deliberately built the same way
// as CareForkScreen itself (same ChoiceTile pattern, same visual
// language) -- not a new design system, not an invitation explainer.
import { StyleSheet, View } from 'react-native';

import { ChoiceTile } from '../components/ChoiceTile';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { spacing } from '../theme';

type Props = {
  onBack: () => void;
  onSetUpCare: () => void;
  onJoinCareCircle: () => void;
};

export function JoinOrSetupScreen({ onBack, onSetUpCare, onJoinCareCircle }: Props) {
  return (
    <Screen>
      <Header onBack={onBack} />
      <View style={styles.content}>
        <AppText variant="title" centre>What would you like to do?</AppText>
        <View style={styles.tiles}>
          <ChoiceTile title="Set up care for someone" onPress={onSetUpCare} />
          <ChoiceTile title="Join a Care Circle" onPress={onJoinCareCircle} />
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
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
});
