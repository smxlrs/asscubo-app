const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('manual notification puts its title in the top bar and starts the body with its publication date', () => {
  const article = { title: '手动发布的通知标题', content: '<p>实际正文</p><img src="https://example.invalid/image.jpg">', link: null, created_at: '2026-10-20T00:00:00Z' };
  let stateIndex = 0;
  const react = { createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: () => [stateIndex++ === 0 ? false : article, () => {}], useEffect() {} };
  const modules = {
    react,
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: x => x } },
    'expo-router': { useLocalSearchParams: () => ({ id: 'notice-id' }), router: {} },
    '../../context/ThemeContext': { useTheme: () => ({ colors: {}, isDark: false, t: key => key, language: 'zh' }) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'react-native-webview': { WebView: 'WebView' },
    '../../lib/supabase': {}, '../../lib/websiteArticleReader': {},
    '../../lib/imageLoading': { imageLoadingMessages: { zh: { loading: '加载中', failed: '失败' } }, articleImageLoadingStyles: () => '', articleImageLoadingScript: 'imageLoading();' },
  };
  const context = { exports: {}, require: name => { assert.ok(name in modules, name); return modules[name]; }, Date, console };
  const file = path.join(__dirname, '../app/article/[id].tsx');
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, context);
  const tree = context.exports.default();
  const nodes = [];
  function visit(node) { if (!node || typeof node !== 'object') return; nodes.push(node); node.children?.flat().forEach(visit); }
  visit(tree);
  assert.ok(nodes.some(node => node.type === 'Text' && node.children.includes(article.title)));
  assert.ok(!nodes.some(node => node.type === 'Text' && node.children.includes('详情')));
  const html = nodes.find(node => node.type === 'WebView').props.source.html;
  assert.ok(!html.includes(article.title));
  assert.ok(!html.includes('<h1>'));
  assert.ok(html.indexOf('发布日期：') < html.indexOf('实际正文'));
  assert.match(html, /image\.jpg/);
});
