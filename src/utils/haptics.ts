import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  light: () => isSupported && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => isSupported && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  success: () => isSupported && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => isSupported && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  selection: () => isSupported && Haptics.selectionAsync(),
};
