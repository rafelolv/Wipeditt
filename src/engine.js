import { checkAbort, fail, sleep } from './errors.js';
import { eligibility, fingerprint, makeMatcher, normalizeOptions } from './filters.js';

export class Engine {
  constructor({ adapter, scheduler, checkpoints, now = Date.now, sleeper = sleep, onEvent = () => {} }) {
    Object.assign(this, { adapter, scheduler, checkpoints, now, sleeper, onEvent });
    this.preview = null;
    this.revision = 0;
    this.running = false;
    this.confirmation = null;
  }
  invalidate() { this.revision++; this.confirmation = null; this.preview = null; }
  async read(task, signal) { checkAbort(signal); return this.adapter.handlesScheduling ? task() : this.scheduler.request(task, { signal }); }
  async account(expected, signal) {
    const current = await this.read(() => this.adapter.account({ signal }), signal);
    if (typeof current?.id !== 'string' || !current.id || typeof current?.name !== 'string' || !current.name) fail('AUTH', 'Account identity unavailable.');
    if (expected && (expected.id !== current.id || expected.name !== current.name)) fail('ACCOUNT_CHANGED', 'Account changed. Scan again.');
    return current;
  }
  async scan(raw, signal) {
    if (this.running) fail('BUSY', 'Another operation is running.');
    this.invalidate();
    const revision = this.revision;
    const options = normalizeOptions(raw);
    const matches = makeMatcher(options);
    this.scheduler.interval = options.interval;
    this.running = true;
    try {
      const account = await this.account(null, signal);
      const items = [], ids = new Set(), cursors = new Set();
      let after = null, inspected = 0, pages = 0, reason = 'Listing exhausted; older history may still be missing';
      outer: do {
        checkAbort(signal);
        const page = await this.read(() => this.adapter.page({ account, after, type: options.type, mode: options.mode, signal }), signal);
        if (!Array.isArray(page?.items)) fail('RESPONSE', 'Invalid listing response.');
        pages++;
        for (const item of page.items) {
          inspected++;
          if (!item || !/^t[13]_[a-z0-9]+$/.test(item.id) || ids.has(item.id)) continue;
          ids.add(item.id);
          if (typeof item.text !== 'string' || typeof item.subreddit !== 'string' || typeof item.author !== 'string' || !Number.isFinite(item.created)) continue;
          if (!matches(item)) continue;
          const skip = eligibility(item, account, options.mode);
          if (!skip) { this.checkpoints?.forgetDeleted?.(item.id); this.checkpoints?.forgetUnavailable?.(item.id); }
          items.push({ ...item, skip, selected: !skip });
          if (options.limit && items.length >= options.limit) { reason = 'Item limit reached; scan is partial'; break outer; }
        }
        this.onEvent({ type: 'scan', inspected, unique: ids.size, matched: items.length });
        after = page.after;
        if (after && cursors.has(after)) { reason = 'Repeated pagination cursor; scan is partial'; break; }
        if (after) cursors.add(after);
        if (pages >= 1000) { reason = 'Page safety limit reached; scan is partial'; break; }
      } while (after);
      await this.account(account, signal);
      if (this.revision !== revision) fail('STALE', 'Settings changed during scan. Scan again.');
      this.preview = { account, options, key: fingerprint(options), created: this.now(), revision, items, reason, completeHistory: false, stats: { inspected, unique: ids.size, matched: items.length, eligible: items.filter(i => !i.skip).length } };
      return this.preview;
    } finally { this.running = false; }
  }
  async import(items, raw, signal) {
    if (this.running) fail('BUSY', 'Another operation is running.');
    this.invalidate();
    const revision = this.revision;
    const options = normalizeOptions(raw);
    const matches = makeMatcher(options);
    this.scheduler.interval = options.interval;
    this.running = true;
    try {
      const account = await this.account(null, signal);
      const seen = new Set();
      const matched = [], deferred = [];
      let inspected = 0, knownDeleted = 0;
      for (const item of Array.isArray(items) ? items : []) {
        inspected++;
        if (!item || !/^t[13]_[a-z0-9]+$/.test(item.id) || seen.has(item.id)) continue;
        seen.add(item.id);
        if (typeof item.text !== 'string' || typeof item.subreddit !== 'string' || typeof item.author !== 'string' || !Number.isFinite(item.created)) continue;
        if (!matches(item)) continue;
        if (this.checkpoints?.wasDeleted?.(item.id, this.adapter.simulation)) { knownDeleted++; continue; }
        if (this.checkpoints?.wasUnavailable?.(item.id, this.adapter.simulation)) { deferred.push(item); continue; }
        const found = this.checkpoints?.wasFound?.(item.id, this.adapter.simulation);
        const skip = eligibility(item, account, options.mode) || (found ? '' : 'Not checked on Reddit yet');
        matched.push({ ...item, skip, selected: false, importStatus: found ? 'previously-found' : 'unchecked' });
        if (options.limit && matched.length >= options.limit) break;
      }
      await this.account(account, signal);
      if (this.revision !== revision) fail('STALE', 'Settings changed during import. Import again.');
      const partial = options.limit && matched.length >= options.limit;
      this.preview = {
        account, options, key: fingerprint(options), created: this.now(), revision, items: matched, source: 'import', deferred,
        reason: partial ? 'Import limit reached; preview is partial' : `Imported ${inspected} rows from comments.csv locally; ${knownDeleted} already deleted; ${deferred.length} unavailable (hidden for up to 6 hours). Only selected originals will be opened`,
        completeHistory: false,
        stats: { inspected, unique: seen.size, matched: matched.length, eligible: matched.filter(item => !item.skip).length }
      };
      return this.preview;
    } finally { this.running = false; }
  }
  includeUnavailable() {
    if (this.running) fail('BUSY', 'Another operation is running.');
    const preview = this.preview;
    if (!preview || preview.source !== 'import' || preview.revision !== this.revision || this.now() - preview.created > 300000) fail('STALE', 'Import your CSV again before reviewing unavailable items.');
    const count = preview.deferred?.length || 0;
    if (!count) return 0;
    this.confirmation = null;
    preview.revision = ++this.revision;
    for (const item of preview.deferred) preview.items.push({ ...item, skip: eligibility(item, preview.account, preview.options.mode) || 'Not checked on Reddit yet', selected: false, importStatus: 'unchecked' });
    preview.deferred = [];
    preview.stats.matched = preview.items.length;
    preview.stats.eligible = preview.items.filter(item => !item.skip).length;
    preview.reason = `${count} previously unavailable item${count === 1 ? '' : 's'} restored, unselected. Select items and review before retrying; absence was not proof of deletion`;
    return count;
  }
  async checkImported(raw, signal, limit = 100) {
    if (this.running) fail('BUSY', 'Another operation is running.');
    const preview = this.preview;
    if (!preview || preview.source !== 'import' || fingerprint(normalizeOptions(raw)) !== preview.key) fail('STALE', 'Import your CSV before checking its originals.');
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) fail('LIMIT', 'Check 1–100 originals at a time.');
    const pending = preview.items.filter(item => item.importStatus === 'unchecked');
    const total = Math.min(limit, pending.length);
    if (!total) fail('EMPTY', 'All CSV originals are checked. Review found items or import again.');
    const started = this.now();
    this.running = true; this.confirmation = null;
    preview.revision = ++this.revision;
    let checked = 0, stopped = false;
    const emit = () => this.onEvent({ type: 'check-import', checked, total, elapsed: this.now() - started, remaining: preview.items.filter(item => item.importStatus === 'unchecked').length });
    emit();
    try {
      await this.account(preview.account, signal);
      const remember = item => {
        item.selected = false;
        if (['found', 'deleted', 'unavailable'].includes(item.importStatus)) this.checkpoints?.rememberObservation?.(item.id, item.importStatus, this.adapter.simulation);
        checked++; emit();
      };
      const apply = (item, current) => {
        if (current && current.id !== item.id) fail('RESPONSE', 'Reddit returned a different original.');
        if (!current || current.deleted) {
          item.importStatus = current?.deleted ? 'deleted' : 'unavailable';
          item.skip = current?.deleted ? 'Already deleted' : 'Original is unavailable; no change submitted';
        } else {
          const skip = eligibility(current, preview.account, preview.options.mode);
          Object.assign(item, current, { imported: true, selected: false, importStatus: skip ? 'checked' : 'found', skip });
        }
        remember(item);
      };
      // A positive profile entry can verify many export IDs in one native page.
      // Missing listing entries remain unknown and require a focused read.
      const targets = new Map(pending.map(item => [item.id, item]));
      for (let pages = 0; !preview.profileDone && checked < total && pages < 10; pages++) {
        checkAbort(signal);
        const page = await this.read(() => this.adapter.page({ account: preview.account, after: preview.checkAfter || null, type: 'comment', mode: preview.options.mode, signal, hydrate: false }), signal);
        if (!Array.isArray(page?.items)) fail('RESPONSE', 'Invalid listing response.');
        for (const current of page.items) {
          const item = targets.get(current?.id);
          if (item?.importStatus === 'unchecked' && checked < total && !eligibility(current, preview.account, preview.options.mode)) apply(item, current);
        }
        preview.checkCursors ||= new Set();
        preview.checkedProfilePages = (preview.checkedProfilePages || 0) + 1;
        preview.profileDone = !page.after || preview.checkCursors.has(page.after) || preview.checkedProfilePages >= 1000;
        if (page.after) preview.checkCursors.add(page.after);
        preview.checkAfter = page.after;
      }
      for (const item of pending) {
        if (checked >= total) break;
        if (item.importStatus !== 'unchecked') continue;
        checkAbort(signal);
        await this.account(preview.account, signal);
        try {
          const current = await this.read(() => this.adapter.get(item.id, { signal }), signal);
          apply(item, current);
        } catch (error) {
          if (error.code !== 'CONTENT_UNAVAILABLE') throw error;
          item.importStatus = 'unavailable'; item.skip = 'Original is unavailable; no change submitted';
          remember(item);
        }
      }
      await this.account(preview.account, signal);
    } catch (error) {
      if (error.code !== 'STOPPED') { this.invalidate(); throw error; }
      stopped = true;
    } finally {
      this.running = false;
      if (this.preview === preview) {
        preview.created = this.now();
        preview.stats.eligible = preview.items.filter(item => !item.skip).length;
        preview.reason = `${checked} originals checked without changes; ${preview.stats.eligible} found candidates; ${preview.items.filter(item => item.importStatus === 'unchecked').length} not checked yet. Select found items and review before changing anything`;
      }
    }
    return { checked, stopped };
  }
  updateOperation(raw) {
    if (this.running) fail('BUSY', 'Operation is running.');
    const preview = this.preview;
    if (!preview) return null;
    const options = normalizeOptions(raw);
    const discovery = value => Object.fromEntries(Object.entries(value).filter(([key]) => !['mode', 'replacement', 'interval', 'deleteDelay'].includes(key)));
    if (fingerprint(discovery(options)) !== fingerprint(discovery(preview.options))) { this.invalidate(); fail('STALE', 'Filters changed. Scan again.'); }
    this.confirmation = null;
    this.revision++;
    preview.revision = this.revision;
    preview.options = options;
    preview.key = fingerprint(options);
    this.scheduler.interval = options.interval;
    for (const item of preview.items) {
      item.skip = eligibility(item, preview.account, options.mode) || (item.importStatus === 'unchecked' ? 'Not checked on Reddit yet' : item.importStatus === 'deleted' ? 'Already deleted' : item.importStatus === 'unavailable' ? 'Original is unavailable; no change submitted' : '');
      if (item.skip) item.selected = false;
    }
    preview.stats.eligible = preview.items.filter(item => !item.skip).length;
    return preview;
  }
  select(id, selected) { this.selectMany([id], selected); }
  selectMany(ids, selected, replace = false) {
    if (this.running) fail('BUSY', 'Selection is locked during an operation.');
    const wanted = new Set(ids);
    for (const item of this.preview?.items || []) {
      if (wanted.has(item.id) && !item.skip) item.selected = Boolean(selected);
      else if (replace) item.selected = false;
    }
    this.confirmation = null;
  }
  validate(raw) {
    const preview = this.preview;
    if (!preview || preview.revision !== this.revision || this.now() - preview.created > 300000 || fingerprint(normalizeOptions(raw)) !== preview.key) fail('STALE', 'Preview expired or settings changed. Scan again.');
    if (!preview.items.some(i => i.selected && !i.skip)) fail('EMPTY', 'Select at least one eligible item.');
    return preview;
  }
  confirmationFor(raw) {
    const preview = this.validate(raw);
    const ids = preview.items.filter(i => i.selected && !i.skip).map(i => i.id);
    this.confirmation = { revision: preview.revision, ids: JSON.stringify(ids), key: preview.key, created: this.now() };
    return { count: ids.length, eligible: preview.stats.eligible, ineligible: preview.stats.matched - preview.stats.eligible, phrase: ids.length > 100 ? (preview.options.mode === 'anonymize' ? 'ANONYMIZE' : 'DELETE') : '', simulation: this.adapter.simulation };
  }
  cancelConfirmation() { this.confirmation = null; }
  async execute(raw, { confirmed = false, phrase = '', signal } = {}) {
    if (this.running) fail('BUSY', 'Another operation is running.');
    const preview = this.validate(raw);
    const selected = preview.items.filter(i => i.selected && !i.skip);
    const confirmation = this.confirmation;
    this.confirmation = null;
    if (!confirmed || !confirmation || confirmation.key !== preview.key || confirmation.revision !== preview.revision || confirmation.ids !== JSON.stringify(selected.map(i => i.id)) || this.now() - confirmation.created > 60000) fail('CONFIRM', 'Explicit current confirmation required.');
    const required = selected.length > 100 ? (preview.options.mode === 'anonymize' ? 'ANONYMIZE' : 'DELETE') : '';
    if (phrase !== required) fail('CONFIRM', 'Confirmation phrase does not match.');
    this.running = true;
    const run = { simulation: this.adapter.simulation, mode: preview.options.mode, source: preview.source || 'live', options: preview.options, started: this.now(), finished: this.now(), stopped: false, records: [] };
    const emit = () => {
      this.checkpoints?.save(run.records, run.simulation);
      this.onEvent({ type: 'progress', records: structuredClone(run.records), total: selected.length, elapsed: this.now() - run.started });
    };
    emit();
    try {
      for (const item of selected) {
        checkAbort(signal);
        const record = { id: item.id, state: 'pending', steps: { anonymize: run.mode === 'delete' ? 'not-requested' : 'pending', delete: run.mode === 'anonymize' ? 'not-requested' : 'pending' } };
        let stage = run.mode === 'delete' ? 'delete' : 'anonymize';
        run.records.push(record);
        const state = (value, code) => { record.state = value; record.code = code; emit(); };
        let writeSubmitted = false;
        try {
          await this.account(preview.account, signal);
          let current = await this.read(() => this.adapter.get(item.id, { signal }), signal);
          const skip = current && eligibility(current, preview.account, run.mode);
          if (!current || skip) {
            for (const step of ['anonymize', 'delete']) if (record.steps[step] === 'pending') record.steps[step] = 'skipped';
            record.reason = !current ? 'Original is unavailable; no change submitted.' : current.deleted ? 'Already deleted.' : skip;
            state('skipped', !current ? 'ORIGINAL_UNAVAILABLE' : current.deleted ? 'ALREADY_DELETED' : 'INELIGIBLE'); continue;
          }
          this.checkpoints?.forgetUnavailable?.(item.id);
          // Identity and ownership reads are scheduled separately; no adapter networking in UI.
          const write = async task => {
            writeSubmitted = false;
            await this.account(preview.account, signal);
            current = await this.read(() => this.adapter.get(item.id, { signal }), signal);
            if (!current || eligibility(current, preview.account, run.mode)) fail('OWNERSHIP', 'Ownership or capability changed.');
            const beforeDispatch = () => {
              checkAbort(signal);
              if (this.preview !== preview || this.revision !== preview.revision) fail('STALE', 'Preview invalidated.');
              writeSubmitted = true;
            };
            if (this.adapter.handlesScheduling) return task(preview.account, { signal, beforeDispatch });
            return this.scheduler.request(async () => { beforeDispatch(); return task(preview.account); }, { signal, write: true });
          };
          if (run.mode !== 'delete') {
            if (current.text !== preview.options.replacement) {
              state('editing');
              await write((expected, settings) => this.adapter.edit(item.id, preview.options.replacement, expected, settings));
            }
            const verified = await this.read(() => this.adapter.get(item.id, { signal }), signal);
            if (!verified || verified.text !== preview.options.replacement) { record.steps.anonymize = 'uncertain'; if (run.mode === 'combined') record.steps.delete = 'skipped'; state('uncertain', 'EDIT_UNVERIFIED'); continue; }
            record.steps.anonymize = 'verified';
            state('anonymized');
            item.text = preview.options.replacement;
            if (run.mode === 'combined') {
              stage = 'delete'; writeSubmitted = false;
              state('waiting');
              const until = this.now() + preview.options.deleteDelay;
              while (this.now() < until) {
                await this.scheduler.gate(signal);
                await this.sleeper(Math.min(250, until - this.now()), signal);
              }
              const again = await this.read(() => this.adapter.get(item.id, { signal }), signal);
              if (!again || again.text !== preview.options.replacement) { record.steps.delete = 'skipped'; state('partial', 'EDIT_CHANGED'); continue; }
            }
          }
          if (run.mode !== 'anonymize') {
            stage = 'delete';
            state('deleting');
            await write((expected, settings) => this.adapter.delete(item.id, expected, run.mode === 'combined' ? preview.options.replacement : undefined, settings));
            const verified = await this.read(() => this.adapter.get(item.id, { signal }), signal);
            if (!verified?.deleted) { record.steps.delete = 'uncertain'; state('uncertain', 'DELETE_UNVERIFIED'); continue; }
            record.steps.delete = 'verified';
            state('deleted');
            item.text = '';
          }
        } catch (error) {
          if (!writeSubmitted && error.code === 'CONTENT_UNAVAILABLE' && record.steps.anonymize !== 'verified') {
            for (const step of ['anonymize', 'delete']) if (record.steps[step] === 'pending') record.steps[step] = 'skipped';
            record.reason = 'Original is unavailable; no change submitted. Absence does not prove deletion.';
            state('skipped', 'ORIGINAL_UNAVAILABLE'); continue;
          }
          const ambiguous = writeSubmitted && !(error.status >= 400 && error.status < 500) && !['ACCOUNT_CHANGED', 'OWNERSHIP', 'PERMISSION'].includes(error.code);
          if (stage === 'anonymize' && run.mode === 'combined') record.steps.delete = 'skipped';
          if (typeof error.reason === 'string' && /^[A-Z_]{1,80}$/.test(error.reason)) record.reason = error.reason;
          const uncertain = error.code === 'UNCERTAIN' || ambiguous;
          record.steps[stage] = uncertain ? 'uncertain' : error.code === 'STOPPED' ? 'skipped' : 'failed';
          state(uncertain ? 'uncertain' : record.steps.anonymize === 'verified' && stage === 'delete' ? 'partial' : error.code === 'STOPPED' ? 'skipped' : 'failed', error.code || 'API');
          if (['STOPPED', 'ACCOUNT_CHANGED', 'AUTH', 'PERMISSION', 'OWNERSHIP', 'STALE', 'SITE_CHANGED', 'BROWSER_CLOSED', 'RESPONSE', 'NETWORK'].includes(error.code) || error.fatal) {
            run.stopped = true;
            break;
          }
        }
      }
    } catch (error) {
      if (error.code !== 'STOPPED') throw error;
      run.stopped = true;
    } finally {
      run.finished = this.now();
      this.running = false;
      this.invalidate();
      this.onEvent({ type: 'done', run });
    }
    return run;
  }
}
