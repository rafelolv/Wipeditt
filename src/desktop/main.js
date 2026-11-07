import { app, BrowserWindow, WebContentsView, ipcMain, session, dialog, shell, nativeImage } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { Scheduler } from '../scheduler.js';
import { RedditBrowser } from './reddit-browser.js';
import { DesktopController } from './controller.js';
import { CheckpointStorage } from './storage.js';
import { REMOTE_PREFERENCES, redditURL, trustedSender, loginNavigation } from './policy.js';

app.setName('Wipeditt');
if (!app.isPackaged && process.env.WIPEDITT_TEST_USER_DATA) app.setPath('userData', process.env.WIPEDITT_TEST_USER_DATA);
const acquired = app.requestSingleInstanceLock();
if (!acquired) app.quit();
let window, redditView, controller, checkpointStorage, activeSession;
let browserVisible = false;
const configuredSessions = new WeakSet();
const appURL = pathToFileURL(join(__dirname, 'index.html')).href;
function layout() {
  if (!window || window.isDestroyed() || !redditView) return;
  const [width, height] = window.getContentSize();
  redditView.setBounds({ x: 272, y: 104, width: Math.max(100, width - 284), height: Math.max(100, height - 116) });
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
    window.contentView.addChildView(redditView);
    browser.adapter = new RedditBrowser({ contents: redditView.webContents, scheduler });
    browserVisible = true; layout();
    await browser.adapter.navigate('https://www.reddit.com/login/');
  },
  async show() { if (!redditView) return browser.open(); browserVisible = true; layout(); },
  hide() { browserVisible = false; layout(); },
  async clear() {
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
app.on('before-quit', () => { controller?.stop(); checkpointStorage?.flush(); });
if (acquired) app.whenReady().then(async () => {
  const icon = nativeImage.createFromPath(join(__dirname, 'icon.png'));
  window = new BrowserWindow({ width: 1280, height: 880, minWidth: 1000, minHeight: 720, title: 'Wipeditt', backgroundColor: '#141c17', icon,
    webPreferences: { ...REMOTE_PREFERENCES, preload: join(__dirname, 'preload.cjs') } });
  window.setMenuBarVisibility(false);
  window.on('resize', layout);
  window.on('close', () => { controller?.stop(); checkpointStorage?.flush(); });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  checkpointStorage = new CheckpointStorage(join(app.getPath('userData'), 'checkpoint-v1.json'));
  browser.adapter = { scheduler: new Scheduler(), account: async () => { throw new Error('Connect Reddit first.'); } };
  controller = new DesktopController({ browser, storage: checkpointStorage, version: app.getVersion(), onState: sendState,
    saveReport: async report => {
      const result = await dialog.showSaveDialog(window, { title: 'Save local Wipeditt report', defaultPath: `wipeditt-${app.getVersion()}-report.json`, filters: [{ name: 'JSON report', extensions: ['json'] }] });
      if (!result.canceled && result.filePath) await writeFile(result.filePath, JSON.stringify(report, null, 2), { mode: 0o600 });
    },
    openOriginal: async value => { const url = redditURL(value); if (!['www.reddit.com', 'old.reddit.com', 'reddit.com'].includes(url.hostname)) throw new Error('Invalid original link.'); await shell.openExternal(url.href); }
  });
  ipcMain.handle('wipeditt:command', async (event, request) => {
    if (!trustedSender(event, window, appURL)) return { error: { code: 'IPC', message: 'Request origin refused.' } };
    try {
      if (!request || typeof request.name !== 'string' || !request.data || typeof request.data !== 'object') throw new Error('Invalid command.');
      const result = await controller.command(request.name, request.data);
      return { data: result ?? null };
    } catch (error) { sendState(controller.snapshot()); return { error: { code: error.code || 'APP', message: error.message || 'Operation failed.' } }; }
  });
  await window.loadFile(join(__dirname, 'index.html'));
});
