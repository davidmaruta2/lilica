import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { createRecordDraft, RecordDraft, RecordEditor } from '../components/RecordEditor';
import { RecordSheet, RecordSheetHandle } from '../components/RecordSheet';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { CareCircleMember } from '../careCircle';
import { firstItemOptions } from '../data/options';
import { formatDateForDisplay } from '../records';
import { colors, radius, spacing } from '../theme';
import { Interest, LilicaRecord, LilicaRecordType } from '../types';

type Props = {
  interests: Interest[];
  personName?: string;
  supportedPersonId: string;
  records: LilicaRecord[];
  // The organiser's own membership ID for the active care space, threaded
  // down to RecordEditor's Assigned-to control. See fork.txt Part 5.
  activeMembershipId?: string;
  // Phase 15: threaded straight down to RecordEditor's real assignment
  // selector. See src/careCircle.ts.
  careCircleMembers?: CareCircleMember[];
  // Phase 14: threaded straight down to RecordEditor's "Remind me" toggle.
  onRequestReminderPermission?: () => Promise<boolean>;
  // True once setup is already complete and this screen is reached from
  // Home's everyday Add action rather than first-time onboarding. Changes
  // only the heading/footer copy — the category-gateway/list/add/edit
  // architecture itself is unchanged and locked either way.
  everyday?: boolean;
  // Phase 10: lets another screen (Calendar) request that a specific
  // existing record's editor opens immediately on mount, reusing this
  // exact category-gateway/list/edit architecture rather than a second
  // editor. Consumed once; onInitialOpenHandled lets the caller clear its
  // own one-shot intent so a later, unrelated visit to this screen (e.g.
  // Home's plain Add button) never reopens a stale record.
  initialOpenRecordId?: string;
  // Phase 13: lets another screen (Person) request that a NEW draft of a
  // given category opens immediately on mount -- e.g. "Add a contact" jumps
  // straight to a blank contact editor rather than the plain gateway. Same
  // one-shot consume/clear contract as initialOpenRecordId above; only one
  // of the two is ever set at a time.
  initialOpenType?: LilicaRecordType;
  onInitialOpenHandled?: () => void;
  onBack: () => void;
  onSaveRecord: (record: LilicaRecord) => void;
  onRemoveRecord: (recordId: string) => void;
  onFinish: () => void;
  onSkip: () => void;
};

const CLOSED_HEIGHT = 118;
const ITEM_GAP = 12;
const categoryTerms: Record<LilicaRecordType, { heading: string; singular: string; plural: string; add: string }> = {
  appointment: { heading: 'Appointments', singular: 'appointment', plural: 'appointments', add: 'Add appointment' },
  task: { heading: 'Things to do', singular: 'thing to do', plural: 'things to do', add: 'Add something to do' },
  bill: { heading: 'Bills and renewals', singular: 'bill or renewal', plural: 'bills or renewals', add: 'Add bill or renewal' },
  homeMatter: { heading: 'Home or car matters', singular: 'home or car matter', plural: 'home or car matters', add: 'Add home or car matter' },
  document: { heading: 'Important documents', singular: 'document', plural: 'documents', add: 'Add document' },
  contact: { heading: 'Contacts', singular: 'contact', plural: 'contacts', add: 'Add contact' },
  careNote: { heading: 'Care information', singular: 'care item', plural: 'care items', add: 'Add care information' },
  update: { heading: 'Wellbeing updates', singular: 'wellbeing update', plural: 'wellbeing updates', add: 'Add wellbeing update' },
};

