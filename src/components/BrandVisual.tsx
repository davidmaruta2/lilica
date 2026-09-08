import { Image, StyleSheet, View } from 'react-native';

import { colors, radius } from '../theme';

export function BrandVisual() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.wrap}>
      <View style={styles.disc} />
      <Image
        source={require('../../assets/lilica-hero.png')}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 224,
    height: 224,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    opacity: 0.94,
  },
  image: {
    width: 220,
    height: 220,
  },
});
