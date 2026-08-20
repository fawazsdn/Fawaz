import { FlatList, View } from 'react-native';
import { UserX } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { AppHeader } from '@/components/AppHeader';
import { UserRow } from '@/components/UserRow';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';

export default function BlockedUsersScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const blockedUserIds = useStore((s) => s.blockedUserIds);
  const users = useStore((s) => s.users);
  const toggleBlockUser = useStore((s) => s.toggleBlockUser);

  const blocked = users.filter((u) => blockedUserIds.includes(u.id));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.settings.blockedUsers} />
      <FlatList
        data={blocked}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: theme.spacing.md }}
        renderItem={({ item }) => (
          <UserRow
            user={item}
            right={<Button label={t.common.unblock} size="sm" variant="outline" onPress={() => toggleBlockUser(item.id)} />}
          />
        )}
        ListEmptyComponent={<EmptyState icon={UserX} title={t.emptyStates.noResults} />}
      />
    </View>
  );
}
