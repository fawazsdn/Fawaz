import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

interface AvatarProps {
  uri?: string;
  name: string;
  size?: number;
  ring?: boolean;
}

const PALETTE = ['#1F5D45', '#A9660B', '#2F6E8C', '#B23B2E', '#6E8F72', '#8B5CF6'];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function Avatar({ uri, name, size = 40, ring = false }: AvatarProps) {
  const theme = useTheme();
  const initial = name.trim().charAt(0) || '؟';
  const bg = colorFor(name);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring ? 2 : 0,
          borderColor: theme.colors.primary,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
          <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '700' }}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
