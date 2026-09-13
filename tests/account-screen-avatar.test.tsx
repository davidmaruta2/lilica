// Profile pictures: AccountScreen's own avatar UI. src/profileAvatar.ts's
// resolveAvatarUrl() is mocked at the module boundary -- this file proves
// the host screen's wiring, not the storage/signed-URL mechanics
// (covered in tests/profile-avatar.test.ts).
const mockResolveAvatarUrl = jest.fn();
jest.mock('../src/profileAvatar', () => ({
  resolveAvatarUrl: (...args: unknown[]) => mockResolveAvatarUrl(...args),
}));

import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AccountScreen } from '../src/screens/AccountScreen';

const baseProps = {
  displayName: 'David',
  email: 'david@example.com',
  signingOut: false,
  remindersEnabled: false,
  reminderPermissionState: 'undetermined' as const,
  quietHoursEnabled: false,
  quietHoursLabel: '9pm-8am',
  onToggleReminders: jest.fn(),
  onToggleQuietHours: jest.fn(),
  onSaveDisplayName: jest.fn(),
  onSignOut: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveAvatarUrl.mockResolvedValue(undefined);
});

describe('AccountScreen: profile photo', () => {
  it('shows the initial letter and "Add photo" when there is no avatar yet', async () => {
    const screen = await render(<AccountScreen {...baseProps} onChangePhoto={jest.fn()} />);
    screen.getByText('D');
    screen.getByText('Add photo');
  });

  it('shows the real photo and "Change photo" once an avatar path is set', async () => {
    mockResolveAvatarUrl.mockResolvedValue('https://signed.example/avatar.jpg');
    const screen = await render(<AccountScreen {...baseProps} avatarPath="user-1/avatar.jpg" onChangePhoto={jest.fn()} />);
    expect(mockResolveAvatarUrl).toHaveBeenCalledWith('user-1/avatar.jpg');
    await waitFor(() => screen.getByText('Change photo'));
    expect(screen.queryByText('D')).toBeNull();
  });

  it('tapping the avatar calls the real change-photo function', async () => {
    const onChangePhoto = jest.fn().mockResolvedValue({ ok: true });
    const screen = await render(<AccountScreen {...baseProps} onChangePhoto={onChangePhoto} />);
    await fireEvent.press(screen.getByLabelText('Change your photo'));
    expect(onChangePhoto).toHaveBeenCalledTimes(1);
  });

  it('shows the real error message on failure, and a cancelled picker shows nothing', async () => {
    const onChangePhoto = jest.fn().mockResolvedValue({ ok: false, message: 'Photo library access is needed to choose a picture.' });
    const screen = await render(<AccountScreen {...baseProps} onChangePhoto={onChangePhoto} />);
    await fireEvent.press(screen.getByLabelText('Change your photo'));
    await waitFor(() => screen.getByText('Photo library access is needed to choose a picture.'));
  });

  it('a cancelled picker never shows an error', async () => {
    const onChangePhoto = jest.fn().mockResolvedValue({ ok: true, cancelled: true });
    const screen = await render(<AccountScreen {...baseProps} onChangePhoto={onChangePhoto} />);
    await fireEvent.press(screen.getByLabelText('Change your photo'));
    await waitFor(() => expect(onChangePhoto).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/could not be saved/)).toBeNull();
  });
});
