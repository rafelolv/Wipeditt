import { build } from 'esbuild';
import { readFile, mkdir } from 'node:fs/promises';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const license = await readFile('LICENSE', 'utf8');
const icon = await readFile('images/icon.svg', 'utf8');
const metadata = `// ==UserScript==
// @name         Wipeditt
// @namespace    https://github.com/rafelolv/Wipeditt
// @version      ${pkg.version}
// @description  ${pkg.description}
// @author       ${pkg.author}
// @copyright    2026 Rafael (rafaelolv)
// @license      LicenseRef-Wipeditt-Proprietary
// @homepageURL  https://github.com/rafelolv/Wipeditt
// @supportURL   https://github.com/rafelolv/Wipeditt/issues
// @downloadURL  https://raw.githubusercontent.com/rafelolv/Wipeditt/main/wipeditt.user.js
// @updateURL    https://raw.githubusercontent.com/rafelolv/Wipeditt/main/wipeditt.user.js
// @icon         data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}
// @match        https://www.reddit.com/*
// @match        https://old.reddit.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      oauth.reddit.com
// @connect      www.reddit.com
// @noframes
// ==/UserScript==`;
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/index.js'], outfile: 'wipeditt.user.js', bundle: true, format: 'iife', target: ['chrome110', 'firefox115'], legalComments: 'none', loader: { '.css': 'text', '.svg': 'text' }, banner: { js: `${metadata}\n/*!\n${license.trim()}\n*/` }, define: { __VERSION__: JSON.stringify(pkg.version) } });
console.log(`Built Wipeditt ${pkg.version} (Reddit OAuth).`);
