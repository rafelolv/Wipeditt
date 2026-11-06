import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
assert.equal(lock.version, pkg.version);
const runtime = await readFile('wipeditt.user.js');
assert.match(runtime.toString(), new RegExp(`@version\\s+${pkg.version.replaceAll('.', '\\.')}`));
assert.match(runtime.toString(), /Wipeditt Proprietary License 1.0/);
execFileSync(process.execPath, ['--check', 'wipeditt.user.js']);
for (const target of ['chromium', 'firefox']) {
  const dir = `dist/${target}`;
  assert.deepEqual(await readFile(`${dir}/wipeditt.user.js`), runtime);
  const manifest = JSON.parse(await readFile(`${dir}/manifest.json`, 'utf8'));
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.permissions, undefined);
  assert.deepEqual(manifest.host_permissions, ['https://oauth.reddit.com/*', 'https://www.reddit.com/*']);
  await readFile(`${dir}/background.js`);
  assert.deepEqual(await readFile(`${dir}/LICENSE`), await readFile('LICENSE'));
  execFileSync('python3', ['-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; assert z.read("wipeditt.user.js")==open("wipeditt.user.js","rb").read()', `dist/wipeditt-${target}-${pkg.version}.zip`]);
}
for (const line of (await readFile('dist/SHA256SUMS', 'utf8')).trim().split('\n')) {
  const [hash, file] = line.split('  ');
  assert.equal(createHash('sha256').update(await readFile(`dist/${file}`)).digest('hex'), hash);
}
console.log('Version, syntax, licenses, runtime parity, ZIPs and checksums passed.');
