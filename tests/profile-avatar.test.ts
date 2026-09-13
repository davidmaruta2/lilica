// Profile pictures: src/profileAvatar.ts's client wrapper. The real
// authorisation boundary (owner-only read/write) is enforced server-side
// and covered by supabase/tests/database/profile_avatars.test.sql -- this
// file only proves the client wraps those calls correctly.

const mockRequestMediaLibraryPermissions = jest.fn();
const mockLaunchImageLibrary = jest.fn();
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockRequestMediaLibraryPermissions(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockLaunchImageLibrary(...args),
}));

jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
  },
}));

const mockUpload = jest.fn();
const mockCreateSignedUrl = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
jest.mock('../src/auth/client', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
      }),
    },
    from: () => ({
      update: (...args: unknown[]) => { mockUpdate(...args); return { eq: (...eqArgs: unknown[]) => mockEq(...eqArgs) }; },
    }),
  },
}));

import { pickProfilePhoto, resolveAvatarUrl, uploadProfilePhoto } from '../src/profileAvatar';

beforeEach(() => {
  jest.clearAllMocks();
  mockEq.mockResolvedValue({ error: null });
  mockUpload.mockResolvedValue({ error: null });
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/avatar.jpg' }, error: null });
});

describe('pickProfilePhoto', () => {
  it('returns denied with a real message when permission is refused', async () => {
    mockRequestMediaLibraryPermissions.mockResolvedValue({ granted: false });
    const result = await pickProfilePhoto();
    expect(result).toEqual({ status: 'denied', message: expect.any(String) });
    expect(mockLaunchImageLibrary).not.toHaveBeenCalled();
  });

  it('returns cancelled when the user backs out of the picker -- never an error', async () => {
    mockRequestMediaLibraryPermissions.mockResolvedValue({ granted: true });
    mockLaunchImageLibrary.mockResolvedValue({ canceled: true, assets: [] });
    const result = await pickProfilePhoto();
    expect(result).toEqual({ status: 'cancelled' });
  });

  it('returns the picked photo uri, square-cropped', async () => {
    mockRequestMediaLibraryPermissions.mockResolvedValue({ granted: true });
    mockLaunchImageLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///photo.jpg' }] });
    const result = await pickProfilePhoto();
    expect(result).toEqual({ status: 'picked', uri: 'file:///photo.jpg' });
    expect(mockLaunchImageLibrary).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }));
  });
});

describe('uploadProfilePhoto', () => {
  it('uploads to a fixed per-user path and updates profiles.avatar_path only after the upload succeeds', async () => {
    const result = await uploadProfilePhoto('user-1', 'file:///photo.jpg');
    expect(mockUpload).toHaveBeenCalledWith('user-1/avatar.jpg', expect.anything(), expect.objectContaining({ upsert: true }));
    expect(mockUpdate).toHaveBeenCalledWith({ avatar_path: 'user-1/avatar.jpg' });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
    expect(result).toEqual({ ok: true, avatarPath: 'user-1/avatar.jpg' });
  });

  it('never updates the profile row when the byte upload itself fails', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'storage error' } });
    const result = await uploadProfilePhoto('user-1', 'file:///photo.jpg');
    expect(result.ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('fails gracefully when the database update fails, never throws', async () => {
    mockEq.mockResolvedValue({ error: { message: 'db error' } });
    const result = await uploadProfilePhoto('user-1', 'file:///photo.jpg');
    expect(result.ok).toBe(false);
  });
});

describe('resolveAvatarUrl', () => {
  it('returns undefined when there is no avatar path at all', async () => {
    const result = await resolveAvatarUrl(undefined);
    expect(result).toBeUndefined();
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it('returns a fresh signed URL for an existing avatar path', async () => {
    const result = await resolveAvatarUrl('user-1/avatar.jpg');
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('user-1/avatar.jpg', expect.any(Number));
    expect(result).toBe('https://signed.example/avatar.jpg');
  });

  it('returns undefined (never throws) when the signed URL cannot be created', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const result = await resolveAvatarUrl('user-1/avatar.jpg');
    expect(result).toBeUndefined();
  });
});
