import AsyncStorage from '@react-native-async-storage/async-storage';

import { trackActivationEvent } from '../src/activationEvents';

const mockRpc = jest.fn();
jest.mock('../src/auth/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

describe('trackActivationEvent', () => {
  beforeEach(async () => {
    mockRpc.mockReset();
    await AsyncStorage.clear();
  });

  it('sends only the event name plus platform and app version', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await trackActivationEvent('user-1', 'first_record_added');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [fn, args] = mockRpc.mock.calls[0];
    expect(fn).toBe('log_activation_event');
    expect(Object.keys(args).sort()).toEqual(['p_app_version', 'p_event_name', 'p_platform']);
    expect(args.p_event_name).toBe('first_record_added');
  });

  it('does not call the server again once it has accepted the event', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await trackActivationEvent('user-1', 'person_added');
    await trackActivationEvent('user-1', 'person_added');
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('keeps users separate on the same device', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await trackActivationEvent('user-1', 'person_added');
    await trackActivationEvent('user-2', 'person_added');
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it('retries later if the server rejected it, and never throws', async () => {
    mockRpc.mockResolvedValueOnce({ error: { message: 'offline' } });
    await expect(trackActivationEvent('user-1', 'invite_created')).resolves.toBeUndefined();
    mockRpc.mockResolvedValueOnce({ error: null });
    await trackActivationEvent('user-1', 'invite_created');
    expect(mockRpc).toHaveBeenCalledTimes(2);
    mockRpc.mockRejectedValueOnce(new Error('network down'));
    await expect(trackActivationEvent('user-1', 'care_summary_created')).resolves.toBeUndefined();
  });

  it('does nothing without a signed-in user', async () => {
    await trackActivationEvent(undefined, 'account_ready');
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
