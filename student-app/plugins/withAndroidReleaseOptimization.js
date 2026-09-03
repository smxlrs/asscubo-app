const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Keep release optimization in the generated Expo Android project.
 * The native android directory is generated and ignored by Git, so this
 * must be applied during every EAS/prebuild run.
 */
module.exports = function withAndroidReleaseOptimization(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    contents = contents.replace(
      /def enableMinifyInReleaseBuilds\s*=\s*\(findProperty\('android\.enableMinifyInReleaseBuilds'\) \?: false\)\.toBoolean\(\)/,
      "def enableMinifyInReleaseBuilds = (findProperty('android.enableMinifyInReleaseBuilds') ?: true).toBoolean()"
    );
    contents = contents.replace(
      /def enableShrinkResources\s*=\s*findProperty\('android\.enableShrinkResourcesInReleaseBuilds'\) \?: 'false'/,
      "def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'true'"
    );

    config.modResults.contents = contents;
    return config;
  });
};
