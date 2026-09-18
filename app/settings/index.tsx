import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BadgeCheck,
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gift,
  Globe,
  HandCoins,
  Info,
  LogOut,
  MapPin,
  MessageCircle,
  Moon,
  RotateCcw,
  Share2,
  Shield,
  Sparkles,
  Trash2,
  User,
  Users,
  UserX,
} from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { signOutSupabase } from '@/features/auth/supabaseAuth';
import { useStore, CURRENT_USER_ID } from '@/store/useStore';
import { IS_DEV_BUILD } from '@/config/devFeatures';
import type { DemoRole, ThemeMode, VerificationStatus } from '@/models';
import { displayName } from '@/utils/format';
import { referralService } from '@/services/referral';
import { links } from '@/config/links';
import { buildInviteMessage } from '@/utils/inviteMessage';
import { shareContent } from '@/utils/share';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Chip } from '@/components/Chip';

export default function SettingsScreen() {
  const theme = useTheme();
  const { t, isRTL, locale } = useI18n();
  const router = useRouter();

  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const setLocale = useStore((s) => s.setLocale);
  const setThemeMode = useStore((s) => s.setThemeMode);
  const setDemoRole = useStore((s) => s.setDemoRole);
  const setRamadanMode = useStore((s) => s.setRamadanMode);
  const signOut = useStore((s) => s.signOut);
  const resetDemoData = useStore((s) => s.resetDemoData);
  const verification = useStore((s) => s.session.verification);
  const user = useStore((s) => s.getUser(CURRENT_USER_ID));
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === s.session.neighborhoodId));

  const [sheet, setSheet] = useState<null | 'language' | 'theme' | 'message' | 'role'>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const shareHaratna = async () => {
    referralService.recordInviteSent();
    const code = await referralService.getReferralCode();
    const neighborhoodName = neighborhood ? (locale === 'ar' ? neighborhood.nameAr : neighborhood.nameEn) : '';
    const link = neighborhood ? links.neighborhoodInvite(neighborhood.id, code) : undefined;
    const message = buildInviteMessage({ neighborhoodName, link: link ?? links.neighborhoodInvite('', code), locale });
    await shareContent({ title: t.settings.shareHaratna, message, url: link });
  };

  if (!user) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.settings.title} fallbackRoute="/" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 60 }}>
        {/* Top profile card — the community-identity summary this screen is
            named for. Real store data only: stats/reputationTier/memberSince
            come straight off the User record, never fabricated. */}
        <Pressable
          onPress={() => router.push(`/profile/${user.id}`)}
          style={[
            styles.profileCard,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t.settings.viewProfile}
        >
          <View style={[theme.row(), { alignItems: 'center', gap: 12 }]}>
            <Avatar uri={user.avatarUrl} name={displayName(user)} size={56} ring />
            <View style={{ flex: 1 }}>
              <View style={[theme.row(), { alignItems: 'center', gap: 5 }]}>
                <Text style={theme.text('heading3')} numberOfLines={1}>
                  {displayName(user)}
                </Text>
                {user.verification === 'verified' ? <BadgeCheck size={16} color={theme.colors.primary} /> : null}
              </View>
              <Text style={theme.text('bodySmall', theme.colors.textSecondary)} numberOfLines={1}>
                {locale === 'ar' ? neighborhood?.nameAr : neighborhood?.nameEn}
              </Text>
              <View style={[theme.row(), { alignItems: 'center', gap: 4, marginTop: 3 }]}>
                <Sparkles size={12} color={theme.colors.primary} />
                <Text style={theme.text('caption', theme.colors.textMuted)}>
                  {t.reputation[user.reputationTier]} · {t.profile.memberSince} {new Date(user.memberSince).getFullYear()}
                </Text>
              </View>
            </View>
            <Chevron size={18} color={theme.colors.textMuted} />
          </View>

          <View style={[theme.row(), styles.statsRow, { borderTopColor: theme.colors.divider }]}>
            <MiniStat value={user.stats.neighborsHelped} label={t.profile.neighborsHelped} />
            <MiniStat value={user.stats.eventsHosted} label={t.profile.eventsHosted} />
            <MiniStat value={user.stats.thanksReceived} label={t.profile.thanksReceived} />
          </View>
        </Pressable>

        <SectionLabel title={t.settings.myHaratna} />
        <Row
          icon={MapPin}
          label={t.settings.myNeighborhood}
          value={locale === 'ar' ? neighborhood?.nameAr : neighborhood?.nameEn}
          onPress={() => router.push('/(auth)/select-neighborhood')}
          Chevron={Chevron}
        />
        <Row icon={FileText} label={t.settings.myPosts} onPress={() => router.push(`/profile/${user.id}?tab=activity`)} Chevron={Chevron} />
        <Row
          icon={CalendarDays}
          label={t.settings.myEvents}
          onPress={() => router.push(`/profile/${user.id}?tab=events`)}
          Chevron={Chevron}
        />
        <Row icon={Bookmark} label={t.settings.saved} onPress={() => router.push('/saved')} Chevron={Chevron} />
        {/* CommunityGroup has no per-user membership list in this model
            (only memberCount) — there's no real "groups I've joined" data
            to filter by, so this honestly opens the same groups browse
            screen everyone sees rather than fabricating a "my groups"
            filter. See t.settings.myGroupsNote / final report. */}
        <Row icon={Users} label={t.settings.myGroups} onPress={() => router.push('/community')} Chevron={Chevron} />
        <Row icon={HandCoins} label={t.marketplace.title} onPress={() => router.push('/marketplace')} Chevron={Chevron} />
        <Row icon={Gift} label={t.invite.title} onPress={() => router.push('/invite')} Chevron={Chevron} />

        <SectionLabel title={t.settings.account} />
        <Row icon={User} label={t.settings.editProfile} onPress={() => router.push('/settings/edit-profile')} Chevron={Chevron} />
        <Row
          icon={BadgeCheck}
          label={t.settings.verificationStatus}
          value={verificationLabel(verification, t)}
          onPress={() => router.push('/(auth)/verification')}
          Chevron={Chevron}
        />

        <SwitchRow
          label={t.settings.notifications}
          value={settings.notificationsEnabled}
          onChange={(v) => setSettings({ notificationsEnabled: v })}
        />

        <SectionLabel title={t.settings.privacy} />
        <Row
          icon={MessageCircle}
          label={t.settings.whoCanMessage}
          value={whoCanMessageLabel(settings.whoCanMessage, t)}
          onPress={() => setSheet('message')}
          Chevron={Chevron}
        />
        <SwitchRow
          label={t.settings.activityVisibility}
          value={settings.activityVisible}
          onChange={(v) => setSettings({ activityVisible: v })}
        />
        <Row icon={UserX} label={t.settings.blockedUsers} onPress={() => router.push('/settings/blocked-users')} Chevron={Chevron} />

        <Row
          icon={Globe}
          label={t.settings.language}
          value={settings.locale === 'ar' ? 'العربية' : 'English'}
          onPress={() => setSheet('language')}
          Chevron={Chevron}
        />

        <SectionLabel title={t.settings.appearance} />
        <Row
          icon={Moon}
          label={t.settings.theme}
          value={themeLabel(settings.themeMode, t)}
          onPress={() => setSheet('theme')}
          Chevron={Chevron}
        />
        <SwitchRow label={t.settings.ramadanMode} value={settings.ramadanMode} onChange={setRamadanMode} />

        <SectionLabel title={t.settings.helpSafety} />
        <Row icon={Info} label={t.settings.help} onPress={() => router.push('/settings/info/help')} Chevron={Chevron} />
        <Row icon={Info} label={t.settings.terms} onPress={() => router.push('/settings/info/terms')} Chevron={Chevron} />
        <Row icon={Shield} label={t.settings.privacyPolicy} onPress={() => router.push('/settings/info/privacy')} Chevron={Chevron} />

        <Row icon={Info} label={t.settings.aboutHaratna} onPress={() => router.push('/settings/info/about')} Chevron={Chevron} />

        {/* Developer-only: the role switcher and demo-data reset only make
            sense against this frontend's mock data layer, and must never
            reach a production build — see src/config/devFeatures.ts. The
            moderator-gated row below (settings.demoRole === 'moderator')
            is left in production-eligible code because moderation itself
            is a real feature; only the ability to self-assign that role
            from the client is dev-only. */}
        {IS_DEV_BUILD ? (
          <>
            <SectionLabel title={t.settings.demoModeTitle} />
            <Row
              icon={Shield}
              label={t.settings.demoRole}
              value={t.roles[settings.demoRole]}
              onPress={() => setSheet('role')}
              Chevron={Chevron}
            />
            <Row icon={RotateCcw} label={t.settings.resetDemoData} onPress={() => setResetOpen(true)} Chevron={Chevron} />
          </>
        ) : null}
        {settings.demoRole === 'moderator' ? (
          <Row icon={Shield} label={t.moderation.title} onPress={() => router.push('/moderation')} Chevron={Chevron} />
        ) : null}

        <SectionLabel title={t.settings.accountActions} />
        <Row icon={Share2} label={t.settings.shareHaratna} onPress={shareHaratna} Chevron={Chevron} />
        <Row icon={LogOut} label={t.settings.signOut} onPress={() => setSignOutOpen(true)} Chevron={Chevron} />
        <Row icon={Trash2} label={t.settings.deleteAccount} destructive onPress={() => setDeleteOpen(true)} Chevron={Chevron} />
      </ScrollView>

      <BottomSheet visible={sheet === 'language'} onClose={() => setSheet(null)}>
        <OptionList
          title={t.settings.language}
          options={[
            { key: 'ar', label: 'العربية' },
            { key: 'en', label: 'English' },
          ]}
          selected={settings.locale}
          onSelect={(k) => {
            setLocale(k as 'ar' | 'en');
            setSheet(null);
          }}
        />
      </BottomSheet>

      <BottomSheet visible={sheet === 'theme'} onClose={() => setSheet(null)}>
        <OptionList
          title={t.settings.theme}
          options={[
            { key: 'system', label: t.settings.themeSystem },
            { key: 'light', label: t.settings.themeLight },
            { key: 'dark', label: t.settings.themeDark },
          ]}
          selected={settings.themeMode}
          onSelect={(k) => {
            setThemeMode(k as ThemeMode);
            setSheet(null);
          }}
        />
      </BottomSheet>

      <BottomSheet visible={sheet === 'message'} onClose={() => setSheet(null)}>
        <OptionList
          title={t.settings.whoCanMessage}
          options={[
            { key: 'everyone', label: t.settings.whoCanMessageEveryone },
            { key: 'neighbors', label: t.settings.whoCanMessageNeighbors },
            { key: 'nobody', label: t.settings.whoCanMessageNobody },
          ]}
          selected={settings.whoCanMessage}
          onSelect={(k) => {
            setSettings({ whoCanMessage: k as 'everyone' | 'neighbors' | 'nobody' });
            setSheet(null);
          }}
        />
      </BottomSheet>

      <BottomSheet visible={sheet === 'role'} onClose={() => setSheet(null)}>
        <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }}>
          <Text style={[theme.text('heading3'), { marginBottom: 12 }]}>{t.settings.demoRole}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['resident', 'moderator', 'organizer', 'business'] as DemoRole[]).map((r) => (
              <Chip
                key={r}
                label={t.roles[r]}
                selected={settings.demoRole === r}
                onPress={() => {
                  setDemoRole(r);
                  setSheet(null);
                }}
              />
            ))}
          </View>
        </View>
      </BottomSheet>

      <ConfirmationModal
        visible={signOutOpen}
        title={t.settings.signOut}
        body={t.settings.signOutConfirm}
        destructive
        onCancel={() => setSignOutOpen(false)}
        onConfirm={() => {
          signOutSupabase().catch(() => {});
          signOut();
          setSignOutOpen(false);
          router.replace('/');
        }}
      />

      <ConfirmationModal
        visible={deleteOpen}
        title={t.settings.deleteAccount}
        body={t.settings.deleteAccountConfirm}
        destructive
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          signOutSupabase().catch(() => {});
          resetDemoData();
          setDeleteOpen(false);
          router.replace('/');
        }}
      />

      <ConfirmationModal
        visible={resetOpen}
        title={t.settings.resetDemoData}
        body={t.settings.resetDemoDataConfirm}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          resetDemoData();
          setResetOpen(false);
          Alert.alert(t.common.done);
          router.replace('/');
        }}
      />
    </View>
  );
}

