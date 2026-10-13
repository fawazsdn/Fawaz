import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { localizeDigits } from '@/utils/format';
import { useStore } from '@/store/useStore';
import { useSafeBack } from '@/hooks/useSafeBack';
import { SectionHeader } from '@/components/SectionHeader';
import { UserRow } from '@/components/UserRow';
import { AlertCard } from '@/features/community/AlertCard';
import { ClubCard } from '@/features/clubs/ClubCard';
import { discoverableClubs } from '@/features/clubs/clubLogic';

export default function CommunityScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeBack = useSafeBack('/');

  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === s.session.neighborhoodId));

  // Raw state + useMemo, not filter() inside the selector — see HomeHeader
  // for why (getSnapshot must return a stable reference across renders).
  const allUsers = useStore((s) => s.users);
  const allAlerts = useStore((s) => s.alerts);
  const allClubs = useStore((s) => s.clubs);
  const allInstitutions = useStore((s) => s.institutions);

  const members = useMemo(() => allUsers.filter((u) => u.neighborhoodId === neighborhood?.id).slice(0, 4), [allUsers, neighborhood?.id]);
  const alerts = useMemo(() => allAlerts.filter((a) => a.neighborhoodId === neighborhood?.id), [allAlerts, neighborhood?.id]);
  const clubs = useMemo(() => discoverableClubs(allClubs, neighborhood?.id ?? null), [allClubs, neighborhood?.id]);
  const institutions = useMemo(
    () => allInstitutions.filter((i) => i.neighborhoodId === neighborhood?.id),
    [allInstitutions, neighborhood?.id],
  );

  if (!neighborhood) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={[styles.hero, { backgroundColor: theme.colors.primary, paddingTop: insets.top + 20 }]}>
          {/* Now a root-level route pushed from Explore/Home — needs its own back
              control, unlike when this lived in the tab bar. Styled for the hero's
              primary-colored background rather than the standard AppHeader. */}
          <Pressable
            onPress={safeBack}
            accessibilityRole="button"
            accessibilityLabel={t.common.back}
            hitSlop={10}
            style={[styles.backButton, { backgroundColor: theme.colors.onPrimary + '22' }]}
          >
            {theme.isRTL ? (
              <ChevronRight size={20} color={theme.colors.onPrimary} />
            ) : (
              <ChevronLeft size={20} color={theme.colors.onPrimary} />
            )}
          </Pressable>
          <Text style={theme.text('heading1', theme.colors.onPrimary)}>{locale === 'ar' ? neighborhood.nameAr : neighborhood.nameEn}</Text>
          <View style={[theme.row(), styles.statsRow]}>
            <HeroStat value={neighborhood.residentsCount} label={t.community.verifiedResidents} />
            <HeroStat value={neighborhood.eventsThisWeek} label={t.community.eventsThisWeek} />
            <HeroStat value={neighborhood.openIssues} label={t.community.openIssues} />
            <HeroStat value={neighborhood.helpfulActions} label={t.community.helpfulActions} />
          </View>
        </View>

        {alerts.length > 0 ? (
          <View style={{ padding: theme.spacing.md, gap: 10 }}>
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </View>
        ) : null}

        <View style={{ marginTop: 8 }}>
          <SectionHeader title={t.community.members} onSeeAll={() => router.push('/directory')} />
          <View style={{ paddingHorizontal: theme.spacing.md }}>
            {members.map((m) => (
              <UserRow key={m.id} user={m} onPress={() => router.push(`/profile/${m.id}`)} />
            ))}
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <SectionHeader title={t.community.issues} onSeeAll={() => router.push('/issues')} />
        </View>

        <View style={{ marginTop: 14 }}>
          <SectionHeader title={t.community.recommendations} onSeeAll={() => router.push('/recommendations')} />
        </View>

        <View style={{ marginTop: 14 }}>
          <SectionHeader title={t.community.marketplace} onSeeAll={() => router.push('/marketplace')} />
        </View>

        <View style={{ marginTop: 14 }}>
          <SectionHeader title={t.clubs.title} onSeeAll={() => router.push('/clubs')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ ...theme.row(), gap: 12, paddingHorizontal: theme.spacing.md }}
          >
            {clubs.slice(0, 8).map((c) => (
              <ClubCard key={c.id} club={c} compact />
            ))}
          </ScrollView>
          {clubs.length === 0 ? (
            <Pressable onPress={() => router.push('/clubs')} style={{ paddingHorizontal: theme.spacing.md }} accessibilityRole="button">
              <Text style={theme.text('bodySmall', theme.colors.primary)}>{t.clubs.createClub}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ marginTop: 14 }}>
          <SectionHeader title={t.community.institutions} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ ...theme.row(), gap: 10, paddingHorizontal: theme.spacing.md }}
          >
            {institutions.map((inst) => (
              <Pressable
                key={inst.id}
                onPress={() => router.push(`/institution/${inst.id}`)}
                style={[styles.instCard, { borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}
              >
                <Image source={{ uri: inst.coverImage }} style={styles.instImage} />
                <View style={{ padding: 10 }}>
                  <Text style={theme.text('bodySmall')} numberOfLines={1}>
                    {inst.name}
                  </Text>
                  <Text style={theme.text('caption', theme.colors.textMuted)}>{t.institutions[inst.type]}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

function HeroStat({ value, label }: { value: number | null; label: string }) {
  const theme = useTheme();
  const { locale } = useI18n();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={theme.text('heading2', theme.colors.onPrimary)}>{value == null ? '—' : localizeDigits(value, locale)}</Text>
      <Text style={[theme.text('caption', theme.colors.onPrimary), { opacity: 0.85, textAlign: 'center' }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingBottom: 20, paddingHorizontal: 20 },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  statsRow: { marginTop: 18, gap: 6 },
  instCard: { width: 150, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  instImage: { width: '100%', height: 80 },
});
