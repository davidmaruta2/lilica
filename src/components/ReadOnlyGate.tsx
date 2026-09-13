import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { AppText } from './Text';
import { EntitlementStatus } from '../entitlement';
import { colors, radius, shadow, spacing } from '../theme';

// Phase 21C: the ONE reusable read-only/commercial-state treatment for the
// whole app -- every mutation entry point this phase gates (Home/To Do/
// People Add, RecordDetail Edit, Care Circle Invite) shows this exact same
// modal rather than each screen inventing its own warning (brief section
// 7's own explicit requirement). Calm and matter-of-fact by design: no red
// error styling, no countdown, no repeated-modal spam (it only ever
// appears in direct response to an explicit tap, never proactively/
// automatically).
//
// Two distinct variants, never conflated (brief section 16/17): the
// COMMERCIAL OWNER sees their own real status and a genuine Subscribe
// route; a COLLABORATOR sees only the functional "this care space is
// read-only" fact and is never told to buy their own subscription, since
// their own subscription would not unlock someone else's care space.
type Props = {
  visible: boolean;
  isCommercialOwner: boolean;
  ownerEntitlementStatus?: EntitlementStatus;
  onSubscribe: () => void;
  onClose: () => void;
};

function ownerHeadline(status?: EntitlementStatus): string {
  switch (status) {
    case 'SUBSCRIPTION_EXPIRED':
      return 'Your subscription has ended';
    case 'REVOKED':
      return 'Your subscription is no longer active';
    case 'BILLING_RETRY':
      return 'There was a problem with your last payment';
    default:
      // TRIAL_EXPIRED, or anything else read-only for a reason this
      // modal doesn't need to distinguish further.
      return 'Your free period has ended';
  }
}

export function ReadOnlyGate({ visible, isCommercialOwner, ownerEntitlementStatus, onSubscribe, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          {isCommercialOwner ? (
            <>
              <AppText variant="title">{ownerHeadline(ownerEntitlementStatus)}</AppText>
              <AppText variant="body" tone="soft" style={styles.body}>
                Your information is safe and you can still view everything you've saved.
              </AppText>
              <AppText variant="body" tone="soft" style={styles.body}>
                Subscribe for £8.99/year to continue adding or making changes.
              </AppText>
              <Button label="Subscribe for £8.99/year" onPress={onSubscribe} />
              <Button label="Not now" variant="text" onPress={onClose} />
            </>
          ) : (
            <>
              <AppText variant="title">This care space is currently read-only</AppText>
              <AppText variant="body" tone="soft" style={styles.body}>
                Existing information is still available, but new information and changes are paused until the subscription for this care space is active again.
              </AppText>
              <Button label="OK" onPress={onClose} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(36,29,28,0.4)',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.soft,
  },
  body: {
    lineHeight: 20,
  },
});
