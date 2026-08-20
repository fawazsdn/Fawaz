import { StyleSheet, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { IconButton } from './IconButton';

interface SearchBarProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({ value, onChangeText, placeholder, onSubmit, autoFocus }: SearchBarProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        theme.row(),
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md },
      ]}
    >
      <Search size={18} color={theme.colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, theme.text('body')]}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        accessibilityLabel={placeholder}
      />
      {value.length > 0 ? (
        <IconButton accessibilityLabel="clear" size={28} onPress={() => onChangeText('')}>
          <X size={16} color={theme.colors.textMuted} />
        </IconButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 46, borderWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, paddingVertical: 0 },
});
