import { StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { colors, radius, spacing } from '../theme';

// "How to use Lilica" menu item, direct product-owner request. A short,
// plain walkthrough of the app's own real structure -- every destination
// named here already exists; this screen adds no behaviour of its own.
type Step = { title: string; body: string };

const STEPS: Step[] = [
  {
    title: 'Home',
    body: "Shows what's due soon for the person you're currently viewing -- overdue items, what's coming up, and anything recently added. Add creates a new appointment, task, bill, home matter, document or care note. The search bar at the top finds anything you've saved.",
  },
  {
    title: 'Calendar',
    body: "Everything with a date, in one month view. Tap a day to see what's happening on it.",
  },
  {
    title: 'To Do',
    body: 'Actionable work, grouped into Overdue, Today and Upcoming. Filter by Mine, Unassigned or All to see who a task belongs to.',
  },
  {
    title: 'People',
    body: "The person you support, their Key Contacts, and their Care Circle -- everyone who can help. Switch between the people you support from the card at the top, or add another person here.",
  },
  {
    title: 'Care Circle',
    body: "Invite family, friends or professional carers to help with a specific person's care. Each person gets a role -- organiser, contributor or viewer -- that controls what they can see and change.",
  },
  {
    title: 'Settings',
    body: "Tap the cog on any tab. At the top, you'll find Care Summary and Recent Activity for the person you're currently viewing. Below that, your Account, Care Circle, Privacy & data, Subscription, and this FAQ.",
  },
  {
    title: 'Recording something',
    body: 'Add an appointment, task, bill, home or car matter, document, or care note from Home or People. Assign it to someone in the Care Circle, attach a document, and turn on a reminder if you want one.',
  },
  {
    title: 'Staying up to date',
    body: "Recent Activity shows what's changed lately across everyone helping. Care Summary gives you a fast overview of what matters right now, without opening every record.",
  },
  {
    title: 'Working offline',
    body: "Lilica keeps a copy on your device, so you can keep working without a connection. Everything syncs automatically once you're back online.",
  },
];

export function HowToUseScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen>
      <Header title="How to use Lilica" onBack={onBack} />
      <View style={styles.content}>
        <AppText variant="secondary" tone="soft">
          A quick tour of what's where.
        </AppText>
        {STEPS.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNumberWrap}>
                <AppText variant="bodyStrong" tone="primary" style={styles.stepNumber}>{index + 1}</AppText>
              </View>
              <AppText variant="bodyStrong" style={styles.stepTitle}>{step.title}</AppText>
            </View>
            <AppText variant="body" tone="soft">{step.body}</AppText>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm, paddingBottom: spacing.xl },
  step: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepNumberWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { fontSize: 14 },
  stepTitle: { flex: 1, fontSize: 17 },
});
