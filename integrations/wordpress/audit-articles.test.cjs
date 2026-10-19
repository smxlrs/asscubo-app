const { test } = require('node:test');
const assert = require('node:assert/strict');
const { key, sourceKeys, audit } = require('./audit-articles.cjs');
const url = 'https://mp.weixin.qq.com/s?__biz=abc%3D%3D&mid=12&idx=1&sn=xxx';
test('wechat identity ignores tracking, protocol and HTML ampersand encoding', () => {
  assert.equal(key(url), key('http://mp.weixin.qq.com/s?idx=1&#038;sn=xxx&#038;mid=12&#038;__biz=abc%3D%3D&scene=1#rd'));
  assert.equal(key('https://mp.weixin.qq.com/s/abc-123?scene=1'), '/s/abc-123');
  assert.equal(key('https://mp.weixin.qq.com.evil.test/s/abc'), '');
  assert.equal(key('https://mp.weixin.qq.com/s?mid=12'), '');
});
test('source footer excludes unrelated links in article body', () => {
  const post = { content: { rendered: `<a href="https://mp.weixin.qq.com/s/wrong">related</a><p class="wxsync-source"><a href="${url}">original</a></p>` } };
  assert.deepEqual(sourceKeys(post), [key(url)]);
});
test('metadata works without visible source footer', () => {
  assert.deepEqual(sourceKeys({ boxue_source: { wechat_url: url } }), [key(url)]);
});
test('identical titles from different publications never become automatic matches', () => {
  const posts = [{ id: 1, title: { rendered: 'Same title' }, boxue_source: { wechat_url: url } }];
  const rows = audit([{ id: 'a', title: 'Same title', link: url }, { id: 'b', title: 'Same title', link: url.replace('mid=12', 'mid=13') }], posts);
  assert.equal(rows[0].status, 'exact'); assert.equal(rows[1].status, 'title_review');
  assert.equal(audit([{ title: 'Same title', link: url }], [...posts, { ...posts[0], id: 2 }])[0].status, 'ambiguous');
});
