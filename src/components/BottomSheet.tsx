import { useEffect } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightRatio?: number;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function BottomSheet({ visible, onClose, children, maxHeightRatio = 0.88 }: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 280 });
      backdropOpacity.value = withTiming(1, { duration: 280 });
    }
  }, [visible, translateY, backdropOpacity]);

  const close = () => {
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 });
    backdropOpacity.value = withTiming(0, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 100 || e.velocityY > 800) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = withTiming(0, { duration: 180 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="close" onPress={close} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.sheet,
              sheetStyle,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderTopLeftRadius: theme.radii.xl,
                borderTopRightRadius: theme.radii.xl,
                paddingBottom: insets.bottom + theme.spacing.md,
                maxHeight: SCREEN_HEIGHT * maxHeightRatio,
              },
              theme.shadows.sheet,
            ]}
          >
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
});
