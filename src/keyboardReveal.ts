/**
 * Pure arithmetic for scrolling a focused field (and, where it fits, the
 * screen's primary CTA below it) into view above the keyboard, kept separate
 * from the native ScrollView/UIManager glue in `KeyboardAwareScrollView` so
 * the actual reveal math is directly testable.
 *
 * `visible`, `target` and `trailing` must all be measured in the same
 * coordinate space (window/screen coordinates from
 * `UIManager.measureInWindow`), not a mix of screen-relative and
 * content-relative values. Mixing those two spaces was the root cause of
 * fields staying hidden behind the Android keyboard even though a reveal was
 * attempted.
 */

export type RevealRect = {
  top: number;
  height: number;
};

export function computeRevealScrollTo(params: {
  visible: RevealRect;
  target: RevealRect;
  currentOffset: number;
  padding?: number;
  // Optional trailing content — typically the screen's footer/CTA — to also
  // bring into view alongside `target` when there is room for both. The
  // focused field (`target`) always wins: it is never scrolled above the
  // visible top just to make more room for `trailing`.
  trailing?: RevealRect;
}): number | undefined {
  const { visible, target, currentOffset, padding = 0, trailing } = params;
  const visibleTop = visible.top;
  const visibleBottom = visible.top + visible.height;

  const requiredBottom = trailing
    ? Math.max(target.top + target.height, trailing.top + trailing.height)
    : target.top + target.height;

  // How far content can still move up without pushing the focused field's
  // own top above the visible area. The field always takes priority over
  // revealing trailing content (e.g. a CTA) when a short viewport can't fit
  // both at once.
  const maxDelta = Math.max(0, target.top - visibleTop);

  const overflowBelow = requiredBottom + padding - visibleBottom;
  if (overflowBelow > 0) {
    const delta = Math.min(overflowBelow, maxDelta);
    if (delta > 0) return currentOffset + delta;
  }

  const overflowAbove = visibleTop - target.top;
  if (overflowAbove > 0) return Math.max(0, currentOffset - overflowAbove);

  return undefined;
}
