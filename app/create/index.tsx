import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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
  Star,
  X,
} from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { IconButton } from '@/components/IconButton';

export default function CreateSheetScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const options = [
    {
      key: 'post',
      icon: MessageSquarePlus,
      tone: theme.colors.primary,
      title: t.create.post,
      desc: t.create.postDesc,
      route: '/create/post',
    },
    {
      key: 'askNeighbors',
      icon: MessageCircleQuestion,
      tone: theme.colors.info,
      title: t.create.askNeighbors,
      desc: t.create.askNeighborsDesc,
      // Same composer as "Post something" — a distinct entry point into
      // the existing post flow, not a duplicate system.
      route: '/create/post',
    },
    { key: 'event', icon: Calendar, tone: theme.colors.secondary, title: t.create.event, desc: t.create.eventDesc, route: '/event/create' },
    {
      key: 'issue',
      icon: AlertTriangle,
      tone: theme.colors.warning,
      title: t.create.issue,
      desc: t.create.issueDesc,
      route: '/issue/create',
    },
    {
      key: 'recommend',
      icon: Star,
      tone: theme.colors.primary,
      title: t.create.recommend,
      desc: t.create.recommendDesc,
      // Recommendations are tied to a specific business (see
      // src/models Recommendation) — there's no standalone "create a
      // recommendation" composer, only leaving one from a business's own
      // page, so this opens the businesses browse screen to pick one.
      route: '/recommendations',
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
    {
      key: 'help',
      icon: HeartHandshake,
      tone: theme.colors.info,
      title: t.create.help,
      desc: t.create.helpDesc,
      route: '/help-request/create',
    },
    { key: 'poll', icon: BarChart3, tone: theme.colors.primary, title: t.create.poll, desc: t.create.pollDesc, route: '/create/poll' },
  ] as const;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={[theme.row(), styles.header, { paddingTop: insets.top + 12, paddingHorizontal: theme.spacing.md }]}>
        <Text style={theme.text('heading2')}>{t.create.sheetTitle}</Text>
        <IconButton accessibilityLabel={t.common.close} variant="surface" onPress={() => router.back()}>
          <X size={18} color={theme.colors.textPrimary} />
        </IconButton>
      </View>

      <View style={{ paddingHorizontal: theme.spacing.md, gap: 10, marginTop: 8 }}>
        {options.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => router.push(opt.route as never)}
            style={[
              theme.row(),
              styles.row,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg },
            ]}
            accessibilityRole="button"
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  row: { alignItems: 'center', gap: 14, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
