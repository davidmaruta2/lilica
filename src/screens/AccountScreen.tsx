import { StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { colors, radius, spacing } from '../theme';

// Phase 13: this screen used to sit directly behind the tab labelled with
// the supported person's name, with copy promising a person knowledge
// space it never actually delivered ("Keep their appointments, home
// details, documents and contacts together here"). That real knowledge
// space is now PersonScreen.tsx; this screen is reached from its "Account"
// link and is purely the organiser's own account settings.
export function AccountScreen({ displayName, email, signingOut, error, onBack, onSignOut }: {
  displayName: string;
  email?: string;
  signingOut: boolean;
  error?: string;
  onBack?: () => void;
  onSignOut: () => void;
}) {
  return (
    <Screen>
      {onBack ? <Header onBack={onBack} /> : null}
      <View style={styles.content}>
        <AppText variant="section" centre>Your account</AppText>
        <View style={styles.avatar}><AppText variant="title" tone="primary">{displayName.slice(0, 1).toUpperCase()}</AppText></View>
        <AppText variant="title" centre>{displayName}</AppText>
        {email ? <AppText variant="secondary" tone="soft" centre>{email}</AppText> : null}
        {error ? <AppText variant="secondary" tone="danger" centre accessibilityRole="alert">{error}</AppText> : null}
        <Button label={signingOut ? 'Signing out...' : 'Sign out'} variant="secondary" disabled={signingOut} onPress={onSignOut} style={styles.button} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: spacing.sm, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  avatar: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.oliveSoft, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
  button: { width: '100%', marginTop: spacing.xl },
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
