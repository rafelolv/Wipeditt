import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.WIPEDITT_CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
try {
  const svg = await readFile('images/icon.svg', 'utf8');
  const page = await browser.newPage();
  await page.goto(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
  for (const size of [48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.evaluate(size => { const svg = document.documentElement; svg.setAttribute('width', size); svg.setAttribute('height', size); }, size);
    await page.screenshot({ path: `dist/icon-${size}.png`, omitBackground: true });
  }
} finally { await browser.close(); }
for (const target of ['chromium', 'firefox']) {
  const dir = `dist/${target}`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  for (const file of ['wipeditt.user.js', 'LICENSE']) await copyFile(file, `${dir}/${file}`);
  for (const size of [48, 128]) await copyFile(`dist/icon-${size}.png`, `${dir}/icon-${size}.png`);
  await build({ entryPoints: ['src/extension/background.js'], outfile: `${dir}/background.js`, bundle: true, format: 'iife', target: ['chrome110', 'firefox140'], legalComments: 'none' });
  const manifest = {
    manifest_version: 3, name: 'Wipeditt', version: pkg.version,
    description: 'Review and anonymize your own Reddit history with local OAuth authentication.',
    host_permissions: ['https://oauth.reddit.com/*', 'https://www.reddit.com/*'],
    background: target === 'firefox' ? { scripts: ['background.js'] } : { service_worker: 'background.js' },
    author: pkg.author, homepage_url: 'https://github.com/rafelolv/Wipeditt',
    icons: { 48: 'icon-48.png', 128: 'icon-128.png' },
    content_scripts: [{ matches: ['https://www.reddit.com/*', 'https://old.reddit.com/*'], js: ['wipeditt.user.js'], run_at: 'document_start', all_frames: false }]
  };
  if (target === 'firefox') manifest.browser_specific_settings = { gecko: { id: 'wipeditt@rafelolv', strict_min_version: '140.0', data_collection_permissions: { required: ['none'] } } };
  await writeFile(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  execFileSync('python3', ['build/zip.py', dir, `dist/wipeditt-${target}-${pkg.version}.zip`]);
}
await copyFile('wipeditt.user.js', 'dist/wipeditt.user.js');
const assets = ['wipeditt.user.js', ...['chromium', 'firefox'].map(target => `wipeditt-${target}-${pkg.version}.zip`)];
await writeFile('dist/SHA256SUMS', (await Promise.all(assets.map(async file => `${createHash('sha256').update(await readFile(`dist/${file}`)).digest('hex')}  ${file}`))).join('\n') + '\n');
console.log('Built unsigned Chromium and Firefox packages and SHA256SUMS.');
