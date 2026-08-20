import { useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ImageViewerModalProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function ImageViewerModal({ visible, images, initialIndex = 0, onClose }: ImageViewerModalProps) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_WIDTH, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: item }} style={{ width: SCREEN_WIDTH, height: '100%' }} contentFit="contain" />
            </View>
          )}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="close"
          onPress={onClose}
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          hitSlop={10}
        >
          <X size={22} color="#fff" />
        </Pressable>
        {images.length > 1 ? (
          <View style={[styles.counter, { bottom: insets.bottom + 20 }]}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, { opacity: i === index ? 1 : 0.4 }]} />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  closeBtn: { position: 'absolute', right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  counter: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
});
