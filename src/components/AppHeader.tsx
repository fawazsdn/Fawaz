import { StyleSheet, Text, View } from 'react-native';
import type { Href } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useSafeBack } from '@/hooks/useSafeBack';
import { IconButton } from './IconButton';

interface AppHeaderProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  /**
   * Where to land if there's no navigation history to go back to (a
   * direct URL open, a web refresh, or a deep link straight into this
   * screen) — see `useSafeBack`. Pick the nearest logical parent screen,
   * not a blanket default; only omit this for screens where `/` really
   * is the right place to land in that situation.
   */
  fallbackRoute?: Href;
  right?: React.ReactNode;
  transparent?: boolean;
}

export function AppHeader({ title, onBack, showBack = true, fallbackRoute = '/', right, transparent }: AppHeaderProps) {
  const theme = useTheme();
  const { t, isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const safeBack = useSafeBack(fallbackRoute);

  return (
    <View
      style={[
        styles.wrap,
        theme.row(),
        {
          paddingTop: insets.top + 8,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: transparent ? 'transparent' : theme.colors.background,
          borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.divider,
        },
      ]}
    >
      <View style={styles.side}>
        {showBack ? (
          <IconButton accessibilityLabel={t.common.back} onPress={onBack ?? safeBack} variant="surface">
            <BackIcon size={20} color={theme.colors.textPrimary} />
          </IconButton>
        ) : null}
      </View>
      <Text style={[theme.text('title'), styles.title]} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingBottom: 10 },
  side: { width: 44 },
  title: { flex: 1, textAlign: 'center' },
});
