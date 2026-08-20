import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import type { LostFoundPost } from '@/models';
import { formatRelativeTime } from '@/utils/format';
import { Badge } from '@/components/Badge';

const STATUS_TONE = { lost: 'danger', found: 'info', reunited: 'success' } as const;

export function LostFoundCard({ item }: { item: LostFoundPost }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/lost-found/${item.id}`)}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}
      accessibilityRole="button"
    >
      <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" />
      <View style={{ flex: 1, padding: 10 }}>
        <Badge label={t.lostFound[item.status]} tone={STATUS_TONE[item.status]} />
        <Text style={[theme.text('bodySmall'), { marginTop: 6 }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={theme.text('caption', theme.colors.textMuted)}>{formatRelativeTime(item.createdAt, locale)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  image: { width: 90, height: 90 },
});
