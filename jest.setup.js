jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key, value) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key) => {
        delete store[key];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
      getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
    },
  };
});

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text } = require('react-native');

  const passthrough = (Component) => {
    const Wrapped = React.forwardRef((props, ref) => React.createElement(Component, { ...props, ref }));
    Wrapped.displayName = `Animated(${Component.displayName || Component.name || 'Component'})`;
    return Wrapped;
  };

  const Animated = {
    View: passthrough(View),
    Text: passthrough(Text),
    createAnimatedComponent: (Component) => passthrough(Component),
  };

  return {
    __esModule: true,
    default: Animated,
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (fn) => fn(),
    useDerivedValue: (fn) => ({ value: fn() }),
    withTiming: (toValue, _config, callback) => {
      if (callback) callback(true);
      return toValue;
    },
    withDelay: (_delay, animation) => animation,
    withRepeat: (animation) => animation,
    withSpring: (toValue) => toValue,
    runOnJS:
      (fn) =>
      (...args) =>
        fn(...args),
    Easing: { linear: (x) => x, inOut: () => (x) => x, out: () => (x) => x, cubic: (x) => x },
    FadeIn: { duration: () => ({ delay: () => ({}) }) },
    FadeInDown: { duration: () => ({ delay: () => ({}) }) },
  };
});

jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler/jestSetup');
  return actual;
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

// ---------------------------------------------------------------------------
// Offline test environment: no test may reach the real Supabase project.
// A chainable no-op query builder resolves every query to empty data.
// ---------------------------------------------------------------------------
jest.mock('@/lib/supabase', () => {
  const result = { data: [], error: null, count: 0 };
  const builder = () => {
    const b = new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (prop === 'then') return (resolve) => resolve(result);
          if (prop === 'single' || prop === 'maybeSingle') return () => Promise.resolve({ data: null, error: null });
          return () => b;
        },
      },
    );
    return b;
  };
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: jest.fn(() => builder()),
      rpc: jest.fn(() => Promise.resolve({ data: null, error: null })),
      channel: jest.fn(() => channel),
      removeChannel: jest.fn(() => Promise.resolve()),
      functions: { invoke: jest.fn(() => Promise.resolve({ data: null, error: null })) },
      storage: {
        from: () => ({
          upload: jest.fn(() => Promise.resolve({ error: null })),
          createSignedUrls: jest.fn(() => Promise.resolve({ data: [], error: null })),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        }),
      },
      auth: {
        getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
        signInWithPassword: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(() => Promise.resolve({ error: null })),
        resend: jest.fn(),
        resetPasswordForEmail: jest.fn(),
        updateUser: jest.fn(),
        exchangeCodeForSession: jest.fn(),
        signInWithIdToken: jest.fn(),
        signInWithOAuth: jest.fn(),
      },
    },
  };
});

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MapView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
    return React.createElement(View, { testID: 'map-view' }, props.children);
  });
  const Marker = (props) => React.createElement(View, { testID: `marker-${props.identifier}`, accessibilityLabel: props.title });
  const Polygon = () => null;
  return { __esModule: true, default: MapView, Marker, Polygon };
});

jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));
