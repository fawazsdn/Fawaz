import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

import { useTheme } from '@/theme/useTheme';

interface SkeletonBlockProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function SkeletonBlock({ width = '100%', height = 14, radius = 8, style }: SkeletonBlockProps) {
  const theme = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: theme.colors.shimmer }, animatedStyle, style]} />;
}

export function SkeletonPostCard() {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}>
      <View style={[theme.row(), { alignItems: 'center', gap: 10, marginBottom: 12 }]}>
        <SkeletonBlock width={40} height={40} radius={20} />
        <View style={{ gap: 6, flex: 1 }}>
          <SkeletonBlock width="45%" height={12} />
          <SkeletonBlock width="30%" height={10} />
        </View>
      </View>
      <SkeletonBlock width="95%" height={12} style={{ marginBottom: 6 }} />
      <SkeletonBlock width="70%" height={12} style={{ marginBottom: 12 }} />
      <SkeletonBlock width="100%" height={140} radius={12} />
    </View>
  );
}

export function SkeletonCardRow({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonPostCard key={i} />
      ))}
    </View>
  );
}

export function SkeletonListRow() {
  const theme = useTheme();
  return (
    <View style={[theme.row(), { alignItems: 'center', gap: 10, paddingVertical: 10 }]}>
      <SkeletonBlock width={44} height={44} radius={22} />
      <View style={{ gap: 6, flex: 1 }}>
        <SkeletonBlock width="55%" height={12} />
        <SkeletonBlock width="35%" height={10} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderWidth: StyleSheet.hairlineWidth },
});
