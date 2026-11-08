import assert from 'node:assert/strict';

export async function verifyNativeUpdater(application, packagedArchive = null) {
  const result = await application.evaluate(async ({ app, session }, archive) => {
    const { createRequire } = process.getBuiltinModule('node:module');
    const path = process.getBuiltinModule('node:path');
    const fs = process.getBuiltinModule('node:fs/promises');
    const { createHash } = process.getBuiltinModule('node:crypto');
    const root = path.join(app.getPath('userData'), 'synthetic-updater');
    await fs.mkdir(root, { recursive: true });
    const require = createRequire(path.join(app.getAppPath(), 'package.json'));
    const isolatedArchive = path.join(root, 'packaged.asar');
    if (archive) await require('original-fs').promises.copyFile(archive, isolatedArchive);
    const library = require(archive ? path.join(isolatedArchive, 'node_modules/electron-updater') : 'electron-updater');
    const { UpdateInstaller, createNativeUpdater } = require(path.join(app.getAppPath(), 'src/desktop/update-installer.js'));
    const bytes = Buffer.from('Synthetic updater fixture. Never execute these bytes.');
    const target = { version: '9.0.0', name: process.platform === 'win32' ? 'Wipeditt-9.0.0-win-x64.exe' : 'Wipeditt-9.0.0-linux-x86_64.AppImage', size: bytes.length, digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}` };
    const own = session.fromPartition('electron-updater', { cache: false });
    const expected = `https://github.com/rafelolv/Wipeditt/releases/download/v9.0.0/${target.name}`;
    let requests = 0, handoffs = 0;
    own.protocol.handle('https', request => {
      if (request.url !== expected) throw new Error('Unexpected updater origin or path');
      for (const name of ['cookie','authorization','x-user-staging-id']) if (request.headers.has(name)) throw new Error('Private update header');
      requests++;
      return new Response(bytes, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(bytes.length) } });
    });
    const previous = process.env.APPIMAGE;
    try {
      const config = path.join(root, 'config.yml');
      await fs.writeFile(config, 'updaterCacheDirName: fixture-cache\n');
      process.env.APPIMAGE = path.join(root, 'old.AppImage');
      await fs.writeFile(process.env.APPIMAGE, 'Old synthetic fixture');
      const installer = new UpdateInstaller({ version: app.getVersion(), supported: true, canInstall: () => true, createUpdater: value => {
        const native = createNativeUpdater(library, value, process.platform);
        native.forceDevUpdateConfig = true;
        const provider = native.clientPromise;
        native.updateConfigPath = config;
        native.clientPromise = provider;
        native.on('error', error => console.error('Synthetic updater:', error.message));
        Object.defineProperty(native.app, 'baseCachePath', { get: () => root });
        // Exercise the real download/provider/hash path, never an OS installer.
        native.quitAndInstall = (silent, restart) => { if (!silent || !restart) throw new Error('Unexpected handoff'); handoffs++; };
        return native;
      } });
      await installer.download({ version: target.version, preview: false, install: target });
      const ready = installer.snapshot().status;
      if (handoffs) throw new Error('Download attempted installation');
      await installer.install();
      return { requests, handoffs, ready };
    } finally {
      own.protocol.unhandle('https');
      if (previous === undefined) delete process.env.APPIMAGE; else process.env.APPIMAGE = previous;
      // Loaded ASAR handles may stay open on Windows; the outer test removes
      // its entire temporary profile after closing Electron.
      if (!archive) await fs.rm(root, { recursive: true, force: true });
    }
  }, packagedArchive);
  assert.deepEqual(result, { requests: 1, handoffs: 1, ready: 'ready' });
  console.log('Real updater library passed synthetic HTTPS download, digest verification and explicit handoff. No installer executed.');
}

export async function verifyInstallerUI(application, page) {
  const base = await page.evaluate(async () => (await window.wipeditt.command('state')).data);
  const send = async (status, extra = {}) => {
    const state = { ...base, ...extra, updates: { ...base.updates, available: { version: '9.0.0', url: 'https://github.com/rafelolv/Wipeditt/releases/tag/v9.0.0', install: {} }, installer: { supported: true, status, version: '9.0.0', percent: 42 } } };
    await application.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0].webContents.send('wipeditt:state', value), state);
  };
  await send('idle'); await page.locator('#download-update').waitFor();
  assert.equal(await page.locator('#install-update').isVisible(), false);
  await send('downloading'); await page.waitForFunction(() => document.getElementById('update-progress').value === 42);
  assert.equal(await page.locator('#check-updates').isDisabled(), true);
  assert.match(await page.locator('#update-description').textContent(), /42%/);
  await send('ready'); await page.locator('#install-update').waitFor();
  assert.equal(await page.locator('#install-update').isEnabled(), true);
  await send('ready', { busy: true });
  await page.waitForFunction(() => document.getElementById('install-update').disabled);
  await send('installing');
  await page.waitForFunction(() => document.getElementById('connect').disabled);
  assert.equal(await page.locator('#progress-section').isVisible(), false);
  await send('error'); await page.locator('#download-update').waitFor();
  assert.match(await page.locator('#update-description').textContent(), /Retry/);
  await application.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0].webContents.send('wipeditt:state', value), base);
}
