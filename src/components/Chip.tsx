import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { haptics } from '@/utils/haptics';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
}

export function Chip({ label, selected, onPress, icon }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        theme.row(),
        {
          backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radii.pill,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon}
      <Text style={theme.text('bodySmall', selected ? theme.colors.onPrimary : theme.colors.textSecondary)} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 8, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', gap: 6 },
});
