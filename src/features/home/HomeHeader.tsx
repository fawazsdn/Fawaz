import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, ChevronDown, MessageSquare } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { displayName } from '@/utils/format';
import { Avatar } from '@/components/Avatar';
import { IconButton } from '@/components/IconButton';
import { BottomSheet } from '@/components/BottomSheet';

export function HomeHeader() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const user = useStore((s) => s.getUser(CURRENT_USER_ID));
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === s.session.neighborhoodId));
  const cityNeighborhoods = useStore((s) => s.neighborhoods.filter((n) => n.citySlug === s.session.citySlug));
  const selectNeighborhood = useStore((s) => s.selectNeighborhood);
  const unreadNotifications = useStore((s) => s.notifications.filter((n) => n.userId === CURRENT_USER_ID && !n.read).length);
  const unreadMessages = useStore((s) =>
    s.conversations
      .filter((c) => c.participantIds.includes(CURRENT_USER_ID))
      .some((c) =>
        s.messages.some((m) => m.conversationId === c.id && m.senderId !== CURRENT_USER_ID && !m.readBy.includes(CURRENT_USER_ID)),
      ),
  );

  const [switcherOpen, setSwitcherOpen] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t.home.greetingMorning : hour < 18 ? t.home.greetingAfternoon : t.home.greetingEvening;

  if (!user) return null;

  return (
    <View style={[theme.row(), styles.wrap, { paddingTop: insets.top + 10, paddingHorizontal: theme.spacing.md }]}>
      <Pressable onPress={() => router.push(`/profile/${user.id}`)} accessibilityRole="button">
        <Avatar uri={user.avatarUrl} name={displayName(user)} size={44} />
      </Pressable>

      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>
          {greeting}، {user.firstName} 👋
        </Text>
        <Pressable
          onPress={() => setSwitcherOpen(true)}
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

      <BottomSheet visible={switcherOpen} onClose={() => setSwitcherOpen(false)}>
        <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }}>
          <Text style={[theme.text('heading3'), { marginBottom: 12 }]}>{t.home.switchNeighborhood}</Text>
          {cityNeighborhoods.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => {
                selectNeighborhood(n.id);
                setSwitcherOpen(false);
              }}
              style={[
                theme.row(),
                styles.neighborhoodRow,
                { borderColor: n.id === neighborhood?.id ? theme.colors.primary : theme.colors.border, borderRadius: theme.radii.md },
              ]}
              accessibilityRole="button"
            >
              <Text style={theme.text('body')}>{locale === 'ar' ? n.nameAr : n.nameEn}</Text>
              <Text style={theme.text('caption', theme.colors.textMuted)}>{n.residentsCount.toLocaleString()}</Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingBottom: 12 },
  dot: { position: 'absolute', top: -1, right: -1, width: 11, height: 11, borderRadius: 6, borderWidth: 2 },
  neighborhoodRow: { justifyContent: 'space-between', alignItems: 'center', padding: 14, borderWidth: 1.5, marginBottom: 8 },
});
