import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { searchRecords, SearchMatch } from '../search';
import { colors, radius, spacing } from '../theme';
import { LilicaRecord } from '../types';
import { CategoryIcon, visualFor } from './HomeScreen';

// Phase 20B, Feature B: one simple unified search entry for the CURRENT
// supported person only -- never across supported people (brief section
// 14). `records` is always exactly the active care space's own already-
// authorised projection, the same one Home/Calendar/To Do/People already
// hold -- see docs/PHASE_20_ARCHITECTURE.md. This screen never fetches
// anything itself, so it works offline identically to being online, and a
// `key` on this screen in App.tsx (keyed by the active care space id)
// ensures a person switch always remounts it fresh rather than showing a
// stale query/results from whoever was previously selected.
type Props = {
  records: LilicaRecord[];
  personName?: string;
  onBack: () => void;
  onOpenRecord: (recordId: string) => void;
};

function matchLabel(match: SearchMatch): string {
  return match.matchedField ? `${match.record.title} · ${match.matchedField}` : match.record.title;
}

export function SearchScreen({ records, personName, onBack, onOpenRecord }: Props) {
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  const groups = useMemo(() => searchRecords(records, query), [records, query]);
  const totalMatches = groups.reduce((sum, group) => sum + group.matches.length, 0);

  return (
    <Screen>
      <Header title={`Search ${personName || 'records'}`} onBack={onBack} />
      <View style={styles.inputWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search appointments, tasks, documents…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoFocus
          autoCorrect={false}
          accessibilityLabel="Search"
          accessibilityHint={`Search ${personName || 'this person'}'s records`}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8} style={styles.clearButton}>
            <AppText variant="secondary" tone="soft">Clear</AppText>
          </Pressable>
        ) : null}
      </View>

      {trimmed.length === 0 ? (
        <AppText variant="secondary" tone="soft" style={styles.helper}>
          Search for anything already saved for {personName || 'this person'} - an appointment, a task, a document, a contact.
        </AppText>
      ) : totalMatches === 0 ? (
        <AppText variant="secondary" tone="soft" style={styles.helper}>
          Nothing matches "{trimmed}".
        </AppText>
      ) : (
        <View style={styles.groups}>
          {groups.map((group) => (
            <View key={group.type} style={styles.group}>
              <AppText variant="section">{group.label}</AppText>
              <View style={styles.groupList}>
                {group.matches.map((match) => {
                  const visual = visualFor(match.record.type);
                  return (
                    <Pressable
                      key={match.record.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${match.record.title}`}
                      onPress={() => onOpenRecord(match.record.id)}
                      style={styles.row}
                    >
                      <View style={[styles.iconChip, { backgroundColor: visual.tint }]}>
                        <CategoryIcon type={match.record.type} color={visual.accent} />
                      </View>
                      <View style={styles.rowCopy}>
                        <AppText variant="bodyStrong" numberOfLines={1}>{match.record.title}</AppText>
                        {match.matchedField ? <AppText variant="secondary" tone="soft" numberOfLines={1}>{match.matchedField}</AppText> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.ink,
  },
  clearButton: {
    paddingVertical: spacing.xs,
  },
  helper: {
    marginTop: spacing.sm,
  },
  groups: {
    gap: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  groupList: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
});
