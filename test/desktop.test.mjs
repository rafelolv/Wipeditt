import test from 'node:test';
import assert from 'node:assert/strict';
import { DesktopController } from '../src/desktop/controller.js';
import { REMOTE_PREFERENCES, contentURL, historyURL, redditURL, trustedSender } from '../src/desktop/policy.js';
import { normalizeOptions } from '../src/filters.js';
import { setup, item } from './helpers.mjs';
function controller(overrides = {}) {
  const { adapter, scheduler } = setup([item()]);
  adapter.scheduler = scheduler;
  adapter.connect = () => adapter.account();
  const browser = { adapter, open: async () => {}, hide() {}, show: async () => {}, clear: async () => {} };
  const store = new Map();
  const storage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  return { desktop: new DesktopController({ browser, storage, version: '0.3.0', ...overrides }), adapter };
}
test('desktop remote pages have no Node privileges and strict sender validation', () => {
  assert.equal(REMOTE_PREFERENCES.nodeIntegration, false);
  assert.equal(REMOTE_PREFERENCES.contextIsolation, true);
  assert.equal(REMOTE_PREFERENCES.sandbox, true);
  const frame = { url: 'file:///app/index.html' };
  const shell = { webContents: { mainFrame: frame } };
  assert.equal(trustedSender({ sender: shell.webContents, senderFrame: frame }, shell, frame.url), true);
  assert.equal(trustedSender({ sender: {}, senderFrame: frame }, shell, frame.url), false);
  assert.equal(trustedSender({ sender: shell.webContents, senderFrame: { url: 'https://www.reddit.com/' } }, shell, frame.url), false);
});
test('desktop navigation refuses foreign origins, cross-account history and invalid content links', () => {
  for (const value of ['file:///etc/passwd', 'javascript:alert(1)', 'http://old.reddit.com/', 'https://old.reddit.com.evil.test/', 'https://user@old.reddit.com/']) assert.throws(() => redditURL(value));
  assert.throws(() => historyURL('https://old.reddit.com/user/other/comments/', { name: 'owner' }));
  assert.equal(contentURL('https://www.reddit.com/r/privacy/comments/abc/test/xyz/?context=3', 't1_xyz'), 'https://old.reddit.com/r/privacy/comments/abc/test/xyz/');
  assert.equal(contentURL('https://www.reddit.com/user/owner/comments/abc/test/xyz/', 't1_xyz'), 'https://old.reddit.com/user/owner/comments/abc/test/xyz/');
});
test('normalized desktop options keep inclusive date boundaries through engine normalization', () => {
  const options = normalizeOptions({ after: '2024-01-01T00:00:00Z', before: '2025-01-01T00:00:00Z' });
  assert.deepEqual(normalizeOptions(options), options);
});
test('desktop tracks the initial login flow for automatic verification', async () => {
  const { desktop } = controller();
  assert.equal(desktop.awaitingLogin, false);
  await desktop.command('connect');
  assert.equal(desktop.awaitingLogin, true);
  await desktop.command('verify-account');
  assert.equal(desktop.awaitingLogin, false);
  await desktop.command('show-browser');
  assert.equal(desktop.awaitingLogin, false);
  await desktop.command('connect');
  assert.equal(desktop.awaitingLogin, true);
  await desktop.command('disconnect');
  assert.equal(desktop.awaitingLogin, false);
});
test('desktop requires main-process confirmation token and rejects replay', async () => {
  const { desktop, adapter } = controller();
  await desktop.command('connect'); await desktop.command('verify-account');
  await desktop.command('scan', { options: { type: 'comment' } });
  await assert.rejects(desktop.command('run', { token: 'invented' }), { code: 'CONFIRM' });
  const confirmation = await desktop.command('confirm');
  await desktop.command('run', { token: confirmation.token, phrase: confirmation.phrase });
  assert.equal(desktop.report.counts.anonymized, 1);
  assert.equal(adapter.items[0].text, desktop.options.replacement);
  await assert.rejects(desktop.command('run', { token: confirmation.token }), { code: 'CONFIRM' });
});
test('changing selection, replacement or filters invalidates desktop authorization', async () => {
  for (const change of ['selection', 'replacement', 'filters', 'cancel']) {
    const { desktop } = controller();
    await desktop.command('connect'); await desktop.command('verify-account');
    await desktop.command('scan', { options: { type: 'comment' } });
    const confirmation = await desktop.command('confirm');
    if (change === 'selection') await desktop.command('select', { ids: [item().id], selected: false });
    if (change === 'replacement') await desktop.command('options', { options: { type: 'comment', replacement: 'Different text' } });
    if (change === 'filters') await desktop.command('invalidate');
    if (change === 'cancel') await desktop.command('cancel-confirmation');
    await assert.rejects(desktop.command('run', { token: confirmation.token }), { code: 'CONFIRM' });
  }
});
test('desktop keeps deletion unavailable for real-account mode and demo isolated', async () => {
  const { desktop } = controller();
  await desktop.command('connect'); await desktop.command('verify-account');
  await assert.rejects(desktop.command('scan', { options: { mode: 'delete' } }), { code: 'DELETION_UNVERIFIED' });
  await desktop.command('demo'); assert.equal(desktop.simulation, true);
  await desktop.command('disconnect'); assert.equal(desktop.account, null);
  assert.equal(desktop.snapshot().preview, null);
});

test('desktop imports a local comments.csv through the main-process hook', async () => {
  let asked = 0;
  const { desktop } = controller({ importExport: async ({ account }) => { asked++; assert.equal(account.name, 'demo_user'); return { items: [item()], skipped: 0, name: 'comments.csv' }; } });
  await desktop.command('connect'); await desktop.command('verify-account');
  await desktop.command('import-export', { options: { type: 'comment' } });
  assert.equal(asked, 1);
  assert.equal(desktop.engine.preview.source, 'import');
  assert.equal(desktop.snapshot().preview.stats.inspected, 1);
  assert.match(desktop.snapshot().status, /imported comments match/);
  const confirmation = await desktop.command('confirm');
  await desktop.command('run', { token: confirmation.token, phrase: confirmation.phrase });
  assert.equal(desktop.report.source, 'import');
  assert.equal(desktop.snapshot().finished.counts.anonymized, 1);
});
