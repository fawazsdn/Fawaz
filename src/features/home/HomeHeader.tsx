import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, ChevronDown, MessageSquare } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { displayName } from '@/utils/format';
import { Avatar } from '@/components/Avatar';
import { IconButton } from '@/components/IconButton';

export function HomeHeader() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const me = useCurrentUserId();
  const user = useStore((s) => s.getUser(me));
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === s.session.neighborhoodId));
  const unreadNotifications = useStore((s) => s.notifications.filter((n) => !n.read).length);
  const unreadMessages = useStore((s) => s.messages.some((m) => m.senderId !== me && !m.readBy.includes(me)));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t.home.greetingMorning : hour < 18 ? t.home.greetingAfternoon : t.home.greetingEvening;

  const firstName = user?.firstName ?? '';

  return (
    <View style={[theme.row(), styles.wrap, { paddingTop: insets.top + 10, paddingHorizontal: theme.spacing.md }]}>
      <Pressable onPress={() => me && router.push(`/profile/${me}`)} accessibilityRole="button" accessibilityLabel={t.profile.editProfile}>
        <Avatar uri={user?.avatarUrl} name={user ? displayName(user) : '؟'} size={44} />
      </Pressable>

      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>
          {firstName ? `${greeting}${locale === 'ar' ? '،' : ','} ${firstName} 👋` : `${greeting} 👋`}
        </Text>
        <Pressable
          onPress={() => router.push('/(auth)/select-city')}
          accessibilityLabel={t.home.switchNeighborhood}
          style={[theme.row(), { alignItems: 'center', gap: 3, marginTop: 2 }]}
          accessibilityRole="button"
        >
          <Text style={theme.text('title')} numberOfLines={1}>
            {neighborhood ? (locale === 'ar' ? neighborhood.nameAr : neighborhood.nameEn) : ''}
          </Text>
          <ChevronDown size={15} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <View style={[theme.row(), { gap: 8 }]}>
        <View>
          <IconButton accessibilityLabel={t.messages.title} variant="surface" onPress={() => router.push('/messages')}>
            <MessageSquare size={19} color={theme.colors.textPrimary} />
          </IconButton>
          {unreadMessages ? (
            <View style={[styles.dot, { backgroundColor: theme.colors.danger, borderColor: theme.colors.background }]} />
          ) : null}
        </View>
        <View>
          <IconButton accessibilityLabel={t.notifications.title} variant="surface" onPress={() => router.push('/notifications')}>
            <Bell size={19} color={theme.colors.textPrimary} />
          </IconButton>
          {unreadNotifications > 0 ? (
            <View style={[styles.dot, { backgroundColor: theme.colors.danger, borderColor: theme.colors.background }]} />
          ) : null}
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingBottom: 12 },
  dot: { position: 'absolute', top: -1, right: -1, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
});
