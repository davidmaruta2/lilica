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
  // To Do background correction (12 September 2026): physical QA found
  // the default two-stop gradient below reads as "a large, almost flat
  // dark block, then a late fade" on To Do specifically -- its header has
  // more content above the fold (title/subtitle/filters) than Home/
  // Calendar/People, so more of that flat 78% stayed on-screen before any
  // fade began. Rather than changing the shared default (which Home/
  // Calendar/People all still render pixel-identically, unchanged), a
  // screen may opt into its own smoother, earlier-starting, multi-stop
  // distribution by passing `stops` -- an ordered list of {color,
  // location} covering the same 0-to-1 span, read directly by
  // LinearGradient. Omit it (every other screen) and behaviour is
  // byte-for-byte the original two-stop deep/tint fade at 0.78.
  stops?: { color: string; location: number }[];
  // To Do background correction: on a short/empty content list, this
  // component's own height used to be exactly the height of its
  // (sparse) children -- ending well above the bottom tab bar and
  // exposing the plain screen background underneath as an accidental
  // cream rectangle. `stretch` opts this instance into `flex: 1`, so it
  // fills whatever height its parent ScrollView content container makes
  // available (that container must itself request `flexGrow: 1` -- see
  // ToDoScreen's own `content` style) -- carrying its background colour
  // all the way to the tab bar regardless of how little content there
  // is, while a genuinely long/scrolling list is completely unaffected
  // (flexGrow never shrinks content that already exceeds the viewport).
  // It also sizes the LinearGradient itself to that same full height
  // (instead of the fixed BACKDROP_GRADIENT_HEIGHT block), so the
  // gradient's own colour interpolation runs the whole way down too --
  // never reaching a flat final colour partway down and reading as a
  // seam. Omitted (every other screen) and this is exactly the original,
  // content-sized, fixed-height behaviour.
  stretch?: boolean;
};

// Solid through the same ~78% mark the approved mock used, then resolves
// to the flat tint over the final stretch. This is a fixed distance down
// the CONTENT (not the viewport), so it comfortably covers the
// header/hero-card/strip region regardless of scroll position.
export const BACKDROP_GRADIENT_HEIGHT = 620;
export const BACKDROP_SOLID_END = BACKDROP_GRADIENT_HEIGHT * 0.78;

export function ScreenBackdrop({ deep, tint, gap, children, stops, stretch }: Props) {
  const colors = stops ? stops.map((stop) => stop.color) : [deep, deep, tint];
  const locations = stops ? stops.map((stop) => stop.location) : [0, 0.78, 1];
  // The flat fill below the gradient block must match its own final stop
  // (not the plain `tint` prop) whenever a custom distribution ends on a
  // different colour, or the two would visibly seam where they meet.
  const trailingColor = stops ? stops[stops.length - 1].color : tint;

  // Stretched instances (To Do): the LinearGradient itself IS the flex
  // container (flex: 1), rather than an absolutely-positioned sibling
  // behind a separately-flexed wrapper -- a genuinely fixed-height
  // ambiguity in the earlier attempt (an absolutely-positioned child's
  // resolved height inside a nested flex chain proved unreliable in
  // practice). This way there is exactly one node whose layout height
  // decides where the gradient's own colour interpolation ends, and
  // that height is the same flex-resolved height the ScrollView's own
  // `flexGrow: 1` content container hands down -- provably the full
  // available screen height, never a fixed pixel box, whatever the
  // device or content length. Every non-stretched screen (Home/
  // Calendar/People) is untouched below -- same absolutely-positioned,
  // fixed-height gradient as always.
  if (stretch) {
    return (
      <LinearGradient
        testID="screen-backdrop-gradient"
        colors={colors as [string, string, ...string[]]}
        locations={locations as [number, number, ...number[]]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.stretchGradient, { backgroundColor: trailingColor }]}
      >
        <View style={[styles.stretchContent, { gap }]}>{children}</View>
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.wrap, { backgroundColor: trailingColor, gap }]}>
      <LinearGradient
        testID="screen-backdrop-gradient"
        colors={colors as [string, string, ...string[]]}
        locations={locations as [number, number, ...number[]]}
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
  // Stretch mode: the LinearGradient is the flex container itself (no
  // absolute positioning involved) -- it fills whatever height its
  // parent ScrollView content container makes available (that container
  // must itself request `flexGrow: 1`, see ToDoScreen's own `content`
  // style), so its own colour interpolation always spans the true,
  // fully-rendered screen height, never a fixed box.
  stretchGradient: {
    flex: 1,
  },
  // Horizontal/top padding lives on this inner content wrapper instead
  // of the gradient itself in stretch mode, so the gradient can bleed
  // edge-to-edge while real content still renders indented, unchanged.
  stretchContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
});
