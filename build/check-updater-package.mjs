import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractFile } from '@electron/asar';
try {
  const directory = join('dist', process.platform === 'win32' ? 'win-unpacked' : 'linux-unpacked');
  const config = await readFile(join(directory, 'resources/app-update.yml'), 'utf8');
  assert.match(config, /updaterCacheDirName:\s*wipeditt-updater/);
  assert.match(config, /owner:\s*rafelolv/);
  assert.match(config, /repo:\s*Wipeditt/);
  const archive = join(directory, 'resources/app.asar');
  const pkg = JSON.parse(extractFile(archive, 'package.json').toString());
  assert.equal(pkg.version, JSON.parse(await readFile('package.json', 'utf8')).version);
  assert.equal(pkg.dependencies['electron-updater'], '6.8.11');
  assert.equal(JSON.parse(extractFile(archive, join('node_modules', 'electron-updater', 'package.json')).toString()).version, '6.8.11');
  assert.match(await readFile(join(directory, 'UPDATER-NOTICES.txt'), 'utf8'), /electron-updater 6\.8\.11/);
  console.log('Packaged updater dependency, fixed GitHub cache configuration and runtime notices verified.');

} catch (error) {
  if (process.env.GITHUB_ACTIONS === 'true') console.error(`::error title=Packaged updater::${String(error.message).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  throw error;
}
