import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bookmark, Flag, Share2 } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore, useCurrentUserId } from '@/store/useStore';
import { useAction } from '@/hooks/useAction';
import { getOrCreateDirectConversation, setListingStatus, toggleSaveListing } from '@/backend/actions';
import { formatRelativeTime, formatSAR } from '@/utils/format';
import { shareContent } from '@/utils/share';
import { links } from '@/config/links';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ImageGallery } from '@/components/ImageGallery';
import { UserRow } from '@/components/UserRow';
import { IconButton } from '@/components/IconButton';
import { ReportSheet } from '@/components/ReportSheet';

export default function MarketplaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();

  const listing = useStore((s) => s.marketplaceListings.find((m) => m.id === id));
  const seller = useStore((s) => s.getUser(listing?.sellerId ?? ''));
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === listing?.neighborhoodId));
  const me = useCurrentUserId();
  const { run } = useAction();
  const [reportOpen, setReportOpen] = useState(false);

  if (!listing) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" fallbackRoute="/marketplace" />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  const saved = listing.savedBy.includes(me);
  const priceLabel =
    listing.listingType === 'sale'
      ? formatSAR(listing.price ?? 0, locale)
      : listing.listingType === 'free'
        ? t.marketplace.free
        : t.marketplace.wanted;

  const messageSeller = async () => {
    const res = await run(() => getOrCreateDirectConversation(listing.sellerId, { type: 'listing', id: listing.id }));
    if (!res.ok) return;
    const convo = { id: res.value };
    router.push(`/messages/${convo.id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title=""
        fallbackRoute="/marketplace"
        right={
          <View style={{ ...theme.row(), gap: 6 }}>
            <IconButton accessibilityLabel={t.common.save} onPress={() => run(() => toggleSaveListing(listing.id))}>
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
            {listing.sellerId !== me ? (
              <IconButton accessibilityLabel={t.common.report} onPress={() => setReportOpen(true)}>
                <Flag size={18} color={theme.colors.textPrimary} />
              </IconButton>
            ) : null}
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md }}>
        {listing.images.length > 0 ? <ImageGallery images={listing.images} maxHeight={260} /> : null}

        <Text style={[theme.text('heading1'), { marginTop: 14 }]}>{priceLabel}</Text>
        <Text style={[theme.text('title'), { marginTop: 4 }]}>{listing.title}</Text>

        <View style={[theme.row(), { gap: 8, marginTop: 10 }]}>
          <Badge label={t.marketplace.condition[listing.condition]} tone="neutral" />
          <Badge label={listing.category} tone="neutral" />
        </View>

        <Text style={[theme.text('body', theme.colors.textSecondary), { marginTop: 14 }]}>{listing.description}</Text>

        <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 12 }]}>
          {t.marketplace.posted} {formatRelativeTime(listing.createdAt, locale)} ·{' '}
          {locale === 'ar' ? neighborhood?.nameAr : neighborhood?.nameEn}
        </Text>

        {seller ? (
          <View style={{ marginTop: 16 }}>
            <UserRow user={seller} onPress={() => router.push(`/profile/${seller.id}`)} />
          </View>
        ) : null}

        {listing.sellerId !== me ? (
          <View style={{ marginTop: 16 }}>
            <Button label={t.marketplace.messageSeller} onPress={messageSeller} fullWidth size="lg" />
          </View>
        ) : (
          <View style={[theme.row(), { marginTop: 16, gap: 8, flexWrap: 'wrap' }]}>
            {listing.status !== 'sold' ? (
              <Button
                label={t.marketplace.markSold}
                onPress={() => run(() => setListingStatus(listing.id, 'sold'))}
                variant="outline"
                size="sm"
              />
            ) : null}
            {listing.status === 'available' ? (
              <Button
                label={t.marketplace.markReserved}
                onPress={() => run(() => setListingStatus(listing.id, 'reserved'))}
                variant="ghost"
                size="sm"
              />
            ) : null}
            {listing.status !== 'available' ? (
              <Button
                label={t.marketplace.markAvailable}
                onPress={() => run(() => setListingStatus(listing.id, 'available'))}
                variant="ghost"
                size="sm"
              />
            ) : null}
          </View>
        )}
      </ScrollView>
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} targetType="listing" targetId={listing.id} />
    </View>
  );
}
