import { AppError, checkAbort, fail, sleep } from '../errors.js';
import { redditPage } from './page.js';
import { REDDIT_CLASSIC, redditURL, contentURL, historyURL } from './policy.js';

// Classic Reddit precomputes at most 1000 entries for each profile ordering.
// The top all-time view is the one that exposes older popular entries; the
// newest view is the chronological baseline. Read both before deciding that a
// short profile is complete. If either reaches the per-ordering boundary, read
// controversial and hot as well. The margin tolerates a few hidden or repeated
// rows without treating every medium-sized profile as capped.
const PROFILE_LISTING_CAP = 1000;
const PROFILE_LISTING_MARGIN = 100;
const PROFILE_REQUIRED_SORTS = 2;
const PROFILE_SORTS = [
  { name: 'top', timed: true },
  { name: 'new', timed: false },
  { name: 'controversial', timed: true },
  { name: 'hot', timed: false }
];

function historyPlan(account, type) {
  const listing = type === 'comment' ? 'comments' : type === 'post' ? 'submitted' : 'overview';
  const root = `${REDDIT_CLASSIC}/user/${encodeURIComponent(account.name)}`;
  const path = type === 'all' ? `${root}/` : `${root}/${listing}/`;
  return {
    seeds: PROFILE_SORTS.map(({ name, timed }) => `${path}?sort=${name}${timed ? '&t=all' : ''}&limit=100`)
  };
}

