import { ScrollView, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { Chip } from './Chip';

interface FilterOption {
  key: string;
  label: string;
}

interface FilterBarProps {
  options: FilterOption[];
  selected: string;
  onSelect: (key: string) => void;
}

export function FilterBar({ options, selected, onSelect }: FilterBarProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.content, theme.row(), { paddingHorizontal: theme.spacing.md }]}
    >
      {options.map((opt) => (
        <Chip
          key={opt.key}
          label={opt.label}
          selected={opt.key === selected}
          onPress={() => onSelect(opt.key)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8, paddingVertical: 4 },
});
