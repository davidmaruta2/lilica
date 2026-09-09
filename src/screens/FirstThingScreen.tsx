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
import { colors, radius, spacing } from '../theme';
import { Interest, LilicaRecord, LilicaRecordType } from '../types';

type Props = {
  interests: Interest[];
  personName?: string;
  supportedPersonId: string;
  records: LilicaRecord[];
  onBack: () => void;
  onSaveRecord: (record: LilicaRecord) => void;
  onFinish: () => void;
  onSkip: () => void;
};

const CLOSED_HEIGHT = 118;
const ITEM_GAP = 12;

export function FirstThingScreen({
  interests,
  personName,
  supportedPersonId,
  records,
  onBack,
  onSaveRecord,
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
  const [drafts, setDrafts] = useState<Partial<Record<LilicaRecordType, RecordDraft>>>({});
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

  const centrePadding = Math.max(spacing.sm, (stackHeight - CLOSED_HEIGHT) / 2);
  const snapOffsets = useMemo(
    () => ordered.map((_, index) => index * (CLOSED_HEIGHT + ITEM_GAP)),
    [ordered],
  );

  function focusIndex(index: number) {
    setActiveIndex(index);
    list.current?.scrollToOffset({ offset: snapOffsets[index] ?? 0, animated: true });
  }

  function open(index: number, type: LilicaRecordType) {
    setActiveIndex(index);
    setDrafts((current) => current[type]
      ? current
      : { ...current, [type]: createRecordDraft(type, records.find((record) => record.type === type)) });
    setOpenType(type);
    focusIndex(index);
  }

  function save(index: number, record: LilicaRecord) {
    onSaveRecord(record);
    setDrafts((current) => ({ ...current, [record.type]: createRecordDraft(record.type, record) }));
    focusAfterDismiss.current = Math.min(index + 1, ordered.length - 1);
    sheet.current?.dismiss();
  }

  function finishDismiss() {
    setOpenType(undefined);
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
          <Button label="I'll add things later" variant="text" onPress={onSkip} />
        )
      }
    >
      <Header onBack={onBack} />
      <View style={styles.intro}>
        <AppText variant="title" centre numberOfLines={2} adjustsFontSizeToFit>
          Let's get {name} organised.
        </AppText>
        <AppText variant="secondary" tone="soft" centre style={styles.supporting}>
          Add the important things you want Lilica to keep track of, so we can remind you what's coming up and what still needs sorting.
        </AppText>
      </View>

      <Animated.FlatList
        ref={list}
        data={ordered}
        keyExtractor={(item) => item.id}
        style={styles.stack}
        onLayout={(event) => setStackHeight(event.nativeEvent.layout.height)}
        contentContainerStyle={[
          styles.stackContent,
          { paddingTop: centrePadding, paddingBottom: Math.max(centrePadding, 180) },
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
          const saved = records.find((record) => record.type === item.id);
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
                accessibilityLabel={`${saved ? 'Edit' : 'Add'} ${item.title}`}
                onPress={() => open(index, item.id)}
                style={styles.itemHeader}
              >
                <View style={[styles.categoryMark, saved && styles.categoryMarkSaved]}>
                  <View style={styles.categoryMarkInner} />
                </View>
                <View style={styles.itemCopy}>
                  <View style={styles.titleRow}>
                    <AppText variant="bodyStrong" numberOfLines={2}>{item.title}</AppText>
                    {saved ? <AppText variant="meta" tone="primary">Added</AppText> : null}
                  </View>
                  <AppText variant="secondary" tone="soft" numberOfLines={2}>
                    {item.description}
                  </AppText>
                </View>
                <View style={styles.addAffordance}>
                  <AppText variant="secondary" tone="primary">{saved ? 'Edit' : 'Add'}</AppText>
                </View>
              </Pressable>
            </Animated.View>
          );
        }}
      />

      {openType ? (() => {
        const option = ordered.find((item) => item.id === openType);
        const record = records.find((item) => item.type === openType);
        const draft = drafts[openType] ?? createRecordDraft(openType, record);
        const index = ordered.findIndex((item) => item.id === openType);
        return (
          <RecordSheet ref={sheet} title={option?.title ?? 'Add something'} onDismiss={finishDismiss}>
            <RecordEditor
              type={openType}
              record={record}
              draft={draft}
              supportedPersonId={supportedPersonId}
              onChange={(nextDraft) => setDrafts((current) => ({ ...current, [openType]: nextDraft }))}
              onSave={(savedRecord) => save(index, savedRecord)}
            />
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
  stackContent: { paddingHorizontal: spacing.lg },
  item: { marginBottom: ITEM_GAP, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  closedItem: { height: CLOSED_HEIGHT, borderRadius: radius.md, justifyContent: 'center' },
  activeItem: { borderColor: colors.primary, backgroundColor: colors.white },
  itemHeader: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  categoryMark: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  categoryMarkSaved: { backgroundColor: colors.oliveSoft },
  categoryMarkInner: { width: 13, height: 13, borderRadius: radius.pill, backgroundColor: colors.primary },
  itemCopy: { flex: 1, gap: spacing.xxs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  addAffordance: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  homeButton: { borderRadius: radius.md },
});
