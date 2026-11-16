const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const file = path.join(__dirname, '../app/settings/profile.tsx');
const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'handleVerifyOtp') handler = node.getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);
function client(result, token = '123456') {
  const calls = [], alerts = []; let signedOut = false, closed = false;
  const context = { exports: {}, console: { error() {} }, otpToken: token,
    localized: { enterOtpTitle: 'Incomplete code', otpCodeError: 'Invalid or expired', deleteFail: 'Failed' },
    setOtpError: error => alerts.push(error), setVerifying() {},
    setIsOtpModalVisible: value => { if (!value) closed = true; },
    signOut: async () => { signedOut = true; }, showCustomAlert: (...args) => alerts.push(args),
    t: () => 'OK', router: { replace() {} },
    supabase: { rpc: async (name, args) => { calls.push({ name, args }); return result; } },
  };
  vm.runInNewContext(ts.transpileModule('export const ' + handler, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  return { run: context.exports.handleVerifyOtp, calls, alerts, signedOut: () => signedOut, closed: () => closed };
}
test('account deletion sends the nonce to the server and signs out only after confirmed deletion', async () => {
  const c = client({ data: true, error: null }); await c.run();
  assert.equal(c.calls[0].name, 'delete_user_account'); assert.equal(c.calls[0].args.p_nonce, '123456');
  assert.equal(c.signedOut(), true); assert.equal(c.closed(), true);
});
test('invalid OTP, server error or incomplete input cannot finish account deletion', async () => {
  for (const result of [{ data: false }, { error: { message: 'offline' } }]) {
    const c = client(result); await c.run();
    assert.equal(c.signedOut(), false); assert.equal(c.closed(), false); assert.equal(c.alerts.length, 1);
  }
  const c = client({ data: true }, '12'); await c.run(); assert.equal(c.calls.length, 0);
});
