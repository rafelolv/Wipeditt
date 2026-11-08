import { app, BrowserWindow, WebContentsView, ipcMain, session, dialog, shell, nativeImage } from 'electron';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { Scheduler } from '../scheduler.js';
import { RedditBrowser } from './reddit-browser.js';
import { DesktopController } from './controller.js';
import { CheckpointStorage } from './storage.js';
import { REDDIT_CLASSIC, REMOTE_PREFERENCES, redditURL, trustedSender, loginNavigation } from './policy.js';
import { NativeWriteTracker } from './write-tracker.js';
import { deletionCapability, DELETION_VALIDATED } from './capabilities.js';
import { UpdateChecker } from './updates.js';
import { parseCommentsCSV } from './import.js';
import { fail } from '../errors.js';

app.setName('Wipeditt');
if (!app.isPackaged && process.env.WIPEDITT_TEST_USER_DATA) app.setPath('userData', process.env.WIPEDITT_TEST_USER_DATA);
const acquired = app.requestSingleInstanceLock();
if (!acquired) app.quit();
let window, redditView, controller, checkpointStorage, activeSession;
let browserVisible = false;
const configuredSessions = new WeakSet();
const appURL = pathToFileURL(join(__dirname, 'index.html')).href;
const DATA_REQUEST_URL = 'https://www.reddit.com/settings/data-request';
const EXPORT_LIMIT = 64 * 1024 * 1024;
function layout() {
  if (!window || window.isDestroyed() || !redditView) return;
  const [width, height] = window.getContentSize();
  redditView.setBounds({ x: 246, y: 184, width: Math.max(100, width - 274), height: Math.max(100, height - 196) });
  redditView.setVisible(browserVisible);
}
function safeRemote(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (controller?.busy || !loginNavigation(url)) return { action: 'deny' };
    return { action: 'allow', overrideBrowserWindowOptions: { width: 620, height: 760, parent: window, autoHideMenuBar: true, webPreferences: { ...REMOTE_PREFERENCES, session: activeSession } } };
  });
  contents.on('did-create-window', child => safeRemote(child.webContents));
  contents.on('will-navigate', (event, value) => { if (!loginNavigation(value)) event.preventDefault(); });
  contents.on('will-redirect', (event, value) => { if (!loginNavigation(value)) event.preventDefault(); });
  contents.on('will-attach-webview', event => event.preventDefault());
}

function sendState(value) { if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send('wipeditt:state', value); }
const loginPage = url => url.hostname === 'accounts.reddit.com'
  || /^\/(?:login|register|signup|account|password|reset|verification|verify|mfa|two-factor|sso)(?:\/|$)/i.test(url.pathname);
