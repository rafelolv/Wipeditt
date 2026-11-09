import { randomUUID } from 'node:crypto';
import { Engine } from '../engine.js';
import { Scheduler } from '../scheduler.js';
import { Checkpoints } from '../checkpoint.js';
import { normalizeOptions } from '../filters.js';
import { makeReport } from '../report.js';
import { fail } from '../errors.js';

export class DesktopController {
  constructor({ browser, storage, version, onState = () => {}, saveReport = async () => {}, openOriginal = async () => {}, importExport = async () => null, openDataRequest = async () => {} }) {
    Object.assign(this, { browser, version, onState, saveReport, openOriginal, importExport, openDataRequest });
    this.checkpoints = new Checkpoints(storage);
    this.options = normalizeOptions({ type: 'comment' });
    this.updates = null;
    this.deletionValidated = false;
    this.deletionTesting = false;
    this.account = null;
    this.busy = false;
    this.browserVisible = false;
    this.report = null;
    this.lastUncertainOriginal = null;
    this.finished = null;
    this.statusError = false;
    this.awaitingLogin = false;
    this.confirmation = null;
    this.activity = [];
    this.status = 'Connect Reddit to review your history.';
    this.useAdapter(browser.adapter);
    const checkpoint = this.checkpoints.load();
    if (checkpoint) this.log(`${checkpoint.records.length} interrupted item states found. A new scan and review are required; nothing will resume automatically.`);
  }
  useAdapter(adapter) {
    this.scheduler = adapter.scheduler || new Scheduler();
    this.scheduler.onWait = wait => {
      const visible = wait && (wait.reason === 'Paused' || wait.remaining >= 5000) ? wait : null;
      if (this.wait?.reason === visible?.reason && Math.ceil((this.wait?.remaining || 0) / 1000) === Math.ceil((visible?.remaining || 0) / 1000)) return;
      this.wait = visible; this.emit();
    };
    this.engine = new Engine({ adapter, scheduler: this.scheduler, checkpoints: this.checkpoints, onEvent: event => {
      if (event.type === 'scan') this.status = `Scanning · ${event.inspected} inspected · ${event.matched} matching`;
      if (event.type === 'progress') {
        this.progress = { total: event.total, elapsed: event.elapsed, counts: {} };
        for (const record of event.records) this.progress.counts[record.state] = (this.progress.counts[record.state] || 0) + 1;
        const record = event.records.at(-1);
        if (record) this.log(`${record.id}: ${record.state}${record.code ? ` · ${record.code}` : ''}${record.reason ? ` · ${record.reason}` : ''}`, record.state);
      }
      this.emit();
    } });
  }
  log(message, outcome = '') { this.activity.unshift({ at: Date.now(), message, outcome }); this.activity = this.activity.slice(0, 30); }
  snapshot() {
    const preview = this.engine.preview;
    return {
      version: this.version, account: this.account, busy: this.busy,
      browserVisible: this.browserVisible, verifyingLogin: !!this.verifyingAccount, connecting: !!this.connecting, paused: this.scheduler.paused, options: this.options,
      status: this.status, wait: this.busy ? this.wait : null, progress: this.progress,
      activity: this.activity, hasReport: !!this.report,
      deletionValidated: this.deletionValidated, deletionTesting: this.deletionTesting,
      deletionEnabled: this.browser.adapter.deletionEnabled === true,
      statusError: this.statusError, finished: this.finished, updates: this.updates?.snapshot() || null,
      preview: preview ? { items: preview.items, stats: preview.stats, reason: preview.reason, deferredUnavailable: preview.deferred?.length || 0, selected: preview.items.filter(item => item.selected && !item.skip).length, options: preview.options, source: preview.source || 'live', created: preview.created, expiresAt: preview.created + 300000 } : null
    };
  }
  emit() { this.onState(this.snapshot()); }
  invalidate() { this.engine.invalidate(); this.confirmation = null; }
  stop() { this.abort?.abort(); this.scheduler.resume(); this.engine.cancelConfirmation(); this.confirmation = null; this.statusError = false; this.status = 'Stopping. Submitted edits may still finish.'; this.emit(); }
  requireIdle() { if (this.busy) fail('BUSY', 'Wait for the current operation or stop it first.'); }
  async work(action) {
    this.requireIdle(); this.scheduler.resume(); this.busy = true; this.wait = null; this.statusError = false; this.abort = new AbortController();
    this.emit();
    try { return await action(this.abort.signal); }
    catch (error) { this.status = error.message || 'Operation failed.'; this.statusError = true; this.log(error.code || 'ERROR', 'failed'); throw error; }
    finally { this.busy = false; this.wait = null; this.emit(); }
  }
  async command(name, data = {}) {
    if (name === 'state') return this.snapshot();
    if (name === 'stop') { this.stop(); return; }
    if (name === 'pause') { if (this.busy) this.scheduler.pause(); this.emit(); return; }
    if (name === 'resume') { this.scheduler.resume(); this.emit(); return; }
    if (name === 'cancel-confirmation') { this.engine.cancelConfirmation(); this.confirmation = null; return; }
    if (name === 'import-export') return this.work(async signal => {
      if (!this.account) fail('AUTH', 'Connect and verify your Reddit account first.');
      this.browser.hide(); this.browserVisible = false; this.progress = null; this.report = null; this.finished = null;
      this.status = 'Choose comments.csv from your official Reddit export.'; this.emit();
      const imported = await this.importExport({ account: this.account, signal });
      if (!imported) { this.status = 'Import canceled. Nothing changed.'; return; }
      if (!imported.items?.length) fail('IMPORT', 'No comments were found in that file.');
      this.finished = null; this.progress = null; this.activity = [];
      this.options = normalizeOptions({ ...data.options, type: 'comment', limit: 0 });
      if (!this.browser.adapter.deletionEnabled && this.options.mode !== 'anonymize') fail('DELETION_UNVERIFIED', 'Real-account deletion is not enabled.');
      this.browser.adapter.register?.(imported.items);
      this.status = `Reading ${imported.items.length} imported comments…`; this.emit();
      const preview = await this.engine.import(imported.items, this.options, signal);
      this.status = `${preview.stats.matched} imported comments match. ${preview.reason}.`;
      this.log(`Imported ${preview.stats.inspected} rows from a local Reddit export.`);
    });
    if (name === 'open-data-request') { await this.openDataRequest(); return; }
    if (name === 'scan') return this.work(async signal => {
      if (!this.account) fail('AUTH', 'Connect and verify your Reddit account first.');
      this.browser.hide(); this.browserVisible = false; this.progress = null; this.finished = null; this.activity = [];
      this.options = normalizeOptions(data.options);
      if (!this.browser.adapter.deletionEnabled && this.options.mode !== 'anonymize') fail('DELETION_UNVERIFIED', 'Real-account deletion is not enabled.');
      this.status = 'Scanning your Reddit history…';
      const preview = await this.engine.scan(this.options, signal);
      this.status = `${preview.stats.matched} matching items. ${preview.reason}.`;
      this.log('Scan finished. Review selected items before editing.');
    });
    if (name === 'run') return this.work(async signal => {
      if (!this.confirmation || data.token !== this.confirmation) fail('CONFIRM', 'Open a new confirmation before running.');
      this.confirmation = null;
      this.browser.hide(); this.browserVisible = false;
      const reviewed = this.engine.preview;
      this.activity = [];
      this.log(`Processing ${reviewed?.items.filter(item => item.selected && !item.skip).length || 0} selected items only. Unselected originals will not be opened.`);
      const run = await this.engine.execute(this.options, { confirmed: true, phrase: data.phrase || '', signal });
      this.report = makeReport(run, this.version, this.scheduler.stats);
      this.report.integration = 'native-browser';
      const uncertain = this.report.issues.find(issue => issue.state === 'uncertain');
      const original = reviewed?.items.find(item => item.id === uncertain?.id);
      this.lastUncertainOriginal = original?.permalink ? { id: original.id, permalink: original.permalink, accountId: reviewed.account.id } : null;
      this.finished = { mode: run.mode, uncertainId: this.lastUncertainOriginal?.id || null, stopped: run.stopped, counts: this.report.counts, total: run.records.length, elapsedMs: this.report.elapsedMs, anonymized: this.report.stages.filter(record => record.steps?.anonymize === 'verified').length, deleted: this.report.stages.filter(record => record.steps?.delete === 'verified').length };
      this.status = `${run.stopped ? 'Stopped' : 'Finished'} · ${Object.entries(this.report.counts).map(([state, count]) => `${count} ${state}`).join(' · ') || 'No changes'}`;
    });
    this.requireIdle();
    if (name === 'connect') {
      return this.work(async signal => {
        this.invalidate(); this.account = null; this.report = null; this.lastUncertainOriginal = null; this.finished = null; this.activity = [];
        this.awaitingLogin = true;
        this.connecting = true;
        this.browserVisible = true; this.status = 'Opening your isolated Reddit browser…'; this.emit();
        try { await this.browser.open({ remember: data.remember === true, signal }); }
        catch (error) { this.awaitingLogin = false; this.browserVisible = true; await this.browser.show(); throw error; }
        finally { this.connecting = false; this.useAdapter(this.browser.adapter); }
        this.status = 'Sign in on Reddit. Wipeditt will verify the account automatically.';
      });
    } else if (name === 'verify-account') {
      return this.work(async signal => {
        this.invalidate(); this.finished = null; this.report = null; this.lastUncertainOriginal = null;
        this.verifyingAccount = true; this.connecting = true; this.emit();
        try { this.account = await this.browser.adapter.connect({ signal }); }
        catch (error) { this.awaitingLogin = false; this.browserVisible = true; await this.browser.show(); throw error; }
        finally { this.verifyingAccount = false; this.connecting = false; }
        this.awaitingLogin = false;
        this.browser.hide(); this.browserVisible = false;
        this.status = `Connected as u/${this.account.name}. Choose what to scan.`;
      });
    } else if (name === 'show-browser') {
      this.invalidate(); this.finished = null; await this.browser.show(); this.useAdapter(this.browser.adapter); this.browserVisible = true;
      this.awaitingLogin = false;
      this.status = 'Review Reddit in the browser. Verify the account again before a new scan.';
      this.account = null;
    } else if (name === 'hide-browser') {
      this.browser.hide(); this.browserVisible = false;
    } else if (name === 'disconnect') {
      this.invalidate(); await this.browser.clear(); this.account = null; this.browserVisible = false; this.awaitingLogin = false; this.report = null; this.lastUncertainOriginal = null; this.finished = null; this.activity = []; this.progress = null;
      this.checkpoints.clear(); this.status = 'Disconnected. Wipeditt’s Reddit session data was cleared.';
    } else if (name === 'invalidate') {
      this.invalidate(); this.finished = null; this.progress = null; this.status = 'Filters changed. Scan again to update your selection.';
    } else if (name === 'options') {
      const next = normalizeOptions(data.options);
      if (!this.browser.adapter.deletionEnabled && next.mode !== 'anonymize') fail('DELETION_UNVERIFIED', 'Real-account deletion is not enabled.');
      this.options = next;
      this.confirmation = null;
      this.engine.updateOperation(next);
    } else if (name === 'include-unavailable') {
      const count = this.engine.includeUnavailable();
      this.confirmation = null;
      this.status = `${count} previously unavailable item${count === 1 ? '' : 's'} restored, unselected. Review and select before retrying.`;
    } else if (name === 'select') {
      if (!Array.isArray(data.ids) || data.ids.length > 100000 || typeof data.selected !== 'boolean') fail('SELECTION', 'Invalid content selection.');
      if (data.replace !== undefined && typeof data.replace !== 'boolean') fail('SELECTION', 'Invalid content selection.');
      this.engine.selectMany(data.ids, data.selected, data.replace === true);
      this.confirmation = null;
    } else if (name === 'confirm') {
      const confirmation = this.engine.confirmationFor(this.options);
      this.confirmation = randomUUID();
      return { ...confirmation, token: this.confirmation, account: this.account?.name, replacement: this.options.replacement, mode: this.options.mode, eligible: this.engine.preview.stats.eligible, ineligible: this.engine.preview.stats.matched - this.engine.preview.stats.eligible };
    } else if (name === 'export-report') {
      if (!this.report) fail('REPORT', 'Run an operation before exporting its report.');
      await this.saveReport(this.report);
    } else if (name === 'open-original') {
      const previous = this.lastUncertainOriginal;
      const item = this.engine.preview?.items.find(item => item.id === data.id) || (previous && previous.id === data.id && this.account?.id === previous.accountId ? previous : null);
      if (!item) fail('STALE', 'Scan again before opening this item.');
      await this.openOriginal(item.permalink);
    } else if (name === 'clear-checkpoint') {
      this.checkpoints.clear(); this.status = 'Local checkpoint cleared.';
    } else fail('COMMAND', 'Unknown application command.');
    this.statusError = false;
    this.emit();
  }
}
