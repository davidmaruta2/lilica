// Phase 20D: the archive-specific counterpart to ReadOnlyGate.tsx --
// deliberately its OWN wording (brief section 7: never reuse billing/
// read-only copy for a different reason).
import { fireEvent, render } from '@testing-library/react-native';

import { ArchivedGate } from '../src/components/ArchivedGate';

describe('ArchivedGate', () => {
  it('names the person, and never uses billing/subscription wording', async () => {
    const screen = await render(
      <ArchivedGate visible personName="Maggie" canRestore onRestore={jest.fn()} onClose={jest.fn()} />,
    );
    screen.getByText("Maggie's care is archived");
    expect(screen.queryByText(/subscri/i)).toBeNull();
    expect(screen.queryByText(/£8\.99/)).toBeNull();
  });

  it('offers Restore only when the viewer can restore (an organiser)', async () => {
    const onRestore = jest.fn();
    const screen = await render(
      <ArchivedGate visible personName="Maggie" canRestore onRestore={onRestore} onClose={jest.fn()} />,
    );
    await fireEvent.press(screen.getByText("Restore Maggie's care"));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('a non-organiser sees no Restore action, only OK', async () => {
    const screen = await render(
      <ArchivedGate visible personName="Maggie" canRestore={false} onRestore={jest.fn()} onClose={jest.fn()} />,
    );
    expect(screen.queryByText(/Restore/)).toBeNull();
    screen.getByText('OK');
  });
});
