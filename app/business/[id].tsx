import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { BadgeCheck, Clock, Phone } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { displayName, formatRelativeTime } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { BottomSheet } from '@/components/BottomSheet';

export default function BusinessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();

  const business = useStore((s) => s.businesses.find((b) => b.id === id));
  const recommendations = useStore((s) =>
    s.recommendations.filter((r) => r.businessId === id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  );
  const users = useStore((s) => s.users);
  const recommendBusiness = useStore((s) => s.recommendBusiness);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [text, setText] = useState('');

  if (!business) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  const submit = () => {
    if (!text.trim()) return;
    recommendBusiness(business.id, text.trim());
    setText('');
    setSheetOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="" transparent />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Image source={{ uri: business.coverImage }} style={{ width: '100%', height: 180 }} contentFit="cover" />
        <View style={{ padding: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={theme.text('heading1')}>{business.name}</Text>
            {business.communityVerified ? <BadgeCheck size={20} color={theme.colors.primary} /> : null}
          </View>
          {business.communityVerified ? (
            <View style={{ marginTop: 6 }}>
              <Badge label={t.common.demoVerified} tone="primary" />
            </View>
          ) : null}

          <Text style={[theme.text('body', theme.colors.textSecondary), { marginTop: 12 }]}>{business.description}</Text>

          <View style={{ marginTop: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Clock size={15} color={theme.colors.textMuted} />
              <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{business.hours}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Phone size={15} color={theme.colors.textMuted} />
              <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{business.phoneMasked}</Text>
            </View>
          </View>

          <Text style={[theme.text('title'), { marginTop: 18 }]}>
            {t.recommendations.recommendedBy} {business.recommendationCount} {t.recommendations.neighbors}
          </Text>

          <View style={{ marginTop: 16, gap: 10 }}>
            <Button label={t.common.call} icon={<Phone size={16} color={theme.colors.onPrimary} />} fullWidth />
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
