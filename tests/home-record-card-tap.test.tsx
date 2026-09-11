import { fireEvent, render } from '@testing-library/react-native';

import { HomeScreen } from '../src/screens/HomeScreen';
import { initialOnboardingState } from '../src/storage';
import { LilicaRecord } from '../src/types';

// Bug fix: unlike Calendar/To Do/Person/WellbeingUpdatesScreen, Home's own
// Today/Upcoming/Recently added record cards had never been wrapped in a
// Pressable -- there was no onOpenRecord prop at all, so tapping one did
// nothing ("the dashboard tiles should be enterable, they still aren't").

describe('Home record cards are tappable', () => {
  it('opens the tapped record via onOpenRecord, with its real id', async () => {
    const record: LilicaRecord = {
      id: 'appt-1', type: 'appointment', title: 'Orthopaedic', status: 'scheduled',
      eventDate: '2026-09-20', createdAt: '2026-09-01T00:00:00.000Z',
    };
    const onOpenRecord = jest.fn();
    const screen = await render(
      <HomeScreen
        state={{ ...initialOnboardingState, stage: 'home', records: [record], allSetDismissed: true }}
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
        onOpenRecord={onOpenRecord}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Open Orthopaedic'));
    expect(onOpenRecord).toHaveBeenCalledWith('appt-1');
  });

  it('the card is not a button when onOpenRecord is not supplied -- never a dead tap', async () => {
    const record: LilicaRecord = {
      id: 'appt-1', type: 'appointment', title: 'Orthopaedic', status: 'scheduled',
      eventDate: '2026-09-20', createdAt: '2026-09-01T00:00:00.000Z',
    };
    const screen = await render(
      <HomeScreen
        state={{ ...initialOnboardingState, stage: 'home', records: [record], allSetDismissed: true }}
        onAddSomething={jest.fn()}
        onDismissAllSet={jest.fn()}
      />,
    );
    const card = screen.getByLabelText('Open Orthopaedic');
    expect(card.props.accessibilityRole).toBeUndefined();
  });
});
