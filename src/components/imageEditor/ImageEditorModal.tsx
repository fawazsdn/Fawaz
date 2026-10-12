import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { RotateCw, X } from 'lucide-react-native';

import { useTheme } from '@/theme/useTheme';
import { useI18n } from '@/i18n/useI18n';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { coverScale, cropRect, fitFrame, MAX_ZOOM, outputSize, type Size } from './cropMath';

export type AspectKey = 'square' | 'portrait' | 'wide' | 'classic' | 'original';

const ASPECTS: Record<Exclude<AspectKey, 'original'>, number> = {
  square: 1,
  portrait: 4 / 5,
  wide: 16 / 9,
  classic: 4 / 3,
};

export interface ImageEditorProps {
  visible: boolean;
  source: { uri: string; width: number; height: number } | null;
  aspects: AspectKey[];
  /** Shape of the preview: round for avatars, rounded card otherwise. */
  previewShape?: 'circle' | 'card';
  onCancel: () => void;
  onDone: (result: { uri: string; width: number; height: number }) => void;
}

/**
 * Crop / zoom / reposition / rotate editor, then a preview of the final
 * framing before it's used. All edits are applied once at full resolution by
 * expo-image-manipulator (JPEG 0.9, long edge capped at 2048px), keeping the
 * exact crop aspect so photos are never stretched.
 */
