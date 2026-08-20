import { act, renderHook } from '@testing-library/react-native';

import { useStore } from '@/store/useStore';
import { useI18n } from '@/i18n/useI18n';

beforeEach(() => {
  useStore.getState().resetDemoData();
});

describe('useI18n', () => {
  it('defaults to Arabic and RTL', async () => {
    const { result } = await renderHook(() => useI18n());
    expect(result.current.locale).toBe('ar');
    expect(result.current.isRTL).toBe(true);
    expect(result.current.t.appName).toBe('حارتنا');
  });

  it('switches to English and LTR when toggled', async () => {
    const { result } = await renderHook(() => useI18n());
    await act(() => result.current.toggleLocale());

    expect(useStore.getState().settings.locale).toBe('en');
    expect(result.current.isRTL).toBe(false);
    expect(result.current.t.appName).toBe('Haratna');
  });
});
