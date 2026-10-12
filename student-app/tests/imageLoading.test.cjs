const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const fs = require('node:fs');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../lib/imageLoading.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { articleImageLoadingScript, imageLoadingMessages } = context.exports;
function run(images) {
  const nodes = [];
  const document = {
    body: { dataset: { imageLoading: '图片加载中', imageFailed: '图片加载失败' } },
    querySelectorAll: () => images,
    createElement: () => {
      const node = { setAttribute() {}, appendChild() {} };
      nodes.push(node);
      return node;
    },
  };
  images.forEach(img => {
    img.events = {};
    img.parentNode = { insertBefore() {} };
    img.addEventListener = (event, handler) => { img.events[event] = handler; };
  });
  vm.runInNewContext(articleImageLoadingScript, { document });
  return nodes;
}
test('multiple body images independently finish loading or fail without spinning forever', () => {
  const a = { complete: false }, b = { complete: false };
  const [first, indicator, second, failedIndicator] = run([a, b]);
  assert.match(indicator.innerHTML, /article-image-spinner/);
  a.events.load();
  assert.match(first.className, /is-loaded/);
  assert.equal(indicator.textContent, '');
  assert.equal(second.className, 'article-image-placeholder');
  b.events.error();
  assert.match(second.className, /is-failed/);
  assert.equal(failedIndicator.textContent, '图片加载失败');
});
test('cached successful and broken images immediately leave loading state', () => {
  const [success, , failure] = run([{ complete: true, naturalWidth: 300 }, { complete: true, naturalWidth: 0 }]);
  assert.match(success.className, /is-loaded/);
  assert.match(failure.className, /is-failed/);
});
test('image status labels cover all four app languages', () => {
  for (const language of ['zh', 'zh-Hant', 'en', 'it']) {
    assert.ok(imageLoadingMessages[language].loading);
    assert.ok(imageLoadingMessages[language].failed);
  }
});
