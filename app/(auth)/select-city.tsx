import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { useStore } from '@/store/useStore';
import { SearchBar } from '@/components/SearchBar';
import type { City } from '@/models';

export default function SelectCityScreen() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cities = useStore((s) => s.cities);
  const selectCity = useStore((s) => s.selectCity);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.nameAr.includes(q) || c.nameEn.toLowerCase().includes(q));
  }, [cities, query]);

  const popular = filtered.filter((c) => c.popular);
  const rest = filtered.filter((c) => !c.popular);

  const onSelect = (city: City) => {
    selectCity(city.slug);
    router.push('/(auth)/select-neighborhood');
  };

  const renderCity = (city: City) => (
    <Pressable
      key={city.id}
      onPress={() => onSelect(city)}
      style={[theme.row(), styles.row, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radii.md }]}
      accessibilityRole="button"
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.backgroundAlt }]}>
        <MapPin size={16} color={theme.colors.primary} />
      </View>
      <Text style={[theme.text('title'), { flex: 1 }]}>{locale === 'ar' ? city.nameAr : city.nameEn}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top + 16 }}>
      <Text style={[theme.text('heading1'), styles.title]}>{t.city.title}</Text>
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={t.city.searchPlaceholder} />
      </View>
      <FlatList
        data={[{ header: t.city.popular, items: popular }, { header: t.city.all, items: rest }]}
        keyExtractor={(section) => section.header}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}
        renderItem={({ item: section }) =>
          section.items.length > 0 ? (
            <View style={{ marginBottom: 20 }}>
              <Text style={[theme.text('caption', theme.colors.textMuted), styles.sectionLabel]}>{section.header}</Text>
              <View style={{ gap: 8 }}>{section.items.map(renderCity)}</View>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 24, marginBottom: 16 },
  searchWrap: { paddingHorizontal: 24, marginBottom: 16 },
  sectionLabel: { marginBottom: 8, textTransform: 'uppercase' },
  row: { alignItems: 'center', gap: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
