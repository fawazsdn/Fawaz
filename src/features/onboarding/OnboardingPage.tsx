import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useI18n } from '@/i18n/useI18n';
import { useSafeBack } from '@/hooks/useSafeBack';
import { IconButton } from '@/components/IconButton';
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
  const { isRTL, t } = useI18n();
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const goBack = useSafeBack('/onboarding/welcome');
  const insets = useSafeAreaInsets();
  const tone = iconTone ?? theme.colors.primary;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.wrap,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, backgroundColor: theme.colors.background },
      ]}
    >
      <View style={[theme.row(), styles.topRow]}>
        {step > 0 ? (
          <IconButton accessibilityLabel={t.common.back} onPress={goBack} variant="surface">
            <BackIcon size={22} color={theme.colors.textPrimary} />
          </IconButton>
        ) : null}
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
        <Animated.View
          entering={FadeIn.duration(420)}
          style={[styles.iconWrap, { backgroundColor: tone + '1c', borderRadius: theme.radii.xl }]}
        >
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  topRow: { alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  dots: { alignItems: 'center', gap: 6 },
  dot: { height: 7, borderRadius: 4 },
  center: { flexGrow: 1, paddingVertical: 20, alignItems: 'center', justifyContent: 'center', gap: 10 },
  iconWrap: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', maxWidth: 320 },
});
