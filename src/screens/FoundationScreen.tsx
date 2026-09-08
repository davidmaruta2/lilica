import { StyleSheet, View } from 'react-native';

import { AppText } from '../components/Text';
import { colors, radius, spacing } from '../theme';

type Props = {
  title: string;
  body: string;
};

export function FoundationScreen({ title, body }: Props) {
  return (
    <View style={styles.container}>
      <AppText variant="meta" tone="muted">{title}</AppText>
      <AppText variant="title" style={styles.title}>{title}</AppText>
      <View style={styles.panel}>
        <AppText variant="body" tone="soft">{body}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  title: {
    marginTop: spacing.xs,
  },
  panel: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
});
