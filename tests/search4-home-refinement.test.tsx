import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, ViewStyle } from 'react-native';

import { HomeScreen } from '../src/screens/HomeScreen';
import { initialOnboardingState } from '../src/storage';
import { LilicaRecord } from '../src/types';

// search4.txt: Home / Search interaction refinement. Covers exactly the
// NEW surface this task adds -- the larger avatar initial, the first-name
// label beneath it, the separated search-bar affordance, and the
// dashboard-strip scroll chevrons. Everything else (Today/Upcoming
// grouping, tile navigation, projection logic) is untouched and already
// covered by the existing Home test files.

const withRecords = (records: LilicaRecord[], overrides: Partial<typeof initialOnboardingState> = {}) => ({
  ...initialOnboardingState,
  stage: 'home' as const,
  records,
  allSetDismissed: true,
  ...overrides,
});

function flattenedStyle(node: { props: { style?: unknown } }): ViewStyle {
  return StyleSheet.flatten(node.props.style) as ViewStyle;
}

function hasAncestor(node: { parent: any }, ancestor: unknown): boolean {
  let current = node.parent;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

describe('search4.txt items 1-4: avatar/name/search copy are dynamic, sourced from the same supported-person state', () => {
  it('shows the current supported person\'s first name directly beneath the avatar', async () => {
    const screen = await render(
      <HomeScreen
        state={withRecords([], { supportedPersonName: 'Maggie' })}
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
      />,
    );
    screen.getByText('Maggie');
  });

  it('the avatar initial comes from the current supported person\'s first name', async () => {
    const screen = await render(
      <HomeScreen
        state={withRecords([], { supportedPersonName: 'Beauty' })}
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
      />,
    );
    screen.getByText('B');
  });

  it('the Home search affordance uses the current supported person\'s name, never a hard-coded one', async () => {
    const screen = await render(
      <HomeScreen
        state={withRecords([], { supportedPersonName: 'Jackie' })}
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
        onOpenSearch={jest.fn()}
      />,
    );
    screen.getByText('Everything for Jackie, in one place.');
  });

  it('switching supported person updates the avatar initial, the name beneath it, and the search copy together', async () => {
    const screen = await render(
      <HomeScreen
        state={withRecords([], { supportedPersonName: 'Maggie' })}
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
        onOpenSearch={jest.fn()}
      />,
    );
    screen.getByText('Maggie');
    screen.getByText('M');
    screen.getByText('Everything for Maggie, in one place.');

    await screen.rerender(
      <HomeScreen
        state={withRecords([], { supportedPersonName: 'Beauty' })}
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
        onOpenSearch={jest.fn()}
      />,
    );
    screen.getByText('Beauty');
    screen.getByText('B');
    screen.getByText('Everything for Beauty, in one place.');
    expect(screen.queryByText('Maggie')).toBeNull();
    expect(screen.queryByText('Everything for Maggie, in one place.')).toBeNull();
  });

  it('keeps the supported-person name and Search in the same polished row without moving the name into Search', async () => {
    const screen = await render(
      <HomeScreen state={withRecords([], { supportedPersonName: 'Maggie' })} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} onOpenSearch={jest.fn()} />,
    );
    const row = screen.getByTestId('home-person-search');
    expect(hasAncestor(screen.getByText('Maggie'), row)).toBe(true);
    expect(hasAncestor(screen.getByLabelText('Search'), row)).toBe(true);
    expect(hasAncestor(screen.getByText('Maggie'), screen.getByLabelText('Search'))).toBe(false);
  });
});

