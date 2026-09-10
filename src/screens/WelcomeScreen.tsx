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
import { AppText } from '../components/Text';
import { Wordmark } from '../components/Wordmark';
import { colors, radius, spacing } from '../theme';

type Props = {
  onStart: () => void;
  onLogin: () => void;
};

type BulletIconKey = 'calendar' | 'document' | 'house' | 'check' | 'people' | 'chat' | 'list' | 'paperPlane';

type IntroBullet = {
  label: string;
  icon: BulletIconKey;
};

type IntroPage = {
  key: string;
  heading: string;
  body: string;
  bullets?: IntroBullet[];
  color: string;
  visual: 'hero' | 'together' | 'ahead';
};

const pages: IntroPage[] = [
  {
    key: 'welcome',
    heading: 'Care for the people you love',
    body: 'Helping them stay independent and age well, with the family organised around them.',
    color: colors.stageDeep,
    visual: 'hero',
  },
  {
    key: 'together',
    heading: 'Know what they need',
    body: 'Keep the important things in one place, from appointments to paperwork and everyday jobs.',
    bullets: [
      { label: 'Medical appointments', icon: 'calendar' },
      { label: 'Documents and bills', icon: 'document' },
      { label: 'Household tasks', icon: 'house' },
      { label: 'Everyday jobs', icon: 'check' },
    ],
    color: '#B9674C',
    visual: 'together',
  },
  {
    key: 'ahead',
    heading: 'Share care, with clarity',
    body: "Bring in family or other helpers, share updates and responsibilities, and see clearly who's doing what.",
    bullets: [
      { label: 'Bring in family or other helpers', icon: 'people' },
      { label: 'Share updates and responsibilities', icon: 'chat' },
      { label: "See clearly who's doing what", icon: 'list' },
      { label: "Invite others when you're ready", icon: 'paperPlane' },
    ],
    color: '#62764F',
    visual: 'ahead',
  },
];

// Small drawn icons built from plain Views only, matching the technique
// already used elsewhere in this app (Wordmark's leaf, HomeScreen's
// CategoryIcon) -- no icon library dependency needed.
function BulletIcon({ icon }: { icon: BulletIconKey }) {
  switch (icon) {
    case 'calendar':
      return (
        <View style={iconStyles.calendar}>
          <View style={iconStyles.calendarTop} />
        </View>
      );
    case 'document':
      return (
        <View style={iconStyles.document}>
          <View style={iconStyles.documentLine} />
          <View style={[iconStyles.documentLine, iconStyles.documentLineShort]} />
        </View>
      );
    case 'house':
      return (
        <View style={iconStyles.houseWrap}>
          <View style={iconStyles.houseRoof} />
          <View style={iconStyles.houseBase} />
        </View>
      );
    case 'check':
      return <View style={iconStyles.tick} />;
    case 'people':
      return (
        <View style={iconStyles.personWrap}>
          <View style={iconStyles.personHead} />
          <View style={iconStyles.personShoulders} />
        </View>
      );
    case 'chat':
      return (
        <View style={iconStyles.chatWrap}>
          <View style={iconStyles.chatBubble} />
          <View style={iconStyles.chatTail} />
        </View>
      );
    case 'list':
      return (
        <View style={iconStyles.listWrap}>
          <View style={iconStyles.listLine} />
          <View style={iconStyles.listLine} />
          <View style={iconStyles.listLine} />
        </View>
      );
    case 'paperPlane':
    default:
      return <View style={iconStyles.paperPlane} />;
  }
}

