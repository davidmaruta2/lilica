import { render } from '@testing-library/react-native';

import { CalendarScreen } from '../src/screens/CalendarScreen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { PersonScreen } from '../src/screens/PersonScreen';
import { ToDoScreen } from '../src/screens/ToDoScreen';
import { initialOnboardingState } from '../src/storage';

// Corrective task 5: each of the four primary tabs leads with its own
// name as the main heading; the Lilica wordmark is retained only as a
// small, de-emphasised mark, never the dominant heading.

describe('Tab header titles', () => {
  it('Home leads with "Home", not the wordmark', async () => {
    const screen = await render(
      <HomeScreen state={{ ...initialOnboardingState, stage: 'home' }} onAddSomething={jest.fn()} onDismissAllSet={jest.fn()} />,
    );
    screen.getByText('Home');
    // The wordmark is still present (brand continuity) but as a small mark.
    screen.getByLabelText('Lilica');
  });

  it('Calendar leads with "Calendar"', async () => {
    const screen = await render(<CalendarScreen records={[]} onOpenRecord={jest.fn()} />);
    // The subtitle below also falls back to the word "Calendar" with no
    // person selected, so assert at least one -- not exactly one.
    expect(screen.getAllByText('Calendar').length).toBeGreaterThan(0);
    screen.getByLabelText('Lilica');
  });

  it('To Do leads with "To Do"', async () => {
    const screen = await render(
      <ToDoScreen records={[]} onOpenRecord={jest.fn()} onSaveRecord={jest.fn()} onAddSomething={jest.fn()} />,
    );
    screen.getByText('To Do');
    screen.getByLabelText('Lilica');
  });

  // Phase 23: renamed from "People" to "Care Circle" -- the page now
  // centres on Care Circle membership and Lilica Chat, not a broader
  // "people involved in care" framing (Key contacts moved to Settings).
  it('Care Circle leads with "Care Circle"', async () => {
    const screen = await render(
      <PersonScreen
        displayName="Maggie"
        relationshipLabel="Mum"
        isSelf={false}
        people={[]}
        activeCareSpaceId="space-a"
        onSwitchPerson={jest.fn()}
        onAddPerson={jest.fn()}
        onOpenSettings={jest.fn()}
      />,
    );
    screen.getByText('Care Circle');
    screen.getByLabelText('Lilica');
  });
});
