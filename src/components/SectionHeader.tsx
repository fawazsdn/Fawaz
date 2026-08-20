import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
}

export function SectionHeader({ title, subtitle, onSeeAll }: SectionHeaderProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={[styles.wrap, theme.row(), { paddingHorizontal: theme.spacing.md }]}>
      <View style={{ flex: 1 }}>
        <Text style={theme.text('heading3')}>{title}</Text>
        {subtitle ? <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{subtitle}</Text> : null}
      </View>
      {onSeeAll ? (
        <Pressable accessibilityRole="button" onPress={onSeeAll} hitSlop={8}>
          <Text style={theme.text('bodySmall', theme.colors.primary)}>{t.common.seeAll}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
});
