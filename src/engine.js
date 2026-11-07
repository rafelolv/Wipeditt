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
      const matched = [];
      let inspected = 0;
      for (const item of Array.isArray(items) ? items : []) {
        inspected++;
        if (!item || !/^t[13]_[a-z0-9]+$/.test(item.id) || seen.has(item.id)) continue;
        seen.add(item.id);
        if (typeof item.text !== 'string' || typeof item.subreddit !== 'string' || typeof item.author !== 'string' || !Number.isFinite(item.created)) continue;
        if (!matches(item)) continue;
        const skip = eligibility(item, account, options.mode);
        matched.push({ ...item, skip, selected: !skip });
        if (options.limit && matched.length >= options.limit) break;
      }
      await this.account(account, signal);
      if (this.revision !== revision) fail('STALE', 'Settings changed during import. Import again.');
      const partial = options.limit && matched.length >= options.limit;
      this.preview = {
        account, options, key: fingerprint(options), created: this.now(), revision, items: matched, source: 'import',
        reason: partial ? 'Import limit reached; preview is partial' : `Imported ${inspected} rows from comments.csv; every item is rechecked before a change`,
        completeHistory: false,
        stats: { inspected, unique: seen.size, matched: matched.length, eligible: matched.filter(item => !item.skip).length }
      };
      return this.preview;
    } finally { this.running = false; }
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
      item.skip = eligibility(item, preview.account, options.mode);
      if (item.skip) item.selected = false;
    }
    preview.stats.eligible = preview.items.filter(item => !item.skip).length;
    return preview;
  }
  select(id, selected) {
    if (this.running) fail('BUSY', 'Selection is locked during an operation.');
    const item = this.preview?.items.find(i => i.id === id);
    if (item && !item.skip) { item.selected = Boolean(selected); this.confirmation = null; }
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
          if (!current || skip) { for (const step of ['anonymize', 'delete']) if (record.steps[step] === 'pending') record.steps[step] = 'skipped'; state('skipped', 'INELIGIBLE'); continue; }
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
          const ambiguous = writeSubmitted && !(error.status >= 400 && error.status < 500) && !['ACCOUNT_CHANGED', 'OWNERSHIP', 'PERMISSION'].includes(error.code);
          if (stage === 'anonymize' && run.mode === 'combined') record.steps.delete = 'skipped';
          const uncertain = error.code === 'UNCERTAIN' || ambiguous;
          record.steps[stage] = uncertain ? 'uncertain' : error.code === 'STOPPED' ? 'skipped' : 'failed';
          state(uncertain ? 'uncertain' : record.steps.anonymize === 'verified' && stage === 'delete' ? 'partial' : error.code === 'STOPPED' ? 'skipped' : 'failed', error.code || 'API');
          if (['STOPPED', 'ACCOUNT_CHANGED', 'AUTH', 'PERMISSION', 'OWNERSHIP', 'STALE'].includes(error.code) || error.fatal) {
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
