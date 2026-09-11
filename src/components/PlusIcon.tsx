import { StyleSheet, View } from 'react-native';

// A small drawn "+" for the compact header Add button (see fixed.png
// reference) -- plain Views, same technique as every other icon in this
// app, no new dependency.
export function PlusIcon({ color = '#FFFFFF' }: { color?: string }) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, styles.horizontal, { backgroundColor: color }]} />
      <View style={[styles.bar, styles.vertical, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    borderRadius: 1,
  },
  horizontal: {
    width: 12,
    height: 2,
  },
  vertical: {
    width: 2,
    height: 12,
  },
});
