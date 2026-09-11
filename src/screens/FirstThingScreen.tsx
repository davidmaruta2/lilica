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
import { canEditRecord, RecordDetail } from '../components/RecordDetail';
import { createRecordDraft, RecordDraft, RecordEditor } from '../components/RecordEditor';
import { RecordSheet, RecordSheetHandle } from '../components/RecordSheet';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { CareCircleMember } from '../careCircle';
import { firstItemOptions } from '../data/options';
import { formatDateForDisplay } from '../records';
import { colors, radius, spacing } from '../theme';
import { LilicaRecord, LilicaRecordType } from '../types';

type Props = {
  // Corrective task: which categories were chosen on "What do you help
  // X with?" -- initial-setup orchestration ONLY. Used below (see
  // `ordered`) to decide which category cards this screen offers WHILE
  // `everyday` is false; has no effect at all once `everyday` is true
  // (or here in any other way) -- never a filter/permission/capability.
  interests: LilicaRecordType[];
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
  // the heading/footer copy AND (corrective task) makes `interests`
  // inert: the everyday Add gateway always offers the complete canonical
  // category set, exactly as before this task, regardless of what was
  // chosen during initial setup. The category-gateway/list/add/edit
  // architecture itself is otherwise unchanged and locked either way.
  everyday?: boolean;
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
  const scrollY = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);
  const [openType, setOpenType] = useState<LilicaRecordType>();
  const [openRecordId, setOpenRecordId] = useState<string>();
  const [openDraftKey, setOpenDraftKey] = useState<string>();
  // Corrective task (view/edit separation): a category list's existing
  // records open in read-only 'view' first, never straight to 'editor' --
  // 'editor' is now reached only by explicitly creating a new record or
  // pressing Edit from that record's own detail. See openDetail/openEditor.
  const [openView, setOpenView] = useState<'list' | 'view' | 'editor'>('editor');
  const [drafts, setDrafts] = useState<Record<string, RecordDraft>>({});
  const [stackHeight, setStackHeight] = useState(0);

  // Corrective task: initial setup (everyday === false) offers ONLY the
  // categories chosen on "What do you help X with?" -- in their normal
  // canonical order, never reordered by preference. An empty selection
  // (skipped, or continued without choosing anything) falls back to the
  // complete list rather than an empty gateway, so "add later" always
  // works. Once setup is done (everyday === true), `interests` is
  // completely inert: Add always offers the complete canonical category
  // set, exactly as if nothing had ever been selected -- this is the
  // one thing this task exists to guarantee never regresses.
  const ordered = useMemo(() => {
    if (everyday || interests.length === 0) return firstItemOptions;
    const chosen = firstItemOptions.filter((option) => interests.includes(option.id));
    return chosen.length > 0 ? chosen : firstItemOptions;
  }, [interests, everyday]);

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

  // Corrective task: tapping an EXISTING record (from the category list)
  // opens its read-only detail, not the editor -- Edit (from within
  // RecordDetail) is what calls openEditor for that same record.
  function openDetail(index: number, type: LilicaRecordType, record: LilicaRecord) {
    setActiveIndex(index);
    setOpenType(type);
    setOpenRecordId(record.id);
    setOpenDraftKey(undefined);
    setOpenView('view');
    focusIndex(index);
  }

  function openCategory(index: number, type: LilicaRecordType) {
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

  function save(index: number, record: LilicaRecord) {
    const wasEditingExisting = Boolean(openRecordId);
    onSaveRecord(record);
    setDrafts((current) => ({
      ...current,
      [`${record.type}:${record.id}`]: createRecordDraft(record.type, record),
      ...(openRecordId ? {} : { [`${record.type}:new`]: createRecordDraft(record.type) }),
    }));
    // Corrective task: editing an existing record returns to its own
    // (now updated) read-only detail, staying open -- never falling back
    // to the category list. A brand-new record has no detail to return
    // to, so creation stays exactly as efficient as before: save returns
    // to the list, now showing it.
    if (wasEditingExisting) {
      setOpenRecordId(record.id);
      setOpenDraftKey(undefined);
      setOpenView('view');
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
    setOpenRecordId(undefined);
    setOpenDraftKey(undefined);
    setOpenView('list');
  }

  function finishDismiss() {
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
          <RecordSheet
            ref={sheet}
            title={openView === 'list' ? terms.heading : option?.title ?? 'Add something'}
            onDismiss={finishDismiss}
          >
            {openView === 'list' ? (
              <View style={styles.recordList}>
                {categoryRecords.length > 0 ? categoryRecords.map((item) => {
                  const date = formatDateForDisplay(item.eventDate ?? item.dueDate ?? item.expiryDate ?? item.date);
                  const detail = [date, item.eventTime ?? item.time].filter(Boolean).join(' - ');
                  const tertiary = item.location ?? item.provider ?? item.role ?? item.responsiblePerson ?? item.phone;
                  return (
                    <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => openDetail(index, openType, item)} style={styles.recordRow}>
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
                    onPress={() => setOpenView('list')}
                    style={styles.backToList}
                  />
                ) : null}
                {openView === 'view' && record ? (
                  <RecordDetail
                    record={record}
                    activeMembershipId={activeMembershipId}
                    careCircleMembers={careCircleMembers}
                    onEdit={canEditRecord(record, careCircleMembers) ? () => openEditor(index, openType, record) : undefined}
                  />
                ) : (
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
                )}
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
