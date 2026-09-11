import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { spacing } from '../theme';

// Visual pass (approved mock "Variant D"): a shared decorative backdrop
// for Home/Calendar/To Do/People -- a deep, Welcome-borrowed colour holds
// solid through roughly two-thirds of the screen, then settles into its
// own much lighter, muted tint for the remainder. Every card/row/tile a
// screen renders on top of this stays exactly as it already was (pure
// white or its existing surface colour) -- this component only ever
// supplies what sits BEHIND everything else.
//
// Bug fix: this used to sit OUTSIDE each screen's ScrollView (a sibling,
// not a child) -- fixed to the viewport, not to the scrolled content. A
// heading's relationship to the gradient therefore changed continuously
// as the user scrolled (a heading could pass through the deep zone at
// one scroll position and the light zone at another), which is exactly
// why a static "is this heading in the deep zone" colour decision looked
// wrong in practice. ScreenBackdrop is now rendered INSIDE each screen's
// ScrollView content (see Home/Calendar/To Do/People), so the gradient
// scrolls away together with everything else -- a heading's position
// relative to it is fixed once measured, the same at any scroll offset.
//
// Because it now lives inside the ScrollView's own (unpadded)
// contentContainerStyle, this component also owns the horizontal/top
// padding every screen's content used to apply itself -- the gradient
// bleeds past that padding to the true screen edges; real content
// renders at exactly the same indentation as before.
//
// Deliberately presentational only: no screen's data, navigation or
// derived state passes through here.
type Props = {
  deep: string;
  tint: string;
  // The vertical gap between this screen's top-level sections -- used to
  // live on the ScrollView's own contentContainerStyle; now lives here,
  // since ScreenBackdrop's wrapper is what directly holds those children.
  gap: number;
  children: ReactNode;
};

// Solid through the same ~78% mark the approved mock used, then resolves
// to the flat tint over the final stretch. This is a fixed distance down
// the CONTENT (not the viewport), so it comfortably covers the
// header/hero-card/strip region regardless of scroll position.
export const BACKDROP_GRADIENT_HEIGHT = 620;
export const BACKDROP_SOLID_END = BACKDROP_GRADIENT_HEIGHT * 0.78;

export function ScreenBackdrop({ deep, tint, gap, children }: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: tint, gap }]}>
      <LinearGradient
        colors={[deep, deep, tint]}
        locations={[0, 0.78, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.gradient, { height: BACKDROP_GRADIENT_HEIGHT }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  // Cancels wrap's own padding specifically for the gradient, so it
  // bleeds to the true screen edges while real content still renders
  // indented by that same padding, unchanged.
  gradient: {
    position: 'absolute',
    top: -spacing.lg,
    left: -spacing.lg,
    right: -spacing.lg,
  },
});