export function FirstThingScreen({
  interests,
  personName,
  supportedPersonId,
  records,
  activeMembershipId,
  careCircleMembers,
  onRequestReminderPermission,
  everyday = false,
  initialOpenRecordId,
  initialOpenType,
  onInitialOpenHandled,
  onBack,
  onSaveRecord,
  onRemoveRecord,
  onFinish,
  onSkip,
}: Props) {
  const name = personName?.trim() || 'them';
  const list = useRef<FlatList<(typeof firstItemOptions)[number]>>(null);
  const sheet = useRef<RecordSheetHandle>(null);
  const focusAfterDismiss = useRef<number | undefined>(undefined);
  // Bug fix: opening a record via the one-shot initialOpenRecordId/
  // initialOpenType deep link (from Home/Calendar/To Do/Person/Wellbeing
  // updates) used to leave the user on THIS screen's own category list
  // once they saved/removed/dismissed that one record ("records home"),
  // instead of returning to wherever they actually came from. Set true
  // only by the deep-link effect below, and consumed (reset to false)
  // the moment that specific editor closes, so ordinary in-screen
  // category browsing is completely unaffected.
  const deepLinked = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);
  const [openType, setOpenType] = useState<LilicaRecordType>();
  const [openRecordId, setOpenRecordId] = useState<string>();
  const [openDraftKey, setOpenDraftKey] = useState<string>();
  const [openView, setOpenView] = useState<'list' | 'editor'>('editor');
  const [drafts, setDrafts] = useState<Record<string, RecordDraft>>({});
  const [stackHeight, setStackHeight] = useState(0);

  const ordered = useMemo(() => {
    return firstItemOptions
      .map((option, originalIndex) => ({
        ...option,
        originalIndex,
        selectedIndex: option.interest ? interests.indexOf(option.interest) : -1,
      }))
      .sort((a, b) => {
        const aSelected = a.selectedIndex >= 0;
        const bSelected = b.selectedIndex >= 0;
        if (aSelected !== bSelected) return aSelected ? -1 : 1;
        if (aSelected && bSelected && a.selectedIndex !== b.selectedIndex) return a.selectedIndex - b.selectedIndex;
        return a.originalIndex - b.originalIndex;
      });
  }, [interests]);

  const stackBottomPadding = Math.max(spacing.sm, stackHeight - CLOSED_HEIGHT);
  const snapOffsets = useMemo(
    () => ordered.map((_, index) => index * (CLOSED_HEIGHT + ITEM_GAP)),
    [ordered],
  );

  function focusIndex(index: number) {
    setActiveIndex(index);
    list.current?.scrollToOffset({ offset: snapOffsets[index] ?? 0, animated: true });
  }

  function openEditor(index: number, type: LilicaRecordType, record?: LilicaRecord) {
    // Any direct call defaults to "not a deep link" -- the effect below
    // sets this true again immediately afterwards for its own call.
    deepLinked.current = false;
    const key = record?.id ?? `${type}:new`;
    setActiveIndex(index);
    setDrafts((current) => current[key]
      ? current
      : { ...current, [key]: createRecordDraft(type, record) });
    setOpenType(type);
    setOpenRecordId(record?.id);
    setOpenDraftKey(key);
    setOpenView('editor');
    focusIndex(index);
  }

  function openCategory(index: number, type: LilicaRecordType) {
    deepLinked.current = false;
    const existing = records.some((record) => record.type === type);
    if (!existing) {
      openEditor(index, type);
      return;
    }
    setActiveIndex(index);
    setOpenType(type);
    setOpenRecordId(undefined);
    setOpenDraftKey(undefined);
    setOpenView('list');
    focusIndex(index);
  }

  useEffect(() => {
    if (initialOpenRecordId) {
      const record = records.find((item) => item.id === initialOpenRecordId);
      const index = record ? ordered.findIndex((item) => item.id === record.type) : -1;
      if (record && index !== -1) {
        openEditor(index, record.type, record);
        deepLinked.current = true;
      }
      onInitialOpenHandled?.();
      return;
    }
    if (initialOpenType) {
      const index = ordered.findIndex((item) => item.id === initialOpenType);
      if (index !== -1) {
        openEditor(index, initialOpenType);
        deepLinked.current = true;
      }
      onInitialOpenHandled?.();
    }
    // Intentionally runs only when the requested ID/type changes -- this is
    // a one-shot "open this" request, not a continuous binding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpenRecordId, initialOpenType]);

  function save(index: number, record: LilicaRecord) {
    onSaveRecord(record);
    setDrafts((current) => ({
      ...current,
      [`${record.type}:${record.id}`]: createRecordDraft(record.type, record),
      ...(openRecordId ? {} : { [`${record.type}:new`]: createRecordDraft(record.type) }),
    }));
    if (deepLinked.current) {
      deepLinked.current = false;
      onBack();
      return;
    }
    focusAfterDismiss.current = Math.min(index + 1, ordered.length - 1);
    setOpenRecordId(undefined);
    setOpenDraftKey(undefined);
    setOpenView('list');
  }

  function remove(recordId: string) {
    onRemoveRecord(recordId);
    setDrafts((current) => {
      const next = { ...current };
      delete next[`${openType}:${recordId}`];
      return next;
    });
    if (deepLinked.current) {
      deepLinked.current = false;
      onBack();
      return;
    }
    setOpenRecordId(undefined);
    setOpenDraftKey(undefined);
    setOpenView('list');
  }

  function finishDismiss() {
    // Closing (backdrop tap/swipe) the editor that a deep link opened
    // returns straight to the caller (Home/Calendar/To Do/Person/
    // Wellbeing updates) rather than surfacing this screen's own
    // category-gateway list underneath -- the user never asked to browse
    // "records home", only to look at the one record they tapped.
    if (deepLinked.current) {
      deepLinked.current = false;
      onBack();
      return;
    }
    setOpenType(undefined);
    setOpenRecordId(undefined);
    setOpenDraftKey(undefined);
    if (focusAfterDismiss.current !== undefined) {
      const nextIndex = focusAfterDismiss.current;
      focusAfterDismiss.current = undefined;
      requestAnimationFrame(() => focusIndex(nextIndex));
    }
  }

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (openType) return;
    const offset = event.nativeEvent.contentOffset.y;
    const nearest = snapOffsets.reduce((best, value, index) => (
      Math.abs(value - offset) < Math.abs((snapOffsets[best] ?? 0) - offset) ? index : best
    ), 0);
    setActiveIndex(nearest);
  }

  return (
    <Screen
      scroll={false}
      backgroundColor={colors.creamStage}
      footer={
        records.length > 0 ? (
          <Button label={`Go to ${name}'s Home`} onPress={onFinish} style={styles.homeButton} />
        ) : (
          <Button label={everyday ? 'Back to Home' : "I'll add things later"} variant="text" onPress={onSkip} />
        )
      }
    >
      <Header onBack={onBack} />
      <View style={styles.intro}>
        <AppText variant="title" centre numberOfLines={2} adjustsFontSizeToFit>
          {everyday ? `${name}'s records` : `Let's get ${name} organised.`}
        </AppText>
        <AppText variant="secondary" tone="soft" centre style={styles.supporting}>
          {everyday
            ? `Add, review or update anything Lilica keeps track of for ${name}.`
            : "Add the important things you want Lilica to keep track of, so we can remind you what's coming up and what still needs sorting."}
        </AppText>
      </View>

      <Animated.FlatList
        ref={list}
        testID="first-thing-record-stack"
        data={ordered}
        keyExtractor={(item) => item.id}
        style={styles.stack}
        onLayout={(event) => setStackHeight(event.nativeEvent.layout.height)}
        contentContainerStyle={[
          styles.stackContent,
          { paddingBottom: stackBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        decelerationRate="fast"
        snapToOffsets={stackHeight === 0 ? undefined : snapOffsets}
        disableIntervalMomentum={!openType}
        onMomentumScrollEnd={handleScrollEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        onScrollToIndexFailed={({ index }) => {
          list.current?.scrollToOffset({ offset: index * (CLOSED_HEIGHT + ITEM_GAP), animated: true });
        }}
        renderItem={({ item, index }) => {
          const savedRecords = records.filter((record) => record.type === item.id);
          const hasRecords = savedRecords.length > 0;
          const focusOffset = snapOffsets[index] ?? index * (CLOSED_HEIGHT + ITEM_GAP);
          const inputRange = [focusOffset - CLOSED_HEIGHT, focusOffset, focusOffset + CLOSED_HEIGHT];
          const animatedStyle = {
            opacity: scrollY.interpolate({ inputRange, outputRange: [0.56, 1, 0.56], extrapolate: 'clamp' }),
            transform: [{
              scale: scrollY.interpolate({ inputRange, outputRange: [0.96, 1, 0.96], extrapolate: 'clamp' }),
            }],
          };

          return (
            <Animated.View
              style={[
                styles.item,
                styles.closedItem,
                index === activeIndex && styles.activeItem,
                animatedStyle,
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${hasRecords ? 'Open' : 'Add'} ${item.title}`}
                onPress={() => openCategory(index, item.id)}
                style={styles.itemHeader}
              >
                  <View style={[styles.categoryMark, hasRecords && styles.categoryMarkSaved]}>
                    <View style={styles.categoryMarkInner} />
                  </View>
                  <View style={styles.itemCopy}>
                    <AppText variant="bodyStrong" numberOfLines={2}>{item.title}</AppText>
                    <AppText variant="secondary" tone="soft" numberOfLines={2}>
                      {item.description}
                    </AppText>
                  </View>
                  <View style={styles.addAffordance}>
                    <AppText variant="secondary" tone="primary">Add</AppText>
                  </View>
              </Pressable>
              {/* Corrective task 7: anchored to the whole card (not the
                  small category icon), overlapping its top-right corner
                  like a refined notification/count badge. Sits OUTSIDE
                  the Pressable and is pointerEvents="none", so it can
                  never intercept or interfere with the card's own tap
                  target -- purely decorative. */}
              {hasRecords ? (
                <View
                  style={styles.countBadge}
                  pointerEvents="none"
                  accessibilityLabel={`${savedRecords.length} saved`}
                >
                  <AppText variant="secondary" tone="white" style={styles.countBadgeLabel} numberOfLines={1}>
                    {savedRecords.length}
                  </AppText>
                </View>
              ) : null}
            </Animated.View>
          );
        }}
      />

      {openType ? (() => {
        const option = ordered.find((item) => item.id === openType);
        const record = openRecordId ? records.find((item) => item.id === openRecordId) : undefined;
        const draftKey = openDraftKey ?? `${openType}:new`;
        const draft = drafts[draftKey] ?? createRecordDraft(openType, record);
        const index = ordered.findIndex((item) => item.id === openType);
        const categoryRecords = records.filter((item) => item.type === openType);
        const terms = categoryTerms[openType];
        return (
          <RecordSheet ref={sheet} title={openView === 'list' ? terms.heading : option?.title ?? 'Add something'} onDismiss={finishDismiss}>
            {openView === 'list' ? (
              <View style={styles.recordList}>
                {categoryRecords.length > 0 ? categoryRecords.map((item) => {
                  const date = formatDateForDisplay(item.eventDate ?? item.dueDate ?? item.expiryDate ?? item.date);
                  const detail = [date, item.eventTime ?? item.time].filter(Boolean).join(' - ');
                  const tertiary = item.location ?? item.provider ?? item.role ?? item.responsiblePerson ?? item.phone;
                  return (
                    <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`} onPress={() => openEditor(index, openType, item)} style={styles.recordRow}>
                      <View style={styles.recordCopy}>
                        <AppText variant="bodyStrong">{item.title}</AppText>
                        {detail ? <AppText variant="secondary" tone="soft">{detail}</AppText> : null}
                        {tertiary ? <AppText variant="secondary" tone="muted">{tertiary}</AppText> : null}
                      </View>
                      <AppText variant="section" tone="primary">&gt;</AppText>
                    </Pressable>
                  );
                }) : <AppText variant="secondary" tone="soft">No {terms.plural} added yet.</AppText>}
                <Button label={terms.add} variant="secondary" onPress={() => openEditor(index, openType)} style={styles.addRecord} />
              </View>
            ) : (
              <View style={styles.editorView}>
                {categoryRecords.length > 0 ? (
                  <Button
                    label={`Back to ${terms.heading}`}
                    variant="text"
                    onPress={() => {
                      // Same deep-link short-circuit as save/remove/
                      // finishDismiss above -- this button only ever
                      // makes sense as "browse this category's list",
                      // which a deep-linked visit never asked for.
                      if (deepLinked.current) {
                        deepLinked.current = false;
                        onBack();
                        return;
                      }
                      setOpenView('list');
                    }}
                    style={styles.backToList}
                  />
                ) : null}
                <RecordEditor
                  type={openType}
                  record={record}
                  draft={draft}
                  supportedPersonId={supportedPersonId}
                  activeMembershipId={activeMembershipId}
                  careCircleMembers={careCircleMembers}
                  onRequestReminderPermission={onRequestReminderPermission}
                  onChange={(nextDraft) => setDrafts((current) => ({ ...current, [draftKey]: nextDraft }))}
                  onSave={(savedRecord) => save(index, savedRecord)}
                  onRemove={record ? () => remove(record.id) : undefined}
                />
              </View>
            )}
          </RecordSheet>
        );
      })() : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', paddingHorizontal: spacing.sm, paddingBottom: spacing.md },
  supporting: { maxWidth: 390, marginTop: spacing.sm },
  stack: { flex: 1, marginHorizontal: -spacing.lg },
  stackContent: { paddingTop: spacing.sm, paddingHorizontal: spacing.lg },
  item: { marginBottom: ITEM_GAP, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  closedItem: { height: CLOSED_HEIGHT, borderRadius: radius.md, justifyContent: 'center' },
  activeItem: { borderColor: colors.primary, backgroundColor: colors.white },
  itemHeader: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  categoryMark: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  categoryMarkSaved: { backgroundColor: colors.oliveSoft },
  categoryMarkInner: { width: 13, height: 13, borderRadius: radius.pill, backgroundColor: colors.primary },
  itemCopy: { flex: 1, gap: spacing.xxs },
  addAffordance: { minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  // Corrective task 7: anchored to the card's own top-right corner (not
  // the small category icon), overlapping the card boundary like a
  // refined notification/count badge. minWidth (not a fixed width) plus
  // horizontal padding lets 1, 2 and 3+ digit counts grow without ever
  // clipping the number.
  countBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.olive,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    elevation: 2,
  },
  countBadgeLabel: { fontWeight: '700', fontSize: 11, lineHeight: 13 },
  recordList: { gap: spacing.sm, paddingBottom: spacing.xl },
  recordRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  recordCopy: { flex: 1, gap: spacing.xxs },
  addRecord: { marginTop: spacing.sm, borderRadius: radius.md },
  editorView: { gap: spacing.xs },
  backToList: { width: 'auto', alignSelf: 'flex-start', paddingHorizontal: 0 },
  homeButton: { borderRadius: radius.md },
});
