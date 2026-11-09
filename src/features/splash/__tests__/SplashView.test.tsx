import { render, screen } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';

import { resetStoreForTests } from '@/testing/fixtures';
import { SPLASH_BACKGROUND, SplashView } from '../SplashView';

const root = join(__dirname, '../../../..');

beforeEach(() => resetStoreForTests());

describe('Splash branding', () => {
  it('shows the approved N2 logo, the name and the tagline on dark green', async () => {
    await render(<SplashView />);
    expect(screen.getByTestId('splash-logo')).toBeTruthy();
    expect(screen.getByText('حارتنا')).toBeTruthy();
    expect(screen.getByText('حارتك، مجتمعك.')).toBeTruthy();
    expect(screen.queryByText('ح')).toBeNull();
    expect(screen.getByTestId('splash')).toHaveStyle({ backgroundColor: SPLASH_BACKGROUND });
  });

  it('uses the N2 asset for the native splash and Home Screen icon, with matching colors', () => {
    const config = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;
    expect(config.icon).toBe('./assets/haratna-n2.png');
    expect(config.ios.icon ?? config.icon).toBe('./assets/haratna-n2.png');
    const splash = config.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
    expect(splash.image).toBe('./assets/haratna-n2-splash.png');
    expect(splash.backgroundColor).toBe(SPLASH_BACKGROUND);
    const src = readFileSync(join(root, 'src/features/splash/SplashView.tsx'), 'utf8');
    expect(src).toContain("assets/haratna-n2.png");
  });
});
