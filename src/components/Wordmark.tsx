import { StyleSheet, View } from 'react-native';

import { colors } from '../theme';
import { AppText } from './Text';

type WordmarkProps = {
  tone?: 'light' | 'dark';
  // Corrective task 5: Home/Calendar/To Do/People now lead with their own
  // tab name as the main heading (see each screen's header), not the
  // brand wordmark. "compact" is the small, faint, watermark-like
  // treatment used there; the default full-size mark is unchanged and
  // still used by Welcome/Auth.
  size?: 'default' | 'compact';
};

export function Wordmark({ tone = 'dark', size = 'default' }: WordmarkProps) {
  const isLight = tone === 'light';
  const isCompact = size === 'compact';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Lilica"
      style={[styles.wrap, isCompact && (isLight ? styles.wrapCompactLight : styles.wrapCompact)]}
    >
      {/* Bug fix: this used to check isCompact BEFORE isLight, so
          tone="light" was silently ignored whenever size="compact" was
          set (the tone stayed 'muted' -- a dark grey, invisible against
          the visual pass's new coloured tab backdrops). isLight now
          takes priority in both the compact and default case. */}
      <AppText
        variant={isCompact ? 'secondary' : 'wordmark'}
        tone={isLight ? 'white' : isCompact ? 'muted' : 'default'}
        style={[styles.text, isCompact && styles.textCompact]}
      >
        Lilica
      </AppText>
      <View style={[styles.leaf, isCompact && styles.leafCompact, isLight && styles.leafLight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  wrapCompact: {
    alignSelf: 'flex-start',
    opacity: 0.6,
  },
  // The 0.6 dimming above was tuned for dark ink on a pale cream page --
  // faint, watermark-like. On the visual pass's coloured backdrops, white
  // text at the same 0.6 reads as "gone", not "faint" -- a lighter dim
  // keeps it legibly present while still clearly secondary to the tab's
  // own title text.
  wrapCompactLight: {
    alignSelf: 'flex-start',
    opacity: 0.85,
  },
  text: {
    fontFamily: 'Fraunces_800ExtraBold',
  },
  textCompact: {
    fontFamily: 'Fraunces_800ExtraBold',
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.2,
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
  leafCompact: {
    width: 7,
    height: 4,
    borderTopLeftRadius: 7,
    borderBottomRightRadius: 7,
    marginLeft: 2,
    marginTop: 1,
  },
  leafLight: {
    backgroundColor: '#D7DCB2',
  },
});
