import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bookmark, Share2 } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { formatDistance, formatRelativeTime, formatSAR } from '@/utils/format';
import { shareContent } from '@/utils/share';
import { links } from '@/config/links';
import { messageService } from '@/services';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ImageGallery } from '@/components/ImageGallery';
import { UserRow } from '@/components/UserRow';
import { IconButton } from '@/components/IconButton';

export default function MarketplaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  const listing = useStore((s) => s.marketplaceListings.find((m) => m.id === id));
  const seller = useStore((s) => s.getUser(listing?.sellerId ?? ''));
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === listing?.neighborhoodId));
  const toggleSaveListing = useStore((s) => s.toggleSaveListing);

  if (!listing || !seller) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  const saved = listing.savedBy.includes(CURRENT_USER_ID);
  const priceLabel =
    listing.listingType === 'sale'
      ? formatSAR(listing.price ?? 0, locale)
      : listing.listingType === 'free'
        ? t.marketplace.free
        : t.marketplace.wanted;

  const messageSeller = async () => {
    const convo = await messageService.getOrCreateConversation(seller.id);
    router.push(`/messages/${convo.id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title=""
        right={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <IconButton accessibilityLabel={t.common.save} onPress={() => toggleSaveListing(listing.id)}>
              <Bookmark
                size={19}
                color={saved ? theme.colors.primary : theme.colors.textPrimary}
                fill={saved ? theme.colors.primary : 'transparent'}
              />
            </IconButton>
            <IconButton
              accessibilityLabel={t.common.share}
              onPress={() => shareContent({ title: listing.title, message: listing.title, url: links.marketplaceListing(listing.id) })}
            >
              <Share2 size={19} color={theme.colors.textPrimary} />
            </IconButton>
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }}>
        {listing.images.length > 0 ? <ImageGallery images={listing.images} maxHeight={260} /> : null}

        <Text style={[theme.text('heading1'), { marginTop: 14 }]}>{priceLabel}</Text>
        <Text style={[theme.text('title'), { marginTop: 4 }]}>{listing.title}</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Badge label={t.marketplace.condition[listing.condition]} tone="neutral" />
          <Badge label={listing.category} tone="neutral" />
        </View>

        <Text style={[theme.text('body', theme.colors.textSecondary), { marginTop: 14 }]}>{listing.description}</Text>

        <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 12 }]}>
          {t.marketplace.posted} {formatRelativeTime(listing.createdAt, locale)} ·{' '}
          {locale === 'ar' ? neighborhood?.nameAr : neighborhood?.nameEn} · {formatDistance(listing.approxDistanceM, locale)}
        </Text>

        <View style={{ marginTop: 16 }}>
          <UserRow user={seller} onPress={() => router.push(`/profile/${seller.id}`)} />
        </View>

        {listing.sellerId !== CURRENT_USER_ID ? (
          <View style={{ marginTop: 16 }}>
            <Button label={t.marketplace.messageSeller} onPress={messageSeller} fullWidth size="lg" />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
