import { AppError, checkAbort, fail, sleep } from '../errors.js';
import { redditPage } from './page.js';
import { REDDIT_CLASSIC, redditURL, contentURL, historyURL } from './policy.js';

export class RedditBrowser {
  simulation = false;
  handlesScheduling = true;
  label = 'Reddit browser session';
  constructor({ contents, scheduler, onBrowser = () => {}, now = Date.now, sleeper = sleep }) {
    Object.assign(this, { contents, scheduler, onBrowser, now, sleeper });
    this.links = new Map();
    this.lastURL = '';
  }
  async navigate(value, signal, { force = false } = {}) {
    checkAbort(signal);
    const url = redditURL(value).href;
    if (!force && this.contents.getURL() === url && !this.contents.isLoadingMainFrame()) return;
    let timer;
    const stop = () => this.contents.stop();
    signal?.addEventListener('abort', stop, { once: true });
    try {
      await Promise.race([
        this.contents.loadURL(url, { extraHeaders: 'Cache-Control: no-cache\r\n' }),
        new Promise((_, reject) => { timer = setTimeout(() => { this.contents.stop(); reject(new AppError('TIMEOUT', 'Reddit page did not finish loading.')); }, 45000); })
      ]);
      checkAbort(signal);
      redditURL(this.contents.getURL());
      this.lastURL = url;
    } catch (error) {
      checkAbort(signal);
      if (error instanceof AppError) throw error;
      throw new AppError('NAVIGATION', 'Reddit page could not be loaded. Open the browser to review the connection.');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', stop); }
  }
  async dom(operation, input = {}) {
    if (this.contents.isDestroyed()) fail('BROWSER_CLOSED', 'Reddit browser closed. Connect again.');
    const url = redditURL(this.contents.getURL());
    if (url.hostname !== 'old.reddit.com') fail('SITE_CHANGED', 'Open your Reddit account in the classic view to continue.');
    // Only this trusted function is evaluated. Arguments are JSON values, never executable page input.
    const code = `(${redditPage.toString()})(${JSON.stringify(operation)},${JSON.stringify(input)})`;
    const result = await this.contents.executeJavaScriptInIsolatedWorld(1001, [{ code }]);
    if (result?.error) throw new AppError(result.error.code, result.error.message, result.error);
    if (!result || !Object.hasOwn(result, 'data')) fail('RESPONSE', 'Browser returned an invalid content snapshot.');
    return result.data;
  }
  register(items = []) {
    for (const item of items) {
      try { this.links.set(item.id, contentURL(item.permalink, item.id)); }
      catch { item.editable = false; }
    }
  }
  connect({ signal } = {}) {
    return this.scheduler.request(async () => {
      this.links.clear();
      await this.navigate(`${REDDIT_CLASSIC}/user/me/overview/`, signal, { force: true });
      this.identity = await this.dom('account');
      return this.identity;
    }, { signal });
  }
  account({ signal } = {}) { return this.scheduler.request(() => this.dom('account'), { signal }); }
  async page({ account, after, type, signal }) {
    const listing = type === 'comment' ? 'comments' : type === 'post' ? 'submitted' : 'overview';
    const url = after ? historyURL(after, account) : `${REDDIT_CLASSIC}/user/${encodeURIComponent(account.name)}/${listing}/?sort=new`;
    const page = await this.scheduler.request(async () => {
      await this.navigate(url, signal);
      const page = await this.dom('listing', { expected: account });
      if (page.after) historyURL(page.after, account);
      for (const item of page.items) {
        if (item.permalink) {
          try { this.links.set(item.id, contentURL(item.permalink, item.id)); } catch { item.editable = false; }
        }
        if (!this.links.has(item.id)) item.editable = false;
      }
      return page;
    }, { signal });
    for (let index = 0; index < page.items.length; index++) {
      const item = page.items[index];
      const missingAuthor = !item.authorId;
      if (this.links.has(item.id) && (missingAuthor || (item.needsBody && item.authorId === account.id))) {
        // Listing metadata is sometimes incomplete. Verify the actual item,
        // rather than infer authorship merely from the account profile URL.
        try { page.items[index] = await this.get(item.id, { signal }); }
        catch (error) {
          if (!['CONTENT_UNAVAILABLE', 'INELIGIBLE'].includes(error.code)) throw error;
          item.editable = false;
        }
      }
    }
    return page;
  }
  async getRaw(id, signal, { fresh = false } = {}) {
    const link = this.links.get(id);
    if (!link) fail('CONTENT_UNAVAILABLE', 'Item has no verified Reddit link. Scan again.');
    await this.navigate(link, signal, { force: fresh });
    let item = await this.dom('get', { id, expected: this.identity });
    if (item.needsBody) {
      await this.dom('expand', { id });
      const deadline = this.now() + 5000;
      while (item.needsBody && this.now() < deadline) { await this.sleeper(250, signal); item = await this.dom('get', { id, expected: this.identity }); }
    }
    return item;
  }
  get(id, { signal } = {}) { return this.scheduler.request(() => this.getRaw(id, signal), { signal }); }
  async edit(id, text, expected, { signal, beforeDispatch } = {}) {
    // Each retry starts with a fresh server-rendered page and verifies current account/author.
    await this.scheduler.request(async () => {
      await this.getRaw(id, signal, { fresh: true });
      await this.dom('prepare-edit', { id, expected });
      await this.sleeper(150, signal);
      beforeDispatch?.();
      await this.dom('submit-edit', { id, text, expected });
      const deadline = this.now() + 30000;
      while (this.now() < deadline) {
        checkAbort(signal);
        let state;
        try { state = await this.dom('edit-status', { id, text, expected }); }
        catch (error) {
          if (['AUTH', 'ACCOUNT_CHANGED', 'OWNERSHIP'].includes(error.code)) throw new AppError('UNCERTAIN', 'Account changed after an edit was submitted. Verify its current state before continuing.', { fatal: true });
          throw error;
        }
        if (state.settled) return { acknowledged: true };
        await this.sleeper(250, signal);
      }
      throw new AppError('UNCERTAIN', 'Reddit did not confirm the edit. Verify the item before trying again.');
    }, { signal, write: true });
    // A fresh navigation is mandatory: hiding an editor is not proof of persisted success.
    let verified;
    try { verified = await this.scheduler.request(() => this.getRaw(id, signal, { fresh: true }), { signal }); }
    catch { throw new AppError('UNCERTAIN', 'The submitted edit could not be verified on a fresh page. Check its current state before continuing.', { fatal: true }); }
    if (verified.text !== text) fail('UNCERTAIN', 'Reddit reloaded different text. The edit outcome is uncertain.');
    return { acknowledged: true };
  }
  delete() { fail('DELETION_UNVERIFIED', 'Deletion is not enabled until the native browser workflow is validated on a real account.'); }
}
