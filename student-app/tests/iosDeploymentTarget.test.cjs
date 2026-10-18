const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const plugin = require('../plugins/withIosPodDeploymentTarget');
async function template() {
  // Unmodified Podfile from expo@56.0.11/template.tgz.
  return fs.readFileSync(path.join(__dirname, 'fixtures/expo56.Podfile'), 'utf8');
}
test('patch applies to installed Expo56 template and covers resource bundle configurations', async () => {
  const original = await template();
  const result = plugin.patchPodfile(original);
  assert.equal((result.match(/post_install do/g) || []).length, 1);
  assert.ok(result.includes('installer.pods_project.targets.each'));
  assert.ok(result.includes('pod_target.build_configurations.each'));
  assert.ok(result.includes("podfile_properties['ios.deploymentTarget'] || '16.4'"));
  assert.ok(result.includes('Gem::Version.new(current.to_s) < minimum_ios'));
  assert.ok(result.includes('current.nil?'));
  assert.ok(result.includes('/\\A\\d+(?:\\.\\d+)*\\z/'));
  // Higher deployment requirements remain untouched; retain all original Podfile lines.
  for(const line of original.split('\n').filter(line=>line.trim())) assert.ok(result.includes(line), line);
});
test('plugin is idempotent across repeated prebuilds and handles Windows line endings', async () => {
  const original = await template();
  const once = plugin.patchPodfile(original);
  assert.equal(plugin.patchPodfile(once), once);
  assert.equal(plugin.patchPodfile(original.replace(/\n/g,'\r\n')), once);
});
test('unrecognized Podfile fails explicitly rather than silently producing a broken build', () => {
  assert.throws(()=>plugin.patchPodfile("platform :ios, '16.4'"), /post_install hook not found/);
});
test('application config registers iOS-only fix and preserves existing app plugins', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')).expo;
  assert.equal(config.ios.deploymentTarget, '16.4');
  for(const name of ['./plugins/withIosPodDeploymentTarget','./plugins/withViaggiaTrenoNetworkSecurity','./plugins/withLiquidGlassAndroid','expo-notifications']) assert.ok(config.plugins.some(entry=>(Array.isArray(entry)?entry[0]:entry)===name));
});
