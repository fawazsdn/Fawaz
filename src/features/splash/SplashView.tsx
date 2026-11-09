import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';

import { useI18n } from '@/i18n/useI18n';

/** Same dark Haratna Forest as the native splash (app.json), so the hand-off is seamless. */
export const SPLASH_BACKGROUND = '#0D4939';
const SPLASH_LOGO = require('../../../assets/haratna-n2.png');

export function SplashView() {
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
    <View style={styles.wrap} testID="splash">
      <Animated.View style={logoStyle}>
        <Image
          source={SPLASH_LOGO}
          style={styles.logo}
          contentFit="cover"
          accessibilityRole="image"
          accessibilityLabel={t.appName}
          testID="splash-logo"
        />
      </Animated.View>
      <Animated.View style={logoStyle}>
        <Text style={styles.appName}>{t.appName}</Text>
      </Animated.View>
      <Animated.View style={taglineStyle}>
        <Text style={styles.tagline}>{t.tagline}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: SPLASH_BACKGROUND },
  // iOS app-icon corner ratio (22.37%), matching the Home Screen icon.
  logo: { width: 140, height: 140, borderRadius: 31, marginBottom: 6 },
  appName: { textAlign: 'center', color: '#FAF6EF', fontSize: 34, lineHeight: 44, fontFamily: 'Tajawal_800ExtraBold' },
  tagline: { textAlign: 'center', color: '#D9CFA8', fontSize: 16, lineHeight: 24, fontFamily: 'Tajawal_500Medium' },
});
