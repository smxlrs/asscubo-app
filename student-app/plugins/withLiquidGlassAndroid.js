const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SOURCE_FILES = [
  'LiquidGlassView.kt',
  'LiquidGlassViewManager.kt',
  'LiquidGlassPackage.kt',
];

module.exports = function withLiquidGlassAndroid(config) {
  return withDangerousMod(config, ['android', async (config) => {
    const packageName = config.android?.package;
    if (!packageName) {
      throw new Error('withLiquidGlassAndroid requires android.package in app config.');
    }

    const packagePath = packageName.replace(/\./g, path.sep);
    const javaDir = path.join(
      config.modRequest.platformProjectRoot,
      'app',
      'src',
      'main',
      'java',
      packagePath
    );
    const sourceDir = path.join(__dirname, 'liquid-glass-android');
    fs.mkdirSync(javaDir, { recursive: true });

    for (const fileName of SOURCE_FILES) {
      const source = fs.readFileSync(path.join(sourceDir, fileName), 'utf8');
      fs.writeFileSync(
        path.join(javaDir, fileName),
        source.replace(/^package\s+[^\r\n]+/m, `package ${packageName}`)
      );
    }

    const applicationPath = path.join(javaDir, 'MainApplication.kt');
    const application = fs.readFileSync(applicationPath, 'utf8');
    if (!application.includes('add(LiquidGlassPackage())')) {
      fs.writeFileSync(
        applicationPath,
        application.replace(
          'PackageList(this).packages.apply {',
          'PackageList(this).packages.apply {\n          add(LiquidGlassPackage())'
        )
      );
    }

    return config;
  }]);
};
