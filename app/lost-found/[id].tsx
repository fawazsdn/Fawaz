import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { formatRelativeTime } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { UserRow } from '@/components/UserRow';

const STATUS_TONE = { lost: 'danger', found: 'info', reunited: 'success' } as const;

export default function LostFoundDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  const item = useStore((s) => s.lostFound.find((l) => l.id === id));
  const author = useStore((s) => s.getUser(item?.authorId ?? ''));
  const markLostFoundStatus = useStore((s) => s.markLostFoundStatus);

  if (!item || !author) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.lostFound.title} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }}>
        <Image source={{ uri: item.image }} style={{ width: '100%', height: 240, borderRadius: theme.radii.lg }} contentFit="cover" />
        <View style={{ marginTop: 14 }}>
          <Badge label={t.lostFound[item.status]} tone={STATUS_TONE[item.status]} />
          <Text style={[theme.text('heading2'), { marginTop: 10 }]}>{item.title}</Text>
          <Text style={[theme.text('body', theme.colors.textSecondary), { marginTop: 8 }]}>{item.description}</Text>
          <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 10 }]}>
            {formatRelativeTime(item.createdAt, locale)}
          </Text>
        </View>

        <View style={{ marginTop: 16 }}>
          <UserRow user={author} onPress={() => router.push(`/profile/${author.id}`)} />
        </View>

        {item.status !== 'reunited' ? (
          <View style={{ marginTop: 20, gap: 10 }}>
            <Button label={t.common.message} onPress={() => router.push(`/profile/${author.id}`)} fullWidth size="lg" />
            <Button label={t.lostFound.reunited} onPress={() => markLostFoundStatus(item.id, 'reunited')} variant="outline" fullWidth />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
