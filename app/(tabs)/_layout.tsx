import { Tabs } from 'expo-router/js-tabs';

import { CustomTabBar } from '@/features/navigation/CustomTabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="community" />
    </Tabs>
  );
}
