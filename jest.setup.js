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
