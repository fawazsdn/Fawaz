import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';

export function SplashView() {
  const theme = useTheme();
  const { t } = useI18n();
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.9);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslate = useSharedValue(8);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    taglineOpacity.value = withDelay(320, withTiming(1, { duration: 420 }));
    taglineTranslate.value = withDelay(320, withTiming(0, { duration: 420 }));
  }, [logoOpacity, logoScale, taglineOpacity, taglineTranslate]);

  const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value, transform: [{ scale: logoScale.value }] }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value, transform: [{ translateY: taglineTranslate.value }] }));

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.background }]}>
      <Animated.View style={logoStyle}>
        <View style={[styles.mark, { backgroundColor: theme.colors.primary, borderRadius: theme.radii.xl }]}>
          <Text style={styles.markText}>ح</Text>
        </View>
      </Animated.View>
      <Animated.View style={logoStyle}>
        <Text style={[theme.text('display'), styles.appName]}>{t.appName}</Text>
      </Animated.View>
      <Animated.View style={taglineStyle}>
        <Text style={[theme.text('body', theme.colors.textSecondary), styles.tagline]}>{t.tagline}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  mark: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  markText: { fontSize: 38, color: '#fff', fontFamily: 'Tajawal_800ExtraBold' },
  appName: { textAlign: 'center' },
  tagline: { textAlign: 'center' },
});