export class RedditBrowser {
  simulation = false;
  handlesScheduling = true;
  label = 'Reddit browser session';
  constructor({ contents, scheduler, writeTracker = null, deletionEnabled = false, onBrowser = () => {}, now = Date.now, sleeper = sleep }) {
    Object.assign(this, { contents, scheduler, writeTracker, deletionEnabled, onBrowser, now, sleeper });
    this.links = new Map();
    this.emptyDeletionProofs = new Map();
  }
  async navigate(value, signal, { force = false } = {}) {
    checkAbort(signal);
    const url = redditURL(value).href;
    if (!force && !this.needsReload && this.contents.getURL() === url && !this.contents.isLoadingMainFrame()) return;
    let timer, rejectAbort;
    const canceled = new Promise((_, reject) => { rejectAbort = reject; });
    const stop = () => { this.contents.stop(); rejectAbort(new AppError('STOPPED', 'Connection canceled.')); };
    signal?.addEventListener('abort', stop, { once: true });
    try {
      await Promise.race([
        canceled,
        this.contents.loadURL(url, { extraHeaders: 'Cache-Control: no-cache\r\n' }),
        new Promise((_, reject) => { timer = setTimeout(() => { this.contents.stop(); reject(new AppError('TIMEOUT', 'Reddit page did not finish loading.')); }, 45000); })
      ]);
      checkAbort(signal);
      redditURL(this.contents.getURL());
      this.needsReload = false;
    } catch (error) {
      this.needsReload = true;
      checkAbort(signal);
      if (error instanceof AppError) throw error;
      if (['ERR_INTERNET_DISCONNECTED', 'ERR_NETWORK_CHANGED', 'ERR_CONNECTION_RESET', 'ERR_CONNECTION_CLOSED', 'ERR_CONNECTION_TIMED_OUT', 'ERR_NAME_NOT_RESOLVED'].includes(error.code)) throw new AppError('NETWORK', 'Connection interrupted. Waiting to retry a safe read.');
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
      this.emptyDeletionProofs.clear();
      await this.navigate(`${REDDIT_CLASSIC}/user/me/overview/`, signal, { force: true });
      this.identity = await this.dom('account');
      return this.identity;
    }, { signal });
  }
  startHistory(account, type) {
    const plan = historyPlan(account, type);
    this.history = {
      seeds: plan.seeds, index: 0, passRows: 0, seen: new Set(),
      expanded: false, passCursors: new Set()
    };
  }
  nextHistorySeed() {
    const history = this.history;
    if (!history) return null;
    if (history.passRows >= PROFILE_LISTING_CAP - PROFILE_LISTING_MARGIN) history.expanded = true;
    const next = history.index + 1;
    if (next >= history.seeds.length) return null;
    // Top and newest are always read. The remaining orderings are useful when
    // one of those views reached Reddit's per-ordering boundary or a cursor
    // loop prevented a complete pass.
    if (next >= PROFILE_REQUIRED_SORTS && !history.expanded) return null;
    history.index = next;
    history.passRows = 0;
    history.passCursors = new Set();
    return history.seeds[history.index];
  }
  account({ signal } = {}) { return this.scheduler.request(() => this.dom('account'), { signal, local: true }); }
  async page({ account, after, type, mode = 'anonymize', signal }) {
    if (!after) this.startHistory(account, type);
    const history = this.history;
    const url = after ? historyURL(after, account) : history.seeds[0];
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
    history.passRows += page.items.length;
    // Follow each native next link unchanged. An ordering that stops, or that
    // repeats a forward cursor without progress, continues with the next native
    // view so older top/new/controversial/hot entries are not skipped.
    if (!page.after) page.after = this.nextHistorySeed();
    else if (history.passCursors.has(page.after)) {
      // A looping cursor cannot finish this ordering; read the remaining
      // native views instead of ending the scan with a partial pass.
      history.expanded = true;
      page.after = this.nextHistorySeed();
    } else history.passCursors.add(page.after);
    for (let index = 0; index < page.items.length; index++) {
      const item = page.items[index];
      const missingAuthor = !item.authorId;
      // Different orderings can repeat entries. Hydrate an original once per
      // scan; the engine still de-duplicates and counts every inspected row.
      if (!history.seen.has(item.id) && this.links.has(item.id) && (missingAuthor || (item.authorId === account.id && (item.needsBody || mode !== 'anonymize' && !item.deletable)))) {
        // Listing metadata is sometimes incomplete. Verify the actual item,
        // rather than infer authorship merely from the account profile URL.
        try { page.items[index] = await this.get(item.id, { signal }); }
        catch (error) {
          if (!['CONTENT_UNAVAILABLE', 'INELIGIBLE'].includes(error.code)) throw error;
          item.editable = false;
        }
      }
    }
    for (const item of page.items) history.seen.add(item.id);
    return page;
  }
  async getRaw(id, signal, { fresh = false, focused = false, nativeDeleteReceipt = false } = {}) {
    const link = this.links.get(id);
    if (!link) fail('CONTENT_UNAVAILABLE', 'Item has no verified Reddit link. Scan again.');
    const target = new URL(link);
    if (focused) target.searchParams.set('context', '0');
    await this.navigate(target.href, signal, { force: fresh });
    let item = await this.dom('get', { id, expected: this.identity, nativeDeleteReceipt });
    if (item.needsBody) {
      await this.dom('expand', { id });
      const deadline = this.now() + 5000;
      while (item.needsBody && this.now() < deadline) { await this.sleeper(250, signal); item = await this.dom('get', { id, expected: this.identity }); }
    }
    return item;
  }
  currentOriginal(id) {
    if (this.contents.isDestroyed?.()) fail('BROWSER_CLOSED', 'Reddit browser closed. Connect again.');
    if (this.needsReload || !this.contents.getURL || !this.contents.isLoadingMainFrame || this.contents.isLoadingMainFrame()) return false;
    const link = this.links.get(id);
    if (!link) return false;
    const target = new URL(link);
    target.searchParams.set('context', '0');
    return this.contents.getURL() === target.href;
  }
  async get(id, { signal } = {}) {
    const receipt = () => {
      const proof = this.emptyDeletionProofs.get(id);
      const valid = !!proof && proof.account === this.identity?.id && proof.link === this.links.get(id) && this.now() - proof.at < 300000;
      if (!valid) this.emptyDeletionProofs.delete(id);
      return valid;
    };
    // Re-read the live DOM, never a cached item. Recheck the URL inside the
    // serial queue because another queued operation may have navigated first.
    const local = await this.scheduler.request(() => this.currentOriginal(id)
      ? this.dom('get', { id, expected: this.identity, nativeDeleteReceipt: receipt() }) : null, { signal, local: true });
    if (local && !local.needsBody) return local;
    return this.scheduler.request(() => this.getRaw(id, signal, { focused: true, nativeDeleteReceipt: receipt() }), { signal });
  }
  async edit(id, text, expected, { signal, beforeDispatch } = {}) {
    if (!this.writeTracker) fail('EDIT_UNVERIFIED', 'Native request observation is unavailable.');
    // Each retry starts with a fresh server-rendered page and verifies current account/author.
    await this.scheduler.request(async () => {
      await this.dom('prepare-edit', { id, expected });
      await this.sleeper(150, signal);
      const receipt = this.writeTracker.begin();
      try {
        beforeDispatch?.();
        await this.dom('submit-edit', { id, text, expected });
        try { await this.writeTracker.wait(receipt, { signal }); }
        catch (error) {
          if (error.code !== 'UNCERTAIN' || !receipt.seen || receipt.pending?.size !== 0) throw error;
          // A failed transport can still have saved remotely. Read, never resubmit.
        }
      } finally { this.writeTracker.end(receipt); }
      const deadline = this.now() + 5000;
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
      // Some layouts leave stale editor UI after a completed native request.
      // Only the fresh source below decides whether the edit actually saved.
      return { acknowledged: true };
    }, { signal, write: true, before: [() => this.getRaw(id, signal, { fresh: true, focused: true })] });
    // A fresh navigation is mandatory: hiding an editor is not proof of persisted success.
    let verified, reason = 'EDIT_SOURCE_MISMATCH';
    for (let attempt = 0; attempt < 3; attempt++) {
      verified = undefined;
      try { verified = await this.scheduler.request(() => this.getRaw(id, signal, { fresh: true, focused: true }), { signal }); }
      catch (error) {
        reason = 'EDIT_ORIGINAL_UNAVAILABLE';
        if (!['CONTENT_UNAVAILABLE', 'NAVIGATION', 'TIMEOUT'].includes(error.code)) throw new AppError('UNCERTAIN', 'The submitted edit could not be verified. Inspect its original.', { fatal: error.fatal || ['AUTH', 'ACCOUNT_CHANGED', 'OWNERSHIP', 'PERMISSION'].includes(error.code), reason });
      }
      if (verified?.text === text) return { acknowledged: true };
      if (attempt < 2) await this.sleeper(500 * (attempt + 1), signal);
    }
    throw new AppError('UNCERTAIN', 'The saved source could not be verified. No edit will be repeated automatically.', { reason: verified ? 'EDIT_SOURCE_MISMATCH' : reason });
  }
  async delete(id, expected, replacement, { signal, beforeDispatch } = {}) {
    if (!this.deletionEnabled) fail('DELETION_UNVERIFIED', 'Deletion requires independently validated support or the explicit development testing gate.');
    if (!this.writeTracker) fail('DELETION_UNVERIFIED', 'Native request observation is unavailable.');
    this.emptyDeletionProofs.delete(id);
    let nativeDeleteReceipt = false;
    await this.scheduler.request(async () => {
      await this.dom('prepare-delete', { id, expected });
      await this.sleeper(150, signal);
      await this.scheduler.gate(signal);
      const receipt = this.writeTracker.begin();
      try {
        beforeDispatch?.();
        await this.dom('submit-delete', { id, expected, replacement });
        try { await this.writeTracker.wait(receipt, { signal }); nativeDeleteReceipt = true; }
        catch (error) {
          if (error.code !== 'UNCERTAIN' || !receipt.seen || receipt.pending?.size !== 0) throw error;
          // A failed transport can still have saved remotely. Read, never resubmit.
        }
      } finally { this.writeTracker.end(receipt); }
      const deadline = this.now() + 5000;
      while (this.now() < deadline) {
        checkAbort(signal);
        let status;
        try { status = await this.dom('delete-status', { id, expected }); }
        catch (error) {
          if (['AUTH', 'ACCOUNT_CHANGED', 'OWNERSHIP'].includes(error.code)) throw new AppError('UNCERTAIN', 'Account or ownership changed after deletion was submitted. Verify the original.', { fatal: true });
          throw error;
        }
        if (status.settled) return;
        await this.sleeper(250, signal);
      }
      // A stale widget cannot replace independent verification of the original.
      return;
    }, { signal, write: true, before: [async () => {
      const current = await this.getRaw(id, signal, { fresh: true, focused: true });
      if (replacement !== undefined && current.text !== replacement) throw new AppError('EDIT_CHANGED', 'Verified replacement changed. No deletion was sent.', { status: 400 });
    }] });
    let verified, proofReason, emptyReads = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      verified = undefined;
      try { verified = await this.scheduler.request(() => this.getRaw(id, signal, { fresh: true, focused: true, nativeDeleteReceipt }), { signal }); }
      catch (error) {
        proofReason = error.reason || 'DELETE_ORIGINAL_UNAVAILABLE';
        if (!['CONTENT_UNAVAILABLE', 'NAVIGATION', 'TIMEOUT'].includes(error.code)) throw new AppError('UNCERTAIN', 'The submitted deletion could not be verified on its original.', { fatal: error.fatal || ['AUTH', 'ACCOUNT_CHANGED', 'OWNERSHIP', 'PERMISSION'].includes(error.code), reason: 'DELETE_ORIGINAL_UNAVAILABLE' });
      }
      if (verified?.deleted) {
        if (verified.evidence !== 'native-delete-focused-empty-thread') break;
        if (++emptyReads >= 2) {
          this.emptyDeletionProofs.set(id, { account: this.identity?.id, link: this.links.get(id), at: this.now() });
          break;
        }
      } else { emptyReads = 0; if (verified) proofReason = 'DELETE_MARKER_MISSING'; }
      // One empty read is not enough, including when it is the final attempt.
      verified = undefined;
      proofReason ||= 'DELETE_EMPTY_THREAD_UNPROVEN';
      if (attempt < 2) await this.sleeper(500 * (attempt + 1), signal);
    }
    if (!verified?.deleted) throw new AppError('UNCERTAIN', 'The original did not provide enough evidence to verify deletion. No deletion will be repeated automatically.', { reason: proofReason || 'DELETE_ORIGINAL_UNAVAILABLE' });
    return { acknowledged: true };
  }
}