export function ImageEditorModal({ visible, source, aspects, previewShape = 'card', onCancel, onDone }: ImageEditorProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();

  const [working, setWorking] = useState<{ uri: string; width: number; height: number } | null>(source);
  const [aspectKey, setAspectKey] = useState<AspectKey>(aspects[0] ?? 'square');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ uri: string; width: number; height: number } | null>(null);

  useEffect(() => {
    setWorking(source);
    setAspectKey(aspects[0] ?? 'square');
    setPreview(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per new source
  }, [source?.uri]);

  const image: Size | null = working ? { width: working.width, height: working.height } : null;
  const aspect = aspectKey === 'original' && image ? image.width / image.height : ASPECTS[aspectKey as Exclude<AspectKey, 'original'>] ?? 1;
  const box = { width: window.width - 32, height: Math.max(220, window.height - insets.top - insets.bottom - 300) };
  const frame = useMemo(() => fitFrame(aspect, box), [aspect, box.width, box.height]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = image ? coverScale(image, frame) : 1;

  const zoom = useSharedValue(1);
  const startZoom = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  // Geometry the worklets need, mirrored into shared values.
  const geo = useSharedValue({ iw: 1, ih: 1, fw: 1, fh: 1, base: 1 });

  useEffect(() => {
    if (!image) return;
    geo.value = { iw: image.width, ih: image.height, fw: frame.width, fh: frame.height, base };
    zoom.value = 1;
    tx.value = 0;
    ty.value = 0;
  }, [image?.width, image?.height, frame.width, frame.height, base]); // eslint-disable-line react-hooks/exhaustive-deps

  const clampPan = (z: number, x: number, y: number) => {
    'worklet';
    const g = geo.value;
    const s = g.base * z;
    const lx = Math.max(0, (g.iw * s - g.fw) / 2);
    const ly = Math.max(0, (g.ih * s - g.fh) / 2);
    return { x: Math.min(lx, Math.max(-lx, x)), y: Math.min(ly, Math.max(-ly, y)) };
  };

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      const c = clampPan(zoom.value, startX.value + e.translationX, startY.value + e.translationY);
      tx.value = c.x;
      ty.value = c.y;
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startZoom.value = zoom.value;
    })
    .onUpdate((e) => {
      const z = Math.min(MAX_ZOOM, Math.max(1, startZoom.value * e.scale));
      zoom.value = z;
      const c = clampPan(z, tx.value, ty.value);
      tx.value = c.x;
      ty.value = c.y;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      zoom.value = withTiming(1);
      tx.value = withTiming(0);
      ty.value = withTiming(0);
    });

  const gestures = Gesture.Simultaneous(pan, pinch, doubleTap);

  const imageStyle = useAnimatedStyle(() => {
    const g = geo.value;
    return {
      width: g.iw * g.base,
      height: g.ih * g.base,
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: zoom.value }],
    };
  });

  const rotate = async () => {
    if (!working || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ctx = ImageManipulator.manipulate(working.uri).rotate(90);
      const ref = await ctx.renderAsync();
      const out = await ref.saveAsync({ compress: 1, format: SaveFormat.JPEG });
      setWorking({ uri: out.uri, width: out.width, height: out.height });
    } catch {
      setError(t.imageEditor.failed);
    } finally {
      setBusy(false);
    }
  };

  const finishCrop = async () => {
    if (!working || !image || busy) return;
    setBusy(true);
    setError(null);
    try {
      const rect = cropRect(image, frame, { scale: zoom.value, tx: tx.value, ty: ty.value });
      let ctx = ImageManipulator.manipulate(working.uri).crop(rect);
      const resize = outputSize(rect);
      if (resize) ctx = ctx.resize(resize);
      const ref = await ctx.renderAsync();
      const out = await ref.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
      setPreview({ uri: out.uri, width: out.width, height: out.height });
    } catch {
      setError(t.imageEditor.failed);
    } finally {
      setBusy(false);
    }
  };

  const aspectLabel = (k: AspectKey) =>
    k === 'original' ? t.imageEditor.original : k === 'square' ? t.imageEditor.square : k === 'portrait' ? t.imageEditor.portrait : k === 'wide' ? t.imageEditor.wide : '4:3';

  if (!visible || !source) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0B0F0D' }}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.common.cancel} style={styles.headerBtn}>
            <X size={22} color="#fff" />
          </Pressable>
          <Text style={theme.text('title', '#fff')}>{preview ? t.imageEditor.previewTitle : t.imageEditor.title}</Text>
          {preview ? (
            <View style={styles.headerBtn} />
          ) : (
            <Pressable onPress={rotate} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.imageEditor.rotate} style={styles.headerBtn} disabled={busy}>
              <RotateCw size={21} color="#fff" />
            </Pressable>
          )}
        </View>

        {preview ? (
          <View style={styles.center}>
            <Image
              source={{ uri: preview.uri }}
              contentFit="cover"
              style={[
                previewShape === 'circle'
                  ? { width: 220, height: 220, borderRadius: 110 }
                  : { width: box.width, height: box.width / (preview.width / preview.height), maxHeight: box.height, borderRadius: theme.radii.lg },
              ]}
            />
          </View>
        ) : (
          <View style={styles.center}>
            <View style={{ width: frame.width, height: frame.height, overflow: 'hidden', borderRadius: previewShape === 'circle' ? frame.width / 2 : 4 }}>
              <GestureDetector gesture={gestures}>
                <View style={[StyleSheet.absoluteFill, styles.center]} collapsable={false}>
                  <Animated.View style={imageStyle}>
                    <Image source={{ uri: working?.uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
                  </Animated.View>
                </View>
              </GestureDetector>
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.grid, { borderRadius: previewShape === 'circle' ? frame.width / 2 : 4 }]} />
            </View>
            <Text style={[theme.text('caption', '#ffffffaa'), { marginTop: 12 }]}>{t.imageEditor.hint}</Text>
          </View>
        )}

        <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12, gap: 12 }}>
          {error ? <Text style={[theme.text('bodySmall', theme.colors.danger), { textAlign: 'center' }]}>{error}</Text> : null}
          {!preview && aspects.length > 1 ? (
            <View style={[theme.row(), { gap: 8, justifyContent: 'center', flexWrap: 'wrap' }]}>
              {aspects.map((k) => (
                <Chip key={k} label={aspectLabel(k)} selected={aspectKey === k} onPress={() => setAspectKey(k)} />
              ))}
            </View>
          ) : null}
          {busy ? (
            <View style={[theme.row(), { justifyContent: 'center', gap: 8, paddingVertical: 12 }]}>
              <ActivityIndicator color="#fff" />
              <Text style={theme.text('bodySmall', '#fff')}>{t.imageEditor.processing}</Text>
            </View>
          ) : preview ? (
            <View style={[theme.row(), { gap: 10 }]}>
              <View style={{ flex: 1 }}>
                <Button label={t.imageEditor.editAgain} variant="outline" onPress={() => setPreview(null)} fullWidth />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={t.imageEditor.usePhoto} onPress={() => onDone(preview)} fullWidth />
              </View>
            </View>
          ) : (
            <Button label={t.imageEditor.preview} onPress={finishCrop} fullWidth size="lg" />
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { borderWidth: 1, borderColor: '#ffffffcc' },
});
