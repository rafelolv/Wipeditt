import pkg from '../package.json' with { type: 'json' };
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const child = spawn(process.execPath, ['build/run.mjs'], { stdio: 'inherit', env: { ...process.env, WIPEDITT_ENABLE_DELETION: '1', WIPEDITT_TEST_USER_DATA: join(tmpdir(), `wipeditt-manual-deletion-validation-${pkg.version}`) } });
child.on('exit', code => { process.exitCode = code ?? 1; });
