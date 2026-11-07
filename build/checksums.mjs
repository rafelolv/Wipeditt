import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const assets = (await readdir('dist')).filter(name => (name.startsWith(`Wipeditt-${version}-`) && /\.(AppImage|deb|exe)$/.test(name)) || name === `wipeditt-source-v${version}.zip`).sort();
if (!assets.length) throw new Error('No desktop packages found.');
await writeFile('dist/SHA256SUMS', (await Promise.all(assets.map(async name => `${createHash('sha256').update(await readFile(`dist/${name}`)).digest('hex')}  ${name}`))).join('\n') + '\n');
console.log(`Checksummed ${assets.length} desktop packages.`);
