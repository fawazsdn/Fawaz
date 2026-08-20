import { forwardRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/useTheme';
import { haptics } from '@/utils/haptics';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  fullWidth?: boolean;
  haptic?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Button = forwardRef<View, ButtonProps>(function Button(
  { label, onPress, variant = 'primary', size = 'md', disabled, loading, icon, trailingIcon, fullWidth, haptic = true, testID, accessibilityLabel },
  ref,
) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const paddingV = size === 'sm' ? 9 : size === 'lg' ? 16 : 13;
  const paddingH = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;
  const minHeight = size === 'sm' ? 36 : size === 'lg' ? 54 : 46;

  const bg = {
    primary: theme.colors.primary,
    secondary: theme.colors.secondary,
    outline: 'transparent',
    ghost: 'transparent',
    danger: theme.colors.danger,
  }[variant];

  const textColor = {
    primary: theme.colors.onPrimary,
    secondary: theme.colors.onSecondary,
    outline: theme.colors.primary,
    ghost: theme.colors.primary,
    danger: '#fff',
  }[variant];

  const borderColor = variant === 'outline' ? theme.colors.primary : 'transparent';

  return (
    <AnimatedPressable
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled || !!loading }}
      disabled={disabled || loading}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120 });
      }}
      onPress={(e) => {
        if (haptic) haptics.light();
        onPress?.(e);
      }}
      style={[
        animatedStyle,
        styles.base,
        theme.row(),
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
          minHeight,
          borderRadius: theme.radii.md,
          opacity: disabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[theme.text('button', textColor), { fontSize }, icon || trailingIcon ? styles.withIconGap : undefined]} numberOfLines={1}>
            {label}
          </Text>
          {trailingIcon}
        </>
      )}
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  withIconGap: {
    marginHorizontal: 2,
  },
});
