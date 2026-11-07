import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
const assets = (await readdir('dist')).filter(name => /\.(AppImage|deb|exe|dmg|zip)$/.test(name)).sort();
if (!assets.length) throw new Error('No desktop packages found.');
await writeFile('dist/SHA256SUMS', (await Promise.all(assets.map(async name => `${createHash('sha256').update(await readFile(`dist/${name}`)).digest('hex')}  ${name}`))).join('\n') + '\n');
console.log(`Checksummed ${assets.length} desktop packages.`);
