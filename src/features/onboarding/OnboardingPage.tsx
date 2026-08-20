import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { useTheme } from '@/theme/useTheme';
import { Button } from '@/components/Button';

interface OnboardingPageProps {
  icon: LucideIcon;
  iconTone?: string;
  title: string;
  body: string;
  step: number;
  totalSteps: number;
  primaryLabel: string;
  onPrimary: () => void;
  topRight?: React.ReactNode;
  secondaryContent?: React.ReactNode;
}

export function OnboardingPage({
  icon: Icon,
  iconTone,
  title,
  body,
  step,
  totalSteps,
  primaryLabel,
  onPrimary,
  topRight,
  secondaryContent,
}: OnboardingPageProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tone = iconTone ?? theme.colors.primary;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, backgroundColor: theme.colors.background }]}>
      <View style={[theme.row(), styles.topRow]}>
        <View style={[theme.row(), styles.dots]}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  width: i === step ? 22 : 7,
                  backgroundColor: i === step ? theme.colors.primary : theme.colors.border,
                },
              ]}
            />
          ))}
        </View>
        {topRight}
      </View>

      <View style={styles.center}>
        <Animated.View entering={FadeIn.duration(420)} style={[styles.iconWrap, { backgroundColor: tone + '1c', borderRadius: theme.radii.xl }]}>
          <Icon size={56} color={tone} strokeWidth={1.6} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.duration(420).delay(80)} style={[theme.text('heading1'), styles.title]}>
          {title}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.duration(420).delay(150)} style={[theme.text('body', theme.colors.textSecondary), styles.body]}>
          {body}
        </Animated.Text>
        {secondaryContent}
      </View>

      <Button label={primaryLabel} onPress={onPrimary} fullWidth size="lg" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  topRow: { alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  dots: { alignItems: 'center', gap: 6 },
  dot: { height: 7, borderRadius: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  iconWrap: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', maxWidth: 320 },
});
