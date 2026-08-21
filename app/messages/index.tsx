import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { MessagesSquare } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { AppHeader } from '@/components/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { FilterBar } from '@/components/FilterBar';
import { EmptyState } from '@/components/EmptyState';
import { ConversationRow } from '@/features/messaging/ConversationRow';

export default function MessagesScreen() {
  const theme = useTheme();
  const { t } = useI18n();

  // Raw state + useMemo, not filter()/sort() inside the selector — see
  // src/features/home/HomeHeader.tsx for why.
  const allConversations = useStore((s) => s.conversations);
  const conversations = useMemo(
    () =>
      allConversations
        .filter((c) => c.participantIds.includes(CURRENT_USER_ID))
        .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)),
    [allConversations],
  );
  const users = useStore((s) => s.users);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'neighbors' | 'groups' | 'events'>('all');

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === 'neighbors') list = list.filter((c) => !c.isGroup);
    if (filter === 'groups') list = list.filter((c) => c.isGroup && !c.eventId);
    if (filter === 'events') list = list.filter((c) => c.isGroup && !!c.eventId);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => {
        if (c.isGroup) return c.title?.toLowerCase().includes(q);
        const other = users.find((u) => c.participantIds.includes(u.id) && u.id !== CURRENT_USER_ID);
        return other ? `${other.firstName} ${other.lastName}`.toLowerCase().includes(q) : false;
      });
    }
    return list;
  }, [conversations, filter, query, users]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.messages.title} showBack={false} />
      <View style={{ paddingHorizontal: theme.spacing.md, marginBottom: 10 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t.messages.searchPlaceholder} />
      </View>
      <View style={{ marginBottom: 6 }}>
        <FilterBar
          options={[
            { key: 'all', label: t.messages.filters.all },
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
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingBottom: 40 }}
        renderItem={({ item }) => <ConversationRow conversation={item} />}
        ListEmptyComponent={<EmptyState icon={MessagesSquare} title={t.messages.empty} />}
      />
    </View>
  );
}
