import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { imageCachePolicy } from '@/backend/mediaPrivacy';

interface ZoomableImageProps {
  uri: string;
  width: number;
  height: number;
  accessibilityLabel?: string;
}

/** Pinch to zoom (1x-4x), pan while zoomed, double-tap to toggle 2x. Shows a spinner until loaded. */
export function ZoomableImage({ uri, width, height, accessibilityLabel }: ZoomableImageProps) {
  const [loading, setLoading] = useState(true);
  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    saved.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(4, Math.max(1, saved.value * e.scale));
    })
    .onEnd(() => {
      saved.value = scale.value;
      if (scale.value <= 1.01) reset();
    });

  // Only pans while zoomed, so the parent pager still swipes between photos at 1x.
  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_e, state) => {
      if (saved.value > 1) state.activate();
      else state.fail();
    })
    .onUpdate((e) => {
      const maxX = ((saved.value - 1) * width) / 2;
      const maxY = ((saved.value - 1) * height) / 2;
      tx.value = Math.min(maxX, Math.max(-maxX, savedTx.value + e.translationX));
      ty.value = Math.min(maxY, Math.max(-maxY, savedTy.value + e.translationY));
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (saved.value > 1) reset();
      else {
        scale.value = withTiming(2);
        saved.value = 2;
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ width, height }, style]}>
          <Image
            source={{ uri }}
            cachePolicy={imageCachePolicy(uri)}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
            accessibilityLabel={accessibilityLabel}
            accessible
          />
        </Animated.View>
        {loading ? <ActivityIndicator style={StyleSheet.absoluteFill} color="#fff" testID="image-loading" /> : null}
      </View>
    </GestureDetector>
  );
}
