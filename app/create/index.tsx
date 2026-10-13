import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  HandCoins,
  HeartHandshake,
  MessageCircleQuestion,
  MessageSquarePlus,
  PawPrint,
  Shield,
  Star,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useSafeBack } from '@/hooks/useSafeBack';
import { IconButton } from '@/components/IconButton';

interface CreateOption {
  key: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  desc: string;
  route: Href;
}

export default function CreateSheetScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeBack = useSafeBack('/');

  const options: CreateOption[] = [
    {
      key: 'post',
      icon: MessageSquarePlus,
      tone: theme.colors.primary,
      title: t.create.post,
      desc: t.create.postDesc,
      route: '/create/post',
    },
    // Same composer as "Post something" — a distinct entry point, not a duplicate system.
    {
      key: 'askNeighbors',
      icon: MessageCircleQuestion,
      tone: theme.colors.info,
      title: t.create.askNeighbors,
      desc: t.create.askNeighborsDesc,
      route: '/create/post',
    },
    {
      key: 'activity',
      icon: Trophy,
      tone: theme.colors.primary,
      title: t.create.activity,
      desc: t.create.activityDesc,
      route: { pathname: '/event/create', params: { kind: 'activity' } },
    },
    {
      key: 'event',
      icon: Calendar,
      tone: theme.colors.secondary,
      title: t.create.event,
      desc: t.create.eventDesc,
      route: { pathname: '/event/create', params: { kind: 'event' } },
    },
    {
      key: 'club',
      icon: Shield,
      tone: theme.colors.primary,
      title: t.clubs.createClub,
      desc: t.create.clubDesc,
      route: '/clubs/create',
    },
    { key: 'poll', icon: BarChart3, tone: theme.colors.primary, title: t.create.poll, desc: t.create.pollDesc, route: '/create/poll' },
    {
      key: 'issue',
      icon: AlertTriangle,
      tone: theme.colors.warning,
      title: t.create.issue,
      desc: t.create.issueDesc,
      route: '/issue/create',
    },
    {
      key: 'help',
      icon: HeartHandshake,
      tone: theme.colors.info,
      title: t.create.help,
      desc: t.create.helpDesc,
      route: '/help-request/create',
    },
    {
      key: 'sell',
      icon: HandCoins,
      tone: theme.colors.secondary,
      title: t.create.sell,
      desc: t.create.sellDesc,
      route: '/marketplace/create',
    },
    {
      key: 'lostFound',
      icon: PawPrint,
      tone: theme.colors.danger,
      title: t.create.lostFound,
      desc: t.create.lostFoundDesc,
      route: '/lost-found/create',
    },
    // Recommendations belong to a specific business, so this opens the businesses list to pick one.
    {
      key: 'recommend',
      icon: Star,
      tone: theme.colors.primary,
      title: t.create.recommend,
      desc: t.create.recommendDesc,
      route: '/recommendations',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View
        style={[
          theme.row(),
          styles.header,
          { paddingTop: insets.top + 12, paddingHorizontal: theme.spacing.md, borderBottomColor: theme.colors.divider },
        ]}
      >
        <Text style={theme.text('heading2')}>{t.create.sheetTitle}</Text>
        <IconButton accessibilityLabel={t.common.close} variant="surface" onPress={safeBack}>
          <X size={18} color={theme.colors.textPrimary} />
        </IconButton>
      </View>

      {/* Scrollable on every iPhone size; bottom padding clears the home indicator. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 10 }}
        showsVerticalScrollIndicator
        accessibilityRole="list"
      >
        {options.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => router.push(opt.route)}
            style={({ pressed }) => [
              theme.row(),
              styles.row,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.lg,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={opt.title}
            accessibilityHint={opt.desc}
          >
            <View style={[styles.iconWrap, { backgroundColor: opt.tone + '1a' }]}>
              <opt.icon size={22} color={opt.tone} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={theme.text('title')}>{opt.title}</Text>
              <Text style={theme.text('bodySmall', theme.colors.textSecondary)}>{opt.desc}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { alignItems: 'center', gap: 14, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
