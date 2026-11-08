import { Text } from 'react-native';

import type { NeighborhoodChangeRequest } from '@/backend/actions';
import { useI18n } from '@/i18n/useI18n';
import { useTheme } from '@/theme/useTheme';
import { Badge } from './Badge';

export function NeighborhoodChangeDetails({ request }: { request: NeighborhoodChangeRequest }) {
  const { t, locale } = useI18n();
  const theme = useTheme();
  const nameKey = locale === 'ar' ? 'name_ar' : 'name_en';
  return (
    <>
      <Text style={theme.text('body')}>
        {request.source?.[nameKey] ?? request.from_neighborhood_id} → {request.destination?.[nameKey] ?? request.to_neighborhood_id}
      </Text>
      <Badge label={t.neighborhoodChange[request.status]} tone={request.status === 'pending' ? 'warning' : 'neutral'} />
      <Text style={theme.text('bodySmall')}>{request.reason}</Text>
      {request.review_note ? <Text style={theme.text('bodySmall')}>{request.review_note}</Text> : null}
    </>
  );
}
