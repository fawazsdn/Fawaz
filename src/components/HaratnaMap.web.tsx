import { forwardRef, useImperativeHandle } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import type { HaratnaMapHandle, HaratnaMapProps } from './HaratnaMap';

export type { HaratnaMapHandle, HaratnaMapProps, HaratnaMarker, MapCoordinate } from './HaratnaMap';

/**
 * Web preview only: react-native-maps has no web map. The iPhone app uses
 * the native implementation in HaratnaMap.tsx. Lists the real markers so the
 * web preview stays honest instead of drawing a fake map.
 */
export const HaratnaMap = forwardRef<HaratnaMapHandle, HaratnaMapProps>(function HaratnaMap({ markers, onMarkerPress, style }, ref) {
  const theme = useTheme();
  const { t } = useI18n();
  useImperativeHandle(ref, () => ({ centerOn: () => {} }));
  return (
    <View style={[{ flex: 1, backgroundColor: theme.colors.backgroundAlt, padding: 16, gap: 8 }, style]}>
      <Text style={theme.text('bodySmall', theme.colors.textMuted)}>{t.map.webUnavailable}</Text>
      {markers.map((m) => (
        <Text key={m.id} onPress={() => onMarkerPress?.(m.id)} style={theme.text('bodySmall', theme.colors.primary)}>
          • {m.title}
        </Text>
      ))}
    </View>
  );
});