let loginWatch = null;
let loginProbe = false;
let loginSettledAt = 0;
let loginRetryAt = 0;
function stopLoginWatch() { if (loginWatch) clearInterval(loginWatch); loginWatch = null; loginProbe = false; }
function startLoginWatch() {
  stopLoginWatch();
  loginSettledAt = Date.now();
  loginRetryAt = 0;
  loginWatch = setInterval(async () => {
    if (!controller?.awaitingLogin || controller.busy || controller.account) return;
    if (loginProbe || Date.now() < loginRetryAt) return;
    if (!redditView || redditView.webContents.isDestroyed() || redditView.webContents.isLoadingMainFrame()) return;
    let url;
    try { url = redditURL(redditView.webContents.getURL()); } catch { return; }
    // Stay quiet while Reddit is still asking for credentials or a second factor.
    if (loginPage(url)) { loginSettledAt = Date.now(); return; }
    if (!['old.reddit.com', 'www.reddit.com', 'reddit.com'].includes(url.hostname)) return;
    if (Date.now() - loginSettledAt < 1500) return;
    loginProbe = true;
    try {
      if (url.hostname === 'old.reddit.com') {
        const account = await browser.adapter.account().catch(() => null);
        if (!account) { browserVisible = true; controller.browserVisible = true; layout(); controller.emit(); loginSettledAt = Date.now(); return; }
        if (controller.busy || !controller.awaitingLogin) return;
        controller.status = `Signed in as u/${account.name}. Verifying…`; controller.emit();
      }
      browser.hide(); controller.browserVisible = false;
      controller.status = 'Verifying your Reddit account…'; controller.emit();
      await controller.command('verify-account');
      stopLoginWatch();
    } catch {
      browserVisible = true; controller.browserVisible = true; layout(); controller.emit();
      loginRetryAt = Date.now() + 15000;
      loginSettledAt = Date.now();
    } finally { loginProbe = false; }
  }, 1200);
}
const browser = {
  adapter: null,
  async open({ remember = false } = {}) {
    if (redditView) { window.contentView.removeChildView(redditView); redditView.webContents.close(); }
    activeSession = session.fromPartition(remember ? 'persist:wipeditt-reddit' : 'wipeditt-reddit');
    if (!configuredSessions.has(activeSession)) {
      activeSession.on('will-download', event => event.preventDefault());
      configuredSessions.add(activeSession);
    }
    activeSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    activeSession.setPermissionCheckHandler(() => false);
    const scheduler = new Scheduler();
    activeSession.webRequest.onHeadersReceived({ urls: ['https://*.reddit.com/*'] }, (details, callback) => {
      const headers = new Headers();
      for (const [key, values] of Object.entries(details.responseHeaders || {})) if (['retry-after', 'x-ratelimit-remaining', 'x-ratelimit-reset'].includes(key.toLowerCase())) headers.set(key, values.join(','));
      scheduler.observe(headers);
      if (details.statusCode === 429) { scheduler.stats.throttles++; scheduler.next = Math.max(scheduler.next, Date.now() + 60000); }
      callback({});
    });
    redditView = new WebContentsView({ webPreferences: { ...REMOTE_PREFERENCES, session: activeSession } });
    safeRemote(redditView.webContents);
    redditView.webContents.on('did-navigate', (_event, value) => {
      if (!controller?.awaitingLogin) return;
      let target;
      try { target = redditURL(value); } catch { return; }
      if (target.hostname !== 'old.reddit.com' || loginPage(target)) return;
      browser.hide(); controller.browserVisible = false;
      controller.status = 'Verifying your Reddit account…'; controller.emit();
    });
    const writeTracker = new NativeWriteTracker({ contentsId: redditView.webContents.id });
    const nativeRequests = { urls: ['https://*.reddit.com/*'] };
    activeSession.webRequest.onBeforeRequest(nativeRequests, (details, callback) => { writeTracker.before(details); callback({}); });
    activeSession.webRequest.onCompleted(nativeRequests, details => writeTracker.complete(details));
    activeSession.webRequest.onErrorOccurred(nativeRequests, details => writeTracker.error(details));
    window.contentView.addChildView(redditView);
    browser.adapter = new RedditBrowser({ contents: redditView.webContents, scheduler, writeTracker, deletionEnabled: deletionCapability({ packaged: app.isPackaged, developmentFlag: process.env.WIPEDITT_ENABLE_DELETION }) });
    browserVisible = true; layout();
    // Ask Reddit to return to the classic overview after sign-in. If the login
    // flow ignores the destination, the watcher below still verifies once the
    // embedded page leaves Reddit's credential screens.
    await browser.adapter.navigate(`https://www.reddit.com/login/?dest=${encodeURIComponent(`${REDDIT_CLASSIC}/user/me/overview/`)}`);
    startLoginWatch();
  },
  async show() { if (!redditView) return browser.open(); browserVisible = true; layout(); },
  hide() { browserVisible = false; layout(); },
  async clear() {
    stopLoginWatch();
    browser.hide();
    if (redditView) { window.contentView.removeChildView(redditView); redditView.webContents.close(); redditView = null; }
    for (const partition of ['wipeditt-reddit', 'persist:wipeditt-reddit']) {
      const ownSession = session.fromPartition(partition);
      await ownSession.clearStorageData();
      await ownSession.clearCache();
    }
  }
};
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { stopLoginWatch(); controller?.stop(); checkpointStorage?.flush(); });
if (acquired) app.whenReady().then(async () => {
  const icon = nativeImage.createFromPath(join(__dirname, 'icon.png'));
  window = new BrowserWindow({ width: 1360, height: 900, minWidth: 1040, minHeight: 720, title: 'Wipeditt', backgroundColor: '#090909', icon,
    webPreferences: { ...REMOTE_PREFERENCES, preload: join(__dirname, 'preload.cjs') } });
  window.setMenuBarVisibility(false);
  window.on('resize', layout);
  window.on('close', () => { stopLoginWatch(); controller?.stop(); checkpointStorage?.flush(); });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  checkpointStorage = new CheckpointStorage(join(app.getPath('userData'), 'checkpoint-v1.json'));
  browser.adapter = { scheduler: new Scheduler(), account: async () => { throw new Error('Connect Reddit first.'); } };
  controller = new DesktopController({ browser, storage: checkpointStorage, version: app.getVersion(), onState: sendState,
    openDataRequest: async () => { const url = redditURL(DATA_REQUEST_URL); await shell.openExternal(url.href); },
    importExport: async ({ account }) => {
      const result = await dialog.showOpenDialog(window, {
        title: 'Choose comments.csv from your Reddit export',
        defaultPath: app.getPath('downloads'),
        properties: ['openFile'],
        filters: [{ name: 'Reddit comments CSV', extensions: ['csv'] }]
      });
      if (result.canceled || !result.filePaths[0]) return null;
      const file = result.filePaths[0];
      const info = await stat(file);
      if (!info.isFile() || info.size > EXPORT_LIMIT) fail('IMPORT', 'Choose a comments.csv file smaller than 64 MB.');
      const parsed = parseCommentsCSV(await readFile(file, 'utf8'), account.name);
      return { ...parsed, name: basename(file) };
    },
    saveReport: async report => {
      const result = await dialog.showSaveDialog(window, { title: 'Save local Wipeditt report', defaultPath: `wipeditt-${app.getVersion()}-report.json`, filters: [{ name: 'JSON report', extensions: ['json'] }] });
      if (!result.canceled && result.filePath) await writeFile(result.filePath, JSON.stringify(report, null, 2), { mode: 0o600 });
    },
    openOriginal: async value => { const url = redditURL(value); if (!['www.reddit.com', 'old.reddit.com', 'reddit.com'].includes(url.hostname)) throw new Error('Invalid original link.'); await shell.openExternal(url.href); }
  });
  const updates = new UpdateChecker({ version: app.getVersion(), settingsPath: join(app.getPath('userData'), 'updates-v1.json'), onChange: () => controller.emit() });
  controller.updates = updates;
  controller.deletionValidated = DELETION_VALIDATED;
  controller.deletionTesting = !DELETION_VALIDATED && deletionCapability({ packaged: app.isPackaged, developmentFlag: process.env.WIPEDITT_ENABLE_DELETION });
  ipcMain.handle('wipeditt:command', async (event, request) => {
    if (!trustedSender(event, window, appURL)) return { error: { code: 'IPC', message: 'Request origin refused.' } };
    try {
      if (!request || typeof request.name !== 'string' || !request.data || typeof request.data !== 'object') throw new Error('Invalid command.');
      if (request.name === 'read-license') return { data: { license: await readFile(join(__dirname, 'LICENSE'), 'utf8'), notice: await readFile(join(__dirname, 'NOTICE'), 'utf8') } };
      if (request.name === 'open-source') { await shell.openExternal('https://github.com/rafelolv/Wipeditt'); return { data: null }; }
      if (request.name === 'check-updates') return { data: await updates.check({ manual: true }) };
      if (request.name === 'update-settings') { updates.setEnabled(request.data.enabled); return { data: updates.snapshot() }; }
      if (request.name === 'open-update') {
        const release = updates.snapshot().available;
        if (!release) throw new Error('Check for a new version first.');
        await shell.openExternal(release.url); return { data: null };
      }
      const result = await controller.command(request.name, request.data);
      return { data: result ?? null };
    } catch (error) { sendState(controller.snapshot()); return { error: { code: error.code || 'APP', message: error.message || 'Operation failed.' } }; }
  });
  await window.loadFile(join(__dirname, 'index.html'));
  // Development and fixture runs never contact GitHub automatically.
  if (app.isPackaged) {
    void updates.check();
    const timer = setInterval(() => { if (!controller.busy) void updates.check(); }, 3600000);
    timer.unref(); app.on('before-quit', () => clearInterval(timer));
  }
});
