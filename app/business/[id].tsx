import { useMemo, useState } from 'react';
import { Linking, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BadgeCheck, Clock, Phone, Share2 } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { displayName, formatRelativeTime } from '@/utils/format';
import { shareContent } from '@/utils/share';
import { links } from '@/config/links';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { BottomSheet } from '@/components/BottomSheet';
import { useAction } from '@/hooks/useAction';
import { recommendBusiness } from '@/backend/actions';

export default function BusinessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { t, locale } = useI18n();

  const business = useStore((s) => s.businesses.find((b) => b.id === id));
  // Raw state + useMemo, not filter()/sort() inside the selector — see
  // src/features/home/HomeHeader.tsx for why.
  const allRecommendations = useStore((s) => s.recommendations);
  const recommendations = useMemo(
    () => allRecommendations.filter((r) => r.businessId === id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [allRecommendations, id],
  );
  const users = useStore((s) => s.users);
  const { run, pending: recommending } = useAction();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [text, setText] = useState('');
  const [linkError, setLinkError] = useState(false);

  if (!business) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" fallbackRoute="/recommendations" />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  const title = (locale === 'ar' ? business.nameAr : business.nameEn) ?? business.name;
  const phone = business.phoneMasked.replace(/[\s()-]/g, '');
  const dialable = /^\+?[0-9]{7,15}$/.test(phone);
  const source = business.sourceUrl?.startsWith('https://') ? business.sourceUrl : null;
  const destination =
    business.approxLat != null && business.approxLng != null ? `${business.approxLat},${business.approxLng}` : business.locationLabel;

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {
      setLinkError(true);
    });
  };

  const submit = async () => {
    if (!text.trim() || recommending) return;
    const res = await run(() => recommendBusiness(business.id, text.trim()));
    if (!res.ok) return;
    setText('');
    setSheetOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader
        title={title}
        fallbackRoute="/recommendations"
        right={
          <IconButton
            accessibilityLabel={t.common.share}
            onPress={() => shareContent({ title: business.name, message: business.name, url: links.business(business.id) })}
          >
            <Share2 size={19} color={theme.colors.textPrimary} />
          </IconButton>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {business.coverImage ? (
          <Image source={{ uri: business.coverImage }} style={{ width: '100%', height: 180 }} contentFit="cover" />
        ) : null}
        <View style={{ padding: theme.spacing.md }}>
          <View style={{ ...theme.row(), alignItems: 'center', gap: 6 }}>
            <Text style={theme.text('heading1')}>{title}</Text>
            {business.communityVerified ? <BadgeCheck size={20} color={theme.colors.primary} /> : null}
          </View>
          {business.communityVerified && !source ? (
            <View style={{ marginTop: 6 }}>
              <Badge label={t.common.demoVerified} tone="primary" />
            </View>
          ) : null}

          {business.description ? (
            <Text style={[theme.text('body', theme.colors.textSecondary), { marginTop: 12 }]}>{business.description}</Text>
          ) : null}
          {business.locationLabel ? <Text style={theme.text('bodySmall')}>{business.locationLabel}</Text> : null}
          {source && business.sourceCheckedOn ? (
            <Text style={theme.text('caption', theme.colors.textSecondary)}>
              {locale === 'ar' ? 'تاريخ التحقق من المصدر' : 'Source checked'} {business.sourceCheckedOn}
            </Text>
          ) : null}

          <View style={{ marginTop: 12, gap: 8 }}>
            {business.hours ? (
              <View style={{ ...theme.row(), alignItems: 'center', gap: 8 }}>
                <Clock size={15} color={theme.colors.textMuted} />
                <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{business.hours}</Text>
              </View>
            ) : null}
            {business.phoneMasked ? (
              <View style={{ ...theme.row(), alignItems: 'center', gap: 8 }}>
                <Phone size={15} color={theme.colors.textMuted} />
                <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{business.phoneMasked}</Text>
              </View>
            ) : null}
          </View>

          <Text style={[theme.text('title'), { marginTop: 18 }]}>
            {t.recommendations.recommendedBy} {business.recommendationCount} {t.recommendations.neighbors}
          </Text>

          <View style={{ marginTop: 16, gap: 10 }}>
            {dialable ? <Button label={t.common.call} onPress={() => open(`tel:${phone}`)} fullWidth /> : null}
            {destination ? (
              <Button
                label={locale === 'ar' ? 'الاتجاهات' : 'Directions'}
                onPress={() => open(`https://maps.apple.com/?daddr=${encodeURIComponent(destination)}`)}
                variant="outline"
                fullWidth
              />
            ) : null}
            {source ? (
              <Button label={locale === 'ar' ? 'المصدر' : 'Source'} onPress={() => open(source)} variant="outline" fullWidth />
            ) : null}
            {linkError ? (
              <Text accessibilityLiveRegion="polite" style={theme.text('bodySmall', theme.colors.danger)}>
                {t.errors.genericTitle}
              </Text>
            ) : null}
            {business.communityVerified ? (
              <>
                <Button
                  label={locale === 'ar' ? 'الإبلاغ عن معلومات غير صحيحة' : 'Report incorrect information'}
                  onPress={() => router.push({ pathname: '/business/request', params: { business: business.id, kind: 'correction' } })}
                  variant="outline"
                  fullWidth
                />
                <Button
                  label={locale === 'ar' ? 'طلب ملكية النشاط التجاري' : 'Claim this business'}
                  onPress={() => router.push({ pathname: '/business/request', params: { business: business.id, kind: 'claim' } })}
                  variant="outline"
                  fullWidth
                />
              </>
            ) : null}
            <Button label={t.recommendations.recommend} onPress={() => setSheetOpen(true)} variant="outline" fullWidth />
          </View>

          <View style={{ marginTop: 20, gap: 10 }}>
            {recommendations.map((r) => {
              const author = users.find((u) => u.id === r.authorId);
              return author ? (
                <View
                  key={r.id}
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderWidth: 1,
                    borderRadius: theme.radii.md,
                    padding: 12,
                  }}
                >
                  <Text style={theme.text('bodySmall')}>{displayName(author)}</Text>
                  <Text style={[theme.text('bodySmall', theme.colors.textSecondary), { marginTop: 4 }]}>{r.textAr}</Text>
                  <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4 }]}>
                    {formatRelativeTime(r.createdAt, locale)}
                  </Text>
                </View>
              ) : null;
            })}
          </View>
        </View>
      </ScrollView>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }}>
          <Text style={[theme.text('heading3'), { marginBottom: 12 }]}>{t.recommendations.recommend}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t.recommendations.recommendPlaceholder}
            placeholderTextColor={theme.colors.textMuted}
            multiline
            style={[
              theme.text('body'),
              {
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                padding: 12,
                minHeight: 80,
                textAlignVertical: 'top',
              },
            ]}
          />
          <View style={{ marginTop: 14 }}>
            <Button label={t.common.submit} onPress={submit} disabled={!text.trim()} fullWidth />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
