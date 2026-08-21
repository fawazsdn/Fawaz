import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { BadgeCheck } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { formatRelativeTime } from '@/utils/format';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';

export default function InstitutionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { t, locale } = useI18n();

  const institution = useStore((s) => s.institutions.find((i) => i.id === id));

  if (!institution) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <AppHeader title="" fallbackRoute="/community" />
        <EmptyState title={t.errors.genericTitle} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title="" transparent fallbackRoute="/community" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Image source={{ uri: institution.coverImage }} style={{ width: '100%', height: 180 }} contentFit="cover" />
        <View style={{ padding: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={theme.text('heading1')}>{institution.name}</Text>
            {institution.verified ? <BadgeCheck size={20} color={theme.colors.primary} /> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Badge label={t.institutions[institution.type]} tone="neutral" />
            <Badge label={t.institutions.demoLabel} tone="info" />
          </View>

          {institution.announcements.length > 0 ? (
            <Section title={t.institutions.announcements}>
              {institution.announcements.map((a) => (
                <Card key={a.id} style={{ marginBottom: 8 }}>
                  <Text style={theme.text('bodySmall')}>{a.textAr}</Text>
                  <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4 }]}>
                    {formatRelativeTime(a.createdAt, locale)}
                  </Text>
                </Card>
              ))}
            </Section>
          ) : null}

          {institution.classes.length > 0 ? (
            <Section title={t.institutions.classes}>
              {institution.classes.map((c) => (
                <Card key={c.id} style={{ marginBottom: 8 }}>
                  <Text style={theme.text('bodySmall')}>{c.titleAr}</Text>
                  <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4 }]}>{c.schedule}</Text>
                </Card>
              ))}
            </Section>
          ) : null}

          {institution.volunteerOpportunities.length > 0 ? (
            <Section title={t.institutions.volunteer}>
              {institution.volunteerOpportunities.map((v) => (
                <Card key={v.id} style={{ marginBottom: 8 }}>
                  <Text style={theme.text('bodySmall')}>{v.titleAr}</Text>
                  <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 4 }]}>{v.spotsLeft} أماكن متبقية</Text>
                </Card>
              ))}
            </Section>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={[theme.text('title'), { marginBottom: 10 }]}>{title}</Text>
      {children}
    </View>
  );
}
