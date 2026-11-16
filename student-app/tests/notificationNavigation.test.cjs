const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {}, console };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/notificationNavigation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { notificationDestination, createNotificationResponseQueue } = context.exports;
const response = (id, data, action = 'tap') => ({ actionIdentifier: action, notification: { request: { identifier: id, content: { data, title: 'Title' } } } });

test('manual notifications, website articles and legacy links open their detail destinations', () => {
  assert.equal(notificationDestination(response('1', { notificationId: 'notice-1', link: 'https://example.org' })), '/article/notice-1');
  assert.equal(notificationDestination(response('2', { articleId: 'article-2' })), '/article/article-2');
  assert.match(notificationDestination(response('3', { link: 'https://asscubo.it/a/' })), /^\/article\/web\?url=/);
  assert.equal(notificationDestination(response('4', { link: 'javascript:evil()', articleId: '../admin' })), '/(tabs)');
  assert.equal(notificationDestination(response('5', { eventId: 'event-1' })).params.eventId, 'event-1');
});

test('cold-start and live delivery queue until navigation is ready and only navigate once for the same response', async () => {
  const routes = []; let clears = 0;
  const queue = createNotificationResponseQueue(route => routes.push(route), async () => { clears++; }, 'tap');
  const tap = response('request-1', { articleId: 'article-1' });
  queue.receive(tap); queue.receive(tap);
  assert.equal(routes.length, 0);
  queue.setReady(true); queue.receive(tap);
  assert.equal(routes.length, 1); assert.equal(clears, 1);
  queue.receive(response('request-2', {}, 'dismiss'));
  assert.equal(routes.length, 1);
  queue.receive(response('request-3', { notificationId: 'notice-3' }));
  assert.equal(routes[1], '/article/notice-3'); assert.equal(clears, 2);
});