const iconStyles = StyleSheet.create({
  calendar: {
    width: 16,
    height: 14,
    borderWidth: 1.4,
    borderColor: colors.white,
    borderRadius: 3,
    overflow: 'hidden',
  },
  calendarTop: {
    height: 4,
    backgroundColor: colors.white,
  },
  document: {
    width: 14,
    height: 16,
    borderWidth: 1.4,
    borderColor: colors.white,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  documentLine: {
    width: 8,
    height: 1.6,
    backgroundColor: colors.white,
  },
  documentLineShort: {
    width: 6,
  },
  houseWrap: {
    alignItems: 'center',
  },
  houseRoof: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.white,
  },
  houseBase: {
    width: 12,
    height: 9,
    borderWidth: 1.4,
    borderColor: colors.white,
    marginTop: -1,
  },
  tick: {
    width: 12,
    height: 7,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.white,
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
  personWrap: {
    alignItems: 'center',
  },
  personHead: {
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    marginBottom: 2,
  },
  personShoulders: {
    width: 18,
    height: 9,
    borderTopLeftRadius: radius.pill,
    borderTopRightRadius: radius.pill,
    backgroundColor: colors.white,
  },
  chatWrap: {
    alignItems: 'flex-start',
  },
  chatBubble: {
    width: 16,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.white,
  },
  chatTail: {
    width: 4,
    height: 4,
    backgroundColor: colors.white,
    marginTop: -2,
    marginLeft: 3,
    transform: [{ rotate: '45deg' }],
  },
  listWrap: {
    gap: 3,
  },
  listLine: {
    width: 14,
    height: 1.6,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  paperPlane: {
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 9,
    borderTopColor: 'transparent',
    borderRightColor: colors.white,
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
});

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
                        <View key={bullet.label} style={styles.bulletRow}>
                          <View style={styles.bulletBadge}>
                            <BulletIcon icon={bullet.icon} />
                          </View>
                          <AppText variant="bodyStrong" tone="white" style={styles.bulletText}>
                            {bullet.label}
                          </AppText>
                        </View>
                      ))}
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Get started"
                onPress={onStart}
                style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              >
                <AppText variant="button" tone="primary">Get started</AppText>
                <View style={styles.ctaArrow} />
              </Pressable>
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
    minHeight: 196,
    justifyContent: 'center',
  },
  visualAreaCompact: {
    minHeight: 150,
  },
  visualCompact: {
    transform: [{ scale: 0.76 }],
  },
  copy: {
    minHeight: 188,
    alignItems: 'center',
    paddingTop: 28,
  },
  copyCompact: {
    minHeight: 0,
    paddingTop: spacing.xs,
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
    maxWidth: 300,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  bulletsCompact: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  bulletRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bulletBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
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
  cta: {
    width: '100%',
    minHeight: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  ctaPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
  ctaArrow: {
    width: 8,
    height: 8,
    borderTopWidth: 2.4,
    borderRightWidth: 2.4,
    borderColor: colors.primary,
    transform: [{ rotate: '45deg' }],
    marginLeft: 2,
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
    width: 172,
    height: 172,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paper: {
    position: 'absolute',
    width: 84,
    height: 106,
    borderRadius: radius.md,
  },
  paperBack: {
    backgroundColor: '#D8DDBB',
    transform: [{ rotate: '9deg' }],
    marginLeft: 23,
  },
  paperFront: {
    backgroundColor: '#EFE2D4',
    transform: [{ rotate: '-6deg' }],
    marginLeft: -17,
    padding: spacing.sm,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  paperLine: {
    height: 7,
    width: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.stage,
  },
  paperLineLong: { width: 60, backgroundColor: colors.primary },
  paperLineShort: { width: 35, backgroundColor: colors.olive },
  calendar: {
    position: 'absolute',
    width: 58,
    height: 55,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    right: 19,
    bottom: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
  },
  calendarTop: { height: 12, backgroundColor: colors.primary },
  calendarDotRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  calendarDot: { width: 7, height: 7, borderRadius: 7, backgroundColor: colors.line },
  calendarDotStrong: { backgroundColor: colors.clay },
  connection: {
    position: 'absolute',
    width: 50,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: '#D8DDBB',
    top: 73,
  },
  connectionLeft: {
    left: 31,
    transform: [{ rotate: '-23deg' }],
  },
  connectionRight: {
    right: 31,
    transform: [{ rotate: '23deg' }],
  },
  helper: {
    position: 'absolute',
    width: 43,
    height: 43,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperLeft: {
    left: 20,
    top: 36,
    backgroundColor: colors.claySoft,
  },
  helperRight: {
    right: 20,
    top: 36,
    backgroundColor: colors.oliveSoft,
  },
  helperHead: {
    width: 11,
    height: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginBottom: 2,
  },
  helperBody: {
    width: 20,
    height: 10,
    borderTopLeftRadius: radius.pill,
    borderTopRightRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  sharedTask: {
    position: 'absolute',
    width: 96,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    bottom: 22,
    paddingHorizontal: spacing.sm,
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
    width: 32,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
  },
  taskLineLong: {
    width: 43,
    backgroundColor: colors.clay,
  },
  taskTick: {
    width: 27,
    height: 27,
    borderRadius: radius.pill,
    backgroundColor: colors.olive,
  },
  tickStem: { position: 'absolute', width: 4, height: 13, borderRadius: 4, backgroundColor: colors.white, transform: [{ rotate: '42deg' }], right: 7, top: 6 },
  tickArm: { position: 'absolute', width: 4, height: 8, borderRadius: 4, backgroundColor: colors.white, transform: [{ rotate: '-42deg' }], left: 7, top: 12 },
});
