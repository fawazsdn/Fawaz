import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Calendar, Home, Plus, Search, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { haptics } from '@/utils/haptics';

const ICONS = { index: Home, discover: Search, events: Calendar, community: Users } as const;

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const labelFor = (name: string) =>
    ({ index: t.nav.home, discover: t.nav.discover, events: t.nav.events, community: t.nav.community })[name] ?? name;

  const leftRoutes = state.routes.slice(0, 2);
  const rightRoutes = state.routes.slice(2);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const routeIndex = state.routes.findIndex((r) => r.key === route.key);
    const focused = state.index === routeIndex;
    const Icon = ICONS[route.name as keyof typeof ICONS] ?? Home;

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={labelFor(route.name)}
        onPress={() => {
          haptics.selection();
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        style={styles.tab}
        hitSlop={6}
      >
        <Icon size={23} color={focused ? theme.colors.primary : theme.colors.textMuted} strokeWidth={focused ? 2.3 : 1.9} />
        <Text style={[theme.text('caption', focused ? theme.colors.primary : theme.colors.textMuted), styles.label]} numberOfLines={1}>
          {labelFor(route.name)}
        </Text>
      </Pressable>
    );
  };

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
      {leftRoutes.map(renderTab)}

      <View style={styles.createWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.nav.create}
          onPress={() => {
            haptics.medium();
            router.push('/create');
          }}
          style={({ pressed }) => [
            styles.createButton,
            {
              backgroundColor: theme.colors.primary,
              borderColor: theme.colors.surfaceElevated,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
        >
          <Plus size={26} color={theme.colors.onPrimary} strokeWidth={2.4} />
        </Pressable>
      </View>

      {rightRoutes.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  label: { fontSize: 11 },
  createWrap: { width: 64, alignItems: 'center' },
  createButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    borderWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
