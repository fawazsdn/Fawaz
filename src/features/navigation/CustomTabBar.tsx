import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { CirclePlus, Compass, Home as HomeIcon, MapPin, MessageCircle } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { haptics } from '@/utils/haptics';

const TAB_ICONS = { index: HomeIcon, discover: Compass, map: MapPin } as const;

/**
 * Home / Explore / Map are real Tabs.Screen routes (declared in
 * app/(tabs)/_layout.tsx) and come through `state.routes`. Create and Inbox
 * are NOT registered tab routes — Create opens a stack sheet at /create,
 * and Inbox pushes the existing /messages screen (kept at its original
 * top-level path so /messages deep links are unaffected) — so they're
 * rendered here as matching bottom-bar buttons, not real tabs, with their
 * "active" state derived from the current pathname instead of tab index.
 * All five are laid out inline at the same height — no raised/floating
 * circle — per the "tasteful, not an enormous floating button" brief.
 */
export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const routeFor = (name: string) => state.routes.find((r) => r.name === name);
  const indexOf = (name: string) => state.routes.findIndex((r) => r.name === name);

  const labelFor = (name: string) =>
    ({ index: t.nav.home, discover: t.nav.discover, map: t.nav.map })[name as 'index' | 'discover' | 'map'] ?? name;

  const goToTab = (name: string) => {
    const route = routeFor(name);
    if (!route) return;
    const routeIndex = indexOf(name);
    const focused = state.index === routeIndex;
    haptics.selection();
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(name);
  };

  const renderRealTab = (name: keyof typeof TAB_ICONS) => {
    const routeIndex = indexOf(name);
    const focused = state.index === routeIndex;
    const Icon = TAB_ICONS[name];
    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={labelFor(name)}
        onPress={() => goToTab(name)}
        style={styles.tab}
        hitSlop={6}
      >
        <Icon size={23} color={focused ? theme.colors.primary : theme.colors.textMuted} strokeWidth={focused ? 2.3 : 1.9} />
        <Text style={[theme.text('caption', focused ? theme.colors.primary : theme.colors.textMuted), styles.label]} numberOfLines={1}>
          {labelFor(name)}
        </Text>
      </Pressable>
    );
  };

  // Inbox: a push-navigation "tab" rather than a registered route, so the
  // existing /messages deep link and its detail route (/messages/[id])
  // don't have to move — see the file-level comment above.
  const inboxFocused = pathname === '/messages';

  return (
    <View
      style={[
        theme.row(),
        styles.wrap,
        {
          paddingBottom: insets.bottom + 6,
          backgroundColor: theme.colors.surfaceElevated,
          borderTopColor: theme.colors.divider,
        },
      ]}
    >
      {renderRealTab('index')}
      {renderRealTab('discover')}

      {/* Create: same height/row as the other tabs, distinguished only by a
          tinted pill behind the icon — not a raised or oversized button. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.nav.create}
        onPress={() => {
          haptics.medium();
          router.push('/create');
        }}
        style={styles.tab}
        hitSlop={6}
      >
        <View style={[styles.createPill, { backgroundColor: theme.colors.primary }]}>
          <CirclePlus size={20} color={theme.colors.onPrimary} strokeWidth={2.2} />
        </View>
        <Text style={[theme.text('caption', theme.colors.primary), styles.label]} numberOfLines={1}>
          {t.nav.create}
        </Text>
      </Pressable>

      {renderRealTab('map')}

      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: inboxFocused }}
        accessibilityLabel={t.nav.inbox}
        onPress={() => {
          haptics.selection();
          router.push('/messages');
        }}
        style={styles.tab}
        hitSlop={6}
      >
        <MessageCircle
          size={23}
          color={inboxFocused ? theme.colors.primary : theme.colors.textMuted}
          strokeWidth={inboxFocused ? 2.3 : 1.9}
        />
        <Text style={[theme.text('caption', inboxFocused ? theme.colors.primary : theme.colors.textMuted), styles.label]} numberOfLines={1}>
          {t.nav.inbox}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  label: { fontSize: 11 },
  createPill: { width: 30, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
