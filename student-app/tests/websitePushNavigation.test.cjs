const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('real website push sender includes the inserted article ID and website URL', async () => {
  const file = path.join(__dirname, '../../supabase/functions/wechat-sync/index.ts');
  const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const fn = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'sendPushNotifications');
  const messages = [];
  const context = { exports: {}, AbortSignal,
    EXPO_BATCH_SIZE: 100, PUSH_CONCURRENCY: 2, PUSH_REQUEST_TIMEOUT_MS: 20000,
    getDeliveryTokens: async () => ['ExpoPushToken[test]'], chunk: values => [values],
    runWithConcurrency: tasks => Promise.allSettled(tasks.map(task => task())),
    fetch: async (_url, options) => { messages.push(...JSON.parse(options.body)); return { ok: true, text: async () => '' }; },
  };
  vm.runInNewContext(ts.transpileModule('export ' + fn.getText(tree), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  await context.exports.sendPushNotifications({}, [{ id: 'saved-article', title: 'New post', summary: 'Text', link: 'https://asscubo.it/post/' }]);
  assert.equal(messages[0].data.articleId, 'saved-article'); assert.equal(messages[0].data.link, 'https://asscubo.it/post/');
});
