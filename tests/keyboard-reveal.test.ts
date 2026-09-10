import { computeRevealScrollTo } from '../src/keyboardReveal';

describe('computeRevealScrollTo', () => {
  it('scrolls a field trapped below the visible area (Android resize case)', () => {
    // A Password field sitting just below the window height the Android
    // keyboard left visible after `softwareKeyboardLayoutMode: resize`
    // shrank it. This reproduces the physical-device failure where the
    // field was clipped at the keyboard boundary and never scrolled.
    const scrollTo = computeRevealScrollTo({
      visible: { top: 0, height: 500 },
      target: { top: 460, height: 66 },
      currentOffset: 0,
      padding: 24,
    });

    expect(scrollTo).toBe(50); // (460 + 66 + 24) - 500
  });

  it('does not scroll a field that is already fully visible', () => {
    const scrollTo = computeRevealScrollTo({
      visible: { top: 0, height: 500 },
      target: { top: 100, height: 66 },
      currentOffset: 0,
      padding: 24,
    });

    expect(scrollTo).toBeUndefined();
  });

  it('accounts for the current scroll offset rather than resetting it', () => {
    const scrollTo = computeRevealScrollTo({
      visible: { top: 0, height: 500 },
      target: { top: 460, height: 66 },
      currentOffset: 120,
      padding: 24,
    });

    expect(scrollTo).toBe(170); // 120 + 50
  });

  it('scrolls up when a field sits above the visible area', () => {
    const scrollTo = computeRevealScrollTo({
      visible: { top: 80, height: 500 },
      target: { top: 20, height: 66 },
      currentOffset: 200,
      padding: 24,
    });

    expect(scrollTo).toBe(140); // 200 - (80 - 20)
  });

  it('never returns a negative scroll offset', () => {
    const scrollTo = computeRevealScrollTo({
      visible: { top: 80, height: 500 },
      target: { top: 20, height: 66 },
      currentOffset: 10,
      padding: 24,
    });

    expect(scrollTo).toBe(0);
  });

  it('ignores window-coordinate mismatches by construction: same space in, same space out', () => {
    // Regression guard for the original bug: the legacy API mixed a
    // content-relative field position with a screen-relative keyboard
    // position. This function only ever accepts one coordinate space, so
    // there is no seam left for that mismatch to reappear in.
    const visible = { top: 0, height: 480 };
    const target = { top: 480, height: 66 }; // sits exactly at the visible edge
    const scrollTo = computeRevealScrollTo({ visible, target, currentOffset: 0, padding: 0 });

    expect(scrollTo).toBe(66);
  });

  describe('with a trailing CTA (e.g. the screen footer)', () => {
    it('pulls the CTA into view alongside the field when there is room for both', () => {
      // Password focused near the top of a keyboard-shrunk 500pt viewport;
      // the Create Account button sits just below it. Both fit together.
      const scrollTo = computeRevealScrollTo({
        visible: { top: 0, height: 500 },
        target: { top: 40, height: 66 },
        trailing: { top: 120, height: 56 },
        currentOffset: 0,
        padding: 24,
      });

      expect(scrollTo).toBeUndefined(); // 120 + 56 + 24 = 200, well within 500
    });

    it('scrolls enough to reveal a trailing CTA that sits below the visible area', () => {
      const scrollTo = computeRevealScrollTo({
        visible: { top: 0, height: 500 },
        target: { top: 300, height: 66 },
        trailing: { top: 420, height: 70 },
        currentOffset: 0,
        padding: 24,
      });

      expect(scrollTo).toBe(14); // (420 + 70 + 24) - 500
    });

    it('never scrolls the focused field itself off the top edge to chase a CTA that cannot fully fit', () => {
      // An extreme short viewport where field + CTA together exceed the
      // available height. The field must win — it is what the user is
      // actively typing into. Uncapped, revealing the CTA fully would need
      // to scroll by (120+56+24-150)=50, which would push the field's own
      // top from 40 to -10 (off the top edge). The field's own top is the
      // hard ceiling on how far this can scroll.
      const scrollTo = computeRevealScrollTo({
        visible: { top: 0, height: 150 },
        target: { top: 40, height: 66 },
        trailing: { top: 120, height: 56 },
        currentOffset: 0,
        padding: 24,
      });

      expect(scrollTo).toBe(40); // capped at target.top - visible.top, not the full 50
    });
  });
});
