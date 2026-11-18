const { withAndroidManifest } = require('@expo/config-plugins');

// Preserve the portrait UI without making portrait hardware an installation requirement.
// Keep this in a config plugin because the native Android project is generated.
module.exports = function withOptionalPortraitFeature(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const name = 'android.hardware.screen.portrait';
    const features = manifest['uses-feature'] || [];
    const portrait = features.find((feature) => feature.$?.['android:name'] === name) || {};
    portrait.$ = { ...portrait.$, 'android:name': name, 'android:required': 'false' };
    manifest['uses-feature'] = [
      ...features.filter((feature) => feature.$?.['android:name'] !== name),
      portrait,
    ];
    return config;
  });
};
