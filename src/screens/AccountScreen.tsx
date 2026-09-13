import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { TextField } from '../components/TextField';
import { resolveAvatarUrl } from '../profileAvatar';
import { colors, radius, spacing } from '../theme';
import { PermissionState } from '../notifications';

// Phase 13: this screen used to sit directly behind the tab labelled with
// the supported person's name, with copy promising a person knowledge
// space it never actually delivered ("Keep their appointments, home
// details, documents and contacts together here"). That real knowledge
// space is now PersonScreen.tsx; this screen is reached from its "Account"
// link and is purely the organiser's own account settings.
//
// Phase 14: gained a minimal Reminders section -- master on/off, current
// permission status, and a quiet-hours toggle. Deliberately simple (brief
// section 26): no per-record controls here, those live on the record
// editor itself; no custom quiet-hour time picker yet (see
// docs/PHASE_14_ARCHITECTURE.md's known limitations).
export function AccountScreen({
  displayName,
  email,
  avatarPath,
  signingOut,
  error,
  remindersEnabled,
  reminderPermissionState,
  quietHoursEnabled,
  quietHoursLabel,
  onToggleReminders,
  onToggleQuietHours,
  onSaveDisplayName,
  onChangePhoto,
  onBack,
  onSignOut,
}: {
  displayName: string;
  email?: string;
  // A profile photo is optional -- most organisers will still just see
  // their initial letter, exactly as before, until they choose to add
  // one.
  avatarPath?: string;
  signingOut: boolean;
  error?: string;
  remindersEnabled: boolean;
  reminderPermissionState: PermissionState;
  quietHoursEnabled: boolean;
  quietHoursLabel: string;
  onToggleReminders: (enabled: boolean) => void;
  onToggleQuietHours: (enabled: boolean) => void;
  // Phase 18: reuses AuthProvider's own existing saveProfile() -- the
  // exact same function onboarding's "About you" step already calls --
  // so there is only ever one place that writes profiles.display_name.
  // Never touches a supported person's own name/identity, a separate
  // table entirely.
  onSaveDisplayName: (name: string) => Promise<{ ok: boolean; message?: string }>;
  // Picks a photo, uploads it, and refreshes the profile -- see
  // src/profileAvatar.ts and App.tsx's handlePickProfilePhoto. Resolves
  // {ok:true} on a genuine save, {ok:false} with a real message on
  // denial/failure, and {ok:true, cancelled:true} if the user simply
  // backed out of the picker (never an error in that case).
  onChangePhoto: () => Promise<{ ok: boolean; message?: string; cancelled?: boolean }>;
  onBack?: () => void;
  onSignOut: () => void;
}) {
  const unsupported = reminderPermissionState === 'unsupported';
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState<string>();
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string>();

  useEffect(() => {
    let active = true;
    resolveAvatarUrl(avatarPath).then((url) => { if (active) setAvatarUrl(url); });
    return () => { active = false; };
  }, [avatarPath]);

  async function saveName() {
    setNameBusy(true);
    const result = await onSaveDisplayName(nameDraft);
    setNameBusy(false);
    if (result.ok) {
      setEditingName(false);
      setNameError(undefined);
    } else {
      setNameError(result.message ?? 'Your name could not be saved. Please try again.');
    }
  }

  async function changePhoto() {
    setPhotoBusy(true);
    setPhotoError(undefined);
    const result = await onChangePhoto();
    setPhotoBusy(false);
    if (!result.ok && !result.cancelled) {
      setPhotoError(result.message ?? 'Your photo could not be saved. Please try again.');
    }
  }

  return (
    <Screen>
      {onBack ? <Header onBack={onBack} /> : null}
      <View style={styles.content}>
        <AppText variant="section" centre>Your account</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Change your photo" onPress={() => void changePhoto()} disabled={photoBusy}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <AppText variant="title" tone="primary">{displayName.slice(0, 1).toUpperCase()}</AppText>
            )}
          </View>
          <AppText variant="secondary" tone="primary" centre style={styles.changePhotoLabel}>
            {photoBusy ? 'Saving…' : avatarUrl ? 'Change photo' : 'Add photo'}
          </AppText>
        </Pressable>
        {photoError ? <AppText variant="secondary" tone="danger" centre>{photoError}</AppText> : null}
        {editingName ? (
          <View style={styles.nameEdit}>
            <TextField compact label="Your name" value={nameDraft} onChangeText={setNameDraft} autoFocus />
            {nameError ? <AppText variant="secondary" tone="danger">{nameError}</AppText> : null}
            <View style={styles.nameEditActions}>
              <Button label="Cancel" variant="text" onPress={() => { setEditingName(false); setNameDraft(displayName); setNameError(undefined); }} style={styles.nameEditButton} />
              <Button label={nameBusy ? 'Saving…' : 'Save'} disabled={nameBusy || nameDraft.trim().length === 0} onPress={() => void saveName()} style={styles.nameEditButton} />
            </View>
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Edit your name" onPress={() => setEditingName(true)}>
            <AppText variant="title" centre>{displayName}</AppText>
            <AppText variant="secondary" tone="primary" centre>Edit name</AppText>
          </Pressable>
        )}
        {email ? <AppText variant="secondary" tone="soft" centre>{email}</AppText> : null}
        {error ? <AppText variant="secondary" tone="danger" centre accessibilityRole="alert">{error}</AppText> : null}

        {!unsupported ? (
          <View style={styles.section}>
            <AppText variant="section">Reminders</AppText>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: remindersEnabled }}
              onPress={() => onToggleReminders(!remindersEnabled)}
              style={styles.row}
            >
              <View style={styles.rowCopy}>
                <AppText variant="bodyStrong">Remind me about things that need attention</AppText>
                {reminderPermissionState === 'denied' ? (
                  <AppText variant="secondary" tone="soft">Notifications are turned off for Lilica in your device settings.</AppText>
                ) : null}
              </View>
              <View style={[styles.checkbox, remindersEnabled && styles.checkboxSelected]}>{remindersEnabled ? <View style={styles.tick} /> : null}</View>
            </Pressable>

            {remindersEnabled ? (
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: quietHoursEnabled }}
                onPress={() => onToggleQuietHours(!quietHoursEnabled)}
                style={styles.row}
              >
                <View style={styles.rowCopy}>
                  <AppText variant="bodyStrong">Quiet hours</AppText>
                  <AppText variant="secondary" tone="soft">No reminders {quietHoursLabel}</AppText>
                </View>
                <View style={[styles.checkbox, quietHoursEnabled && styles.checkboxSelected]}>{quietHoursEnabled ? <View style={styles.tick} /> : null}</View>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Button label={signingOut ? 'Signing out...' : 'Sign out'} variant="secondary" disabled={signingOut} onPress={onSignOut} style={styles.button} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: spacing.sm, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  avatar: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.oliveSoft, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  changePhotoLabel: { marginBottom: spacing.xs },
  nameEdit: { width: '100%', gap: spacing.sm },
  nameEditActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  nameEditButton: { width: 'auto', minHeight: 44, paddingHorizontal: spacing.md },
  button: { width: '100%', marginTop: spacing.xl },
  section: { width: '100%', marginTop: spacing.xl, gap: spacing.sm },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowCopy: { flex: 1, gap: 2 },
  checkbox: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: colors.primary },
  tick: { width: 11, height: 7, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: colors.white, transform: [{ rotate: '-45deg' }], marginTop: -2 },
});

export function ProfileErrorScreen({ message, onRetry, onSignOut }: { message: string; onRetry: () => void; onSignOut: () => void }) {
  return (
    <Screen>
      <View style={styles.content}>
        <AppText variant="title" centre>We couldn’t open your profile</AppText>
        <AppText variant="body" tone="soft" centre>{message}</AppText>
        <Button label="Try again" onPress={onRetry} style={styles.button} />
        <Button label="Sign out" variant="text" onPress={onSignOut} />
      </View>
    </Screen>
  );
}
