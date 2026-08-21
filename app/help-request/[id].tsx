import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { displayName, formatDistance, formatRelativeTime } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { messageService } from '@/services';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { UserRow } from '@/components/UserRow';
import { EmptyState } from '@/components/EmptyState';
import { ConfirmationModal } from '@/components/ConfirmationModal';

export default function HelpRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  const request = useStore((s) => s.helpRequests.find((h) => h.id === id));
  const requester = useStore((s) => s.getUser(request?.requesterId ?? ''));
  const offerHelp = useStore((s) => s.offerHelp);
  const users = useStore((s) => s.users);

  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!request || !requester) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" fallbackRoute="/(tabs)/discover" />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  const offered = request.offeredBy.includes(CURRENT_USER_ID);
  const isOwn = request.requesterId === CURRENT_USER_ID;

  const onOffer = () => {
    haptics.medium();
    offerHelp(request.id);
    setConfirmOpen(true);
  };

  const messageRequester = async () => {
    const convo = await messageService.getOrCreateConversation(requester.id);
    router.push(`/messages/${convo.id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.help.categories[request.category]} fallbackRoute="/(tabs)/discover" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }}>
        <Badge label={t.help.categories[request.category]} tone="info" />
        <Text style={[theme.text('heading2'), { marginTop: 10 }]}>{request.title}</Text>
        <Text style={[theme.text('body', theme.colors.textSecondary), { marginTop: 8 }]}>{request.description}</Text>

        <View style={{ marginTop: 12, gap: 4 }}>
          <Text style={theme.text('caption', theme.colors.textMuted)}>{formatRelativeTime(request.createdAt, locale)}</Text>
          <View style={[theme.row(), { alignItems: 'center', gap: 4 }]}>
            <MapPin size={12} color={theme.colors.textMuted} />
            <Text style={theme.text('caption', theme.colors.textMuted)}>{formatDistance(request.approxDistanceM, locale)}</Text>
          </View>
        </View>

        <Card style={{ marginTop: 16 }}>
          <UserRow user={requester} onPress={() => router.push(`/profile/${requester.id}`)} />
        </Card>

        {!isOwn ? (
          <View style={{ marginTop: 16, gap: 10 }}>
            <Button label={offered ? t.help.offered : t.help.iCanHelp} onPress={onOffer} disabled={offered} fullWidth size="lg" />
            <Button label={t.common.message} onPress={messageRequester} variant="outline" fullWidth />
          </View>
        ) : null}

        {request.offeredBy.length > 0 ? (
          <View style={{ marginTop: 20 }}>
            <Text style={[theme.text('title'), { marginBottom: 8 }]}>{t.help.offered}</Text>
            {request.offeredBy.map((uid) => {
              const u = users.find((x) => x.id === uid);
              return u ? <UserRow key={uid} user={u} onPress={() => router.push(`/profile/${u.id}`)} /> : null;
            })}
          </View>
        ) : null}
      </ScrollView>

      <ConfirmationModal
        visible={confirmOpen}
        title={`${displayName(useStore.getState().currentUser())} ${t.help.offerConfirmed}`}
        confirmLabel={t.common.ok}
        cancelLabel={t.common.message}
        onCancel={messageRequester}
        onConfirm={() => setConfirmOpen(false)}
      />
    </View>
  );
}
