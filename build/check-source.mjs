import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
async function files(dir) { return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))).flat(); }
for (const path of [...await files('src'), ...await files('build')]) {
  if (!/\.(?:m|c)?js$/.test(path)) continue;
  execFileSync(process.execPath, ['--check', path]);
  const source = await readFile(path, 'utf8');
  if (path.startsWith('src/') && /\b(innerHTML|outerHTML|insertAdjacentHTML|DOMParser|eval)\b|XMLHttpRequest|document\.cookie/.test(source)) throw new Error(`Unsafe runtime API: ${path}`);
  if (path.startsWith('src/') && /\bfetch\s*\(/.test(source)) throw new Error(`Networking outside the transport: ${path}`);
}
console.log('Source syntax and restricted runtime API checks passed.');
