import { build } from 'esbuild';
import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile, copyFile, mkdir, rm, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await rm('app', { recursive: true, force: true });
await mkdir('app/icons', { recursive: true });
const svg = await readFile('images/icon.svg', 'utf8');
for (const size of [16, 32, 48, 64, 128, 256, 512]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(`app/icons/${size}x${size}.png`, png);
  if (size === 512) await writeFile('app/icon.png', png);
}
await build({ entryPoints: ['src/desktop/main.js'], outfile: 'app/main.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron', 'electron-updater'], legalComments: 'none' });
await build({ entryPoints: ['src/desktop/preload.cjs'], outfile: 'app/preload.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron'], legalComments: 'none' });
await build({ entryPoints: ['src/desktop/renderer.js'], outfile: 'app/renderer.js', bundle: true, platform: 'browser', format: 'iife', target: 'chrome140', legalComments: 'none' });
await copyFile('src/desktop/index.html', 'app/index.html');
await copyFile('LICENSE', 'app/LICENSE');
await copyFile('NOTICE', 'app/NOTICE');
await writeFile('app/version.json', JSON.stringify({ name: 'Wipeditt', version: pkg.version, creator: pkg.author, integration: 'native-browser' }, null, 2) + '\n');
const visited = new Set(), notices = [];
async function collectNotices(name, parent) {
  const manifest = createRequire(parent).resolve(`${name}/package.json`);
  if (visited.has(manifest)) return;
  visited.add(manifest);
  const dependency = JSON.parse(await readFile(manifest, 'utf8'));
  const directory = dirname(manifest);
  const files = (await readdir(directory)).filter(name => /^(?:licen[sc]e|notice)(?:\..*)?$/i.test(name)).sort();
  if (!files.length && !['MIT', 'ISC'].includes(dependency.license)) throw new Error(`Missing runtime notices: ${dependency.name}`);
  notices.push(`${dependency.name} ${dependency.version} (${dependency.license})\n${files.length ? (await Promise.all(files.map(file => readFile(join(directory, file), 'utf8')))).join('\n') : `Author: ${JSON.stringify(dependency.author)}\nRepository: ${JSON.stringify(dependency.repository)}\nThe npm package declares ${dependency.license} and contains no separate license notice.`}`);
  for (const child of Object.keys(dependency.dependencies || {}).sort()) await collectNotices(child, manifest);
}
await collectNotices('electron-updater', new URL('../package.json', import.meta.url));
await writeFile('app/UPDATER-NOTICES.txt', notices.join('\n\n---\n\n') + '\n');
console.log(`Built Wipeditt Desktop ${pkg.version}.`);
