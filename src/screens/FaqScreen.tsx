import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { colors, radius, spacing } from '../theme';

// FAQ menu item, direct product-owner request. Static reference content --
// no new data, no new RPC. Reuses the exact collapsed-by-default accordion
// pattern PrivacyDataScreen.tsx already established (13 September 2026,
// direct product-owner feedback there too), so a long list of questions
// doesn't read as a wall of text.
type Faq = { question: string; answer: string };

const FAQS: Faq[] = [
  {
    question: 'What is a care space?',
    answer: 'A care space is everything Lilica holds for one person you support -- their appointments, tasks, bills, home matters, documents, contacts and updates, all in one place. You can support more than one person, and each has their own separate care space.',
  },
  {
    question: 'What is the Care Circle?',
    answer: 'The Care Circle is everyone who has access to a care space -- family, friends, or professional carers. Each person has a role (organiser, contributor or viewer) that controls what they can see and change. You invite people from Care Circle in Settings, or from People.',
  },
  {
    question: "What's the difference between organiser, contributor and viewer?",
    answer: "An organiser can invite and remove people, change roles, and manage the care space itself. A contributor can add and edit records but can't manage membership. A viewer can see records but not change them. Every care space needs at least one organiser -- Lilica won't let the last one leave or be removed.",
  },
  {
    question: 'How do I add someone I support?',
    answer: "From People, use Add another person. You'll give them a name and your relationship to them, and Lilica sets up a new, separate care space for them straight away.",
  },
  {
    question: 'How do I remove someone I support if they no longer need it?',
    answer: "As an organiser, open Settings > Privacy & data > Remove a supported person. You'll see every person you organise listed there. This permanently deletes everything saved for them, so Lilica asks you to tick a box confirming you understand it can't be undone before it happens.",
  },
  {
    question: 'Can I leave a care space without deleting it?',
    answer: "Yes. If you're a contributor or viewer (not the organiser), Settings > Privacy & data has a Leave option for the care space you're currently in. You lose access, but the care space and its records continue for whoever else still has access.",
  },
  {
    question: 'What happens to reminders?',
    answer: "Reminders are personal to your device -- they don't send anyone else a notification. You can turn reminders on or off, and set quiet hours, from Settings > Account.",
  },
  {
    question: 'Where do documents go, and are they safe?',
    answer: "Attach a document to any appointment, bill, or other record, and it's stored securely and only visible to people with access to that care space. You can find one again by searching, or from the record it's attached to.",
  },
  {
    question: 'How do I see what changed recently?',
    answer: "Tap the notification bell on any main tab to see reminders, overdue items and a plain-language feed of recent Care Circle changes. Use View all recent activity for the full history.",
  },
  {
    question: 'What is Care Summary?',
    answer: "Care Summary (also under the current person's care section in Settings) gives you a fast overview of what matters right now for that person -- without opening every record one by one.",
  },
  {
    question: 'How do I export a Care Summary?',
    answer: "Open Exportable Care Summary from People, or Care Summary from the current person's section in Settings, then tap Export PDF. Lilica prepares a detailed report from all the care information you are allowed to see and opens your device's share or save options. The report contains sensitive personal information, so share and store it carefully.",
  },
  {
    question: 'How do I suggest a feature?',
    answer: 'Open Settings, choose Suggest a feature under Help, and email your idea to admin@luxfordinteractive.com.',
  },
  {
    question: 'Is my data exported anywhere, or shared without my knowledge?',
    answer: "No. Lilica never shares your data with third parties. You can get a full copy of everything you can see, including document files, any time from Settings > Privacy & data > Export your data.",
  },
  {
    question: 'How do I delete my account?',
    answer: "Settings > Privacy & data > Delete account. Lilica checks first that you're not the only organiser anywhere -- if you are, make someone else an organiser there first. Deleting your account never deletes shared care records other people still rely on; your own contributions simply stay attributed to you.",
  },
  {
    question: "Does deleting my account cancel my subscription?",
    answer: "No -- deleting your Lilica account does not cancel an App Store or Google Play subscription automatically. Cancel it directly in your App Store or Google Play account settings to stop future charges.",
  },
  {
    question: 'Does Lilica work without an internet connection?',
    answer: "Yes, for what you've already loaded -- Lilica keeps a local copy on your device so you can keep working offline. Anything you add or change syncs automatically once you're back online.",
  },
];

export function FaqScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen>
      <Header title="FAQ" onBack={onBack} />
      <View style={styles.content}>
        <AppText variant="secondary" tone="soft">
          Common questions about using Lilica.
        </AppText>
        {FAQS.map((faq) => (
          <FaqItem key={faq.question} faq={faq} />
        ))}
      </View>
    </Screen>
  );
}

function FaqItem({ faq }: { faq: Faq }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.item}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${faq.question} question`}
        onPress={() => setExpanded((current) => !current)}
        style={styles.itemHeader}
      >
        <AppText variant="bodyStrong" style={styles.itemQuestion}>{faq.question}</AppText>
        <View style={[styles.chevron, expanded && styles.chevronExpanded]} />
      </Pressable>
      {expanded ? (
        <View style={styles.itemBody}>
          <AppText variant="body" tone="soft">{faq.answer}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xs, paddingBottom: spacing.xl },
  item: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  itemHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  itemQuestion: { flex: 1 },
  chevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.primary,
    transform: [{ rotate: '-45deg' }],
  },
  chevronExpanded: {
    transform: [{ rotate: '135deg' }],
  },
  itemBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
