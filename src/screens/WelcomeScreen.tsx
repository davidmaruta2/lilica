import { useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  bullets?: string[];
  closing?: string;
  color: string;
  visual: 'hero' | 'together' | 'ahead';
};

const pages: IntroPage[] = [
  {
    key: 'welcome',
    heading: 'Welcome to Lilica',
    body: 'Help the people you love to:',
    bullets: [
      'Stay independent',
      'Live and age well',
    ],
    closing: 'while keeping everyone involved on the same page.',
    color: colors.stageDeep,
    visual: 'hero',
  },
  {
    key: 'together',
    heading: 'Know what they need',
    body: 'See the important things in one place:',
    bullets: [
      'Medical appointments',
      'Documents and bills',
      'Everyday jobs',
      'Home and car tasks',
    ],
    color: '#B9674C',
    visual: 'together',
  },
  {
    key: 'ahead',
    heading: 'Share care, with clarity',
    body: 'Update and share responsibilities in a controlled way:',
    bullets: [
      'Bring in family or other helpers',
      'Share updates and responsibilities',
      "See clearly who's doing what",
      "Invite others when you're ready",
    ],
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
      <View style={[styles.connection, styles.connectionLeft]} />
      <View style={[styles.connection, styles.connectionRight]} />
      <View style={[styles.helper, styles.helperLeft]}>
        <View style={styles.helperHead} />
        <View style={styles.helperBody} />
      </View>
      <View style={[styles.helper, styles.helperRight]}>
        <View style={styles.helperHead} />
        <View style={styles.helperBody} />
      </View>
      <View style={styles.sharedTask}>
        <View style={styles.taskLines}>
          <View style={[styles.taskLine, styles.taskLineLong]} />
          <View style={styles.taskLine} />
        </View>
        <View style={styles.taskTick}>
          <View style={styles.tickStem} />
          <View style={styles.tickArm} />
        </View>
      </View>
    </View>
  );
}

export function WelcomeScreen({ onStart, onLogin }: Props) {
  const { height, width } = useWindowDimensions();
  const pageWidth = Math.min(width, 520);
  const compact = height < 740;
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
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea} testID="welcome-safe-area">
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
                <View style={[styles.visualArea, compact && styles.visualAreaCompact]}>
                  <View style={compact && styles.visualCompact}>
                    {item.visual === 'hero' ? <BrandVisual /> : item.visual === 'together' ? <TogetherVisual /> : <AheadVisual />}
                  </View>
                </View>
                <View style={[styles.copy, compact && styles.copyCompact]}>
                  <AppText variant="display" tone="white" centre style={styles.heading}>
                    {item.heading}
                  </AppText>
                  <AppText variant="body" tone="white" centre style={[styles.body, compact && styles.bodyCompact]}>
                    {item.body}
                  </AppText>
                  {item.bullets ? (
                    <View style={[styles.bullets, compact && styles.bulletsCompact]}>
                      {item.bullets.map((bullet) => (
                        <View key={bullet} style={styles.bulletRow}>
                          <View style={styles.bulletMark} />
                          <AppText variant="bodyStrong" tone="white" centre style={styles.bulletText}>
                            {bullet}
                          </AppText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {item.closing ? (
                    <View style={styles.closing}>
                      <View style={styles.accentLine} />
                      <AppText variant="secondary" tone="white" centre style={styles.closingText}>
                        {item.closing}
                      </AppText>
                    </View>
                  ) : null}
                  {index === 2 ? (
                    <AppText variant="secondary" tone="white" centre style={[styles.reassurance, compact && styles.reassuranceCompact]}>
                      Lilica works from day one, even when it’s just you.
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
            {page === pages.length - 1 ? (
              <Button label="Get started" variant="light" onPress={onStart} />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go to the next introduction page"
                onPress={() => goTo(page + 1)}
                style={({ pressed }) => [styles.advance, pressed && styles.advancePressed]}
              >
                <AppText variant="bodyStrong" tone="white" centre>
                  Swipe to continue  ›
                </AppText>
              </Pressable>
            )}
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
  visualAreaCompact: {
    minHeight: 176,
  },
  visualCompact: {
    transform: [{ scale: 0.76 }],
  },
  copy: {
    minHeight: 188,
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  copyCompact: {
    minHeight: 0,
    paddingTop: 0,
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
  bodyCompact: {
    marginTop: spacing.xs,
  },
  bullets: {
    width: '100%',
    maxWidth: 330,
    marginTop: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
  },
  bulletsCompact: {
    marginTop: spacing.xs,
    gap: spacing.xxs,
  },
  bulletRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  bulletMark: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: '#D7DCB2',
    marginTop: 7,
  },
  bulletText: {
    maxWidth: 270,
  },
  closing: {
    width: '100%',
    maxWidth: 300,
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  accentLine: {
    width: 46,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: '#D7DCB2',
  },
  closingText: {
    maxWidth: 280,
    opacity: 0.9,
  },
  reassurance: {
    marginTop: spacing.lg,
    opacity: 0.82,
  },
  reassuranceCompact: {
    marginTop: spacing.xs,
  },
  bottom: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  advance: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  advancePressed: {
    opacity: 0.62,
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
  connection: {
    position: 'absolute',
    width: 60,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: '#D8DDBB',
    top: 88,
  },
  connectionLeft: {
    left: 37,
    transform: [{ rotate: '-23deg' }],
  },
  connectionRight: {
    right: 37,
    transform: [{ rotate: '23deg' }],
  },
  helper: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperLeft: {
    left: 24,
    top: 44,
    backgroundColor: colors.claySoft,
  },
  helperRight: {
    right: 24,
    top: 44,
    backgroundColor: colors.oliveSoft,
  },
  helperHead: {
    width: 13,
    height: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginBottom: 3,
  },
  helperBody: {
    width: 24,
    height: 12,
    borderTopLeftRadius: radius.pill,
    borderTopRightRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  sharedTask: {
    position: 'absolute',
    width: 116,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    bottom: 27,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
  },
  taskLines: {
    gap: spacing.xs,
  },
  taskLine: {
    width: 39,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
  },
  taskLineLong: {
    width: 52,
    backgroundColor: colors.clay,
  },
  taskTick: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.olive,
  },
  tickStem: { position: 'absolute', width: 5, height: 16, borderRadius: 5, backgroundColor: colors.white, transform: [{ rotate: '42deg' }], right: 8, top: 7 },
  tickArm: { position: 'absolute', width: 5, height: 10, borderRadius: 5, backgroundColor: colors.white, transform: [{ rotate: '-42deg' }], left: 8, top: 14 },
});
