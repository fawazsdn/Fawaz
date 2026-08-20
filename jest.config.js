module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|lucide-react-native|react-native-svg|react-native-gesture-handler|react-native-reanimated|react-native-worklets|@react-native-async-storage))',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // lucide-react-native's package.json "react-native"/"import" export
    // conditions point at an ESM (.mjs) build that Jest's default
    // \.[jt]sx?$ transform never touches. Force resolution to its CJS
    // build instead, which the existing transform already covers.
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
};
