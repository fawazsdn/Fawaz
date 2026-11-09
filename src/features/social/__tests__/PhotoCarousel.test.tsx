import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { resetStoreForTests } from '@/testing/fixtures';
import { PhotoCarousel } from '../PhotoCarousel';

jest.mock('react-native-gesture-handler', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference out-of-scope imports
  const { View } = require('react-native');
  const gesture = (): unknown => new Proxy({}, { get: (_t, prop) => (prop === 'then' ? undefined : () => gesture()) });
  return {
    Gesture: new Proxy({}, { get: () => () => gesture() }),
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    GestureHandlerRootView: View,
  };
});

const frame = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderScreen = (ui: React.ReactElement) => render(<SafeAreaProvider initialMetrics={frame}>{ui}</SafeAreaProvider>);

beforeEach(() => resetStoreForTests());

describe('PhotoCarousel', () => {
  it('shows one position dot per photo, and none for a single photo', async () => {
    const many = await renderScreen(<PhotoCarousel images={['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg']} />);
    expect(many.getByTestId('carousel-dots').props.accessibilityValue).toEqual({ min: 1, max: 3, now: 1 });
    many.unmount();
    const one = await renderScreen(<PhotoCarousel images={['https://x/1.jpg']} />);
    expect(one.queryByTestId('carousel-dots')).toBeNull();
  });
});
