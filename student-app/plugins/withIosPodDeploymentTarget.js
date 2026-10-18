const { withPodfile } = require('expo/config-plugins');

const START = '# @generated begin asscubo-pod-deployment-target';
const END = '# @generated end asscubo-pod-deployment-target';

function patchPodfile(contents) {
  const clean = contents.replace(/\r\n/g, '\n').replace(
    /^[ \t]*# @generated begin asscubo-pod-deployment-target[\s\S]*?^[ \t]*# @generated end asscubo-pod-deployment-target\n?/gm,
    ''
  );
  const hook = /^([ \t]*)post_install do \|installer\|[ \t]*$/m;
  if (!hook.test(clean)) {
    throw new Error('withIosPodDeploymentTarget: Expo Podfile post_install hook not found');
  }
  return clean.replace(hook, (match, indent) => {
    const lines = [
      START,
      '# Resource bundle targets are not covered by React Native deployment target updates.',
      "minimum_ios = Gem::Version.new(podfile_properties['ios.deploymentTarget'] || '16.4')",
      'installer.pods_project.targets.each do |pod_target|',
      '  pod_target.build_configurations.each do |build_config|',
      "    current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']",
      '    if current.nil? || (current.to_s.match?(/\\A\\d+(?:\\.\\d+)*\\z/) && Gem::Version.new(current.to_s) < minimum_ios)',
      "      build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_ios.to_s",
      '    end',
      '  end',
      'end',
      END,
    ];
    return match + '\n' + lines.map(line => indent + '  ' + line).join('\n');
  });
}

module.exports = function withIosPodDeploymentTarget(config) {
  return withPodfile(config, mod => {
    mod.modResults.contents = patchPodfile(mod.modResults.contents);
    return mod;
  });
};
module.exports.patchPodfile = patchPodfile;
