import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { interestOptions } from '../data/options';
import { colors, radius, shadow, spacing } from '../theme';
import { Interest } from '../types';

type Props = {
  selected: Interest[];
  personName?: string;
  // True for the organiser's own "Myself" care space. "What do you help
  // David with?" is grammatically fine but conceptually odd once the
  // supported person is the organiser themselves, so this swaps to
  // first-person framing using the same existing relationship semantic
  // the fork already established -- no new domain concept.
  isSelf?: boolean;
  onBack: () => void;
  onToggle: (interest: Interest) => void;
  onContinue: () => void;
  onSkip: () => void;
};

const SCROLL_STEP = 230;

export function InterestsScreen({ selected, personName, isSelf = false, onBack, onToggle, onContinue, onSkip }: Props) {
  const name = personName?.trim() || 'them';
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const layoutWidth = useRef(0);
  const contentWidth = useRef(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  function updateArrows() {
    const max = Math.max(0, contentWidth.current - layoutWidth.current);
    setCanScrollLeft(scrollX.current > 4);
    setCanScrollRight(max > 4 && scrollX.current < max - 4);
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollX.current = event.nativeEvent.contentOffset.x;
    updateArrows();
  }

  function handleLayout(width: number) {
    layoutWidth.current = width;
    updateArrows();
  }

  function handleContentSizeChange(width: number) {
    contentWidth.current = width;
    updateArrows();
  }

  function scrollBy(direction: 1 | -1) {
    const max = Math.max(0, contentWidth.current - layoutWidth.current);
    const next = Math.max(0, Math.min(max, scrollX.current + direction * SCROLL_STEP));
    scrollRef.current?.scrollTo({ x: next, animated: true });
  }

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button label="Continue" onPress={onContinue} />
          <Button label="Skip for now" variant="text" onPress={onSkip} />
        </View>
      }
    >
      <Header onBack={onBack} />
      <View testID="interests-content" style={styles.content}>
        <View style={styles.prompt}>
          <AppText variant="title" centre>{isSelf ? 'What would you like help staying on top of?' : `What do you help ${name} with?`}</AppText>
          <AppText variant="body" tone="soft" centre style={styles.supporting}>
            Choose what feels familiar.
          </AppText>
        </View>
        <View testID="interests-carousel" style={styles.wheel}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            onLayout={(event) => handleLayout(event.nativeEvent.layout.width)}
            onContentSizeChange={(width) => handleContentSizeChange(width)}
            scrollEventThrottle={16}
            contentContainerStyle={styles.row}
          >
            {interestOptions.map((option) => (
              <Chip
                key={option.id}
                title={option.title}
                selected={selected.includes(option.id)}
                onPress={() => onToggle(option.id)}
              />
            ))}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scroll left"
            disabled={!canScrollLeft}
            onPress={() => scrollBy(-1)}
            style={[styles.arrow, styles.arrowLeft, canScrollLeft ? styles.arrowActive : styles.arrowInactive]}
          >
            <View style={[styles.chevron, styles.chevronLeft, canScrollLeft && styles.chevronActive]} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scroll right"
            disabled={!canScrollRight}
            onPress={() => scrollBy(1)}
            style={[styles.arrow, styles.arrowRight, canScrollRight ? styles.arrowActive : styles.arrowInactive]}
          >
            <View style={[styles.chevron, styles.chevronRight, canScrollRight && styles.chevronActive]} />
          </Pressable>
        </View>
        <AppText variant="secondary" tone="soft" centre style={styles.count}>
          {selected.length > 0 ? `${selected.length} selected` : 'Tap to select. You can change this later.'}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  supporting: {
    marginTop: spacing.sm,
    maxWidth: 310,
  },
  prompt: {
    alignItems: 'center',
  },
  wheel: {
    marginTop: spacing.xl,
    marginHorizontal: -spacing.lg,
    justifyContent: 'center',
  },
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  arrowLeft: {
    left: 0,
  },
  arrowRight: {
    right: 0,
  },
  arrowActive: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.teal,
  },
  arrowInactive: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    opacity: 0.55,
  },
  chevron: {
    width: 9,
    height: 9,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.muted,
  },
  chevronActive: {
    borderColor: colors.teal,
  },
  chevronLeft: {
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
  chevronRight: {
    transform: [{ rotate: '225deg' }],
    marginRight: 3,
  },
  count: {
    marginTop: spacing.md,
  },
  footer: {
    gap: spacing.xxs,
  },
});
