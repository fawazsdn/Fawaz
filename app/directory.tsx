import { Redirect } from 'expo-router';

/**
 * The old neighborhood directory listed every resident the app had loaded.
 * Residents are now listed only through opt-in Neighbors discovery, so this
 * route forwards there (kept so existing links don't break).
 */
export default function DirectoryScreen() {
  return <Redirect href="/neighbors" />;
}
