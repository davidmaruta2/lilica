import { useMemo, useRef, useState } from 'react';
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
  // True once setup is already complete and this screen is reached from
  // Home's everyday Add action rather than first-time onboarding. Changes
  // only the heading/footer copy — the category-gateway/list/add/edit
  // architecture itself is unchanged and locked either way.
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
  update: { heading: 'Updates', singular: 'update', plural: 'updates', add: 'Add update' },
};

export function FirstThingScreen({
  interests,
  personName,
  supportedPersonId,
  records,
  activeMembershipId,
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
    onSaveRecord(record);
    setDrafts((current) => ({
      ...current,
      [`${record.type}:${record.id}`]: createRecordDraft(record.type, record),
      ...(openRecordId ? {} : { [`${record.type}:new`]: createRecordDraft(record.type) }),
    }));
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
                    <AppText variant="secondary" tone="primary">{hasRecords ? 'Added' : 'Add'}</AppText>
                  </View>
              </Pressable>
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
                {categoryRecords.length > 0 ? <Button label={`Back to ${terms.heading}`} variant="text" onPress={() => setOpenView('list')} style={styles.backToList} /> : null}
                <RecordEditor
                  type={openType}
                  record={record}
                  draft={draft}
                  supportedPersonId={supportedPersonId}
                  activeMembershipId={activeMembershipId}
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
  categoryMark: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  categoryMarkSaved: { backgroundColor: colors.oliveSoft },
  categoryMarkInner: { width: 13, height: 13, borderRadius: radius.pill, backgroundColor: colors.primary },
  itemCopy: { flex: 1, gap: spacing.xxs },
  addAffordance: { width: 48, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  recordList: { gap: spacing.sm, paddingBottom: spacing.xl },
  recordRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  recordCopy: { flex: 1, gap: spacing.xxs },
  addRecord: { marginTop: spacing.sm, borderRadius: radius.md },
  editorView: { gap: spacing.xs },
  backToList: { width: 'auto', alignSelf: 'flex-start', paddingHorizontal: 0 },
  homeButton: { borderRadius: radius.md },
});
