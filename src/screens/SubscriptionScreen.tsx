import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { describeEntitlement, isEntitlementActiveNow, MyEntitlement } from '../entitlement';
import { colors, radius, spacing } from '../theme';

// Phase 21B, brief section 34: "Add a clear subscription area inside the
// EXISTING Settings drawer. Do NOT create a parallel Settings
// architecture." Rendered as SettingsMenu's own 'subscription' section
// body, exactly like Account/Care Circle/Privacy & data already are.
// Information architecture only -- no Phase 22 visual polish.
type Props = {
  entitlement?: MyEntitlement;
  loading: boolean;
  error?: string;
  onBack: () => void;
  onSubscribe: () => Promise<{ ok: boolean; message?: string }>;
  onRestore: () => Promise<{ ok: boolean; message?: string }>;
  billingConfigured: boolean;
};

// Apple/Google both own subscription cancellation/management -- Lilica
// never reimplements it (brief section 35: "Do not build a fake
// cancellation button that Lilica cannot fulfil"). These are the
// platform's own real management surfaces.
function openManageSubscription() {
  const url = Platform.OS === 'ios' ? 'itms-apps://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions';
  void Linking.openURL(url).catch(() => undefined);
}

export function SubscriptionScreen({ entitlement, loading, error, onBack, onSubscribe, onRestore, billingConfigured }: Props) {
  const [actionPending, setActionPending] = useState<'subscribe' | 'restore'>();
  const [actionMessage, setActionMessage] = useState<string>();

  async function handleSubscribe() {
    setActionPending('subscribe');
    setActionMessage(undefined);
    const result = await onSubscribe();
    setActionPending(undefined);
    if (!result.ok) setActionMessage(result.message ?? 'Something went wrong. Please try again.');
  }

  async function handleRestore() {
    setActionPending('restore');
    setActionMessage(undefined);
    const result = await onRestore();
    setActionPending(undefined);
    setActionMessage(result.ok ? 'Restored — thank you.' : (result.message ?? 'Nothing to restore on this account.'));
  }

  const isActive = entitlement ? isEntitlementActiveNow(entitlement) : false;
  const isPaidSubscriber = entitlement?.status === 'SUBSCRIPTION_ACTIVE' || entitlement?.status === 'GRACE_PERIOD';

  return (
    <Screen>
      <Header title="Subscription" onBack={onBack} />
      {loading ? (
        <AppText variant="secondary" tone="soft">Loading…</AppText>
      ) : error ? (
        <AppText variant="secondary" tone="danger">{error}</AppText>
      ) : (
        <View style={styles.content}>
          <View style={styles.priceCard}>
            <AppText variant="section">Lilica</AppText>
            <AppText variant="title">£8.99/year</AppText>
            <AppText variant="secondary" tone="soft">
              Continue organising everything around the person you support.
            </AppText>
          </View>

          <View style={styles.statusCard}>
            <AppText variant="bodyStrong">{entitlement ? describeEntitlement(entitlement) : 'Loading your subscription…'}</AppText>
            {!isActive && entitlement ? (
              <AppText variant="secondary" tone="soft" style={styles.statusDetail}>
                Everything you've already added is still here — you can view, search and export it at any time. Subscribing lets you continue adding and managing care.
              </AppText>
            ) : null}
          </View>

          {!isPaidSubscriber ? (
            <Button
              label={actionPending === 'subscribe' ? 'Subscribing…' : 'Subscribe for £8.99/year'}
              onPress={() => void handleSubscribe()}
              disabled={actionPending !== undefined || !billingConfigured}
            />
          ) : (
            <Button label="Manage subscription" onPress={openManageSubscription} variant="secondary" />
          )}

          <Button
            label={actionPending === 'restore' ? 'Restoring…' : 'Restore purchases'}
            onPress={() => void handleRestore()}
            variant="text"
            disabled={actionPending !== undefined || !billingConfigured}
          />

          {actionMessage ? <AppText variant="secondary" tone="soft">{actionMessage}</AppText> : null}

          {!billingConfigured ? (
            <AppText variant="secondary" tone="soft" style={styles.configNotice}>
              Subscriptions are not yet configured in this build.
            </AppText>
          ) : null}

          <AppText variant="meta" tone="soft" style={styles.legal}>
            £8.99/year, billed annually through the {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}. Renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel any time in your {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} account settings.
          </AppText>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  priceCard: {
    gap: spacing.xxs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  statusCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statusDetail: {
    lineHeight: 18,
  },
  configNotice: {
    textAlign: 'center',
  },
  legal: {
    lineHeight: 16,
  },
});
