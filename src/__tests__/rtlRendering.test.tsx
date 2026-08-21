import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useStore } from '@/store/useStore';
import CreateSheetScreen from '../../app/create/index';
import SettingsScreen from '../../app/settings/index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/components/BottomSheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories can't reference out-of-scope imports
  const { View } = require('react-native');
  return {
    BottomSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => (visible ? <View>{children}</View> : null),
  };
});

const insetsFrame = { frame: { x: 0, y: 0, width: 320, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function renderWithProvider(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={insetsFrame}>{ui}</SafeAreaProvider>);
}

beforeEach(() => {
  useStore.getState().resetDemoData();
});

// The app defaults to Arabic/RTL (see src/i18n/__tests__/useI18n.test.ts) —
// these two new/redesigned screens must render correctly under that
// default, not just once English is selected.
describe('New/redesigned screens render correctly in Arabic (RTL default)', () => {
  it('Create sheet renders all option titles in Arabic', async () => {
    expect(useStore.getState().settings.locale).toBe('ar');
    await renderWithProvider(<CreateSheetScreen />);

    for (const title of ['انشر شيئاً', 'اسأل الجيران', 'أنشئ فعالية', 'بلّغ عن مشكلة', 'أوصِ بمكان', 'بيع / تبرّع', 'مفقودات', 'اطلب مساعدة']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('Profile & Settings renders the new Arabic menu groups', async () => {
    await renderWithProvider(<SettingsScreen />);

    for (const label of ['منشوراتي', 'فعالياتي', 'المحفوظات', 'مجموعاتي', 'شارك حارتنا']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
