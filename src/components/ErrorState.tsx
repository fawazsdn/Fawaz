import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, WifiOff } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  body?: string;
  offline?: boolean;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({ title, body, offline, onRetry, compact }: ErrorStateProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const Icon = offline ? WifiOff : AlertTriangle;
  const resolvedTitle = title ?? (offline ? t.errors.offlineTitle : t.errors.genericTitle);
  const resolvedBody = body ?? (offline ? t.errors.offlineBody : t.errors.genericBody);

  return (
    <View style={[styles.wrap, { paddingVertical: compact ? theme.spacing.xl : theme.spacing.xxxl }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.dangerSurface, borderRadius: theme.radii.pill }]}>
        <Icon size={26} color={theme.colors.danger} strokeWidth={1.75} />
      </View>
      <Text style={[theme.text('title'), styles.center]}>{resolvedTitle}</Text>
      <Text style={[theme.text('bodySmall', theme.colors.textSecondary), styles.center]}>{resolvedBody}</Text>
      {onRetry ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <Button label={t.common.tryAgain} onPress={onRetry} variant="primary" size="sm" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 4 },
  iconWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  center: { textAlign: 'center' },
});
