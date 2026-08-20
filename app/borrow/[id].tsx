import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { UserRow } from '@/components/UserRow';

export default function BorrowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const item = useStore((s) => s.borrowItems.find((b) => b.id === id));
  const owner = useStore((s) => s.getUser(item?.ownerId ?? ''));
  const requestBorrow = useStore((s) => s.requestBorrow);

  if (!item || !owner) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  const requested = item.requests.some((r) => r.userId === CURRENT_USER_ID);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={item.title} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }}>
        <Image source={{ uri: item.image }} style={{ width: '100%', height: 220, borderRadius: theme.radii.lg }} contentFit="cover" />
        <View style={{ marginTop: 14 }}>
          <Badge label={item.available ? t.borrow.available : t.borrow.unavailable} tone={item.available ? 'success' : 'neutral'} />
          <Text style={[theme.text('heading2'), { marginTop: 10 }]}>{item.title}</Text>
          <Text style={[theme.text('body', theme.colors.textSecondary), { marginTop: 8 }]}>{item.description}</Text>
        </View>
        <View style={{ marginTop: 16 }}>
          <UserRow user={owner} subtitle={t.borrow.owner} onPress={() => router.push(`/profile/${owner.id}`)} />
        </View>
        {item.ownerId !== CURRENT_USER_ID ? (
          <View style={{ marginTop: 16 }}>
            <Button
              label={requested ? t.borrow.requested : t.borrow.requestToBorrow}
              onPress={() => requestBorrow(item.id)}
              disabled={requested || !item.available}
              fullWidth
              size="lg"
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
