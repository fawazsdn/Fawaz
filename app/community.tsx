import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2, ChevronLeft, ChevronRight, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { useSafeBack } from '@/hooks/useSafeBack';
import { SectionHeader } from '@/components/SectionHeader';
import { UserRow } from '@/components/UserRow';
import { BottomSheet } from '@/components/BottomSheet';
import { AlertCard } from '@/features/community/AlertCard';

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
  const allGroups = useStore((s) => s.communityGroups);
  const allInstitutions = useStore((s) => s.institutions);

  const members = useMemo(
    () => allUsers.filter((u) => u.neighborhoodId === neighborhood?.id).slice(0, 4),
    [allUsers, neighborhood?.id],
  );
  const alerts = useMemo(() => allAlerts.filter((a) => a.neighborhoodId === neighborhood?.id), [allAlerts, neighborhood?.id]);
  const groups = useMemo(
    () => allGroups.filter((g) => g.neighborhoodId === neighborhood?.id),
    [allGroups, neighborhood?.id],
  );
  const institutions = useMemo(
    () => allInstitutions.filter((i) => i.neighborhoodId === neighborhood?.id),
    [allInstitutions, neighborhood?.id],
  );

  const [selectedGroup, setSelectedGroup] = useState<(typeof groups)[number] | null>(null);

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
          <SectionHeader title={t.community.groups} />
          <View style={{ paddingHorizontal: theme.spacing.md, gap: 10 }}>
            {groups.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => setSelectedGroup(g)}
                style={[
                  theme.row(),
                  styles.groupRow,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.md },
                ]}
              >
                <View style={[styles.groupIcon, { backgroundColor: theme.colors.backgroundAlt }]}>
                  <Users size={16} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={theme.text('title')}>{g.name}</Text>
                  <Text style={theme.text('caption', theme.colors.textMuted)}>{g.memberCount.toLocaleString()}</Text>
                </View>
              </Pressable>
            ))}
          </View>
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

      <BottomSheet visible={!!selectedGroup} onClose={() => setSelectedGroup(null)}>
        <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
          <View style={[theme.row(), { alignItems: 'center', gap: 8, marginBottom: 10 }]}>
            <Building2 size={18} color={theme.colors.primary} />
            <Text style={theme.text('heading3')}>{selectedGroup?.name}</Text>
          </View>
          <Text style={theme.text('body', theme.colors.textSecondary)}>{selectedGroup?.description}</Text>
          <Text style={[theme.text('caption', theme.colors.textMuted), { marginTop: 10 }]}>
            {selectedGroup?.memberCount.toLocaleString()} {t.directory.title}
          </Text>
        </View>
      </BottomSheet>
    </View>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={theme.text('heading2', theme.colors.onPrimary)}>{value.toLocaleString()}</Text>
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
  groupRow: { alignItems: 'center', gap: 12, padding: 12, borderWidth: StyleSheet.hairlineWidth },
  groupIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  instCard: { width: 150, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  instImage: { width: '100%', height: 80 },
});