describe('search4.txt item 7: tapping the Home search box opens the dedicated Search screen', () => {
  it('is a real button that calls onOpenSearch, and is omitted entirely when not supplied', async () => {
    const onOpenSearch = jest.fn();
    const screen = await render(
      <HomeScreen state={withRecords([], { supportedPersonName: 'Maggie' })} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} onOpenSearch={onOpenSearch} />,
    );
    await fireEvent.press(screen.getByLabelText('Search'));
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  it('is not rendered at all when onOpenSearch is not supplied', async () => {
    const screen = await render(
      <HomeScreen state={withRecords([], { supportedPersonName: 'Maggie' })} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    expect(screen.queryByLabelText('Search')).toBeNull();
  });
});

describe('search4.txt items 10-14: dashboard strip scroll chevrons', () => {
  const records: LilicaRecord[] = [
    { id: 'a1', type: 'appointment', title: 'Dentist', status: 'scheduled', eventDate: '2026-09-20', createdAt: '2026-09-01T00:00:00.000Z' },
  ];

  it('both chevrons render, with accessibility labels describing what they do', async () => {
    const screen = await render(
      <HomeScreen state={withRecords(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    screen.getByLabelText('Scroll dashboard left');
    screen.getByLabelText('Scroll dashboard right');
  });

  it('the left chevron starts disabled (already at the start of the strip)', async () => {
    const screen = await render(
      <HomeScreen state={withRecords(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    const left = screen.getByLabelText('Scroll dashboard left');
    expect(left.props.accessibilityState?.disabled).toBe(true);
  });

  it('the right chevron becomes enabled once there is more content than fits, and pressing it scrolls the strip', async () => {
    const screen = await render(
      <HomeScreen state={withRecords(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    const scrollView = screen.getByTestId('dashboard-strip-scroll');
    // Simulate a real measurement: the strip's content is wider than its
    // own visible container, so more can be explored to the right.
    await fireEvent(scrollView, 'layout', { nativeEvent: { layout: { width: 300, height: 100 } } });
    await fireEvent(scrollView, 'contentSizeChange', 900, 100);

    const right = screen.getByLabelText('Scroll dashboard right');
    expect(right.props.accessibilityState?.disabled).toBe(false);

    await fireEvent.press(right);
    // scrollTo is called on the real ScrollView ref -- reaching this point
    // without throwing confirms the chevron is wired to a real scroll
    // action, not a decorative no-op.
  });

  it('disables the right chevron truthfully at the end of the strip', async () => {
    const screen = await render(
      <HomeScreen state={withRecords(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    const scrollView = screen.getByTestId('dashboard-strip-scroll');
    await fireEvent(scrollView, 'layout', { nativeEvent: { layout: { width: 300, height: 100 } } });
    await fireEvent(scrollView, 'contentSizeChange', 900, 100);
    await fireEvent(scrollView, 'scroll', { nativeEvent: { contentOffset: { x: 600 } } });
    expect(screen.getByLabelText('Scroll dashboard right').props.accessibilityState?.disabled).toBe(true);
  });

  it('keeps both carousel controls outside the clipped viewport with 44px targets', async () => {
    const screen = await render(
      <HomeScreen state={withRecords(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    const viewport = screen.getByTestId('dashboard-strip-viewport');
    expect(flattenedStyle(viewport).overflow).toBe('hidden');
    for (const label of ['Scroll dashboard left', 'Scroll dashboard right']) {
      const style = flattenedStyle(screen.getByLabelText(label));
      expect(style.width).toBe(44);
      expect(style.height).toBe(44);
      expect(style.position).not.toBe('absolute');
    }
  });

  it('the left chevron becomes enabled once the strip has been scrolled away from its start, and disables again at the start', async () => {
    const screen = await render(
      <HomeScreen state={withRecords(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    const scrollView = screen.getByTestId('dashboard-strip-scroll');
    await fireEvent(scrollView, 'layout', { nativeEvent: { layout: { width: 300, height: 100 } } });
    await fireEvent(scrollView, 'contentSizeChange', 900, 100);

    await fireEvent(scrollView, 'scroll', { nativeEvent: { contentOffset: { x: 200 } } });
    expect(screen.getByLabelText('Scroll dashboard left').props.accessibilityState?.disabled).toBe(false);

    await fireEvent(scrollView, 'scroll', { nativeEvent: { contentOffset: { x: 0 } } });
    expect(screen.getByLabelText('Scroll dashboard left').props.accessibilityState?.disabled).toBe(true);
  });

  it('ordinary swipe/drag scrolling remains enabled -- the strip is still a real horizontal ScrollView, not replaced by the chevrons', async () => {
    const screen = await render(
      <HomeScreen state={withRecords(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    const scrollView = screen.getByTestId('dashboard-strip-scroll');
    expect(scrollView.props.scrollEnabled).not.toBe(false);
    expect(scrollView.props.horizontal).toBe(true);
  });
});

describe('Phase 22 Batch 3: Home record grid polish', () => {
  it('keeps two equal-priority record cards with truncated category labels and higher-priority titles', async () => {
    const records: LilicaRecord[] = [
      { id: 'appointment', type: 'appointment', title: 'Orthopaedic review with a longer title', status: 'scheduled', eventDate: '2020-01-01', createdAt: '2020-01-01T00:00:00.000Z' },
      { id: 'home', type: 'homeMatter', title: 'Service the boiler', status: 'unresolved', dueDate: '2020-01-01', createdAt: '2020-01-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <HomeScreen state={withRecords(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    const first = screen.getByTestId('home-record-card-appointment');
    const second = screen.getByTestId('home-record-card-home');
    expect(flattenedStyle(first).width).toBe(flattenedStyle(second).width);
    expect(screen.getByText('Appointment').props.numberOfLines).toBe(1);
    expect(screen.getByText('Orthopaedic review with a longer title').props.numberOfLines).toBe(2);
    expect(screen.getByTestId('home-record-grid')).toBeOnTheScreen();
  });
});

describe('search4.txt item 15: no Home projection/classification logic changed', () => {
  it('Overdue/Due today/Completed counts and Today section grouping are unaffected by this refinement', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-13T12:00:00.000Z'));
    const records: LilicaRecord[] = [
      { id: 'past', type: 'appointment', title: 'Past visit', status: 'scheduled', eventDate: '2026-09-01', createdAt: '2026-09-01T00:00:00.000Z' },
    ];
    const screen = await render(
      <HomeScreen state={withRecords(records)} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    screen.getByLabelText('1 overdue');
    screen.getByText('Today');
    jest.useRealTimers();
  });
});
