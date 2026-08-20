import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Wrench } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { displayName } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';

export default function BorrowScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const neighborhoodId = useStore((s) => s.session.neighborhoodId);
  const items = useStore((s) => s.borrowItems.filter((b) => b.neighborhoodId === neighborhoodId));
  const users = useStore((s) => s.users);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.borrow.title} />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: theme.spacing.md }}
        contentContainerStyle={{ gap: 12, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const owner = users.find((u) => u.id === item.ownerId);
          return (
            <Pressable
              onPress={() => router.push(`/borrow/${item.id}`)}
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
              ]}
            >
              <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" />
              <View style={{ padding: 10 }}>
                <Text style={theme.text('title')} numberOfLines={1}>
                  {item.title}
                </Text>
                <Badge label={item.available ? t.borrow.available : t.borrow.unavailable} tone={item.available ? 'success' : 'neutral'} />
                {owner ? (
                  <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 6 }]}>
                    {t.borrow.owner}: {displayName(owner)}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<EmptyState icon={Wrench} title={t.emptyStates.noResults} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '48%', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  image: { width: '100%', height: 110 },
});
