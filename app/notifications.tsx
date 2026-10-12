import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, BellRing } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { formatRelativeTime, isSameSaudiDay } from '@/utils/format';
import { markAllNotificationsRead, markNotificationRead } from '@/backend/actions';
import { requestSync } from '@/backend/sync';
import { SyncNotice } from '@/components/VerifyGate';
import type { AppNotification } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';

export default function NotificationsScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  // Raw state + useMemo, not filter()/sort() inside the selector — see
  // src/features/home/HomeHeader.tsx for why.
  const allNotifications = useStore((s) => s.notifications);
  const notifications = useMemo(
    () =>
      // Notifications are already scoped to the signed-in user by RLS.
      [...allNotifications].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [allNotifications],
  );
  const getUser = useStore((s) => s.getUser);
  const hasUnread = notifications.some((n) => !n.read);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await requestSync();
    setRefreshing(false);
  }, []);

  const sections = useMemo(() => {
    const now = new Date();
    const yday = new Date(now.getTime() - 86400000);
    const today: AppNotification[] = [];
    const yesterday: AppNotification[] = [];
    const earlier: AppNotification[] = [];
    notifications.forEach((n) => {
      if (isSameSaudiDay(n.createdAt, now)) today.push(n);
      else if (isSameSaudiDay(n.createdAt, yday)) yesterday.push(n);
      else earlier.push(n);
    });
    return [
      { title: t.common.today, data: today },
      { title: t.common.yesterday, data: yesterday },
      { title: t.common.earlier, data: earlier },
    ].filter((s) => s.data.length > 0);
  }, [notifications, t]);

  const onPress = (n: AppNotification) => {
    if (!n.read) void markNotificationRead(n.id).catch(() => {});
    if (n.deepLink?.startsWith('/')) router.push(n.deepLink as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={t.notifications.title}
        fallbackRoute="/"
        right={
          hasUnread ? (
            <Pressable onPress={() => void markAllNotificationsRead().catch(() => {})} hitSlop={8} accessibilityRole="button">
              <Text style={theme.text('caption', theme.colors.primary)}>{t.notifications.markAllRead}</Text>
            </Pressable>
          ) : undefined
        }
      />
      <SectionList
        sections={sections}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListHeaderComponent={<SyncNotice />}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 14, marginBottom: 6 }]}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const actor = item.actorId ? getUser(item.actorId) : undefined;
          return (
            <Pressable
              onPress={() => onPress(item)}
              style={[theme.row(), { alignItems: 'center', gap: 12, paddingVertical: 10, opacity: item.read ? 0.7 : 1 }]}
              accessibilityRole="button"
            >
              {actor ? (
                <Avatar uri={actor.avatarUrl} name={actor.firstName} size={40} />
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.backgroundAlt,
                  }}
                >
                  <Bell size={17} color={theme.colors.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={theme.text('title')} numberOfLines={1}>
                  {locale === 'en' ? (item.titleEn ?? item.titleAr) : item.titleAr}
                </Text>
                <Text style={theme.text('bodySmall', theme.colors.textSecondary)} numberOfLines={2}>
                  {locale === 'en' ? (item.bodyEn ?? item.bodyAr) : item.bodyAr}
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
