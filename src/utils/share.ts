import { Linking, Platform, Share } from 'react-native';

/**
 * The one place every "Share" button in the app calls through — so no
 * screen builds its own ad hoc share text/URL, and no Share button is
 * ever left wired to nothing (a "decorative dead" button).
 *
 * Uses React Native's built-in native share sheet (`Share.share`) — no
 * extra native module/config needed, works in Expo Go and dev/production
 * builds alike. iOS keeps `message` and `url` separate (its share sheet
 * renders them as distinct fields); other platforms don't have a
 * dedicated `url` field, so the link is appended into the message text.
 */
export async function shareContent(params: { title?: string; message: string; url?: string }): Promise<void> {
  const { title, message, url } = params;
  try {
    if (Platform.OS === 'ios' && url) {
      await Share.share({ message, url, title });
    } else {
      await Share.share({ message: url ? `${message}\n${url}` : message, title });
    }
  } catch {
    // User cancelled the share sheet, or the platform rejected it — not a
    // crash-worthy failure, nothing further to do.
  }
}

/**
 * Opens WhatsApp directly with a pre-filled message, via the universal
 * `wa.me` link — works whether or not WhatsApp is installed (falls back to
 * wa.me's own "install WhatsApp" page in a browser), needs no extra native
 * module/entitlement, and is the first-class sharing path this app's
 * primary growth loop is built around (see docs "WhatsApp viral growth").
 * Returns false if the OS couldn't open the link at all, so callers can
 * fall back to the native share sheet.
 */
export async function openWhatsApp(message: string): Promise<boolean> {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
