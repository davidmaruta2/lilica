// Profile pictures: lets an organiser add a real photo to their own
// account, replacing the initial-letter circle Account has always shown.
// `profiles.avatar_path` already existed (Phase 5) but nothing ever wrote
// or read it until now. Mirrors src/attachments.ts's own upload/signed-
// URL pattern rather than inventing a new one -- same `File` upload call,
// same short-lived signed URL for a private bucket.
//
// Scope, named rather than silently assumed: this only lets a user manage
// and see their OWN avatar (see supabase/migrations/20260912180000_
// profile_avatars.sql's own RLS -- owner-only read/write). Showing one
// member's photo to other care-circle members is a real, separate
// product decision not made here.

import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';

import { supabase } from './auth/client';

const BUCKET = 'profile-avatars';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export type PickPhotoResult =
  | { status: 'picked'; uri: string }
  | { status: 'cancelled' }
  | { status: 'denied'; message: string };

// Opens the device's photo library (never the camera directly -- a
// simple, familiar "choose a photo" flow), pre-cropped to a square so it
// reads well in every existing circular avatar slot.
export async function pickProfilePhoto(): Promise<PickPhotoResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { status: 'denied', message: 'Photo library access is needed to choose a picture.' };
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
  return { status: 'picked', uri: result.assets[0].uri };
}

export type UploadPhotoResult = { ok: true; avatarPath: string } | { ok: false; message: string };

// One fixed path per user ("{userId}/avatar.jpg") -- upsert overwrites,
// so changing your photo never accumulates orphaned old files. Never
// marks profiles.avatar_path until the byte upload itself has genuinely
// succeeded.
export async function uploadProfilePhoto(userId: string, localUri: string): Promise<UploadPhotoResult> {
  try {
    const path = `${userId}/avatar.jpg`;
    const localFile = new File(localUri);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, localFile, { upsert: true, contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
    if (dbError) throw dbError;

    return { ok: true, avatarPath: path };
  } catch {
    return { ok: false, message: 'Your photo could not be saved. Please try again.' };
  }
}

// Private bucket -- a short-lived signed URL each time it's displayed,
// same "no permanent public URL to rely on" approach as document
// attachments already use. Returns undefined (never throws) if the file
// is missing/unreachable, so the caller can fall back to the initial
// letter without a crash or a broken-image state.
export async function resolveAvatarUrl(avatarPath?: string): Promise<string | undefined> {
  if (!avatarPath) return undefined;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(avatarPath, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return undefined;
    return data.signedUrl;
  } catch {
    return undefined;
  }
}
