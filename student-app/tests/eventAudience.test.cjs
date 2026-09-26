const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');

function load(name, modules = {}) {
  const source = readFileSync(path.join(__dirname, '../lib', name), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, console: { warn() {} }, require: (name) => {
    if (!modules[name]) throw new Error('Unexpected module: ' + name);
    return modules[name];
  } };
  vm.runInNewContext(code, context);
  return context.exports;
}

test('cached internal activities disappear for guests and ordinary accounts', () => {
  const { canViewEventAudience: visible } = load('eventAudience.ts');
  for (const role of [undefined, null, 'student']) {
    assert.equal(visible('admins', role), false);
    assert.equal(visible('all', role), true);
    assert.equal(visible(undefined, role), true); // legacy public activity
  }
  for (const role of ['admin', 'super_admin']) assert.equal(visible('admins', role), true);
});

test('event push uses server-scoped paginated recipients, including targeted sends', async () => {
  const calls = [], messages = [];
  const { broadcastPushNotification } = load('notificationService.ts', {
    './supabase': { supabase: {
      from() { throw new Error('Must not query all push tokens for an event.'); },
      async rpc(name, args) {
        calls.push({ name, ...args });
        return { data: Array.from({ length: args.p_offset === 0 ? 500 : 1 }, (_, i) => ({ token: `device-${args.p_offset + i}` })), error: null };
      },
    } },
    './expoPush': { async sendExpoPushMessages(items) { messages.push(...items); return { success: true, sentCount: items.length, failedCount: 0 }; } },
  });
  const result = await broadcastPushNotification('Internal event', 'Test', 'events', undefined, undefined, 'event-id', 'user-id');
  assert.equal(result.sentCount, 501);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].p_offset, 500);
  assert.equal(calls[0].name, 'admin_event_push_tokens');
  assert.equal(calls[0].p_event_id, 'event-id');
  assert.equal(calls[0].p_user_id, 'user-id');
  assert.equal(messages.length, 501);
});

test('recipient lookup failure never falls back to a public broadcast', async () => {
  let sends = 0;
  const { broadcastPushNotification } = load('notificationService.ts', {
    './supabase': { supabase: { from() { throw new Error('Unsafe fallback'); }, async rpc() { return { data: null, error: new Error('Permission denied') }; } } },
    './expoPush': { async sendExpoPushMessages() { sends++; } },
  });
  assert.equal((await broadcastPushNotification('Title', 'Body', 'events', undefined, undefined, 'internal')).success, false);
  assert.equal(sends, 0);
});
