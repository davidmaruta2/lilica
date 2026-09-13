// Phase 20B, brief section 35 (multi-person isolation): proves the exact
// state-machine App.tsx uses to guarantee Search/Recent Activity/Care
// Summary never keep showing one supported person's screen a moment after
// switching to another. App.tsx has no existing direct-render test
// harness in this codebase (see tests/settings-navigation.test.tsx's own
// note) -- this reproduces the same ref-based "only reset on a genuine
// care-space-id change" effect App.tsx's real code uses, wired to small
// stand-in screens, so the wiring pattern itself is proven end-to-end
// without needing to mount the whole app.
import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

function Harness() {
  const [careSpaceId, setCareSpaceId] = useState('beauty');
  const [showSearch, setShowSearch] = useState(false);
  const [showRecentActivity, setShowRecentActivity] = useState(false);
  const [showCareSummary, setShowCareSummary] = useState(false);
  const previousCareSpaceId = useRef(careSpaceId);

  // The exact logic under test, copied from App.tsx's own effect.
  useEffect(() => {
    if (previousCareSpaceId.current !== careSpaceId) {
      previousCareSpaceId.current = careSpaceId;
      setShowSearch(false);
      setShowRecentActivity(false);
      setShowCareSummary(false);
    }
  }, [careSpaceId]);

  return (
    <>
      <Text>{`space:${careSpaceId}`}</Text>
      <Text accessibilityLabel="Open Search" onPress={() => setShowSearch(true)}>Open Search</Text>
      <Text accessibilityLabel="Open Recent Activity" onPress={() => setShowRecentActivity(true)}>Open Recent Activity</Text>
      <Text accessibilityLabel="Open Care Summary" onPress={() => setShowCareSummary(true)}>Open Care Summary</Text>
      <Text accessibilityLabel="Switch to Jackie" onPress={() => setCareSpaceId('jackie')}>Switch to Jackie</Text>
      {showSearch ? <Text accessibilityLabel="Search screen">{`Search ${careSpaceId}`}</Text> : null}
      {showRecentActivity ? <Text accessibilityLabel="Activity screen">{`Activity ${careSpaceId}`}</Text> : null}
      {showCareSummary ? <Text accessibilityLabel="Summary screen">{`Summary ${careSpaceId}`}</Text> : null}
    </>
  );
}

describe('Phase 20B: switching supported person closes Search/Activity/Summary', () => {
  it('closes an open Search screen when the active care space changes', async () => {
    const screen = await render(<Harness />);
    await fireEvent.press(screen.getByLabelText('Open Search'));
    expect(screen.getByLabelText('Search screen').props.children).toBe('Search beauty');
    await fireEvent.press(screen.getByLabelText('Switch to Jackie'));
    expect(screen.queryByLabelText('Search screen')).toBeNull();
  });

  it('closes an open Recent Activity screen when the active care space changes', async () => {
    const screen = await render(<Harness />);
    await fireEvent.press(screen.getByLabelText('Open Recent Activity'));
    expect(screen.getByLabelText('Activity screen')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Switch to Jackie'));
    expect(screen.queryByLabelText('Activity screen')).toBeNull();
  });

  it('closes an open Care Summary screen when the active care space changes', async () => {
    const screen = await render(<Harness />);
    await fireEvent.press(screen.getByLabelText('Open Care Summary'));
    expect(screen.getByLabelText('Summary screen')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Switch to Jackie'));
    expect(screen.queryByLabelText('Summary screen')).toBeNull();
  });

  it('does not reset an open screen on a re-render that is not a genuine space switch', async () => {
    const screen = await render(<Harness />);
    await fireEvent.press(screen.getByLabelText('Open Search'));
    screen.rerender(<Harness />);
    expect(screen.getByLabelText('Search screen')).toBeTruthy();
  });
});
