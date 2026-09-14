const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const RESOURCE_NAME = 'network_security_config.xml';
const RESOURCE_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">viaggiatreno.it</domain>
    </domain-config>
</network-security-config>
`;

module.exports = function withViaggiaTrenoNetworkSecurity(config) {
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('withViaggiaTrenoNetworkSecurity could not find the Android application.');
    }

    application.$ = application.$ || {};
    application.$['android:networkSecurityConfig'] = `@xml/${RESOURCE_NAME.replace('.xml', '')}`;
    return config;
  });

  return withDangerousMod(config, ['android', async (config) => {
    const resourceDir = path.join(
      config.modRequest.platformProjectRoot,
      'app',
      'src',
      'main',
      'res',
      'xml'
    );
    fs.mkdirSync(resourceDir, { recursive: true });
    fs.writeFileSync(path.join(resourceDir, RESOURCE_NAME), RESOURCE_CONTENT, 'utf8');
    return config;
  }]);
};
