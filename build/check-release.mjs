import pkg from '../package.json' with { type: 'json' };
import { DELETION_VALIDATED } from '../src/desktop/capabilities.js';
const tag = process.env.RELEASE_TAG;
if (tag !== `v${pkg.version}`) throw new Error('Release tag and package version differ.');
if (!pkg.version.includes('-') && Number(pkg.version.split('.')[0]) >= 1 && !DELETION_VALIDATED) throw new Error('A stable v1 release requires the completed independent live deletion validation record.');
if (pkg.license !== 'GPL-3.0-only' || pkg.build.mac) throw new Error('Release license/platform configuration is invalid.');
console.log(`Release ${tag} validated.`);
