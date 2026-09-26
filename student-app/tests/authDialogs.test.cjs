const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

// Exercise screen event handlers with mocked native views and Supabase.
// UIKit presentation itself still needs an iPhone smoke test.
function screen(file, os = 'ios', verifyError = null) {
  const slots = [], alerts = [], calls = [], timers = [];
  let cursor = 0;
  const useState = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], value => { slots[index] = value; }];
  };
  const react = {
    useState, useRef: value => useState({ current: value })[0],
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  };
  const alert = (...args) => alerts.push(args);
  const native = new Proxy({
    Platform: { OS: os }, Keyboard: { dismiss() {} },
    StyleSheet: { create: value => value, absoluteFill: {}, hairlineWidth: 1 },
  }, { get: (target, key) => target[key] || key });
  const modules = {
    react, 'react-native': native,
    'expo-router': { router: { back() {}, push() {}, replace() {} }, Link: 'Link' },
    '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    'expo-image-picker': {},
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0 }) },
    '../../context/ThemeContext': { useTheme: () => ({ colors: {}, language: 'zh', t: key => key }) },
    '../../context/AuthContext': { useAuth: () => ({
      user: { email: 'member@example.com' }, profile: {}, refreshProfile: async () => {},
      signIn: async () => ({ error: { message: 'Invalid login credentials' } }),
    }) },
    '../../hooks/useOtpCooldown': { useOtpCooldown: () => ({ remaining: 0, startCooldown() {}, resetCooldown() {} }) },
    '../../lib/supabase': { translateAuthError: value => value, supabase: { auth: {
      verifyOtp: async args => { calls.push(['verify', args]); return { error: verifyError }; },
      updateUser: async args => { calls.push(['update', args]); return { error: null }; },
      resetPasswordForEmail: async () => ({ error: null }),
    } } },
    '../../lib/customAlert': { showCustomAlert: alert },
    '../../lib/appAlert': { appAlert: { alert } },
    '../../assets/images/logo.png': 'logo',
  };
  const context = { exports: {}, console: { error() {} }, setTimeout: fn => timers.push(fn),
    require: name => { assert.ok(name in modules, name); return modules[name]; } };
  vm.runInNewContext(ts.transpileModule(readFileSync(path.join(__dirname, '../app', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, context);
  return { alerts, calls, timers, render() { cursor = 0; return context.exports.default(); } };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (typeof tree.type === 'function') return nodes(tree.type(tree.props));
  return [tree, ...nodes(tree.props.children)];
}
function button(tree, name) {
  return nodes(tree).find(node => node.type === 'Pressable' && node.props.onPress?.name === name);
}
function openPassword(h) {
  const open = nodes(h.render()).find(node => node.type === 'Pressable' && nodes(node).some(child => child.props.name === 'lock-reset'));
  open.props.onPress();
  const inputs = nodes(h.render()).filter(node => node.type === 'TextInput');
  inputs[0].props.onChangeText('new-password');
  inputs[1].props.onChangeText('new-password');
  inputs[2].props.onChangeText('123456');
}

test('iOS password success verifies OTP before saving, closes form, and shows confirmation', async () => {
  const h = screen('settings/edit-profile.tsx');
  openPassword(h);
  assert.equal(nodes(h.render()).some(node => node.type === 'Modal'), false);
  await button(h.render(), 'handleUpdatePassword').props.onPress();
  assert.deepEqual(h.calls.map(call => call[0]), ['verify', 'update']);
  assert.equal(h.calls[0][1].type, 'recovery');
  assert.equal(h.calls[1][1].password, 'new-password');
  assert.equal(nodes(h.render()).some(node => node.type === 'TextInput'), false);
  assert.match(h.alerts.at(-1)[1], /密码/);
  assert.equal(h.alerts.at(-1)[2].length, 1);
});

test('invalid verification code never updates password and retains editable form', async () => {
  const h = screen('settings/edit-profile.tsx', 'ios', { message: 'Invalid OTP' });
  openPassword(h);
  await button(h.render(), 'handleUpdatePassword').props.onPress();
  assert.deepEqual(h.calls.map(call => call[0]), ['verify']);
  assert.equal(h.alerts.at(-1)[1], 'Invalid OTP');
  assert.equal(button(h.render(), 'handleUpdatePassword').props.disabled, false);
});

test('OTP sent prompt keeps the password form available', async () => {
  const h = screen('settings/edit-profile.tsx');
  openPassword(h);
  await button(h.render(), 'handleSendOtp').props.onPress();
  assert.equal(h.alerts.length, 1);
  assert.ok(button(h.render(), 'handleUpdatePassword'));
});

test('Android retains the native form modal', () => {
  const h = screen('settings/edit-profile.tsx', 'android');
  openPassword(h);
  assert.equal(nodes(h.render()).find(node => node.type === 'Modal').props.visible, true);
});

test('retry after invalid login clears password but preserves email', async () => {
  const h = screen('(auth)/login.tsx');
  const inputs = nodes(h.render()).filter(node => node.type === 'TextInput');
  inputs[0].props.onChangeText('member@example.com');
  inputs[1].props.onChangeText('wrong-password');
  nodes(h.render()).find(node => node.type === 'Pressable' && nodes(node).some(child => child.props.name === 'checkbox-blank-outline')).props.onPress();
  await button(h.render(), 'handleLogin').props.onPress();
  await h.timers.shift()();
  h.alerts.at(-1)[2].find(item => item.text === 'retryLogin').onPress();
  const after = nodes(h.render()).filter(node => node.type === 'TextInput');
  assert.equal(after[0].props.value, 'member@example.com');
  assert.equal(after[1].props.value, '');
});
