import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  CareCircleDomain,
  CareCircleInvitation,
  CareCircleMember,
  CareCircleRole,
  inviteMember,
  removeMember,
  revokeInvitation,
} from '../careCircle';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { TextField } from '../components/TextField';
import { colors, radius, spacing } from '../theme';
import { Relationship } from '../types';

type Props = {
  personName?: string;
  members: CareCircleMember[];
  invitations: CareCircleInvitation[];
  careSpaceId: string;
  onBack: () => void;
  // Re-fetches members/invitations from the server -- called after any
  // successful invite/revoke/remove so the screen always reflects real,
  // server-confirmed state rather than an optimistic local guess.
  onRefresh: () => void;
};

const DOMAIN_OPTIONS: { value: CareCircleDomain; label: string }[] = [
  { value: 'general', label: 'Everyday things' },
  { value: 'health', label: 'Care & health' },
  { value: 'financial', label: 'Bills & money' },
  { value: 'home', label: 'Home & car' },
  { value: 'documents', label: 'Documents' },
];

const RELATIONSHIP_OPTIONS: Relationship[] = ['Other relative', 'Someone else'];

function roleDescription(role: CareCircleRole) {
  if (role === 'organiser') return 'Full access, can manage the care circle';
  if (role === 'contributor') return 'Can view and update what you share with them';
  return 'Can view what you share with them';
}

export function CareCircleScreen({ personName, members, invitations, careSpaceId, onBack, onRefresh }: Props) {
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'contributor' | 'viewer'>('contributor');
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<CareCircleDomain[]>(['general']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const organiserCount = members.filter((member) => member.role === 'organiser').length;
  const pendingInvitations = invitations.filter((invitation) => invitation.status === 'pending');

  function toggleDomain(domain: CareCircleDomain) {
    setSelectedDomains((current) =>
      current.includes(domain) ? current.filter((value) => value !== domain) : [...current, domain],
    );
  }

  async function submitInvite() {
    if (!email.trim() || !relationshipLabel.trim()) {
      setError('Enter their email and how they know you.');
      return;
    }
    setBusy(true);
    setError(undefined);
    const result = await inviteMember({
      careSpaceId,
      email: email.trim(),
      role,
      grantedDomains: selectedDomains,
      relationshipType: 'Someone else',
      relationshipLabel: relationshipLabel.trim(),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setShowInvite(false);
    setEmail('');
    setRelationshipLabel('');
    setSelectedDomains(['general']);
    onRefresh();
  }

  async function handleRevoke(invitationId: string) {
    setBusy(true);
    const result = await revokeInvitation(invitationId);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onRefresh();
  }

  async function handleRemove(membershipId: string) {
    setBusy(true);
    const result = await removeMember(membershipId);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onRefresh();
  }

  return (
    <Screen>
      <Header title="Care Circle" onBack={onBack} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <AppText variant="secondary" tone="soft">
          Who can see and help with {personName?.trim() || 'this'}'s care -- and exactly what they can see.
        </AppText>

        {error ? <AppText variant="secondary" tone="danger">{error}</AppText> : null}

        <View style={styles.section}>
          <AppText variant="section" tone="primary">Members</AppText>
          {members.map((member) => (
            <View key={member.membershipId} style={styles.card}>
              <View style={styles.cardHeader}>
                <AppText variant="body" tone="primary">{member.displayName}</AppText>
                <AppText variant="secondary" tone="soft">
                  {member.role === 'organiser' ? 'Organiser' : member.role === 'contributor' ? 'Contributor' : 'Viewer'}
                </AppText>
              </View>
              <AppText variant="secondary" tone="soft">
                {member.relationshipLabel || member.relationshipType} · {roleDescription(member.role)}
              </AppText>
              {member.role !== 'organiser' ? (
                <AppText variant="secondary" tone="muted">
                  Can see: {member.grantedDomains.length > 0
                    ? member.grantedDomains.map((domain) => DOMAIN_OPTIONS.find((option) => option.value === domain)?.label ?? domain).join(', ')
                    : 'Nothing shared yet'}
                </AppText>
              ) : null}
              {!member.isSelf && !(member.role === 'organiser' && organiserCount <= 1) ? (
                <Button
                  label="Remove"
                  variant="text"
                  disabled={busy}
                  onPress={() => handleRemove(member.membershipId)}
                  style={styles.removeButton}
                />
              ) : null}
            </View>
          ))}
        </View>

        {pendingInvitations.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="section" tone="primary">Pending invitations</AppText>
            {pendingInvitations.map((invitation) => (
              <View key={invitation.id} style={styles.card}>
                <AppText variant="body" tone="primary">{invitation.inviteeEmail}</AppText>
                <AppText variant="secondary" tone="soft">
                  Invited as {invitation.role === 'contributor' ? 'Contributor' : 'Viewer'} · not a member yet
                </AppText>
                <Button
                  label="Cancel invitation"
                  variant="text"
                  disabled={busy}
                  onPress={() => handleRevoke(invitation.id)}
                  style={styles.removeButton}
                />
              </View>
            ))}
          </View>
        ) : null}

        {showInvite ? (
          <View style={styles.section}>
            <AppText variant="section" tone="primary">Invite someone</AppText>
            <TextField
              label="Their email"
              placeholder="name@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextField
              label="How you know them"
              placeholder="e.g. Cousin, neighbour"
              value={relationshipLabel}
              onChangeText={setRelationshipLabel}
            />
            <AppText variant="secondary" tone="soft" style={styles.fieldLabel}>Role</AppText>
            <View style={styles.pillRow}>
              {(['contributor', 'viewer'] as const).map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: role === option }}
                  onPress={() => setRole(option)}
                  style={[styles.pill, role === option && styles.pillSelected]}
                >
                  <AppText variant="secondary" tone={role === option ? 'primary' : 'soft'}>
                    {option === 'contributor' ? 'Contributor' : 'Viewer'}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <AppText variant="secondary" tone="soft" style={styles.fieldLabel}>
              What can they see? Review this before sending.
            </AppText>
            <View style={styles.pillRow}>
              {DOMAIN_OPTIONS.map((option) => {
                const selected = selectedDomains.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => toggleDomain(option.value)}
                    style={[styles.pill, selected && styles.pillSelected]}
                  >
                    <AppText variant="secondary" tone={selected ? 'primary' : 'soft'}>{option.label}</AppText>
                  </Pressable>
                );
              })}
            </View>
            <Button label="Send invitation" onPress={submitInvite} disabled={busy} />
            <Button label="Cancel" variant="text" onPress={() => setShowInvite(false)} disabled={busy} />
          </View>
        ) : (
          <Button label="Invite someone" onPress={() => setShowInvite(true)} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeButton: {
    alignSelf: 'flex-start',
  },
  fieldLabel: {
    marginTop: spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  pillSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
});
