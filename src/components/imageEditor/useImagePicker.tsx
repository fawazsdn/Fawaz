import { useCallback, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useI18n } from '@/i18n/useI18n';
import { ImageEditorModal, type AspectKey } from './ImageEditorModal';

interface Options {
  aspects: AspectKey[];
  previewShape?: 'circle' | 'card';
}

/**
 * Photo flow used by every composer (posts, events/activities, marketplace,
 * lost & found, issues, profile photo): pick from the library at full quality
 * → crop/zoom/reposition/rotate → preview → resolves with the edited local
 * JPEG (uploaded later by the backend action). Resolves null if cancelled.
 *
 *   const { pickImage, editor } = useImagePicker({ aspects: ['wide'] });
 *   ...
 *   const uri = await pickImage();
 *   return <>{...}{editor}</>;
 */
export function useImagePicker({ aspects, previewShape = 'card' }: Options) {
  const { t } = useI18n();
  const [source, setSource] = useState<{ uri: string; width: number; height: number } | null>(null);
  const resolver = useRef<((uri: string | null) => void) | null>(null);

  const finish = useCallback((uri: string | null) => {
    resolver.current?.(uri);
    resolver.current = null;
    setSource(null);
  }, []);

  const pickImage = useCallback(async (): Promise<string | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        Alert.alert(t.imageEditor.permissionTitle, t.imageEditor.permissionBody, [
          { text: t.common.cancel, style: 'cancel' },
          { text: t.imageEditor.openSettings, onPress: () => Linking.openSettings() },
        ]);
      }
      return null;
    }
    // No system editing: iOS's built-in editor is square-only and ignores
    // `aspect`, so we use our own editor for real aspect-ratio control.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false, exif: false });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return null;
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
      setSource({ uri: asset.uri, width: asset.width, height: asset.height });
    });
  }, [t]);

  const editor = (
    <ImageEditorModal
      visible={!!source}
      source={source}
      aspects={aspects}
      previewShape={previewShape}
      onCancel={() => finish(null)}
      onDone={(r) => finish(r.uri)}
    />
  );

  return { pickImage, editor };
}
