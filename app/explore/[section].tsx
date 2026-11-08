import { Redirect, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { ExploreLinks, useExploreSections } from '@/features/explore/ExploreSections';
import { useTheme } from '@/theme/useTheme';

export default function ExploreSectionScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const current = useExploreSections().find(({ id }) => id === section);
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();

  if (!current) return <Redirect href="/(tabs)/discover" />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <AppHeader title={current.label} fallbackRoute="/(tabs)/discover" />
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: bottom + theme.spacing.md }}>
        <ExploreLinks rows={current.rows} />
      </ScrollView>
    </View>
  );
}
