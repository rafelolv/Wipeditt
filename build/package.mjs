import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
if (!['linux', 'win32'].includes(process.platform) || process.arch !== 'x64' || process.argv.slice(2).some(arg => !['--linux', '--win', '--x64', '--dir'].includes(arg))) {
  throw new Error('Official packages support Linux x64 and Windows x64 only.');
}
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve('electron-builder/cli.js'), '--publish', 'never', ...process.argv.slice(2)], { stdio: ['inherit', 'pipe', 'pipe'] });
let tail = '';
function forward(stream, chunk) {
  stream.write(chunk);
  tail = (tail + chunk.toString()).slice(-20000);
}
child.stdout.on('data', chunk => forward(process.stdout, chunk));
child.stderr.on('data', chunk => forward(process.stderr, chunk));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => {
  if (code !== 0 && process.env.GITHUB_ACTIONS === 'true') {
    const message = tail.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
    console.error(`::error title=Native installer packaging::${message}`);
  }
  process.exitCode = code ?? 1;
});
