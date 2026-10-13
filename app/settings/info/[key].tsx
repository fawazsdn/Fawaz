import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/Button';
import { LEGAL_DOCS, LEGAL_UPDATED, legalDoc, type LegalDoc } from '@/content/legal';
import { formatFullDate } from '@/utils/format';

/** Privacy policy, terms, community guidelines, help, about and account deletion — same text as the website. */
export default function InfoScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const doc: LegalDoc = (LEGAL_DOCS as string[]).includes(key ?? '') ? (key as LegalDoc) : 'about';
  const { title, sections } = legalDoc(doc, locale);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={title} fallbackRoute="/settings" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 48, gap: 14 }}>
        {sections.map((s, i) => (
          <View key={i} style={{ gap: 6 }}>
            {s.h ? <Text style={theme.text('title')}>{s.h}</Text> : null}
            {s.p?.map((p, j) => (
              <Text key={j} style={theme.text('body', theme.colors.textSecondary)}>
                {p}
              </Text>
            ))}
            {s.li?.map((li, j) => (
              <Text key={j} style={theme.text('body', theme.colors.textSecondary)}>
                {'•  '}
                {li}
              </Text>
            ))}
          </View>
        ))}
        {doc === 'help' || doc === 'deletion' ? (
          <Button label={t.support.title} onPress={() => router.push('/settings/support')} variant="outline" />
        ) : null}
        <Text style={theme.text('caption', theme.colors.textMuted)}>
          {t.support.lastUpdated} {formatFullDate(`${LEGAL_UPDATED}T12:00:00Z`, locale)}
        </Text>
      </ScrollView>
    </View>
  );
}
