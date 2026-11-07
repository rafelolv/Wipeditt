import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const result = spawnSync(process.execPath, ['node_modules/electron/install.js'], { stdio: 'inherit', env: { ...process.env, ELECTRON_CACHE: process.env.ELECTRON_CACHE || join(tmpdir(), 'wipeditt-electron-cache') } });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
