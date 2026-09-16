import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { activeCareSpace } from '../careSpaceState';
import { Button } from '../components/Button';
import { FoundationIcon } from '../components/FoundationIcon';
import { BackIcon, DownIcon, ForwardIcon, GridIcon, ListIcon, SearchIcon } from '../components/foundationIcons';
import { PrimaryTabHeader } from '../components/PrimaryTabHeader';
import { ScreenBackdrop } from '../components/ScreenBackdrop';
import { AppText } from '../components/Text';
import { firstItemOptions } from '../data/options';
import { deriveRecordState, formatDateForDisplay } from '../records';
import { colors, radius, shadow, spacing } from '../theme';
import { CareSpaceSetupStatus, FirstItem, LilicaRecordType, LocalCareSpaceState, OnboardingState } from '../types';
import { PersonSwitcher } from '../components/PersonSwitcher';
import { PlusIcon } from '../components/PlusIcon';
import { NotificationAnchor } from '../components/NotificationBellButton';
import { useRef, useState } from 'react';

type Props = {
  state: OnboardingState;
  onAddSomething: () => void;
  onDismissAllSet: () => void;
  people?: LocalCareSpaceState[];
  activeCareSpaceId?: string;
  setupStatus?: CareSpaceSetupStatus;
  onSwitchPerson?: (careSpaceId: string) => void;
  onAddPerson?: () => void;
  onContinueSetup?: () => void;
  // Bug fix: unlike every other projection (Calendar/To Do/Person), Home's
  // own Today/Upcoming/Recently added record cards were never wrapped in
  // a Pressable at all -- there was no way to open one from here. Reuses
  // the exact same onOpenRecord contract those screens already use.
  onOpenRecord?: (recordId: string) => void;
  // Corrective task 2: the at-a-glance strip's Overdue/Due today/Assigned
  // to you tiles navigate to their existing canonical To Do projection
  // (whichever active care space is already selected -- these callbacks
  // never take or change a care space id themselves). "Coming up" instead
  // scrolls to Home's own "Upcoming" section (same records, same page, no
  // navigation needed).
  onOpenOverdue?: () => void;
  onOpenDueToday?: () => void;
  onOpenAssignedToYou?: () => void;
  // Opens WellbeingUpdatesScreen (a real destination screen, not an
  // in-page scroll) listing exactly the wellbeing-update records this
  // tile counts.
  onOpenWellbeingUpdates?: () => void;
  // Corrective task 4: app-level Settings entry point, consistently
  // positioned top-right across Home/Calendar/To Do/People. Omitted
  // entirely (no cog rendered) when not supplied, rather than shown as a
  // dead button -- matches this app's existing "never a fake affordance"
  // discipline (see Assigned-to-you's own omit-not-fake-zero precedent).
  onOpenSettings?: () => void;
  notificationCount?: number;
  onOpenNotifications?: (origin?: NotificationAnchor) => void;
  // Phase 20B: the one, simple, unified search entry point for the
  // current supported person. Works identically for a synced or a
  // local-only care space -- it only ever reads `state.records`, exactly
  // like every other projection on this screen, so it is always shown
  // once there is anything to search.
  onOpenSearch?: () => void;
};

type HomeViewMode = 'list' | 'grid';

function itemTiming(item: FirstItem) {
  const eventDate = formatDateForDisplay(item.eventDate ?? item.date);
  const dueDate = formatDateForDisplay(item.dueDate ?? item.date);
  if (item.type === 'appointment') return item.eventTime || item.time ? `${eventDate}, ${item.eventTime ?? item.time}` : eventDate;
  if (item.type === 'bill' || item.type === 'task' || item.type === 'homeMatter') return dueDate ? `Due ${dueDate}` : 'No due date';
  if (item.type === 'document' && item.expiryDate) return `Expires ${formatDateForDisplay(item.expiryDate)}`;
  if (item.type === 'contact' && item.role) return item.role;
  return 'Saved for later';
}

// Presentation-only: one combined line instead of two stacked lines. Reuses
// itemTiming() and responsiblePerson exactly as already derived/stored.
function itemMeta(item: FirstItem) {
  const timing = itemTiming(item);
  return item.responsiblePerson ? `${timing} · with ${item.responsiblePerson}` : timing;
}

// Presentation-only: the app's own existing category names, looked up from
// the same firstItemOptions list the onboarding record stack uses, so this
// never drifts out of sync with the real category naming.
export function categoryLabel(type: LilicaRecordType) {
  return firstItemOptions.find((option) => option.id === type)?.title ?? type;
}

