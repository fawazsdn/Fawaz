import { Tabs } from 'expo-router/js-tabs';

import { CustomTabBar } from '@/features/navigation/CustomTabBar';

// Home / Explore / Map are real parallel tab routes. Create and Inbox are
// rendered as matching bottom-bar buttons by CustomTabBar but navigate via
// router.push (Create opens a stack sheet at /create; Inbox pushes /messages)
// rather than being registered Tabs.Screen entries — see CustomTabBar.tsx
// for why. Events and Community moved to root-level routes (/events,
// /community): reachable from Explore/Home, same as every other detail
// screen in the app, without needing to live in the tab bar.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="map" />
    </Tabs>
  );
}
