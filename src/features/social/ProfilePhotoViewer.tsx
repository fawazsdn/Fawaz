import { useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Camera, Trash2, X } from 'lucide-react-native';

import { useI18n } from '@/i18n/useI18n';
import { useAction } from '@/hooks/useAction';
import { changeAvatar, removeAvatar } from '@/backend/social';
import { useImagePicker } from '@/components/imageEditor/useImagePicker';
import { Avatar } from '@/components/Avatar';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { ZoomableImage } from '@/components/ZoomableImage';

interface ProfilePhotoViewerProps {
  visible: boolean;
  uri?: string;
  name: string;
  isOwn: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

const { width: W, height: H } = Dimensions.get('window');

/**
 * Full-screen profile photo: pinch to zoom, loading state, initials when
 * there's no photo. The owner can change or remove it. Only shown for a
 * profile the viewer is already allowed to open, so it never widens access.
 */
export function ProfilePhotoViewer({ visible, uri, name, isOwn, onClose, onChanged }: ProfilePhotoViewerProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { run, pending } = useAction();
  const { pickImage, editor } = useImagePicker({ aspects: ['square'], previewShape: 'circle' });
  const [confirmRemove, setConfirmRemove] = useState(false);

  const change = async () => {
    const local = await pickImage();
    if (!local) return;
    const res = await run(() => changeAvatar(local, uri));
    if (res.ok) onChanged?.();
  };
  const remove = async () => {
    setConfirmRemove(false);
    const res = await run(() => removeAvatar(uri));
    if (res.ok) {
      onChanged?.();
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent presentationStyle="overFullScreen" transparent>
      <GestureHandlerRootView style={styles.backdrop}>
        <View style={styles.center} accessibilityLabel={t.social.profilePhoto}>
          {uri ? (
            <ZoomableImage uri={uri} width={W} height={H * 0.7} accessibilityLabel={t.social.profilePhoto} />
          ) : (
            <Avatar name={name} size={Math.min(W * 0.6, 260)} />
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.social.close}
          onPress={onClose}
          style={[styles.close, { top: insets.top + 12 }]}
          hitSlop={10}
          testID="photo-viewer-close"
        >
          <X size={22} color="#fff" />
        </Pressable>

        {isOwn ? (
          <View style={[styles.actions, { bottom: insets.bottom + 24 }]}>
            <Pressable onPress={change} disabled={pending} style={styles.action} accessibilityRole="button" testID="photo-change">
              <Camera size={18} color="#fff" />
              <Text style={styles.actionText}>{t.social.changePhoto}</Text>
            </Pressable>
            {uri ? (
              <Pressable
                onPress={() => setConfirmRemove(true)}
                disabled={pending}
                style={styles.action}
                accessibilityRole="button"
                testID="photo-remove"
              >
                <Trash2 size={18} color="#fff" />
                <Text style={styles.actionText}>{t.social.removePhoto}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <ConfirmationModal
          visible={confirmRemove}
          title={t.social.removePhotoConfirm}
          confirmLabel={t.social.removePhoto}
          destructive
          onCancel={() => setConfirmRemove(false)}
          onConfirm={remove}
        />
        {editor}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  close: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', gap: 12 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