function sectionFor(item: FirstItem) {
  const derived = deriveRecordState(item);
  // Corrective task 1 (presentation only): the section heading that used
  // to read "Needs attention" is now labelled "Today", and an appointment
  // happening today already belonged there too -- so both now share the
  // one "Today" heading. This changes no classification: overdue, due
  // today, upcoming and unresolved are computed by deriveRecordState()
  // exactly as before. A genuinely overdue item still gets its own small
  // "Overdue" pill (see the per-item badge below) and the horizontal
  // at-a-glance strip's "Overdue" chip is unaffected -- only this
  // section's heading text changed.
  const isAppointmentToday = item.type === 'appointment' && item.eventDate === new Date().toISOString().slice(0, 10);
  if (derived.overdue) return 'Today';
  if (isAppointmentToday) return 'Today';
  if (derived.dueToday) return 'Today';
  if (derived.upcoming) return 'Upcoming';
  if ((item.type === 'task' || item.type === 'bill' || item.type === 'homeMatter') && derived.unresolved) return 'Today';
  return 'Recently added';
}

// Presentation-only tonal treatment per category, built entirely from
// existing theme tokens (no new colors, no new dependency). Only 5 tonal
// tint/accent pairs exist in theme.ts, so the 4 categories outside the
// approved snapshot row (document, contact, careNote, update) reuse the
// closest existing pair by icon shape rather than by color - still
// distinguishable at a glance, still no new token added anywhere.
export type CategoryVisual = { tint: string; accent: string };

const CATEGORY_VISUALS: Record<LilicaRecordType, CategoryVisual> = {
  appointment: { tint: colors.blueSoft, accent: colors.blue },
  task: { tint: colors.primarySoft, accent: colors.primary },
  bill: { tint: colors.claySoft, accent: colors.clay },
  homeMatter: { tint: colors.oliveSoft, accent: colors.olive },
  document: { tint: colors.tealSoft, accent: colors.teal },
  contact: { tint: colors.tealSoft, accent: colors.teal },
  careNote: { tint: colors.oliveSoft, accent: colors.olive },
  update: { tint: colors.primarySoft, accent: colors.primary },
};

export function visualFor(type: LilicaRecordType): CategoryVisual {
  return CATEGORY_VISUALS[type];
}

// Small drawn icons built from plain Views only - the same technique
// already used elsewhere in this app (Wordmark's leaf mark, PersonSwitcher's
// tick), so this needed no new icon-library dependency.
export function CategoryIcon({ type, color }: { type: LilicaRecordType; color: string }) {
  switch (type) {
    case 'appointment':
      return (
        <View style={iconStyles.calendarBody}>
          <View style={[iconStyles.calendarFrame, { borderColor: color }]} />
          <View style={[iconStyles.calendarBar, { backgroundColor: color }]} />
          <View style={[iconStyles.calendarRing, iconStyles.calendarRingLeft, { backgroundColor: color }]} />
          <View style={[iconStyles.calendarRing, iconStyles.calendarRingRight, { backgroundColor: color }]} />
        </View>
      );
    case 'task':
      return <View style={[iconStyles.tick, { borderColor: color }]} />;
    case 'bill':
      return (
        <View style={[iconStyles.coin, { borderColor: color }]}>
          <View style={[iconStyles.coinBar, { backgroundColor: color }]} />
        </View>
      );
    case 'homeMatter':
      return (
        <View style={iconStyles.houseWrap}>
          <View style={[iconStyles.houseRoof, { borderBottomColor: color }]} />
          <View style={[iconStyles.houseBase, { borderColor: color }]} />
        </View>
      );
    case 'document':
      return (
        <View style={[iconStyles.document, { borderColor: color }]}>
          <View style={[iconStyles.documentLine, { backgroundColor: color, width: '100%' }]} />
          <View style={[iconStyles.documentLine, { backgroundColor: color, width: '65%' }]} />
        </View>
      );
    case 'contact':
      return (
        <View style={iconStyles.personWrap}>
          <View style={[iconStyles.personHead, { borderColor: color }]} />
          <View style={[iconStyles.personShoulders, { borderColor: color }]} />
        </View>
      );
    case 'careNote':
      return (
        <View style={iconStyles.plusWrap}>
          <View style={[iconStyles.plusBar, iconStyles.plusBarHorizontal, { backgroundColor: color }]} />
          <View style={[iconStyles.plusBar, iconStyles.plusBarVertical, { backgroundColor: color }]} />
        </View>
      );
    case 'update':
    default:
      return (
        <View style={iconStyles.noteWrap}>
          <View style={[iconStyles.noteLine, { backgroundColor: color }]} />
          <View style={[iconStyles.noteDot, { backgroundColor: color }]} />
        </View>
      );
  }
}

