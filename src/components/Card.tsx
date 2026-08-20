import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { useTheme } from '@/theme/useTheme';

interface CardProps {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  style?: object;
  padded?: boolean;
  elevated?: boolean;
  accessibilityLabel?: string;
}

export function Card({ children, onPress, style, padded = true, elevated = true, accessibilityLabel }: CardProps) {
  const theme = useTheme();
  const base = [
    styles.base,
    {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      padding: padded ? theme.spacing.md : 0,
    },
    elevated && theme.shadows.card,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [...base, { opacity: pressed ? 0.92 : 1 }]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
