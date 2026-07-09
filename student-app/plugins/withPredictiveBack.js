const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withPredictiveBack(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults
    );

    mainApplication.$['android:enableOnBackInvokedCallback'] = 'true';

    return config;
  });
};
