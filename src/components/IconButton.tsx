import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { haptics } from '@/utils/haptics';

interface IconButtonProps {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  size?: number;
  variant?: 'plain' | 'surface' | 'filled';
  accessibilityLabel: string;
  disabled?: boolean;
}

export function IconButton({ children, onPress, size = 40, variant = 'plain', accessibilityLabel, disabled }: IconButtonProps) {
  const theme = useTheme();
  const bg = variant === 'surface' ? theme.colors.surface : variant === 'filled' ? theme.colors.primary : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      onPress={(e) => {
        haptics.light();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          borderWidth: variant === 'surface' ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.colors.border,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
