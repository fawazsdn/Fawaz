import { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Plus } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { AppHeader } from '@/components/AppHeader';
import { IconButton } from '@/components/IconButton';
import { EmptyState } from '@/components/EmptyState';
import { IssueCard } from '@/features/issues/IssueCard';

export default function IssuesListScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  // Raw state + useMemo, not filter()/sort() inside the selector — see
  // src/features/home/HomeHeader.tsx for why.
  const allIssues = useStore((s) => s.issues);
  const issues = useMemo(
    () =>
      allIssues
        .filter((i) => i.neighborhoodId === neighborhoodId)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [allIssues, neighborhoodId],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t.community.issues}
        right={
          <IconButton accessibilityLabel={t.create.issue} onPress={() => router.push('/issue/create')}>
            <Plus size={20} color={theme.colors.primary} />
          </IconButton>
        }
      />
      <FlatList
        data={issues}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: 10 }}
        renderItem={({ item }) => <IssueCard issue={item} />}
        ListEmptyComponent={
          <EmptyState
            icon={AlertTriangle}
            title={t.emptyStates.noIssues}
            actionLabel={t.create.issue}
            onAction={() => router.push('/issue/create')}
          />
        }
      />
    </View>
  );
}
