import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';

interface AvatarProps {
  uri?: string;
  name: string;
  size?: number;
  ring?: boolean;
}

// Haratna-brand avatar fallback palette — forest/sage/sand/terracotta/teal
// tones only, deliberately no purple (see src/theme/tokens.ts).
const PALETTE = ['#0D4939', '#83977A', '#A9660B', '#2E6B78', '#B23B2E', '#5C7A63'];

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
