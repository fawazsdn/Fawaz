import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { useTheme } from '@/theme/useTheme';
import { ImageViewerModal } from './ImageViewerModal';

interface ImageGalleryProps {
  images: string[];
  radius?: number;
  maxHeight?: number;
}

export function ImageGallery({ images, radius, maxHeight = 320 }: ImageGalleryProps) {
  const theme = useTheme();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const r = radius ?? theme.radii.md;

  if (images.length === 0) return null;

  const open = (i: number) => setViewerIndex(i);

  if (images.length === 1) {
    return (
      <>
        <Pressable onPress={() => open(0)} accessibilityRole="imagebutton">
          <Image
            source={{ uri: images[0] }}
            style={{ width: '100%', height: maxHeight, borderRadius: r }}
            contentFit="cover"
            transition={150}
          />
        </Pressable>
        <ImageViewerModal
          visible={viewerIndex !== null}
          images={images}
          initialIndex={viewerIndex ?? 0}
          onClose={() => setViewerIndex(null)}
        />
      </>
    );
  }

  if (images.length === 2) {
    return (
      <>
        <View style={[styles.row, { gap: 4 }]}>
          {images.map((uri, i) => (
            <Pressable key={i} onPress={() => open(i)} style={{ flex: 1 }} accessibilityRole="imagebutton">
              <Image
                source={{ uri }}
                style={{ width: '100%', height: maxHeight * 0.7, borderRadius: r }}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          ))}
        </View>
        <ImageViewerModal
          visible={viewerIndex !== null}
          images={images}
          initialIndex={viewerIndex ?? 0}
          onClose={() => setViewerIndex(null)}
        />
      </>
    );
  }

  if (images.length === 3) {
    return (
      <>
        <View style={[styles.row, { gap: 4, height: maxHeight * 0.75 }]}>
          <Pressable onPress={() => open(0)} style={{ flex: 1.4 }} accessibilityRole="imagebutton">
            <Image
              source={{ uri: images[0] }}
              style={{ width: '100%', height: '100%', borderRadius: r }}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            {images.slice(1, 3).map((uri, i) => (
              <Pressable key={i} onPress={() => open(i + 1)} style={{ flex: 1 }} accessibilityRole="imagebutton">
                <Image source={{ uri }} style={{ width: '100%', height: '100%', borderRadius: r }} contentFit="cover" transition={150} />
              </Pressable>
            ))}
          </View>
        </View>
        <ImageViewerModal
          visible={viewerIndex !== null}
          images={images}
          initialIndex={viewerIndex ?? 0}
          onClose={() => setViewerIndex(null)}
        />
      </>
    );
  }

  const extra = images.length - 4;
  return (
    <>
      <View style={[styles.grid, { gap: 4, height: maxHeight * 0.75 }]}>
        {images.slice(0, 4).map((uri, i) => (
          <Pressable key={i} onPress={() => open(i)} style={styles.gridItem} accessibilityRole="imagebutton">
            <Image source={{ uri }} style={{ width: '100%', height: '100%', borderRadius: r }} contentFit="cover" transition={150} />
            {i === 3 && extra > 0 ? (
              <View style={[StyleSheet.absoluteFill, styles.moreOverlay, { borderRadius: r }]}>
                <Text style={styles.moreText}>+{extra}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
      <ImageViewerModal
        visible={viewerIndex !== null}
        images={images}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '49.5%', height: '49.5%' },
  moreOverlay: { backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  moreText: { color: '#fff', fontSize: 22, fontWeight: '700' },
});
