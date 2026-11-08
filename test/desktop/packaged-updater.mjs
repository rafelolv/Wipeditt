import { _electron as electron } from 'playwright-core';
import executablePath from 'electron';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { verifyNativeUpdater } from './updater.mjs';
const profile = await mkdtemp(join(tmpdir(), 'wipeditt-packaged-updater-'));
const env = { ...process.env, WIPEDITT_TEST_USER_DATA: profile };
delete env.ELECTRON_RUN_AS_NODE;
const args = [resolve('.')];
if (process.env.CI === 'true') args.push('--no-sandbox');
let application;
const deadline = setTimeout(() => { application?.process().kill('SIGTERM'); process.exitCode = 1; }, 30000);
try {
  application = await electron.launch({ executablePath, args, env, timeout: 20000 });
  await application.firstWindow();
  const archive = resolve('dist', process.platform === 'win32' ? 'win-unpacked' : 'linux-unpacked', 'resources/app.asar');
  await verifyNativeUpdater(application, archive);
} finally {
  await application?.close(); clearTimeout(deadline); await rm(profile, { recursive: true, force: true });
}
