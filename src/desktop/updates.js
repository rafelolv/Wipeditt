import https from 'node:https';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';

export const RELEASES_API = 'https://api.github.com/repos/rafelolv/Wipeditt/releases?per_page=20';
const RELEASE_ROOT = 'https://github.com/rafelolv/Wipeditt/releases/tag/';
const HOUR = 3600000;

export function parseVersion(value) {
  if (typeof value !== 'string' || value.length > 100) return null;
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value);
  if (!match) return null;
  const numbers = match.slice(1, 4).map(Number);
  const pre = match[4]?.split('.') || [];
  if (!numbers.every(Number.isSafeInteger) || pre.some(part => /^\d+$/.test(part) && (part.length > 1 && part[0] === '0' || !Number.isSafeInteger(Number(part))))) return null;
  return { numbers, pre };
}
export function compareVersions(left, right) {
  const a = parseVersion(left), b = parseVersion(right);
  if (!a || !b) throw new Error('Invalid version.');
  for (let index = 0; index < 3; index++) if (a.numbers[index] !== b.numbers[index]) return Math.sign(a.numbers[index] - b.numbers[index]);
  if (!a.pre.length || !b.pre.length) return Math.sign(Number(!a.pre.length) - Number(!b.pre.length));
  for (let index = 0; index < Math.max(a.pre.length, b.pre.length); index++) {
    const x = a.pre[index], y = b.pre[index];
    if (x === y) continue;
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    if (nx && ny) return Math.sign(Number(x) - Number(y));
    if (nx !== ny) return nx ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
export function availableRelease(releases, current, platform, arch) {
  if (!Array.isArray(releases) || releases.length > 100) throw new Error('Invalid release response.');
  const local = parseVersion(current);
  if (!local) throw new Error('Invalid installed version.');
  const previews = local.numbers[0] === 0 || local.pre.length > 0;
  let newest = null;
  for (const release of releases) {
    const tag = release?.tag_name;
    if (release?.draft !== false || typeof tag !== 'string' || !tag.startsWith('v') || !parseVersion(tag)) continue;
    const preview = release.prerelease === true || parseVersion(tag).pre.length > 0;
    if (preview && !previews || compareVersions(tag, current) <= 0) continue;
    const version = tag.slice(1);
    const packageNames = platform === 'linux' && arch === 'x64' ? [`Wipeditt-${version}-linux-x86_64.AppImage`, `Wipeditt-${version}-linux-amd64.deb`]
      : platform === 'win32' && arch === 'x64' ? [`Wipeditt-${version}-win-x64.exe`]
        : [];
    const uploaded = new Set((Array.isArray(release.assets) ? release.assets : []).filter(asset => asset?.state === 'uploaded' && asset.size > 0).map(asset => asset.name));
    if (!uploaded.has('SHA256SUMS') || !packageNames.some(name => uploaded.has(name))) continue;
    if (!newest || compareVersions(tag, newest.version) > 0) {
      newest = { version, preview, url: RELEASE_ROOT + encodeURIComponent(tag) };
      const name = platform === 'win32' ? packageNames[0] : packageNames.find(name => name.endsWith('.AppImage'));
      const asset = release.assets.find(asset => asset?.name === name && asset.state === 'uploaded');
      if (release.prerelease === false && !preview && uploaded.has(`wipeditt-source-v${version}.zip`) && /^sha256:[a-f0-9]{64}$/.test(asset?.digest) && Number.isSafeInteger(asset.size) && asset.size > 0 && asset.size <= 1024 ** 3) newest.install = { name, size: asset.size, digest: asset.digest };
    }
  }
  return newest;
}

// Fixed public metadata endpoint. No cookies, Reddit state, tokens, identifiers
// or remote executable code are sent or downloaded by this checker.
export function requestReleases() {
  return new Promise((resolve, reject) => {
    const request = https.get(RELEASES_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Wipeditt-update-check' }, agent: false }, response => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error('GitHub is unavailable or its request limit was reached.')); return; }
      const chunks = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 512 * 1024) { response.destroy(); request.destroy(new Error('Release response too large.')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('aborted', () => reject(new Error('Release check interrupted.')));
      response.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('Invalid release response.')); } });
    });
    const deadline = setTimeout(() => request.destroy(new Error('Release check timed out.')), 10000);
    request.on('close', () => clearTimeout(deadline));
    request.on('error', error => { clearTimeout(deadline); reject(error); });
  });
}

export class UpdateChecker {
  constructor({ version, platform = process.platform, arch = process.arch, settingsPath, request = requestReleases, now = Date.now, onChange = () => {} }) {
    Object.assign(this, { version, platform, arch, settingsPath, request, now, onChange });
    this.state = { enabled: true, status: 'idle', available: null, checkedAt: null };
    this.lastAttempt = null;
    try { const saved = JSON.parse(readFileSync(settingsPath, 'utf8')); if (typeof saved.enabled === 'boolean') this.state.enabled = saved.enabled; } catch { /* First launch or unavailable preference. */ }
  }
  snapshot() { return { ...structuredClone(this.state), ...(this.installer ? { installer: this.installer.snapshot() } : {}) }; }
  setEnabled(enabled) {
    if (typeof enabled !== 'boolean') throw new Error('Invalid update preference.');
    if (this.settingsPath) {
      writeFileSync(this.settingsPath + '.tmp', JSON.stringify({ enabled }), { mode: 0o600 });
      renameSync(this.settingsPath + '.tmp', this.settingsPath);
    }
    this.state.enabled = enabled; this.onChange();
  }
  async check({ manual = false } = {}) {
    if (this.pending) return this.pending;
    if (!manual && !this.state.enabled) return this.snapshot();
    if (this.lastAttempt !== null && this.now() - this.lastAttempt < (manual ? 60000 : 4 * HOUR)) return this.snapshot();
    this.lastAttempt = this.now(); this.state.status = 'checking'; this.onChange();
    this.pending = (async () => {
      try {
        const releases = await Promise.resolve().then(() => this.request());
        this.state.available = availableRelease(releases, this.version, this.platform, this.arch);
        this.state.status = this.state.available ? 'available' : 'current';
        this.state.checkedAt = this.now();
      } catch { this.state.status = 'error'; }
      finally { this.pending = null; this.onChange(); }
      return this.snapshot();
    })();
    return this.pending;
  }
}
