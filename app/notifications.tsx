import { useMemo } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, BellRing } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { formatRelativeTime } from '@/utils/format';
import type { AppNotification } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';

export default function NotificationsScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const notifications = useStore((s) => s.notifications.filter((n) => n.userId === CURRENT_USER_ID).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
  const markNotificationRead = useStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useStore((s) => s.markAllNotificationsRead);
  const getUser = useStore((s) => s.getUser);

  const sections = useMemo(() => {
    const now = Date.now();
    const today: AppNotification[] = [];
    const yesterday: AppNotification[] = [];
    const earlier: AppNotification[] = [];
    notifications.forEach((n) => {
      const diffDays = (now - new Date(n.createdAt).getTime()) / 86400000;
      if (diffDays < 1) today.push(n);
      else if (diffDays < 2) yesterday.push(n);
      else earlier.push(n);
    });
    return [
      { title: t.common.today, data: today },
      { title: t.common.yesterday, data: yesterday },
      { title: t.common.earlier, data: earlier },
    ].filter((s) => s.data.length > 0);
  }, [notifications, t]);

  const onPress = (n: AppNotification) => {
    markNotificationRead(n.id);
    router.push(n.deepLink as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t.notifications.title}
        right={
          <Pressable onPress={markAllNotificationsRead} hitSlop={8}>
            <Text style={theme.text('caption', theme.colors.primary)}>{t.notifications.markAllRead}</Text>
          </Pressable>
        }
      />
      <SectionList
        sections={sections}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40 }}
        renderSectionHeader={({ section }) => <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 14, marginBottom: 6 }]}>{section.title}</Text>}
        renderItem={({ item }) => {
          const actor = item.actorId ? getUser(item.actorId) : undefined;
          return (
            <Pressable
              onPress={() => onPress(item)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: item.read ? 0.7 : 1 }}
            >
              {actor ? (
                <Avatar uri={actor.avatarUrl} name={actor.firstName} size={40} />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.backgroundAlt }}>
                  <Bell size={17} color={theme.colors.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={theme.text('bodySmall')} numberOfLines={2}>
                  {item.bodyAr}
                </Text>
                <Text style={theme.text('caption', theme.colors.textMuted)}>{formatRelativeTime(item.createdAt, locale)}</Text>
              </View>
              {!item.read ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: theme.colors.primary }} /> : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={<EmptyState icon={BellRing} title={t.notifications.empty} />}
      />
    </View>
  );
}
