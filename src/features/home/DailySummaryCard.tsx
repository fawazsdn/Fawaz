import { Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { Card } from '@/components/Card';
import { isSameSaudiDay, localizeDigits } from '@/utils/format';
import { useNeighborhoodActivity } from './useNeighborhoodActivity';

/**
 * A plain-language digest of what's actually in the neighborhood today —
 * built only from loaded Supabase records, in the UI language. It never
 * claims activity that isn't there.
 */
export function DailySummaryCard({ neighborhoodId }: { neighborhoodId: string }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const { events, issues, helpRequests } = useNeighborhoodActivity(neighborhoodId);
  const syncStatus = useStore((s) => s.sync.status);

  const today = events.filter((e) => !e.cancelled && isSameSaudiDay(e.startsAt, new Date()));
  const n = (v: number) => localizeDigits(v, locale);

  let text: string;
  if (syncStatus === 'loading' && events.length + issues.length + helpRequests.length === 0) {
    text = t.common.loading;
  } else if (today.length === 0 && issues.length === 0 && helpRequests.length === 0) {
    text = t.summary.quiet;
  } else if (locale === 'ar') {
    const parts: string[] = [];
    if (today.length) parts.push(today.length === 1 ? 'فيه نشاط واحد اليوم' : `فيه ${n(today.length)} أنشطة اليوم`);
    if (issues.length) parts.push(`${n(issues.length)} بلاغ مفتوح`);
    if (helpRequests.length) parts.push(`${n(helpRequests.length)} طلب مساعدة من الجيران`);
    text = parts.join('، ') + '.';
  } else {
    const parts: string[] = [];
    if (today.length) parts.push(`${today.length} ${today.length === 1 ? 'activity' : 'activities'} today`);
    if (issues.length) parts.push(`${issues.length} open ${issues.length === 1 ? 'report' : 'reports'}`);
    if (helpRequests.length) parts.push(`${helpRequests.length} help ${helpRequests.length === 1 ? 'request' : 'requests'} from neighbors`);
    text = parts.join(', ') + '.';
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return (
    <Card style={{ backgroundColor: theme.colors.backgroundAlt, borderWidth: 0 }} elevated={false}>
      <View style={[theme.row(), { alignItems: 'center', gap: 8, marginBottom: 8 }]}>
        <Sparkles size={16} color={theme.colors.primary} />
        <Text style={theme.text('title')}>{t.summary.title}</Text>
      </View>
      <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{text}</Text>
    </Card>
  );
}
