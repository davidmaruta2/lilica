import { StyleSheet, View } from 'react-native';

import { colors } from '../theme';
import { AppText } from './Text';

type WordmarkProps = {
  tone?: 'light' | 'dark';
};

export function Wordmark({ tone = 'dark' }: WordmarkProps) {
  const isLight = tone === 'light';

  return (
    <View accessibilityRole="text" accessibilityLabel="Lilica" style={styles.wrap}>
      <AppText
        variant="wordmark"
        tone={isLight ? 'white' : 'default'}
        style={styles.text}
      >
        Lilica
      </AppText>
      <View style={[styles.leaf, isLight && styles.leafLight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  text: {
    fontFamily: 'Fraunces_800ExtraBold',
  },
  leaf: {
    width: 16,
    height: 9,
    borderTopLeftRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: colors.olive,
    transform: [{ rotate: '-28deg' }],
    marginLeft: 5,
    marginTop: 2,
  },
  leafLight: {
    backgroundColor: '#D7DCB2',
  },
});
