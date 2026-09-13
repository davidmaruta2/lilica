import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, StyleSheet, View } from 'react-native';

import { CareCircleDomain, CareCircleMember, DOMAIN_LABELS } from '../careCircle';
import { colors, radius, shadow, spacing } from '../theme';
import { AppText } from './Text';

// Product direction (12 September 2026): tapping a Care Circle avatar
// used to do nothing at all. This softly pops out that member's real
// details -- a small, centred, fade/scale-in card, never a full-screen
// takeover -- reusing exactly the same CareCircleMember data the People
// screen's own preview and Settings' Care Circle management screen
// already read. No new data source, no fabricated detail.
type Props = {
  visible: boolean;
  member?: CareCircleMember;
  avatarTone: { chip: string; text: string };
  // The signed-in organiser's own resolved photo -- shown only when the
  // popup is opened for their own ("You") entry. Other members have no
  // avatar of their own available yet (see PersonScreen.tsx's own note).
  selfAvatarUrl?: string;
  onClose: () => void;
};

function roleLabel(role: CareCircleMember['role']) {
  if (role === 'organiser') return 'Organiser';
  if (role === 'contributor') return 'Contributor';
  return 'Viewer';
}

function roleDescription(role: CareCircleMember['role']) {
  if (role === 'organiser') return 'Full access -- can manage the care circle.';
  if (role === 'contributor') return 'Can view and update what is shared with them.';
  return 'Can view what is shared with them.';
}

function domainLabel(domain: CareCircleDomain) {
  return DOMAIN_LABELS[domain] ?? domain;
}

export function MemberDetailPopup({ visible, member, avatarTone, selfAvatarUrl, onClose }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(progress, { toValue: 1, useNativeDriver: true, friction: 9, tension: 90 }).start();
    } else if (mounted) {
      Animated.timing(progress, { toValue: 0, duration: 140, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted || !member) return null;

  const label = member.isSelf ? 'You' : member.displayName;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Dismiss member details" style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: progress,
              transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
            },
          ]}
        >
          {/* Swallow taps on the card itself so they don't bubble to the backdrop's dismiss. */}
          <Pressable onPress={() => undefined}>
            <View style={[styles.avatar, { backgroundColor: avatarTone.chip }]}>
              {member.isSelf && selfAvatarUrl ? (
                <Image source={{ uri: selfAvatarUrl }} style={styles.avatarImage} />
              ) : (
                <AppText variant="title" style={{ color: avatarTone.text }}>{label.charAt(0).toUpperCase()}</AppText>
              )}
            </View>
            <AppText variant="title" centre style={styles.name}>{label}</AppText>
            <AppText variant="secondary" tone="primary" centre style={styles.role}>{roleLabel(member.role)}</AppText>
            {!member.isSelf ? (
              <AppText variant="secondary" tone="soft" centre>{member.relationshipLabel || member.relationshipType}</AppText>
            ) : null}
            <AppText variant="secondary" tone="soft" centre style={styles.description}>{roleDescription(member.role)}</AppText>
            {member.role !== 'organiser' ? (
              <View style={styles.domains}>
                <AppText variant="meta" tone="soft" centre>Can see</AppText>
                <AppText variant="secondary" centre>
                  {member.grantedDomains.length > 0
                    ? member.grantedDomains.map(domainLabel).join(', ')
                    : 'Nothing shared yet'}
                </AppText>
              </View>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Close member details" onPress={onClose} style={styles.closeButton}>
              <AppText variant="bodyStrong" tone="primary">Close</AppText>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(36,29,28,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xxs,
    ...shadow.soft,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  name: { marginTop: spacing.xxs },
  role: { fontWeight: '700' },
  description: { marginTop: spacing.xs },
  domains: { marginTop: spacing.md, alignItems: 'center', gap: 2 },
  closeButton: {
    marginTop: spacing.lg,
    minHeight: 44,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.lg,
  },
});
