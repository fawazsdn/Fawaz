import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: React.ReactNode;
}

export function Badge({ label, tone = 'neutral', icon }: BadgeProps) {
  const theme = useTheme();
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    primary: { bg: theme.colors.successSurface, fg: theme.colors.primary },
    success: { bg: theme.colors.successSurface, fg: theme.colors.success },
    warning: { bg: theme.colors.warningSurface, fg: theme.colors.warning },
    danger: { bg: theme.colors.dangerSurface, fg: theme.colors.danger },
    info: { bg: theme.colors.infoSurface, fg: theme.colors.info },
    neutral: { bg: theme.colors.backgroundAlt, fg: theme.colors.textSecondary },
  };
  const { bg, fg } = map[tone];

  return (
    <View style={[styles.wrap, theme.row(), { backgroundColor: bg, borderRadius: theme.radii.pill }]}>
      {icon}
      <Text style={[theme.text('caption', fg)]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 4, paddingHorizontal: 9, alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
});
