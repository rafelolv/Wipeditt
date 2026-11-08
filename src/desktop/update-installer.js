import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { posix } from 'node:path';
import { AppError } from '../errors.js';
import { compareVersions, parseVersion } from './updates.js';

export const DOWNLOAD_ROOT = 'https://github.com/rafelolv/Wipeditt/releases/download/';
export const MAX_INSTALLER_SIZE = 1024 ** 3;

export function supportsIntegratedUpdates({ packaged, platform, arch, appImage, appDir, executable }) {
  if (!packaged || arch !== 'x64') return false;
  if (platform === 'win32') return true;
  if (platform !== 'linux' || !appImage || !appDir || !posix.isAbsolute(appImage) || !posix.isAbsolute(appDir) || appDir === '/') return false;
  const relative = posix.relative(appDir, executable);
  return !!relative && relative !== '..' && !relative.startsWith('../') && !posix.isAbsolute(relative);
}

export function installerTarget(release, current, platform) {
  const version = parseVersion(release?.version);
  const target = release?.install;
  const name = platform === 'win32' ? `Wipeditt-${release?.version}-win-x64.exe` : platform === 'linux' ? `Wipeditt-${release?.version}-linux-x86_64.AppImage` : '';
  if (!version || version.pre.length || release.preview || compareVersions(release.version, current) <= 0 || !target || target.name !== name || !/^sha256:[a-f0-9]{64}$/.test(target.digest) || !Number.isSafeInteger(target.size) || target.size <= 0 || target.size > MAX_INSTALLER_SIZE) throw new AppError('UPDATE', 'This release requires a manual download.');
  return { version: release.version, name, digest: target.digest, size: target.size };
}

export async function verifyInstaller(path, expected) {
  const info = await lstat(path);
  if (!info.isFile() || info.size !== expected.size) throw new Error('Update size mismatch.');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  if (`sha256:${hash.digest('hex')}` !== expected.digest) throw new Error('Update checksum mismatch.');
}

export class UpdateInstaller {
  constructor({ version, platform = process.platform, supported = false, createUpdater, canInstall = () => false, verify = verifyInstaller, onChange = () => {} }) {
    Object.assign(this, { version, platform, createUpdater, canInstall, verify, onChange });
    this.state = { supported, status: 'idle', percent: 0, version: null };
  }
  snapshot() { return { ...this.state }; }
  change(status, extra = {}) { Object.assign(this.state, { status }, extra); this.onChange(); }
  async download(release) {
    if (!this.state.supported) throw new AppError('UPDATE', 'Use the official release installer for this package.');
    if (['downloading', 'verifying', 'ready', 'installing'].includes(this.state.status)) throw new AppError('BUSY', 'An update is already being prepared.');
    if (!this.canInstall()) throw new AppError('BUSY', 'Finish your Reddit operation before updating.');
    const target = installerTarget(release, this.version, this.platform);
    this.change('downloading', { percent: 0, version: target.version });
    try {
      const updater = this.createUpdater(target);
      updater.autoDownload = false;
      updater.autoInstallOnAppQuit = false;
      updater.allowDowngrade = false;
      updater.allowPrerelease = false;
      updater.disableDifferentialDownload = true;
      updater.on('error', () => {
        if (this.state.status === 'installing') { this.ready = null; this.change('error'); }
      });
      updater.on('download-progress', progress => {
        if (this.state.status === 'downloading' && Number.isFinite(progress.percent)) this.change('downloading', { percent: Math.max(0, Math.min(100, Math.floor(progress.percent))) });
      });
      const result = await updater.checkForUpdates();
      const info = result?.updateInfo;
      if (info?.version !== target.version || info.packages || !Array.isArray(info.files) || info.files.length !== 1 || info.files[0].url !== target.name || info.files[0].sha2 !== target.digest.slice(7) || info.files[0].size !== target.size) throw new Error('Update metadata refused.');
      const paths = await updater.downloadUpdate();
      if (!Array.isArray(paths) || paths.length !== 1 || typeof paths[0] !== 'string') throw new Error('Unexpected downloaded files.');
      this.change('verifying', { percent: 100 });
      await this.verify(paths[0], target);
      this.ready = { updater, path: paths[0], target };
      this.change('ready');
    } catch {
      this.ready = null; this.change('error');
      throw new AppError('UPDATE', 'Could not prepare the update. Retry or use the official release.');
    }
  }
  async install() {
    if (!this.ready || this.state.status !== 'ready') throw new AppError('UPDATE', 'Download and verify an update first.');
    if (!this.canInstall()) throw new AppError('BUSY', 'Finish your Reddit operation before installing.');
    // Lock main-process operation commands before asynchronous verification.
    this.change('installing');
    try {
      await this.verify(this.ready.path, this.ready.target);
      if (!this.canInstall()) throw new Error('Reddit operation started.');
      this.ready.updater.quitAndInstall(true, true);
    } catch {
      this.ready = null; this.change('error');
      throw new AppError('UPDATE', 'Update was not installed. Retry the download.');
    }
  }
}

// A custom provider consumes already-validated public API metadata, not remote
// YAML, HTML, provider configuration or a staged rollout identifier.
export function createNativeUpdater(library, target, platform) {
  const info = { version: target.version, files: [{ url: target.name, size: target.size, sha2: target.digest.slice(7) }], path: target.name, sha2: target.digest.slice(7) };
  class OfficialProvider extends library.Provider {
    constructor(_options, _updater, runtime) { super(runtime); }
    setRequestHeaders() { /* Never forward the library's staging identifier. */ }
    async getLatestVersion() { return structuredClone(info); }
    resolveFiles() { return [{ url: new URL(`v${target.version}/${target.name}`, DOWNLOAD_ROOT), info: { ...info.files[0] } }]; }
  }
  const Type = platform === 'win32' ? library.NsisUpdater : library.AppImageUpdater;
  const updater = new Type({ provider: 'custom', updateProvider: OfficialProvider });
  updater.logger = null;
  updater.requestHeaders = { 'User-Agent': 'Wipeditt-update-download' };
  // Enforce HTTPS and known GitHub asset origins on initial and redirect requests.
  const executor = updater.httpExecutor;
  const create = executor.createRequest.bind(executor);
  executor.createRequest = (options, callback) => {
    const host = options.hostname || options.host;
    if (options.protocol !== 'https:' || options.port && String(options.port) !== '443' || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(host)) throw new Error('Update origin refused.');
    const request = create({ ...options, timeout: 60000, credentials: 'omit', headers: { 'User-Agent': 'Wipeditt-update-download', Accept: 'application/octet-stream' } }, callback);
    request.on('response', response => {
      let bytes = 0;
      response.on('data', chunk => { bytes += chunk.length; if (bytes > target.size) request.abort(); });
    });
    return request;
  };
  return updater;
}
