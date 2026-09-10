import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { colors, radius, spacing } from '../theme';

type Props = {
  onBack: () => void;
  onContinue: () => void;
};

export function HowItWorksScreen({ onBack, onContinue }: Props) {
  const points = [
    {
      title: 'Keep the important things together',
      body: 'Appointments, medication information, documents, bills and everyday tasks.',
    },
    {
      title: 'See what needs sorting',
      body: 'What is due, what is coming up and what still needs attention.',
    },
    {
      title: 'Bring others in when useful',
      body: "Share updates later, so family or helpers know what's happening.",
    },
  ];

  return (
    <Screen
      backgroundColor={colors.creamStage}
      footer={
        <View style={styles.footer}>
          <Button label="Continue" onPress={onContinue} />
        </View>
      }
    >
      <Header onBack={onBack} />
      <AppText variant="title" style={styles.title}>
        One place for the care and everyday life of someone you support.
      </AppText>
      <AppText variant="body" tone="soft" style={styles.opening}>
        Keep appointments, care, home and car matters, important paperwork and everyday to-dos organised for someone you care about.
      </AppText>
      <View style={styles.numberedList}>
        {points.map((point, index) => (
          <View key={point.title} style={styles.point}>
            <View style={styles.number}>
              <AppText variant="bodyStrong" tone="white">
                {index + 1}
              </AppText>
            </View>
            <View style={styles.pointCopy}>
              <AppText variant="bodyStrong">{point.title}</AppText>
              <AppText variant="secondary" tone="soft" style={styles.pointBody}>
                {point.body}
              </AppText>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.reassurance}>
        <AppText variant="bodyStrong">You can start on your own.</AppText>
        <AppText variant="secondary" tone="soft" style={styles.reassuranceCopy}>
          Invite others later if it helps.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: spacing.lg,
    maxWidth: 355,
  },
  opening: {
    marginTop: spacing.md,
    maxWidth: 350,
  },
  numberedList: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  number: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  pointCopy: {
    flex: 1,
  },
  pointBody: {
    marginTop: spacing.xxs,
  },
  reassurance: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  reassuranceCopy: {
    marginTop: spacing.xxs,
  },
  footer: {
    gap: spacing.sm,
  },
});
