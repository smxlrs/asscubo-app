const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const app = path.join(__dirname, '..', 'app');

function announcementRoutes(dir = app, segments = []) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const next = [...segments, entry.name];
    if (entry.isDirectory()) return announcementRoutes(path.join(dir, entry.name), next);
    if (!/^announcements\.(tsx?|jsx?)$/.test(entry.name)) return [];
    return [next.join('/').replace(/\.(tsx?|jsx?)$/, '')];
  });
}

function sorter() {
  // Use the actual installed router's ranking logic without loading native UI.
  const file = require.resolve('expo-router/build/fork/getStateFromPath-forks.js');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
  const declaration = source.statements.find(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'getRouteConfigSorter');
  assert.ok(declaration);
  return vm.runInNewContext(declaration.getText(source) + '; getRouteConfigSorter');
}

function config(route) {
  const segments = route.split('/');
  const parts = segments.filter(part => !part.startsWith('('));
  return { pattern: route, routeNames: ['__root', ...segments], expandedRouteNames: segments,
    type: 'static', staticPartCount: parts.length, parts, isIndex: false };
}

test('router prefers the conflicting tab route when navigating from home', () => {
  const candidates = ['announcements', '(tabs)/announcements'].map(config);
  candidates.sort(sorter()(['(tabs)', 'index']));
  assert.equal(candidates[0].pattern, '(tabs)/announcements');
});

test('home announcements has one unambiguous stack destination on either platform', () => {
  const routes = announcementRoutes().filter(route =>
    route.split('/').filter(segment => !segment.startsWith('(')).join('/') === 'announcements');
  assert.deepEqual(routes, ['announcements']);
  const candidates = routes.map(config).sort(sorter()(['(tabs)', 'index']));
  assert.equal(candidates[0].routeNames.length, 2);
  assert.equal(candidates[0].pattern, 'announcements');
});

test('quick action opens the same stack page and articles keep their own destination', () => {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'quickActions.ts'), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, {
    exports, require: () => ({}), console,
  });
  // Inspect actual shortcut definitions, independent of native shortcut registration.
  const literals = ts.createSourceFile('quickActions.ts', source, ts.ScriptTarget.Latest, true);
  const shortcuts = [];
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const values = {};
      for (const item of node.properties) {
        if (ts.isPropertyAssignment(item) && ts.isStringLiteral(item.initializer)) {
          values[item.name.getText(literals)] = item.initializer.text;
        }
      }
      if (values.id && values.href) shortcuts.push(values);
    }
    ts.forEachChild(node, visit);
  }
  visit(literals);
  assert.equal(shortcuts.find(item => item.id === 'announcements').href, '/announcements');
  assert.equal(shortcuts.find(item => item.id === 'articles').href, '/(tabs)/notifications');
});