function verificationLabel(status: VerificationStatus, t: ReturnType<typeof useI18n>['t']) {
  const map: Record<VerificationStatus, string> = {
    not_started: t.verification.notStarted,
    checking: t.verification.checking,
    pending: t.verification.pending,
    verified: t.verification.verified,
    failed: t.verification.failed,
  };
  return map[status];
}

function themeLabel(mode: ThemeMode, t: ReturnType<typeof useI18n>['t']) {
  return mode === 'system' ? t.settings.themeSystem : mode === 'light' ? t.settings.themeLight : t.settings.themeDark;
}

function whoCanMessageLabel(v: 'everyone' | 'neighbors' | 'nobody', t: ReturnType<typeof useI18n>['t']) {
  return v === 'everyone'
    ? t.settings.whoCanMessageEveryone
    : v === 'neighbors'
      ? t.settings.whoCanMessageNeighbors
      : t.settings.whoCanMessageNobody;
}

function SectionLabel({ title }: { title: string }) {
  const theme = useTheme();
  return <Text style={[theme.text('caption', theme.colors.textMuted), styles.sectionLabel]}>{title}</Text>;
}

function MiniStat({ value, label }: { value: number; label: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={theme.text('title')}>{value}</Text>
      <Text style={theme.text('caption', theme.colors.textMuted)} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  onPress,
  destructive,
  Chevron,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
  Chevron: React.ComponentType<{ size: number; color: string }>;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[theme.row(), styles.row, { borderBottomColor: theme.colors.divider }]} accessibilityRole="button">
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.backgroundAlt }]}>
        <Icon size={16} color={destructive ? theme.colors.danger : theme.colors.textSecondary} />
      </View>
      <Text style={[theme.text('body', destructive ? theme.colors.danger : theme.colors.textPrimary), { flex: 1 }]}>{label}</Text>
      {value ? (
        <Text style={theme.text('bodySmall', theme.colors.textMuted)} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <Chevron size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={[theme.row(), styles.row, { borderBottomColor: theme.colors.divider }]}>
      <Text style={[theme.text('body'), { flex: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.colors.primary }}
        accessibilityRole="switch"
        accessibilityLabel={label}
      />
    </View>
  );
}

function OptionList({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (k: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md }}>
      <Text style={[theme.text('heading3'), { marginBottom: 12 }]}>{title}</Text>
      {options.map((opt) => (
        <Pressable
          key={opt.key}
          onPress={() => onSelect(opt.key)}
          style={[theme.row(), styles.optionRow, { borderColor: selected === opt.key ? theme.colors.primary : theme.colors.border }]}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === opt.key }}
        >
          <Text style={theme.text('body', selected === opt.key ? theme.colors.primary : theme.colors.textPrimary)}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: 22, marginBottom: 6, textTransform: 'uppercase' },
  row: { alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  optionRow: { padding: 14, borderWidth: 1.5, borderRadius: 10, marginBottom: 8 },
  profileCard: { padding: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  statsRow: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
