import { build } from 'esbuild';
import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile, copyFile, mkdir, rm } from 'node:fs/promises';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await rm('app', { recursive: true, force: true });
await mkdir('app/icons', { recursive: true });
const svg = await readFile('images/icon.svg', 'utf8');
for (const size of [16, 32, 48, 64, 128, 256, 512]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(`app/icons/${size}x${size}.png`, png);
  if (size === 512) await writeFile('app/icon.png', png);
}
await build({ entryPoints: ['src/desktop/main.js'], outfile: 'app/main.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron'], legalComments: 'none' });
await build({ entryPoints: ['src/desktop/preload.cjs'], outfile: 'app/preload.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron'], legalComments: 'none' });
await build({ entryPoints: ['src/desktop/renderer.js'], outfile: 'app/renderer.js', bundle: true, platform: 'browser', format: 'iife', target: 'chrome140', legalComments: 'none' });
await copyFile('src/desktop/index.html', 'app/index.html');
await copyFile('LICENSE', 'app/LICENSE');
await copyFile('NOTICE', 'app/NOTICE');
await writeFile('app/version.json', JSON.stringify({ name: 'Wipeditt', version: pkg.version, creator: pkg.author, integration: 'native-browser' }, null, 2) + '\n');
console.log(`Built Wipeditt Desktop ${pkg.version}.`);
