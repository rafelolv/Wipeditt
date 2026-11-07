import { _electron as electron } from 'playwright-core';
import executablePath from 'electron';
import { resolve, join } from 'node:path';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { installFixture } from './fixture.mjs';
import { verifyAuthorLayouts } from './ownership.mjs';
import { verifyUpdateNotice } from './updates.mjs';

process.on('uncaughtExceptionMonitor', error => {
  if (process.env.GITHUB_ACTIONS === 'true') console.error(`::error title=Desktop validation::${String(error.stack || error.message).replaceAll('%', '%25').replaceAll('\n', '%0A').replaceAll('\r', '%0D')}`);
});
const profile = await mkdtemp(join(tmpdir(), 'wipeditt-desktop-test-'));
const environment = { ...process.env, WIPEDITT_TEST_USER_DATA: profile };
delete environment.ELECTRON_RUN_AS_NODE;
const args = [resolve('.')];
if (process.env.CI === 'true') args.push('--no-sandbox'); // Isolated CI container only; never a production default.
await mkdir('artifacts', { recursive: true });
let application;
const deadline = setTimeout(() => { console.error('Desktop test exceeded 150 seconds.'); application?.process().kill('SIGTERM'); process.exitCode = 1; }, 150000);
deadline.unref();
const selected = async (page, value) => {
  await page.waitForFunction(expected => document.getElementById('selected-count')?.textContent === String(expected), value);
};
const openFilters = page => page.locator('#filters').evaluate(node => { node.open = true; });
const darkNow = page => page.evaluate(() => document.body.classList.contains('dark'));
const setTheme = async (page, dark) => {
  if (await darkNow(page) !== dark) await page.locator('#theme').click();
  assert.equal(await darkNow(page), dark);
  await page.waitForTimeout(220);
};
try {
  application = await electron.launch({ executablePath, args, env: environment, timeout: 30000 });
  const page = await application.firstWindow();
  await page.getByRole('button', { name: 'Connect Reddit', exact: true }).first().waitFor();
  await installFixture(application);
  console.log('Electron window and isolated fixture session ready.');
  const capture = name => process.env.WIPEDITT_TEST_SCREENSHOTS === '1' ? page.screenshot({ path: `artifacts/${name}.png`, timeout: 15000 }) : Promise.resolve();
  await capture('desktop-welcome');
  assert.equal(await page.locator('#scan-section').isVisible(), false);
  await page.locator('#connect').click();
  await page.getByRole('button', { name: 'Verify account', exact: true }).waitFor();
  const browserBounds = await application.evaluate(({ BrowserWindow, session }) => BrowserWindow.getAllWindows()[0].contentView.children.find(view => view.webContents?.session === session.fromPartition('wipeditt-reddit')).getBounds());
  const helpBounds = await page.locator('#browser-help').boundingBox();
  assert.ok(browserBounds.y >= helpBounds.y + helpBounds.height, 'embedded Reddit must not cover the sign-in instructions');
  await capture('desktop-sign-in');
  const preferences = await application.evaluate(({ webContents, session }) => {
    const remote = webContents.getAllWebContents().find(contents => contents.session === session.fromPartition('wipeditt-reddit'));
    return remote.getLastWebPreferences();
  });
  assert.equal(preferences.nodeIntegration, false);
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.sandbox, true);
  await application.evaluate(async ({ webContents, session }) => {
    const remote = webContents.getAllWebContents().find(contents => contents.session === session.fromPartition('wipeditt-reddit'));
    const exposed = await remote.executeJavaScript('typeof window.wipeditt');
    if (exposed !== 'undefined') throw new Error('Reddit page received privileged bridge');
    await remote.executeJavaScript('document.querySelector("#fixture-login").click()');
  });
  // Verification must run automatically after login; never click #verify here.
  await page.locator('#account').filter({ hasText: 'u/fixture_user' }).waitFor({ timeout: 20000 });
  assert.equal(await page.locator('#verify').isVisible(), false);
  console.log('Native fixture login and automatic account verification passed.');
  await verifyAuthorLayouts(application);

  // A targeted scan by text keeps the test deterministic without an item cap.
  await openFilters(page);
  await page.locator('#contains').fill('Wipeditt should change only');
  await page.locator('#scan').click();
  await page.locator('.item').waitFor({ timeout: 15000 });
  assert.match(await page.locator('#counts').textContent(), /1 found · 1 selected/);
  assert.equal(await application.evaluate(() => globalThis.fixture.writes.length), 0);

  // Selection works from both the row and the checkbox, including after rerenders.
  await page.locator('.item[data-id="t1_abc"]').click();
  await selected(page, 0);
  await page.locator('.item[data-id="t1_abc"]').click();
  await selected(page, 1);
  const checkbox = page.locator('.item[data-id="t1_abc"] input[type="checkbox"]');
  await checkbox.uncheck();
  await selected(page, 0);
  await checkbox.check();
  await selected(page, 1);
  await page.locator('#select-all').click();
  await selected(page, 1);
  await page.locator('#select-none').click();
  await selected(page, 0);
  await page.locator('#select-all').click();
  await selected(page, 1);

  const navigationCount = await application.evaluate(() => globalThis.fixture.navigations.length);
  const replacement = '<img src=x onerror="window.INJECTED=true">';
  await page.locator('#replacement').fill(replacement);
  await page.locator('#review').click();
  assert.equal(await page.locator('#confirmation-text').textContent(), replacement);
  assert.equal(await page.locator('#confirmation-text img').count(), 0);
  assert.equal(await application.evaluate(() => globalThis.fixture.navigations.length), navigationCount, 'replacement changes must not rescan');
  await page.keyboard.press('Escape');
  assert.equal(await application.evaluate(() => globalThis.fixture.writes.length), 0);

  await page.locator('#replacement').fill('A fresh start.');
  await page.locator('#review').click();
  await page.locator('#accept').click();
  await page.locator('#pause').click();
  await page.waitForTimeout(500);
  assert.equal(await application.evaluate(() => globalThis.fixture.writes.length), 0);
  await page.locator('#pause').click();
  await page.locator('#status').filter({ hasText: 'Finished' }).waitFor({ timeout: 30000 });
  assert.equal(await application.evaluate(() => globalThis.fixture.writes.length), 1);
  assert.equal(await application.evaluate(() => globalThis.fixture.items.t1_abc.text), 'A fresh start.');
  assert.equal(await page.locator('#finished').isVisible(), true);
  const navigations = await application.evaluate(() => globalThis.fixture.navigations);
  assert.ok(navigations.filter(path => path === '/r/privacy/comments/post/fixture/abc/').length >= 2, 'verified replacement must reload native item page');
  assert.ok(!navigations.some(path => path.startsWith('/api/')), 'app must not replay a private API');

  // A scan with no item cap follows every available page.
  await openFilters(page);
  await page.locator('#contains').fill('');
  await page.locator('#scan').click();
  await page.locator('#matched-count').filter({ hasText: '3' }).waitFor({ timeout: 15000 });
  assert.match(await page.locator('#counts').textContent(), /3 found · 2 selected/);
  assert.equal(await page.locator('.item[data-id="t1_other"] input[type="checkbox"]').isDisabled(), true);
  assert.match(await page.locator('.item[data-id="t1_other"] .warning').textContent(), /another Reddit account/);
  // A listing without any author/edit metadata must be resolved from its original permalink.
  assert.equal(await page.locator('.item[data-id="t1_next"] .warning').count(), 0);
  assert.equal(await page.locator('.item[data-id="t1_next"] input[type="checkbox"]').isDisabled(), false);
  assert.equal(await page.locator('.item[data-id="t1_abc"] .warning').count(), 0);
  assert.ok(await application.evaluate(() => globalThis.fixture.navigations.some(path => path === '/r/privacy/comments/post/fixture/next/')), 'missing listing authors must be rechecked on the actual original');
  assert.equal(await page.locator('.item[data-id="t1_abc"]').count(), 1);
  assert.match(await page.locator('#page-label').textContent(), /Page 1 of 1 · 3 items/);
  await setTheme(page, true);
  await capture('desktop-review-dark');
  await page.locator('#privacy').check();
  assert.equal(await page.locator('.item p.sensitive').first().evaluate(node => getComputedStyle(node).filter), 'blur(6px)');
  await page.locator('#privacy').uncheck();
  await setTheme(page, false);
  await capture('desktop-review-light');
  await setTheme(page, true);

  // Explicit rejection must be a failed edit, not a sent-request success.
  await page.locator('#change-search').click();
  await openFilters(page);
  await page.locator('#contains').fill('A fresh start.');
  await page.locator('#scan').click();
  await page.waitForFunction(() => document.getElementById('counts').textContent.includes('1 found'), null, { timeout: 15000 });
  await application.evaluate(() => { globalThis.fixture.failWrite = true; });
  await page.locator('#replacement').fill('Rejected fixture replacement.');
  await page.locator('#review').click(); await page.locator('#accept').click();
  await page.locator('#status').filter({ hasText: '1 failed' }).waitFor({ timeout: 30000 });
  assert.equal(await application.evaluate(() => globalThis.fixture.writes.length), 1);
  await application.evaluate(() => { globalThis.fixture.failWrite = false; });

  // Text-post bodies use the same native edit form boundary as comments.
  await openFilters(page);
  await page.locator('#contains').fill('');
  await page.locator('#type').selectOption('post');
  await page.locator('#scan').click();
  await page.locator('.item p').filter({ hasText: 'synthetic editable text-post body' }).waitFor({ timeout: 15000 });
  // A changed native website account invalidates the operation before any new save.
  await application.evaluate(() => { globalThis.fixture.username = 'other_user'; });
  await page.locator('#review').click(); await page.locator('#accept').click();
  await page.locator('#status').filter({ hasText: 'Stopped' }).waitFor({ timeout: 15000 });
  assert.equal(await application.evaluate(() => globalThis.fixture.writes.length), 1);
  await page.locator('#disconnect').click();
  await page.locator('#connect').waitFor();
  assert.equal(await page.locator('#review-section').isVisible(), false);
  await verifyUpdateNotice(application, page);
  console.log('Electron desktop passed: native login, automatic account verification, isolated session/renderer, author metadata fallbacks, uncapped pagination, row/checkbox selection, safe preview, cancel, pause/resume, native save, fresh-page verification, account-change stop, disconnect and themes. All Reddit pages were local fixtures.');
} finally { await application?.close(); clearTimeout(deadline); await rm(profile, { recursive: true, force: true }); }
