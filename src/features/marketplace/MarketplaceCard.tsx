import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Bookmark } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import type { MarketplaceListing } from '@/models';
import { formatDistance, formatSAR } from '@/utils/format';
import { Badge } from '@/components/Badge';

export function MarketplaceCard({ listing }: { listing: MarketplaceListing }) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const toggleSaveListing = useStore((s) => s.toggleSaveListing);
  const saved = listing.savedBy.includes(CURRENT_USER_ID);

  const priceLabel =
    listing.listingType === 'sale'
      ? formatSAR(listing.price ?? 0, locale)
      : listing.listingType === 'free'
        ? t.marketplace.free
        : t.marketplace.wanted;

  return (
    <Pressable
      onPress={() => router.push(`/marketplace/${listing.id}`)}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}
      accessibilityRole="button"
    >
      <View>
        {listing.images[0] ? (
          <Image source={{ uri: listing.images[0] }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, { backgroundColor: theme.colors.backgroundAlt }]} />
        )}
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            toggleSaveListing(listing.id);
          }}
          style={[styles.saveBtn, { backgroundColor: theme.colors.overlay }]}
        >
          <Bookmark size={14} color="#fff" fill={saved ? '#fff' : 'transparent'} />
        </Pressable>
        {listing.status !== 'available' ? (
          <View style={[StyleSheet.absoluteFill, styles.statusOverlay, { backgroundColor: theme.colors.overlay }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{listing.status === 'sold' ? '✓' : '⏳'}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 10 }}>
        <Text style={theme.text('title')} numberOfLines={1}>
          {priceLabel}
        </Text>
        <Text style={theme.text('bodySmall', theme.colors.textSecondary)} numberOfLines={1}>
          {listing.title}
        </Text>
        <View style={[theme.row(), { justifyContent: 'space-between', marginTop: 6, alignItems: 'center' }]}>
          <Text style={theme.text('caption', theme.colors.textMuted)}>{formatDistance(listing.approxDistanceM, locale)}</Text>
          <Badge label={t.marketplace.condition[listing.condition]} tone="neutral" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '48%', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  image: { width: '100%', height: 120 },
  saveBtn: {
    position: 'absolute',
    top: 6,
    end: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOverlay: { alignItems: 'center', justifyContent: 'center' },
});
