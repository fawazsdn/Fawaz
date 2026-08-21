import { act, cleanup, renderHook } from '@testing-library/react-native';

import { useSafeBack } from '../useSafeBack';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
    push: jest.fn(),
  }),
}));

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
  mockCanGoBack.mockReset();
});

afterEach(async () => {
  await cleanup();
});

// Regresses the real "GO_BACK was not handled by any navigator" crash:
// plain router.back() assumes navigation history exists, which is false
// on a direct URL open, a web refresh, or a deep link (WhatsApp share,
// referral invite) landing straight on a screen.
describe('useSafeBack', () => {
  it('goes back normally when navigation history exists', async () => {
    mockCanGoBack.mockReturnValue(true);
    const { result } = await renderHook(() => useSafeBack('/events'));

    await act(async () => {
      result.current();
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('replaces to the fallback route when there is no history to go back to', async () => {
    mockCanGoBack.mockReturnValue(false);
    const { result } = await renderHook(() => useSafeBack('/events'));

    await act(async () => {
      result.current();
    });

    expect(mockReplace).toHaveBeenCalledWith('/events');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('uses replace (not push) for the fallback, so it never becomes a poppable dead end itself', async () => {
    mockCanGoBack.mockReturnValue(false);
    const { result } = await renderHook(() => useSafeBack('/'));

    await act(async () => {
      result.current();
    });
    await act(async () => {
      result.current();
    });

    // Calling the safe-back handler repeatedly with no history each time
    // must keep replacing, not stack up pushes that could themselves be
    // popped back into (which would reintroduce the same crash).
    expect(mockReplace).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenNthCalledWith(1, '/');
    expect(mockReplace).toHaveBeenNthCalledWith(2, '/');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('respects a different fallback per call site rather than a single blanket default', async () => {
    mockCanGoBack.mockReturnValue(false);
    const { result: eventsResult } = await renderHook(() => useSafeBack('/events'));
    await act(async () => {
      eventsResult.current();
    });
    await cleanup();

    const { result: marketplaceResult } = await renderHook(() => useSafeBack('/marketplace'));
    await act(async () => {
      marketplaceResult.current();
    });

    expect(mockReplace).toHaveBeenNthCalledWith(1, '/events');
    expect(mockReplace).toHaveBeenNthCalledWith(2, '/marketplace');
  });
});
