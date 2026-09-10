import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text, TouchableOpacity, View } from 'react-native';

const mockGetSession = jest.fn();
const mockGetUser = jest.fn();
const mockSignOut = jest.fn();
const mockInsert = jest.fn();
const mockMaybeSingle = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockVerifyOtp = jest.fn();

jest.mock('../src/auth/client', () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      resend: jest.fn(),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      setSession: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args) })),
      })),
      insert: (...args: unknown[]) => mockInsert(...args),
      update: jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) })),
    })),
  },
}));

import { AuthProvider, useAuth } from '../src/auth/AuthProvider';

const session = {
  access_token: 'access',
  refresh_token: 'refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-a', email: 'david@example.com' },
};

function Probe() {
  const auth = useAuth();
  if (auth.loading || auth.profileLoading) return <Text>loading</Text>;
  return (
    <View>
      <Text>{auth.session ? 'authenticated' : 'unauthenticated'}</Text>
      <Text>{auth.profile?.displayName ?? 'no profile'}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save profile" onPress={() => void auth.saveProfile('David')} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sign out" onPress={() => void auth.signOut()} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Verify recovery" onPress={() => void auth.verifyRecovery('david@example.com', '654321')} />
    </View>
  );
}

describe('Phase 5 authentication provider', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
    mockSignOut.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: session.user }, error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockVerifyOtp.mockResolvedValue({ data: { session }, error: null });
  });

  it('restores an authenticated session and loads only its organiser profile', async () => {
    mockGetSession.mockResolvedValue({ data: { session } });
    mockMaybeSingle.mockResolvedValue({ data: { id: 'user-a', display_name: 'David', avatar_path: null }, error: null });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('authenticated');
    screen.getByText('David');
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it('settles into the unauthenticated state when no session can be restored', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('unauthenticated');
    expect(screen.queryByText('David')).toBeNull();
  });

  it('clears a cached session when its server account has been deleted', async () => {
    mockGetSession.mockResolvedValue({ data: { session } });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { status: 403 } });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('unauthenticated');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it('creates a missing organiser profile against the authenticated account', async () => {
    mockGetSession.mockResolvedValue({ data: { session } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('no profile');
    await fireEvent.press(screen.getByLabelText('Save profile'));
    await waitFor(() => expect(mockInsert).toHaveBeenCalledWith({ id: 'user-a', display_name: 'David' }));
    await screen.findByText('David');
  });

  it('signs out without deleting existing local supported-person state', async () => {
    await AsyncStorage.setItem('lilica:onboarding:v1', JSON.stringify({ supportedPersonName: 'Margaret', records: [{ id: 'record-1' }] }));
    mockGetSession.mockResolvedValue({ data: { session } });
    mockMaybeSingle.mockResolvedValue({ data: { id: 'user-a', display_name: 'David', avatar_path: null }, error: null });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('authenticated');
    await fireEvent.press(screen.getByLabelText('Sign out'));
    await screen.findByText('unauthenticated');
    expect(await AsyncStorage.getItem('lilica:onboarding:v1')).toContain('Margaret');
  });

  it('verifies password recovery with the emailed OTP', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const screen = await render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('unauthenticated');
    await fireEvent.press(screen.getByLabelText('Verify recovery'));
    await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'david@example.com',
      token: '654321',
      type: 'recovery',
    }));
  });
});
