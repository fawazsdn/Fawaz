import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, body, actionLabel, onAction, compact }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={[styles.wrap, { paddingVertical: compact ? theme.spacing.xl : theme.spacing.xxxl }]}>
      {Icon ? (
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.backgroundAlt, borderRadius: theme.radii.pill }]}>
          <Icon size={26} color={theme.colors.textMuted} strokeWidth={1.75} />
        </View>
      ) : null}
      <Text style={[theme.text('title'), styles.title]}>{title}</Text>
      {body ? <Text style={[theme.text('bodySmall', theme.colors.textSecondary), styles.body]}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <Button label={actionLabel} onPress={onAction} variant="outline" size="sm" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 4 },
  iconWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', marginTop: 2 },
});