// The "at a glance" status strip answers a different question than the
// record boxes or the sections below: not "how many of each category"
// (that duplicated the record boxes, and was removed), but "what state is
// everything in, right now". Every count comes straight from the same
// deriveRecordState()/record fields the rest of Home already uses -- no
// new derivation, no fabricated numbers. "Assigned to you" is the one chip
// that depends on a real active membership existing (Phase 9's
// assignedMembershipId); it is omitted entirely, not shown as a fake zero,
// when no membership is available yet.
export type StatusIconKey = 'alert' | 'calendar' | 'people' | 'clock';

type StatusChipDef = {
  key: string;
  label: string;
  count: number;
  icon: StatusIconKey;
  tint: string;
  accent: string;
  // Corrective task 2: undefined means this tile is intentionally not a
  // navigation target right now -- either its count is 0 (nothing to
  // explore) or, for "Updates this week" specifically, no existing
  // canonical destination represents exactly this count (see below).
  // Never a Pressable/button role when undefined.
  onPress?: () => void;
  // What the tile's accessibility label says it does, appended after the
  // count/label -- e.g. "View in To Do" or "Jump to Upcoming below".
  actionHint?: string;
};

export function StatusIcon({ icon, color }: { icon: StatusIconKey; color: string }) {
  switch (icon) {
    case 'alert':
      return (
        <View style={iconStyles.alertWrap}>
          <View style={[iconStyles.alertBar, { backgroundColor: color }]} />
          <View style={[iconStyles.alertDot, { backgroundColor: color }]} />
        </View>
      );
    case 'calendar':
      return (
        <View style={iconStyles.calendarBody}>
          <View style={[iconStyles.calendarFrame, { borderColor: color }]} />
          <View style={[iconStyles.calendarBar, { backgroundColor: color }]} />
          <View style={[iconStyles.calendarRing, iconStyles.calendarRingLeft, { backgroundColor: color }]} />
          <View style={[iconStyles.calendarRing, iconStyles.calendarRingRight, { backgroundColor: color }]} />
        </View>
      );
    case 'people':
      return (
        <View style={iconStyles.personWrap}>
          <View style={[iconStyles.personHead, { borderColor: color }]} />
          <View style={[iconStyles.personShoulders, { borderColor: color }]} />
        </View>
      );
    case 'clock':
    default:
      return (
        <View style={[iconStyles.clockFace, { borderColor: color }]}>
          <View style={[iconStyles.clockHandMinute, { backgroundColor: color }]} />
          <View style={[iconStyles.clockHandHour, { backgroundColor: color }]} />
        </View>
      );
  }
}

