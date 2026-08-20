import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import type { User } from '@/models';
import { displayName } from '@/utils/format';
import { Avatar } from './Avatar';

interface UserRowProps {
  user: User;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}

export function UserRow({ user, subtitle, onPress, right }: UserRowProps) {
  const theme = useTheme();
  const name = displayName(user);

  const content = (
    <View style={[theme.row(), styles.wrap, { gap: 12 }]}>
      <Avatar uri={user.avatarUrl} name={name} size={44} />
      <View style={{ flex: 1 }}>
        <View style={[theme.row(), { alignItems: 'center', gap: 4 }]}>
          <Text style={theme.text('title')} numberOfLines={1}>
            {name}
          </Text>
          {user.verification === 'verified' ? <BadgeCheck size={15} color={theme.colors.primary} /> : null}
        </View>
        {subtitle ? (
          <Text style={theme.text('bodySmall', theme.colors.textSecondary)} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 8 },
});
