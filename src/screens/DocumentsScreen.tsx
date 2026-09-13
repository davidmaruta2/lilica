import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { AppText } from '../components/Text';
import { CareSpaceDocument, listCareSpaceDocuments } from '../documents';
import { colors, radius, spacing } from '../theme';

// Phase 20D, Part D (approved `\downloads\20-22.txt`): a current-
// supported-person Documents collection, deliberately modelled on
// ContactsListScreen.tsx's own bounded-list architecture -- same row
// language, same Screen/Header pattern, same "small focused v1" shape.
// Answers "show me [Name]'s documents" for the first time; no filtering
// or sorting UI (brief section 32 -- deliberately deferred until proven
// necessary).
type Props = {
  careSpaceId?: string;
  personName?: string;
  onBack: () => void;
  onOpenRecord: (recordId: string) => void;
};

function formatSize(bytes?: number): string | undefined {
  if (!bytes) return undefined;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function DocumentsScreen({ careSpaceId, personName, onBack, onOpenRecord }: Props) {
  const [documents, setDocuments] = useState<CareSpaceDocument[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    if (!careSpaceId) {
      setDocuments([]);
      return;
    }
    setDocuments(undefined);
    setError(undefined);
    listCareSpaceDocuments(careSpaceId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setDocuments(result.data);
      } else {
        // Real bug found by testing: leaving `documents` as undefined here
        // meant the "Loading…" branch (checked first) never released, so
        // the real error message below could never actually be reached.
        setError(result.message);
        setDocuments([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [careSpaceId]);

  return (
    <Screen>
      <Header title="Documents" onBack={onBack} />
      {documents === undefined ? (
        <AppText variant="secondary" tone="soft">Loading…</AppText>
      ) : error ? (
        <AppText variant="secondary" tone="danger">{error}</AppText>
      ) : documents.length > 0 ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {documents.map((document) => {
            const meta = [document.recordTitle, formatDate(document.createdAt), formatSize(document.sizeBytes)]
              .filter(Boolean)
              .join(' · ');
            return (
              <Pressable
                key={document.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${document.displayName}`}
                onPress={() => onOpenRecord(document.recordId)}
                style={styles.row}
              >
                <View style={styles.iconChip}>
                  <View style={styles.iconMark} />
                </View>
                <View style={styles.rowCopy}>
                  <AppText variant="bodyStrong" numberOfLines={1}>{document.displayName}</AppText>
                  <AppText variant="secondary" tone="soft" numberOfLines={1}>{meta}</AppText>
                </View>
                <View style={styles.chevron} />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <AppText variant="secondary" tone="soft">
          No documents have been added for {personName || 'them'} yet.
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
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
    backgroundColor: colors.primarySoft,
  },
  iconMark: {
    width: 14,
    height: 18,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 2,
  },
  rowCopy: { flex: 1, gap: 2 },
  chevron: {
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.muted,
    transform: [{ rotate: '45deg' }],
  },
});