export function HomeScreen({
  state,
  onAddSomething,
  people = [],
  activeCareSpaceId,
  setupStatus = 'ready',
  onSwitchPerson = () => undefined,
  onAddPerson = () => undefined,
  onContinueSetup = () => undefined,
  onOpenRecord,
  onOpenOverdue,
  onOpenDueToday,
  onOpenAssignedToYou,
  onOpenWellbeingUpdates,
  onOpenSettings,
  notificationCount = 0,
  onOpenNotifications,
  onOpenSearch,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [viewMode, setViewMode] = useState<HomeViewMode>('grid');
  const records = state.records.length > 0 ? state.records : state.firstItem ? [state.firstItem] : [];
  const personName = state.supportedPersonName?.trim() || 'Them';
  const sections = ['Today', 'Upcoming', 'Recently added']
    .map((title) => ({ title, records: records.filter((record) => sectionFor(record) === title) }))
    .filter((section) => section.records.length > 0);

  // Corrective task 2: "Coming up" scrolls to this screen's own "Upcoming"
  // section -- the exact same `derived.upcoming` records the chip counts,
  // so there is zero risk of the destination disagreeing with the count.
  // Measured via plain onLayout offsets (no native measureLayout calls,
  // which are fragile across RN versions and awkward to test) captured as
  // the sections render, then looked up when the chip is actually pressed.
  const scrollRef = useRef<ScrollView>(null);
  const sectionsContainerY = useRef(0);
  const sectionOffsetsWithinContainer = useRef<Record<string, number>>({});

  function scrollToSection(title: string) {
    const offset = sectionOffsetsWithinContainer.current[title];
    if (offset === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(sectionsContainerY.current + offset - spacing.md, 0), animated: true });
  }

  // Search4 UI refinement: the horizontal dashboard strip wasn't visibly
  // scrollable -- left/right chevrons make that obvious and give a second
  // way to move through it, without replacing ordinary swipe/drag (brief
  // requirements 13-19). Plain onLayout/onContentSizeChange/onScroll
  // measurements only (the same technique already used for scrollToSection
  // above), so this needs no extra native module.
  const stripScrollRef = useRef<ScrollView>(null);
  const stripScrollX = useRef(0);
  const stripContainerWidth = useRef(0);
  const stripContentWidth = useRef(0);
  const [canScrollStripLeft, setCanScrollStripLeft] = useState(false);
  const [canScrollStripRight, setCanScrollStripRight] = useState(false);
  const STRIP_SCROLL_EPSILON = 4;
  const stripViewportWidth = Math.max(windowWidth - 88, 0);
  const statusChipWidth = Math.max(108, Math.min(150, (stripViewportWidth - spacing.sm) / 2));
  const STRIP_SCROLL_AMOUNT = statusChipWidth + spacing.sm;
  const recordCardWidth = Math.min(220, Math.max(124, (windowWidth - (spacing.lg * 2) - spacing.sm) / 2));

  function updateStripChevronState() {
    setCanScrollStripLeft(stripScrollX.current > STRIP_SCROLL_EPSILON);
    setCanScrollStripRight(
      stripScrollX.current < stripContentWidth.current - stripContainerWidth.current - STRIP_SCROLL_EPSILON,
    );
  }

  function scrollStripBy(delta: number) {
    const next = Math.max(
      0,
      Math.min(stripScrollX.current + delta, Math.max(stripContentWidth.current - stripContainerWidth.current, 0)),
    );
    stripScrollRef.current?.scrollTo({ x: next, animated: true });
  }

  const currentSpace = activeCareSpace(state);
  const derived = records.map((record) => deriveRecordState(record));
  const overdueCount = derived.filter((item) => item.overdue).length;
  const dueTodayCount = derived.filter((item) => item.dueToday).length;
  const comingUpCount = derived.filter((item) => item.upcoming).length;
  // Narrowed to wellbeing-update records specifically (matching the tile's
  // own name and its destination, WellbeingUpdatesScreen) -- was every
  // record type edited recently; now exactly the records that screen lists.
  const wellbeingUpdates = records.filter((record, index) => record.type === 'update' && derived[index].recentlyUpdated);
  const updatesThisWeekCount = wellbeingUpdates.length;
  const assignedToYouCount = currentSpace?.membershipId
    ? records.filter((record) => record.assignedMembershipId === currentSpace.membershipId).length
    : undefined;

  // Corrective task 2 mapping (see docs/CORE_SYSTEM_CONTRACT.md and the
  // Home-strip revision log entry this extends):
  //   Overdue / Due today / Assigned to you -> To Do's own matching group/
  //     filter, the app's existing canonical "actionable work" projection.
  //   Coming up -> this screen's own "Upcoming" section (see
  //     scrollToSection above) -- an exact, zero-drift match.
  //   Updates this week -> opens WellbeingUpdatesScreen, a real
  //     destination listing exactly the wellbeing-update (type 'update')
  //     records entered/edited in the last 7 days. The count itself was
  //     narrowed to match: previously ANY record type edited recently,
  //     now specifically wellbeing-update records (see wellbeingUpdates
  //     above) -- an explicit, deliberate scope change, not the earlier
  //     in-page-scroll workaround.
  // Every navigable tile is disabled at zero count -- there is nothing to
  // explore, so it deliberately does not become a button (requirement 5:
  // do not navigate to nonsense).
  const statusChips: StatusChipDef[] = [
    {
      key: 'overdue', label: 'Overdue', count: overdueCount, icon: 'alert', tint: colors.dangerSoft, accent: colors.danger,
      onPress: overdueCount > 0 ? onOpenOverdue : undefined,
      actionHint: 'View in To Do',
    },
    {
      key: 'dueToday', label: 'Due today', count: dueTodayCount, icon: 'calendar', tint: colors.warningSoft, accent: colors.warning,
      onPress: dueTodayCount > 0 ? onOpenDueToday : undefined,
      actionHint: 'View in To Do',
    },
    {
      key: 'comingUp', label: 'Coming up', count: comingUpCount, icon: 'calendar', tint: colors.oliveSoft, accent: colors.olive,
      onPress: comingUpCount > 0 ? () => scrollToSection('Upcoming') : undefined,
      actionHint: 'Jump to Upcoming below',
    },
    ...(assignedToYouCount !== undefined
      ? [{
          key: 'assignedToYou', label: 'Assigned to you', count: assignedToYouCount, icon: 'people' as const, tint: colors.primarySoft, accent: colors.primary,
          onPress: assignedToYouCount > 0 ? onOpenAssignedToYou : undefined,
          actionHint: 'View in To Do',
        }]
      : []),
    {
      key: 'updatesThisWeek', label: 'Updates this week', count: updatesThisWeekCount, icon: 'clock' as const, tint: colors.blueSoft, accent: colors.blue,
      onPress: updatesThisWeekCount > 0 ? onOpenWellbeingUpdates : undefined,
      actionHint: 'View wellbeing updates',
    },
  ];

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <ScreenBackdrop
        deep={colors.canvas}
        tint="#EFE7DE"
        gap={20}
        stretch
        stops={[
          { color: colors.canvas, location: 0 },
          { color: '#F6F1EA', location: 0.3 },
          { color: '#F4EEE6', location: 0.58 },
          { color: '#F2EBE3', location: 0.8 },
          { color: '#EFE7DE', location: 1 },
        ]}
      >
      <PrimaryTabHeader
        title="Home"
        actions={<Button label="Add" icon={<PlusIcon />} onPress={onAddSomething} style={styles.addButton} />}
        notificationCount={notificationCount}
        onOpenNotifications={onOpenNotifications}
        onOpenSettings={onOpenSettings}
      />

      {/* Search4 UI refinement: the person-switcher and the search
          affordance are now two separate, side-by-side elements, matching
          the approved mock -- previously one combined row that only ever
          opened the switcher (search lived as a small icon in the header
          instead). The switcher itself is unchanged in behaviour (same
          onPress, same PersonSwitcher, same accessibility label existing
          tests rely on): only its own visual presentation moved -- a
          larger initial, a chevron alongside it, and the person's first
          name shown directly beneath. */}
      <View testID="home-person-search" style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Switch person, currently ${personName}`}
          onPress={() => setSwitcherOpen(true)}
          style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarButtonPressed]}
        >
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <AppText variant="title" tone="primary" style={styles.avatarInitial}>{personName.charAt(0).toUpperCase()}</AppText>
            </View>
            <FoundationIcon icon={DownIcon} role="navigation" color={colors.primary} />
          </View>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.avatarName}>{personName}</AppText>
        </Pressable>

        {/* The Home search box is not an inline expanding field -- tapping
            it navigates straight to the existing dedicated Search screen
            (Phase 20B), exactly as already implemented and approved; only
            this control's own visual presentation (a real search-bar look,
            moved out of the header) changed here. */}
        {onOpenSearch ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search"
            accessibilityHint={`Search ${personName}'s records`}
            onPress={onOpenSearch}
            style={({ pressed }) => [styles.searchBar, pressed && styles.searchBarPressed]}
          >
            {/* A real magnifying-glass glyph, not a hand-drawn ring+handle
                -- at this size, against this background, the drawn
                version read as a stray mark next to the text rather than
                a recognisable search icon. */}
            <FoundationIcon icon={SearchIcon} role="utility" color={colors.primary} />
            <AppText variant="body" tone="soft" numberOfLines={1} style={styles.searchCopy}>
              Everything for {personName}, in one place.
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {setupStatus !== 'ready' ? (
        <View style={styles.setupCard}>
          <AppText variant="section">{personName} still needs setting up</AppText>
          <AppText variant="secondary" tone="soft">Finish their privacy and care preferences before adding records.</AppText>
          <Button label="Continue setup" onPress={onContinueSetup} style={styles.emptyButton} />
        </View>
      ) : (
        <>
          {records.length > 0 ? (
            <View style={styles.stripWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scroll dashboard left"
                accessibilityState={{ disabled: !canScrollStripLeft }}
                disabled={!canScrollStripLeft}
                onPress={() => scrollStripBy(-STRIP_SCROLL_AMOUNT)}
                style={[styles.stripChevron, !canScrollStripLeft && styles.stripChevronDisabled]}
              >
                <FoundationIcon icon={BackIcon} role="navigation" color={canScrollStripLeft ? colors.primary : colors.line} />
              </Pressable>
              <View testID="dashboard-strip-viewport" style={styles.stripViewport}>
                <ScrollView
                  ref={stripScrollRef}
                  testID="dashboard-strip-scroll"
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.snapshotRow}
                  onLayout={(event) => {
                    stripContainerWidth.current = event.nativeEvent.layout.width;
                    updateStripChevronState();
                  }}
                  onContentSizeChange={(width) => {
                    stripContentWidth.current = width;
                    updateStripChevronState();
                  }}
                  onScroll={(event) => {
                    stripScrollX.current = event.nativeEvent.contentOffset.x;
                    updateStripChevronState();
                  }}
                  scrollEventThrottle={16}
                >
                  {statusChips.map((chip) => {
                    const interactive = Boolean(chip.onPress);
                    return (
                      <Pressable
                        key={chip.key}
                        testID={`status-chip-${chip.key}`}
                        accessibilityRole={interactive ? 'button' : undefined}
                        accessibilityLabel={interactive ? `${chip.count} ${chip.label.toLowerCase()}. ${chip.actionHint}.` : `${chip.count} ${chip.label.toLowerCase()}`}
                        disabled={!interactive}
                        onPress={chip.onPress}
                        style={({ pressed }) => [
                          styles.statusChip,
                          { width: statusChipWidth, backgroundColor: chip.tint },
                          pressed && interactive && styles.statusChipPressed,
                        ]}
                      >
                        <View style={styles.statusTopRow}>
                          <View style={styles.statusIconChip}>
                            <StatusIcon icon={chip.icon} color={chip.accent} />
                          </View>
                          <AppText variant="title" style={styles.statusCount}>{chip.count}</AppText>
                        </View>
                        <AppText variant="secondary" tone="soft" numberOfLines={1} style={styles.statusLabel}>{chip.label}</AppText>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scroll dashboard right"
                accessibilityState={{ disabled: !canScrollStripRight }}
                disabled={!canScrollStripRight}
                onPress={() => scrollStripBy(STRIP_SCROLL_AMOUNT)}
                style={[styles.stripChevron, !canScrollStripRight && styles.stripChevronDisabled]}
              >
                <FoundationIcon icon={ForwardIcon} role="navigation" color={canScrollStripRight ? colors.primary : colors.line} />
              </Pressable>
            </View>
          ) : null}

          {sections.length > 0 ? (
            <View
              style={styles.sections}
              onLayout={(event) => {
                sectionsContainerY.current = event.nativeEvent.layout.y;
              }}
            >
              {sections.map((section) => (
                <View
                  key={section.title}
                  style={styles.section}
                  onLayout={(event) => {
                    sectionOffsetsWithinContainer.current[section.title] = event.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.sectionHeader}>
                    <AppText variant="section">{section.title}</AppText>
                    {section.title === 'Today' ? (
                      <View accessibilityRole="toolbar" accessibilityLabel="Home Today view" style={styles.viewControls}>
                        {(['list', 'grid'] as HomeViewMode[]).map((mode) => {
                          const selected = viewMode === mode;
                          return (
                            <Pressable
                              key={mode}
                              accessibilityRole="button"
                              accessibilityLabel={`Show as ${mode}`}
                              accessibilityState={{ selected }}
                              onPress={() => setViewMode(mode)}
                              style={({ pressed }) => [
                                styles.viewButton,
                                selected && styles.viewButtonSelected,
                                pressed && styles.viewButtonPressed,
                              ]}
                            >
                              <FoundationIcon
                                icon={mode === 'list' ? ListIcon : GridIcon}
                                role="navigation"
                                color={selected ? colors.white : colors.primary}
                              />
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                  {viewMode === 'grid' ? (
                  <View testID="home-record-grid" style={styles.grid}>
                    {section.records.map((item) => {
                      const visual = visualFor(item.type);
                      const overdue = deriveRecordState(item).overdue;
                      // Bug fix: this card was a plain, non-interactive
                      // View -- unlike every other projection (Calendar/
                      // To Do/Person/Wellbeing updates), there was no way
                      // to open it from Home at all. Same onOpenRecord
                      // contract, same destination (the normal record
                      // editor), just reached from a different screen.
                      return (
                        <Pressable
                          key={item.id}
                          testID={`home-record-card-${item.id}`}
                          accessibilityRole={onOpenRecord ? 'button' : undefined}
                          accessibilityLabel={`Open ${item.title}`}
                          disabled={!onOpenRecord}
                          onPress={() => onOpenRecord?.(item.id)}
                          style={({ pressed }) => [styles.card, { width: recordCardWidth }, pressed && onOpenRecord && styles.cardPressed]}
                        >
                          <View style={styles.cardTop}>
                            <View style={[styles.cardIconChip, { backgroundColor: visual.tint }]}>
                              <CategoryIcon type={item.type} color={visual.accent} />
                            </View>
                            {overdue ? (
                              <View style={styles.overduePill}>
                                <AppText variant="secondary" style={styles.overduePillText}>Overdue</AppText>
                              </View>
                            ) : null}
                          </View>
                          <AppText variant="meta" tone="muted" numberOfLines={1} style={styles.cardCategory}>{categoryLabel(item.type)}</AppText>
                          <AppText variant="bodyStrong" numberOfLines={2} style={styles.cardTitle}>{item.title}</AppText>
                          <AppText variant="secondary" tone="soft" numberOfLines={2} style={styles.cardMetadata}>{itemMeta(item)}</AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                  ) : (
                    <View testID={`home-record-list-${section.title.toLowerCase().replace(/\s+/g, '-')}`} style={styles.list}>
                      {section.records.map((item) => {
                        const visual = visualFor(item.type);
                        const overdue = deriveRecordState(item).overdue;
                        return (
                          <Pressable
                            key={item.id}
                            testID={`home-record-list-row-${item.id}`}
                            accessibilityRole={onOpenRecord ? 'button' : undefined}
                            accessibilityLabel={`Open ${item.title}`}
                            disabled={!onOpenRecord}
                            onPress={() => onOpenRecord?.(item.id)}
                            style={({ pressed }) => [styles.listRow, pressed && onOpenRecord && styles.cardPressed]}
                          >
                            <View style={[styles.listIconChip, { backgroundColor: visual.tint }]}>
                              <CategoryIcon type={item.type} color={visual.accent} />
                            </View>
                            <View style={styles.listCopy}>
                              <AppText variant="meta" tone="muted" numberOfLines={1} style={styles.cardCategory}>{categoryLabel(item.type)}</AppText>
                              <AppText variant="bodyStrong" style={styles.cardTitle}>{item.title}</AppText>
                              <AppText variant="secondary" tone={overdue ? 'danger' : 'soft'} style={styles.listMetadata}>
                                {overdue ? `Overdue · ${itemMeta(item)}` : itemMeta(item)}
                              </AppText>
                            </View>
                            <View style={styles.listDisclosure}>
                              <FoundationIcon icon={ForwardIcon} role="navigation" color={colors.primary} />
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <AppText variant="section">Start with one thing you want to keep track of.</AppText>
              <Button label="Add something" onPress={onAddSomething} style={styles.emptyButton} />
            </View>
          )}
        </>
      )}

      <PersonSwitcher
        visible={switcherOpen}
        people={people}
        activeId={activeCareSpaceId}
        onClose={() => setSwitcherOpen(false)}
        onSelect={onSwitchPerson}
        onAdd={onAddPerson}
      />
      <View testID="home-bottom-clearance" style={styles.bottomClearance} />
      </ScreenBackdrop>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  addButton: {
    width: 'auto',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    gap: spacing.xxs,
  },
  // Search4 UI refinement: the switcher (avatar + chevron + name) and the
  // search bar now sit side by side as two independent elements, rather
  // than one combined row -- see the render block above for why.
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    // Deliberate breathing room before the dashboard strip beneath (brief
    // requirement 5) -- more than the ScrollView's own default `gap`
    // between every other pair of sections, but not excessive dead space.
    marginBottom: spacing.xs,
  },
  avatarButton: {
    width: 72,
    minHeight: 76,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  avatarButtonPressed: {
    opacity: 0.85,
  },
  avatarRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  // Larger than the previous 34px/16px pairing (brief requirement 3: "make
  // the initial larger... do not make the avatar disproportionately
  // large") -- the same primarySoft/primary tonal pair, just bigger.
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 26,
    lineHeight: 31,
    textAlign: 'center',
  },
  avatarName: {
    width: '100%',
    textAlign: 'center',
  },
  // The real search-bar look the brief asks for (brief requirement 6),
  // filling the remaining row width next to the avatar column.
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    ...shadow.soft,
  },
  searchBarPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
    borderColor: colors.primary,
  },
  searchCopy: {
    flex: 1,
  },
  setupCard: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.oliveSoft, gap: spacing.sm },
  stripWrap: {
    marginHorizontal: -spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stripViewport: {
    flex: 1,
    overflow: 'hidden',
  },
  snapshotRow: {
    gap: spacing.sm,
  },
  // Restrained, premium discoverability aid for the horizontally
  // scrollable strip (brief requirements 13/17) -- small, sitting just
  // outside the strip's own edge, never a giant or loud floating control,
  // and never a substitute for ordinary swipe/drag (unchanged above).
  stripChevron: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripChevronDisabled: {
    opacity: 0.55,
  },
  statusChip: {
    minHeight: 104,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  // Corrective task 2: same scale+opacity feedback Button.tsx already
  // uses elsewhere in the app, so this reads as native/premium and
  // consistent rather than a one-off new interaction style.
  statusChipPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusIconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCount: {
    fontSize: 26,
    lineHeight: 30,
  },
  statusLabel: {
    lineHeight: 18,
  },
  sections: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  viewControls: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  viewButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonSelected: {
    backgroundColor: colors.primary,
  },
  viewButtonPressed: {
    opacity: 0.76,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  card: {
    minHeight: 166,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    gap: 3,
    ...shadow.soft,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xxs,
  },
  cardIconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overduePill: {
    backgroundColor: 'rgba(154,62,66,0.12)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overduePillText: {
    color: colors.danger,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
  },
  cardCategory: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 21,
  },
  cardMetadata: {
    lineHeight: 19,
  },
  list: {
    gap: spacing.xs,
  },
  listRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    ...shadow.soft,
  },
  listIconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCopy: {
    minWidth: 0,
    flex: 1,
    gap: 1,
  },
  listMetadata: {
    lineHeight: 19,
  },
  listDisclosure: {
    width: 28,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomClearance: {
    height: spacing.xxxl,
  },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  emptyButton: {
    marginTop: spacing.lg,
  },
});

// Shapes for CategoryIcon, built from plain Views/borders only.
const iconStyles = StyleSheet.create({
  calendarBody: {
    width: 16,
    height: 14,
    marginTop: 3,
  },
  calendarFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.6,
    borderRadius: 3,
  },
  calendarBar: {
    position: 'absolute',
    top: 3,
    left: 0,
    right: 0,
    height: 1.4,
  },
  calendarRing: {
    position: 'absolute',
    top: -4,
    width: 2,
    height: 5,
    borderRadius: 1,
  },
  calendarRingLeft: { left: 3 },
  calendarRingRight: { right: 3 },
  tick: {
    width: 11,
    height: 7,
    borderLeftWidth: 2.2,
    borderBottomWidth: 2.2,
    transform: [{ rotate: '-45deg' }],
  },
  coin: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinBar: {
    width: 9,
    height: 1.4,
    borderRadius: 1,
  },
  houseWrap: {
    alignItems: 'center',
  },
  houseRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  houseBase: {
    width: 12,
    height: 8,
    borderWidth: 1.6,
    borderTopWidth: 0,
    marginTop: -1,
  },
  document: {
    width: 13,
    height: 16,
    borderWidth: 1.6,
    borderRadius: 2,
    padding: 2.5,
    justifyContent: 'center',
    gap: 2.5,
  },
  documentLine: {
    height: 1.3,
    borderRadius: 1,
  },
  personWrap: {
    alignItems: 'center',
  },
  personHead: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  personShoulders: {
    width: 13,
    height: 7,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    marginTop: 1.5,
  },
  alertWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  alertBar: {
    width: 2.4,
    height: 9,
    borderRadius: 1.5,
  },
  alertDot: {
    width: 2.4,
    height: 2.4,
    borderRadius: 1.5,
  },
  clockFace: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockHandMinute: {
    position: 'absolute',
    width: 1.4,
    height: 6,
    borderRadius: 1,
    top: 2,
  },
  clockHandHour: {
    position: 'absolute',
    width: 1.4,
    height: 4.5,
    borderRadius: 1,
    top: 4,
    left: 8.3,
    transform: [{ rotate: '70deg' }],
  },
  plusWrap: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBar: {
    position: 'absolute',
    borderRadius: 1,
  },
  plusBarHorizontal: {
    width: 15,
    height: 2,
  },
  plusBarVertical: {
    width: 2,
    height: 15,
  },
  noteWrap: {
    alignItems: 'center',
    gap: 3,
  },
  noteLine: {
    width: 2,
    height: 8,
    borderRadius: 1,
  },
  noteDot: {
    width: 2.4,
    height: 2.4,
    borderRadius: 1.2,
  },
});
