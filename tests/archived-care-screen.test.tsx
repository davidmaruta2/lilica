// Phase 20D, Part A: the "intentional archived-care management route" the
// brief requires (section 6) -- archived care spaces are hidden from
// ordinary navigation, but must never disappear irretrievably.
import { fireEvent, render } from '@testing-library/react-native';

import { ArchivedCareScreen } from '../src/screens/ArchivedCareScreen';

describe('ArchivedCareScreen', () => {
  it('shows a calm empty state when nothing is archived', async () => {
    const screen = await render(<ArchivedCareScreen archivedSpaces={[]} onBack={jest.fn()} onRestore={jest.fn()} />);
    screen.getByText('No archived care spaces.');
  });

  it('lists every archived care space, identifying each by name', async () => {
    const screen = await render(
      <ArchivedCareScreen
        archivedSpaces={[{ careSpaceId: 'space-1', displayName: 'Maggie' }, { careSpaceId: 'space-2', displayName: 'Ben' }]}
        onBack={jest.fn()}
        onRestore={jest.fn()}
      />,
    );
    screen.getByText('Maggie');
    screen.getByText('Ben');
  });

  it('restoring calls the real handler with the right care space, and reports success', async () => {
    const onRestore = jest.fn().mockResolvedValue({ ok: true });
    const screen = await render(
      <ArchivedCareScreen archivedSpaces={[{ careSpaceId: 'space-1', displayName: 'Maggie' }]} onBack={jest.fn()} onRestore={onRestore} />,
    );
    await fireEvent.press(screen.getByLabelText('Restore Maggie'));
    expect(onRestore).toHaveBeenCalledWith('space-1');
    await screen.findByText("Maggie's care has been restored.");
  });

  it('a genuine failure surfaces the real message', async () => {
    const onRestore = jest.fn().mockResolvedValue({ ok: false, message: 'Only an active organiser can restore it' });
    const screen = await render(
      <ArchivedCareScreen archivedSpaces={[{ careSpaceId: 'space-1', displayName: 'Maggie' }]} onBack={jest.fn()} onRestore={onRestore} />,
    );
    await fireEvent.press(screen.getByLabelText('Restore Maggie'));
    await screen.findByText('Only an active organiser can restore it');
  });

  it('Back calls the real handler', async () => {
    const onBack = jest.fn();
    const screen = await render(<ArchivedCareScreen archivedSpaces={[]} onBack={onBack} onRestore={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
