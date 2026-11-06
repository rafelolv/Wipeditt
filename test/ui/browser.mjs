import { chromium } from 'playwright-core';
import { readFile, mkdir, mkdtemp, rm, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

await mkdir('artifacts', { recursive: true });
const executablePath = process.env.WIPEDITT_CHROME || '/usr/bin/google-chrome';
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  const requests = [];
  await page.route('**/*', route => {
    requests.push(route.request().url());
    if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated Reddit fixture</title><style>body{background:#101512}button{font-size:80px!important}</style>' });
    return route.abort();
  });
  await page.goto('https://www.reddit.com/');
  await page.clock.install();
  const source = await readFile('wipeditt.user.js', 'utf8');
  await page.evaluate(source);
  await page.evaluate(source);
  assert.equal(await page.locator('#wipeditt-runtime-v1').count(), 1, 'reinjection must mount once');
  await page.getByRole('button', { name: 'Open Wipeditt' }).click();
  const status = page.locator('.status');
  await page.getByRole('button', { name: 'Scan content', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#wipeditt-runtime-v1').shadowRoot.querySelector('.status').textContent.includes('approval'));
  assert.match(await status.textContent(), /approval/);
  await page.getByRole('button', { name: 'Try synthetic data' }).click();
  await page.locator('#limit').fill('1');
  await page.getByText('Dates, pattern & score', { exact: true }).click();
  await page.locator('#regex').fill('[');
  await page.getByRole('button', { name: 'Scan content', exact: true }).click();
  assert.match(await status.textContent(), /Invalid regular expression/);
  await page.locator('#regex').fill('');
  const attack = '<img src=x onerror="window.INJECTED=true">';
  await page.locator('#replacement').fill(attack);
  const advanceUntil = async predicate => {
    for (let n = 0; n < 30; n++) {
      await page.clock.runFor(1000);
      if (await page.evaluate(predicate)) return;
    }
    throw new Error('Timed out advancing isolated browser clock');
  };
  await page.getByRole('button', { name: 'Scan content', exact: true }).click();
  await advanceUntil(() => !!document.querySelector('#wipeditt-runtime-v1').shadowRoot.querySelector('.item'));
  assert.equal(await page.locator('.item').count(), 1);
  assert.equal(await page.locator('.replacement').textContent(), `Replace with: ${attack}`);
  assert.equal(await page.evaluate(() => window.INJECTED), undefined);
  assert.equal(await page.locator('#wipeditt-runtime-v1').locator('img').count(), 0);
  await page.getByRole('button', { name: 'Review operation', exact: true }).click();
  assert.equal(await page.getByRole('dialog').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Cancel', exact: true }).evaluate(el => el === el.getRootNode().activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.locator('progress').getAttribute('value'), '0');
  // A changed replacement invalidates the scan before a new confirmation.
  await page.locator('#replacement').fill('A fresh start.');
  assert.equal(await page.getByRole('button', { name: 'Review operation', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Scan content', exact: true }).click();
  await advanceUntil(() => !!document.querySelector('#wipeditt-runtime-v1').shadowRoot.querySelector('.item'));
  await page.getByRole('checkbox', { name: /Select t3_demo0/ }).uncheck();
  assert.equal(await page.getByRole('button', { name: 'Review operation', exact: true }).isDisabled(), true);
  await page.getByRole('checkbox', { name: /Select t3_demo0/ }).check();
  await page.getByRole('button', { name: 'Review operation', exact: true }).click();
  await page.getByRole('button', { name: 'Run simulation', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const before = await page.locator('progress').getAttribute('value');
  await page.clock.runFor(3000);
  assert.equal(await page.locator('progress').getAttribute('value'), before);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await advanceUntil(() => document.querySelector('#wipeditt-runtime-v1').shadowRoot.querySelector('.status').textContent.includes('Finished'));
  assert.match(await status.textContent(), /No Reddit content changed/);
  assert.match(await status.textContent(), /anonymized/);
  assert.equal(await page.getByRole('button', { name: 'Export report', exact: true }).isEnabled(), true);
  // Real screenshot of synthetic mode, generated from the production userscript.
  await page.locator('#limit').fill('100');
  await page.getByRole('button', { name: 'Scan content', exact: true }).click();
  await advanceUntil(() => document.querySelector('#wipeditt-runtime-v1').shadowRoot.querySelectorAll('.item').length === 12);
  await page.locator('.scope').evaluate(node => { node.open = false; });
  await page.locator('.panel').evaluate(node => { node.scrollTop = 0; });
  await page.locator('.panel').screenshot({ path: 'artifacts/panel-dark.png' });
  await page.getByRole('checkbox', { name: 'Privacy mode', exact: true }).check();
  assert.equal(await page.locator('.original').first().evaluate(node => getComputedStyle(node).filter), 'blur(6px)');
  await page.getByRole('checkbox', { name: 'Privacy mode', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Light mode', exact: true }).click();
  await page.locator('.panel').evaluate(node => { node.scrollTop = 0; });
  await page.locator('.panel').screenshot({ path: 'artifacts/panel-light.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.locator('.panel').evaluate(node => node.getBoundingClientRect().right <= innerWidth));
  await page.locator('.panel').evaluate(node => { node.scrollTop = 0; });
  await page.locator('.panel').screenshot({ path: 'artifacts/panel-mobile.png' });
  assert.equal(requests.length, 1, 'runtime must never make network requests');
  assert.deepEqual(errors, []);
  console.log(`Userscript UI passed · ${browser.version()} · injection, filters, confirmation, cancellation, pause/resume, execution, privacy, light/dark and mobile.`);
} finally { await browser.close(); }

// Load the real Chromium content-script runtime using a loopback-only temporary manifest.
// Executable bytes are identical; temporary matches prevent contact with Reddit.
const profile = await mkdtemp(join(tmpdir(), 'wipeditt-browser-'));
const extensionDir = join(profile, 'extension');
await mkdir(extensionDir);
let context;
try {
  const manifest = JSON.parse(await readFile('dist/chromium/manifest.json', 'utf8'));
  manifest.content_scripts[0].matches = ['http://127.0.0.1/*'];
  await writeFile(join(extensionDir, 'manifest.json'), JSON.stringify(manifest));
  for (const file of ['wipeditt.user.js', 'icon-48.png', 'icon-128.png']) await copyFile(`dist/chromium/${file}`, join(extensionDir, file));
  const extensionBrowser = process.env.WIPEDITT_EXTENSION_CHROME || chromium.executablePath();
  context = await chromium.launchPersistentContext(join(profile, 'profile'), { executablePath: extensionBrowser, headless: true, args: ['--no-sandbox', `--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`] });
  const page = await context.newPage();
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Extension fixture</title>' }));
  await page.goto('http://127.0.0.1/wipeditt-fixture');
  await page.getByRole('button', { name: 'Open Wipeditt' }).waitFor();
  await page.evaluate(await readFile('wipeditt.user.js', 'utf8'));
  assert.equal(await page.locator('#wipeditt-runtime-v1').count(), 1, 'extension and userscript must share the document claim');
  await page.getByRole('button', { name: 'Open Wipeditt' }).click();
  await page.getByRole('button', { name: 'Try synthetic data' }).click();
  await page.locator('#limit').fill('1');
  await page.getByRole('button', { name: 'Scan content', exact: true }).click();
  await page.locator('.item').waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.item').count(), 1);
  console.log(`Chromium extension passed · ${context.browser().version()} · actual content script, blocked status and shared simulation scan.`);
} finally { await context?.close(); await rm(profile, { recursive: true, force: true }); }
