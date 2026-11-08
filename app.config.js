module.exports = ({ config }) => {
  const iosGoogleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY?.trim();
  if (!iosGoogleMapsApiKey) return config;
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ['react-native-maps', { iosGoogleMapsApiKey }]],
    extra: { ...config.extra, googleMapsIosEnabled: true },
  };
};
