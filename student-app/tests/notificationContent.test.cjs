const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');

function load(source, globals = {}) {
  const context = { exports: {}, ...globals };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
const content = load(fs.readFileSync(path.join(root, 'lib/notificationContent.ts'), 'utf8'));

function publisher(options = {}) {
  // Run the real submit handler with a fake database; never publish or send push.
  const file = path.join(root, 'app/admin/notification.tsx');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'handleSubmit') handler = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(handler);
  const inserts = [], updates = [], alerts = [];
  const defaults = {
    title: '测试通知', summary: '列表简述 & 推送', contentBody: '正文第一行\n正文第二行\n<img src="https://example.invalid/body.jpg" style="max-width:100%;" />',
    category: 'general', submitting: false, uploadingImage: false, uploadingBodyImage: false,
    editingId: null, loadingNotification: false, loadFailed: false, originalContent: null,
    hasAdminPermission: () => true,
    sendPush: false, setSubmitting() {}, getFinalCoverImage: () => null, getFinalWechatLink: () => null,
    buildNotificationContent: content.buildNotificationContent,
    Alert: { alert: (...args) => alerts.push(args) }, router: { back() {} },
    console, supabase: { from: table => {
      assert.equal(table, 'notifications');
      return {
        insert: async rows => { inserts.push(...rows); return { error: null }; },
        update: payload => ({ eq: (column, id) => {
          assert.equal(column, 'id'); updates.push({ id, payload });
          return { select: () => ({ single: async () => ({ data: { id }, error: null }) }) };
        } }),
      };
    } },
  };
  const submit = load('export const ' + handler.getText(source), { ...defaults, ...options });
  return { run: submit.handleSubmit, inserts, updates, alerts };
}

test('real publisher persists body and uploaded images in notifications, not articles', async () => {
  const p = publisher();
  await p.run();
  assert.equal(p.inserts.length, 1);
  assert.match(p.inserts[0].content, /<img src="https:\/\/example\.invalid\/body\.jpg"/);
  assert.match(p.inserts[0].content, /正文第一行/);
  assert.match(p.inserts[0].content, /正文第二行/);
  assert.equal(content.notificationPreview(p.inserts[0].content), '列表简述 & 推送');
});

test('cover and body uploads must finish before saving', async () => {
  for (const options of [{ uploadingImage: true }, { uploadingBodyImage: true }, { submitting: true }]) {
    const p = publisher(options);
    await p.run();
    assert.equal(p.inserts.length, 0);
  }
});

test('summary-only and older notifications keep compatible previews', async () => {
  const p = publisher({ contentBody: ' ' });
  await p.run();
  assert.equal(p.inserts[0].content, '列表简述 & 推送');
  assert.equal(content.notificationPreview(p.inserts[0].content), '列表简述 & 推送');
  assert.equal(content.notificationPreview(null), null);
});

test('multiple images survive and HTML-like typed text remains literal', () => {
  const html = content.buildNotificationContent('简述 <活动> & "图片"', '第一张\n<img src="https://example.invalid/a.png" />\n第二张\n<img src="https://example.invalid/b.jpg?x=1&y=2" />\n<script>alert(1)</script>');
  assert.equal((html.match(/<img /g) || []).length, 2);
  assert.ok(html.includes('b.jpg?x=1&amp;y=2'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.equal(content.notificationPreview(html), '简述 <活动> & "图片"');
});

test('only uploaded HTTPS image sources are rendered and extra attributes are dropped', () => {
  const html = content.buildNotificationContent('简述', '<img src="https://example.invalid/a.jpg" onerror="alert(1)" /><img src="javascript:alert(1)" />');
  assert.equal((html.match(/<img /g) || []).length, 1);
  assert.ok(!html.includes('onerror'));
  assert.ok(!html.includes('javascript:'));
});

test('editing round trips summary, line breaks, special characters and multiple body images', () => {
  const summary = '简述 & <活动>';
  const body = '第一行 & <文字>\n<img src="https://example.invalid/a.jpg?x=1&y=2" />\n<img src="https://example.invalid/b.jpg" />';
  const html = content.buildNotificationContent(summary, body);
  const parsed = content.parseNotificationContent(html);
  assert.equal(parsed.summary, summary);
  assert.equal(content.buildNotificationContent(parsed.summary, parsed.body), html);
  assert.equal(content.parseNotificationContent('旧通知纯文字').body, '');
  assert.match(content.parseNotificationContent('<p>旧正文</p><img src="https://example.invalid/a.jpg">').body, /<img/);
});

test('editing updates only the selected notification, preserves timestamp and never broadcasts', async () => {
  const p = publisher({ editingId: 'notification-1', sendPush: true,
    hasAdminPermission: permission => permission === 'notifications.manage',
    broadcastPushNotification: () => assert.fail('editing must never send push'),
  });
  await p.run();
  assert.equal(p.inserts.length, 0);
  assert.equal(p.updates.length, 1);
  assert.equal(p.updates[0].id, 'notification-1');
  assert.ok(!('created_at' in p.updates[0].payload));
  assert.ok(!('is_pinned' in p.updates[0].payload));
  assert.match(p.updates[0].payload.content, /<img/);
});

test('editing title alone preserves the exact original legacy HTML', async () => {
  const original = '<div><strong>旧正文</strong><img src="https://example.invalid/a.jpg"></div>';
  const parsed = content.parseNotificationContent(original);
  const p = publisher({ editingId: 'legacy', summary: parsed.summary, contentBody: parsed.body,
    originalContent: { content: original, ...parsed } });
  await p.run();
  assert.equal(p.updates[0].payload.content, original);
});

test('failed loading and missing manage permission cannot save an existing notice', async () => {
  for (const options of [{ loadFailed: true }, { loadingNotification: true }, { hasAdminPermission: () => false }]) {
    const p = publisher({ editingId: 'notification-1', ...options });
    await p.run();
    assert.equal(p.inserts.length, 0);
    assert.equal(p.updates.length, 0);
  }
});
