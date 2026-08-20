import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { summaryService } from '@/services';
import { Card } from '@/components/Card';
import { SkeletonBlock } from '@/components/Skeleton';

export function DailySummaryCard({ neighborhoodId }: { neighborhoodId: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    summaryService.getSummary(neighborhoodId).then((s) => alive && setSummary(s));
    return () => {
      alive = false;
    };
  }, [neighborhoodId]);

  return (
    <Card style={{ backgroundColor: theme.colors.backgroundAlt, borderWidth: 0 }} elevated={false}>
      <View style={[theme.row(), { alignItems: 'center', gap: 8, marginBottom: 8 }]}>
        <Sparkles size={16} color={theme.colors.primary} />
        <Text style={theme.text('title')}>{t.summary.title}</Text>
      </View>
      {summary ? (
        <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{summary}</Text>
      ) : (
        <View style={{ gap: 6 }}>
          <SkeletonBlock width="100%" height={11} />
          <SkeletonBlock width="70%" height={11} />
        </View>
      )}
    </Card>
  );
}
