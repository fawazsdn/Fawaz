import { StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { IconButton } from './IconButton';

interface AppHeaderProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: React.ReactNode;
  transparent?: boolean;
}

export function AppHeader({ title, onBack, showBack = true, right, transparent }: AppHeaderProps) {
  const theme = useTheme();
  const { isRTL } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

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
          <IconButton accessibilityLabel="back" onPress={onBack ?? (() => router.back())} variant="surface">
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
