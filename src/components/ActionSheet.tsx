import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { BottomSheet } from './BottomSheet';

export interface ActionSheetItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  items: ActionSheetItem[];
}

export function ActionSheet({ visible, onClose, title, items }: ActionSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
        {title ? <Text style={[theme.text('caption', theme.colors.textMuted), styles.title]}>{title}</Text> : null}
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => {
              onClose();
              setTimeout(item.onPress, 200);
            }}
            style={({ pressed }) => [theme.row(), styles.row, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
          >
            {item.icon}
            <Text style={theme.text('body', item.destructive ? theme.colors.danger : theme.colors.textPrimary)}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 6, marginBottom: 6 },
  row: { alignItems: 'center', gap: 14, paddingVertical: 14 },
});
