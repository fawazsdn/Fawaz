import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { MessagesSquare } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { requestSync } from '@/backend/sync';
import { normalizeForSearch } from '@/utils/searchNormalize';
import { SyncNotice } from '@/components/VerifyGate';
import { AppHeader } from '@/components/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { FilterBar } from '@/components/FilterBar';
import { EmptyState } from '@/components/EmptyState';
import { ConversationRow } from '@/features/messaging/ConversationRow';

export default function MessagesScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const me = useCurrentUserId();
  const allMessages = useStore((s) => s.messages);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await requestSync();
    setRefreshing(false);
  }, []);

  // Raw state + useMemo, not filter()/sort() inside the selector — see
  // src/features/home/HomeHeader.tsx for why.
  const allConversations = useStore((s) => s.conversations);
  const conversations = useMemo(
    () =>
      allConversations
        .filter((c) => c.participantIds.includes(me))
        .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)),
    [allConversations, me],
  );
  const users = useStore((s) => s.users);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'neighbors' | 'groups' | 'events'>('all');
  const unreadIds = useMemo(
    () => new Set(allMessages.filter((m) => m.senderId !== me && !m.readBy.includes(me)).map((m) => m.conversationId)),
    [allMessages, me],
  );

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === 'unread') list = list.filter((c) => unreadIds.has(c.id));
    if (filter === 'neighbors') list = list.filter((c) => !c.isGroup);
    if (filter === 'groups') list = list.filter((c) => c.isGroup && !c.eventId);
    if (filter === 'events') list = list.filter((c) => c.isGroup && !!c.eventId);
    const q = normalizeForSearch(query);
    if (q) {
      list = list.filter((c) => {
        const lastText = allMessages.filter((m) => m.conversationId === c.id).map((m) => m.text ?? '').join(' ');
        if (c.isGroup) return normalizeForSearch(`${c.title ?? ''} ${lastText}`).includes(q);
        const other = users.find((u) => c.participantIds.includes(u.id) && u.id !== me);
        return normalizeForSearch(`${other ? `${other.firstName} ${other.lastName}` : ''} ${lastText}`).includes(q);
      });
    }
    return list;
  }, [conversations, filter, query, users, unreadIds, allMessages, me]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Inbox is pushed from the tab bar; the header's back control falls back to Home when there's no history. */}
      <AppHeader title={t.messages.title} fallbackRoute="/(tabs)" />
      <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 10 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t.messages.searchPlaceholder} />
      </View>
      <View style={{ marginBottom: 6 }}>
        <FilterBar
          options={[
            { key: 'all', label: t.messages.filters.all },
            { key: 'unread', label: t.messages.unreadFilter },
            { key: 'neighbors', label: t.messages.filters.neighbors },
            { key: 'groups', label: t.messages.filters.groups },
            { key: 'events', label: t.messages.filters.events },
          ]}
          selected={filter}
          onSelect={(k) => setFilter(k as typeof filter)}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingBottom: 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        keyboardDismissMode="on-drag"
        renderItem={({ item }) => <ConversationRow conversation={item} />}
        ListHeaderComponent={<SyncNotice />}
        ListEmptyComponent={<EmptyState icon={MessagesSquare} title={query || filter !== 'all' ? t.messages.noResults : t.messages.empty} />}
      />
    </View>
  );
}
