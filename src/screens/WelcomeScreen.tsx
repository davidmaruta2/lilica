import { useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { BrandVisual } from '../components/BrandVisual';
import { Button } from '../components/Button';
import { AppText } from '../components/Text';
import { Wordmark } from '../components/Wordmark';
import { colors, radius, spacing } from '../theme';

type Props = {
  onStart: () => void;
  onLogin: () => void;
};

type IntroPage = {
  key: string;
  heading: string;
  body: string;
  color: string;
  visual: 'hero' | 'together' | 'ahead';
};

const pages: IntroPage[] = [
  {
    key: 'welcome',
    heading: 'Welcome to Lilica',
    body: 'A calm place to organise life for someone you love.',
    color: colors.stageDeep,
    visual: 'hero',
  },
  {
    key: 'together',
    heading: 'Keep the important things together',
    body: 'Appointments, bills, documents and everyday jobs — all in one place.',
    color: '#B9674C',
    visual: 'together',
  },
  {
    key: 'ahead',
    heading: 'Know what needs doing',
    body: "See what's coming up and bring family in when it helps.",
    color: '#62764F',
    visual: 'ahead',
  },
];

function TogetherVisual() {
  return (
    <View style={styles.visualDisc}>
      <View style={[styles.paper, styles.paperBack]} />
      <View style={[styles.paper, styles.paperFront]}>
        <View style={[styles.paperLine, styles.paperLineLong]} />
        <View style={styles.paperLine} />
        <View style={[styles.paperLine, styles.paperLineShort]} />
      </View>
      <View style={styles.calendar}>
        <View style={styles.calendarTop} />
        <View style={styles.calendarDotRow}>
          <View style={styles.calendarDot} />
          <View style={styles.calendarDot} />
          <View style={[styles.calendarDot, styles.calendarDotStrong]} />
        </View>
      </View>
    </View>
  );
}

function AheadVisual() {
  return (
    <View style={styles.visualDisc}>
      <View style={styles.path} />
      <View style={[styles.pathDot, styles.pathDotOne]} />
      <View style={[styles.pathDot, styles.pathDotTwo]} />
      <View style={[styles.pathDot, styles.pathDotThree]}>
        <View style={styles.tickStem} />
        <View style={styles.tickArm} />
      </View>
    </View>
  );
}

export function WelcomeScreen({ onStart, onLogin }: Props) {
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, 520);
  const list = useRef<FlatList<IntroPage>>(null);
  const [page, setPage] = useState(0);

  function goTo(next: number) {
    list.current?.scrollToOffset({ offset: next * pageWidth, animated: true });
    setPage(next);
  }

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  }

  return (
    <View style={[styles.backdrop, { backgroundColor: pages[page].color }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.frame, { width: pageWidth }]}>
          <View style={styles.topBar}>
            <Wordmark tone="light" />
            <Pressable accessibilityRole="button" onPress={onLogin} hitSlop={12}>
              <AppText variant="secondary" tone="white" style={styles.login}>Log in</AppText>
            </Pressable>
          </View>

          <FlatList
            ref={list}
            data={pages}
            keyExtractor={(item) => item.key}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
            renderItem={({ item, index }) => (
              <View style={[styles.page, { width: pageWidth }]}>
                <View style={styles.visualArea}>
                  {item.visual === 'hero' ? <BrandVisual /> : item.visual === 'together' ? <TogetherVisual /> : <AheadVisual />}
                </View>
                <View style={styles.copy}>
                  <AppText variant="display" tone="white" centre style={styles.heading}>
                    {item.heading}
                  </AppText>
                  <AppText variant="body" tone="white" centre style={styles.body}>
                    {item.body}
                  </AppText>
                  {index === 0 ? (
                    <AppText variant="secondary" tone="white" centre style={styles.swipeCue}>
                      Swipe to continue  ›
                    </AppText>
                  ) : index === 2 ? (
                    <AppText variant="secondary" tone="white" centre style={styles.reassurance}>
                      Start on your own. Invite others later.
                    </AppText>
                  ) : null}
                </View>
              </View>
            )}
          />

          <View style={styles.bottom}>
            <View accessibilityLabel={`Intro page ${page + 1} of ${pages.length}`} style={styles.dots}>
              {pages.map((item, index) => (
                <View key={item.key} style={[styles.dot, index === page && styles.dotActive]} />
              ))}
            </View>
            <Button
              label={page === pages.length - 1 ? 'Get started' : 'Next'}
              variant="light"
              onPress={page === pages.length - 1 ? onStart : () => goTo(page + 1)}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  frame: {
    flex: 1,
    maxWidth: 520,
  },
  topBar: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  login: {
    fontWeight: '700',
    opacity: 0.9,
  },
  page: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  visualArea: {
    minHeight: 236,
    justifyContent: 'center',
    marginTop: -spacing.lg,
  },
  copy: {
    minHeight: 188,
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  heading: {
    maxWidth: 360,
    fontFamily: 'Fraunces_800ExtraBold',
  },
  body: {
    maxWidth: 340,
    marginTop: spacing.md,
    opacity: 0.94,
  },
  swipeCue: {
    marginTop: spacing.xl,
    opacity: 0.78,
    fontWeight: '700',
  },
  reassurance: {
    marginTop: spacing.lg,
    opacity: 0.82,
  },
  bottom: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  dots: {
    height: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.white,
  },
  visualDisc: {
    width: 208,
    height: 208,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paper: {
    position: 'absolute',
    width: 102,
    height: 128,
    borderRadius: radius.md,
  },
  paperBack: {
    backgroundColor: '#D8DDBB',
    transform: [{ rotate: '9deg' }],
    marginLeft: 28,
  },
  paperFront: {
    backgroundColor: '#EFE2D4',
    transform: [{ rotate: '-6deg' }],
    marginLeft: -20,
    padding: spacing.md,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  paperLine: {
    height: 8,
    width: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.stage,
  },
  paperLineLong: { width: 72, backgroundColor: colors.primary },
  paperLineShort: { width: 42, backgroundColor: colors.olive },
  calendar: {
    position: 'absolute',
    width: 70,
    height: 66,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    right: 23,
    bottom: 27,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  calendarTop: { height: 15, backgroundColor: colors.primary },
  calendarDotRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  calendarDot: { width: 9, height: 9, borderRadius: 9, backgroundColor: colors.line },
  calendarDotStrong: { backgroundColor: colors.clay },
  path: {
    width: 118,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
    transform: [{ rotate: '-17deg' }],
  },
  pathDot: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.clay,
    borderWidth: 6,
    borderColor: colors.surface,
  },
  pathDotOne: { left: 36, bottom: 55 },
  pathDotTwo: { width: 40, height: 40, left: 84, top: 77, backgroundColor: colors.primary },
  pathDotThree: { width: 58, height: 58, right: 25, top: 41, backgroundColor: colors.olive },
  tickStem: { position: 'absolute', width: 7, height: 26, borderRadius: 7, backgroundColor: colors.white, transform: [{ rotate: '42deg' }], right: 14, top: 10 },
  tickArm: { position: 'absolute', width: 7, height: 16, borderRadius: 7, backgroundColor: colors.white, transform: [{ rotate: '-42deg' }], left: 15, top: 24 },
});
