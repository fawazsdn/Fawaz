import { useState } from 'react';
import { FlatList, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSequence, withTiming, withDelay } from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';

import { useI18n } from '@/i18n/useI18n';
import { useTheme } from '@/theme/useTheme';
import { localizeDigits } from '@/utils/format';
import { ImageViewerModal } from '@/components/ImageViewerModal';
import { imageCachePolicy } from '@/backend/mediaPrivacy';

interface PhotoCarouselProps {
  images: string[];
  /** Called on double-tap. Only likes, never unlikes, like Instagram. */
  onDoubleTapLike?: () => void;
  aspectRatio?: number;
  radius?: number;
}

/** Swipeable photos with position dots; double-tap likes, single tap opens the full-screen viewer. */
export function PhotoCarousel({ images, onDoubleTapLike, aspectRatio = 1, radius }: PhotoCarouselProps) {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const heart = useSharedValue(0);
  const r = radius ?? theme.radii.md;

  const like = () => onDoubleTapLike?.();
  const open = () => setViewerOpen(true);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((_e, success) => {
      if (!success) return;
      heart.value = withSequence(withTiming(1, { duration: 140 }), withDelay(450, withTiming(0, { duration: 220 })));
      runOnJS(like)();
    });
  const singleTap = Gesture.Tap()
    .requireExternalGestureToFail(doubleTap)
    .onEnd((_e, success) => {
      if (success) runOnJS(open)();
    });

  const heartStyle = useAnimatedStyle(() => ({ opacity: heart.value, transform: [{ scale: 0.6 + heart.value * 0.5 }] }));

  if (images.length === 0) return null;
  const height = width ? width / aspectRatio : 0;

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} testID="photo-carousel">
      {width > 0 ? (
        <GestureDetector gesture={Gesture.Exclusive(doubleTap, singleTap)}>
          <View style={{ width, height, borderRadius: r, overflow: 'hidden', backgroundColor: theme.colors.backgroundAlt }}>
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(uri, i) => `${i}-${uri}`}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              onMomentumScrollEnd={(e) => setIndex(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width))}
              renderItem={({ item, index: i }) => (
                <Image
                  source={{ uri: item }}
                  cachePolicy={imageCachePolicy(item)}
                  style={{ width, height }}
                  contentFit="cover"
                  transition={150}
                  accessibilityLabel={t.social.photoOf.replace('{i}', String(i + 1)).replace('{n}', String(images.length))}
                />
              )}
            />
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, heartStyle]}>
              <Heart size={86} color="#fff" fill="#fff" />
            </Animated.View>
            {images.length > 1 ? (
              <View style={[styles.counter, { backgroundColor: theme.colors.overlay }]}>
                <Text style={styles.counterText}>
                  {localizeDigits(index + 1, locale)}/{localizeDigits(images.length, locale)}
                </Text>
              </View>
            ) : null}
          </View>
        </GestureDetector>
      ) : (
        <View style={{ aspectRatio }} />
      )}
      {images.length > 1 ? (
        <View style={styles.dots} testID="carousel-dots" accessibilityRole="adjustable" accessibilityValue={{ min: 1, max: images.length, now: index + 1 }}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, { backgroundColor: i === index ? theme.colors.primary : theme.colors.border }]}
            />
          ))}
        </View>
      ) : null}
      <ImageViewerModal visible={viewerOpen} images={images} initialIndex={index} onClose={() => setViewerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
