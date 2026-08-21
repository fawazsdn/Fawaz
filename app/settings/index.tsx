import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Gift,
  Globe,
  Info,
  LogOut,
  MapPin,
  MessageCircle,
  Moon,
  RotateCcw,
  Shield,
  Trash2,
  User,
  UserX,
} from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { IS_DEV_BUILD } from '@/config/devFeatures';
import type { DemoRole, ThemeMode, VerificationStatus } from '@/models';
import { AppHeader } from '@/components/AppHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { Chip } from '@/components/Chip';

export default function SettingsScreen() {
  const theme = useTheme();
  const { t, isRTL } = useI18n();
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
  const neighborhood = useStore((s) => s.neighborhoods.find((n) => n.id === s.session.neighborhoodId));

  const [sheet, setSheet] = useState<null | 'language' | 'theme' | 'message' | 'role'>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={t.settings.title} />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: 60 }}>
        <SectionLabel title={t.settings.account} />
        <Row icon={User} label={t.settings.editProfile} onPress={() => router.push('/settings/edit-profile')} Chevron={Chevron} />
        <Row
          icon={MapPin}
          label={t.settings.neighborhood}
          value={neighborhood?.nameAr}
          onPress={() => router.push('/(auth)/select-neighborhood')}
          Chevron={Chevron}
        />
        <Row
          icon={BadgeCheck}
          label={t.settings.verificationStatus}
          value={verificationLabel(verification, t)}
          onPress={() => router.push('/(auth)/verification')}
          Chevron={Chevron}
        />
        <Row icon={Gift} label={t.invite.title} onPress={() => router.push('/invite')} Chevron={Chevron} />

        <SectionLabel title={t.settings.preferences} />
        <Row
          icon={Globe}
          label={t.settings.language}
          value={settings.locale === 'ar' ? 'العربية' : 'English'}
          onPress={() => setSheet('language')}
          Chevron={Chevron}
        />
        <Row
          icon={Moon}
          label={t.settings.theme}
          value={themeLabel(settings.themeMode, t)}
          onPress={() => setSheet('theme')}
          Chevron={Chevron}
        />
        <SwitchRow
          label={t.settings.notifications}
          value={settings.notificationsEnabled}
          onChange={(v) => setSettings({ notificationsEnabled: v })}
        />
        <SwitchRow label={t.settings.ramadanMode} value={settings.ramadanMode} onChange={setRamadanMode} />

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

        <SectionLabel title={t.settings.app} />
        <Row icon={Info} label={t.settings.about} onPress={() => router.push('/settings/info/about')} Chevron={Chevron} />
        <Row icon={Info} label={t.settings.help} onPress={() => router.push('/settings/info/help')} Chevron={Chevron} />
        <Row icon={Info} label={t.settings.terms} onPress={() => router.push('/settings/info/terms')} Chevron={Chevron} />
        <Row icon={Shield} label={t.settings.privacyPolicy} onPress={() => router.push('/settings/info/privacy')} Chevron={Chevron} />

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
      {value ? <Text style={theme.text('bodySmall', theme.colors.textMuted)}>{value}</Text> : null}
      <Chevron size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
}

function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={[theme.row(), styles.row, { borderBottomColor: theme.colors.divider }]}>
      <Text style={[theme.text('body'), { flex: 1 }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.colors.primary }} />
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
});
